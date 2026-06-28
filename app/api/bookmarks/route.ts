// app/api/bookmarks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const cat = searchParams.get('cat') || '';
    const sort = searchParams.get('sort') || 'newest';
    const limit = parseInt(searchParams.get('limit') || '2000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const featured = searchParams.get('featured') === 'true';

    // 常用书签：只返回标记的，按 sort_order 排序
    if (featured) {
      const rows = await sql`
        SELECT b.*, c.name as category_name, c.icon as category_icon
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE b.is_featured = true AND b.is_dead = false
        ORDER BY b.sort_order ASC, b.created_at DESC
      `;
      return NextResponse.json({ bookmarks: rows, total: rows.length });
    }

    let query: any;
    let countQuery: any;

    if (q) {
      const like = `%${q}%`;
      if (cat) {
        query = sql`
          SELECT b.*, c.name as category_name, c.icon as category_icon
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE (b.title ILIKE ${like} OR b.url ILIKE ${like} OR b.domain ILIKE ${like})
            AND c.name = ${cat}
          ORDER BY ${sort === 'recent' ? sql`is_dead ASC, created_at DESC` : sort === 'name' ? sql`b.title ASC` : sql`is_dead ASC, created_at DESC`}
          LIMIT ${limit} OFFSET ${offset};
        `;
        countQuery = sql`
          SELECT COUNT(*) FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE (b.title ILIKE ${like} OR b.url ILIKE ${like} OR b.domain ILIKE ${like})
            AND c.name = ${cat};
        `;
      } else {
        query = sql`
          SELECT b.*, c.name as category_name, c.icon as category_icon
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE b.title ILIKE ${like} OR b.url ILIKE ${like} OR b.domain ILIKE ${like}
          ORDER BY ${sort === 'recent' ? sql`is_dead ASC, created_at DESC` : sort === 'name' ? sql`b.title ASC` : sql`is_dead ASC, created_at DESC`}
          LIMIT ${limit} OFFSET ${offset};
        `;
      }
    } else {
      if (cat) {
        query = sql`
          SELECT b.*, c.name as category_name, c.icon as category_icon
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          WHERE c.name = ${cat}
          ORDER BY ${sort === 'recent' ? sql`is_dead ASC, created_at DESC` : sort === 'name' ? sql`b.title ASC` : sql`is_dead ASC, created_at DESC`}
          LIMIT ${limit} OFFSET ${offset};
        `;
      } else {
        query = sql`
          SELECT b.*, c.name as category_name, c.icon as category_icon
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          ORDER BY ${sort === 'recent' ? sql`is_dead ASC, created_at DESC` : sort === 'name' ? sql`b.title ASC` : sql`is_dead ASC, created_at DESC`}
          LIMIT ${limit} OFFSET ${offset};
        `;
      }
    }

    const rows = await query;

    // Get total count
    const totalResult = await sql`SELECT COUNT(*) as cnt FROM bookmarks;`;
    const total = Number(totalResult[0]?.cnt || 0);

    return NextResponse.json({ bookmarks: rows, total });
  } catch (err: any) {
    console.error('API bookmarks error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — 新增书签
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, title, category_name, is_featured, sort_order, summary: inputSummary } = body;

    if (!url || !title) {
      return NextResponse.json({ error: 'url 和 title 必填' }, { status: 400 });
    }

    // Extract domain
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { }

    // Find or get category_id
    let categoryId: number | null = null;
    if (category_name) {
      const catRows = await sql`SELECT id FROM categories WHERE name = ${category_name}`;
      if (catRows.length > 0) {
        categoryId = catRows[0].id;
      }
    }

    // Auto-calculate sort_order for featured bookmarks
    let finalSortOrder = sort_order ?? 0;
    if (is_featured && !sort_order) {
      const maxSort = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM bookmarks WHERE is_featured = true`;
      finalSortOrder = Number(maxSort[0]?.next_order || 1);
    }

    // Use provided summary or auto-generate via DeepSeek
    let summary = inputSummary || null;
    const shouldAutoSummarize = !summary && process.env.DEEPSEEK_API_KEY;

    const result = await sql`
      INSERT INTO bookmarks (url, title, domain, category_id, is_featured, sort_order, summary)
      VALUES (${url}, ${title}, ${domain}, ${categoryId}, ${is_featured || false}, ${finalSortOrder}, ${summary || ''})
      ON CONFLICT (url) DO UPDATE SET
        title = ${title},
        domain = ${domain},
        category_id = COALESCE(${categoryId}, bookmarks.category_id),
        is_featured = COALESCE(${is_featured}, bookmarks.is_featured, false),
        sort_order = CASE WHEN ${is_featured || false} = true THEN ${finalSortOrder} ELSE bookmarks.sort_order END,
        summary = COALESCE(${summary}, bookmarks.summary, '')
      RETURNING id, url, title, domain, summary, category_id, is_featured, sort_order, created_at;
    `;

    const bookmark = result[0];

    // 异步生成 AI 描述（不阻塞响应）
    if (shouldAutoSummarize) {
      generateAndSaveSummary(bookmark.id, url, title).catch(e =>
        console.error('Auto-summary failed:', e)
      );
    }

    return NextResponse.json({
      bookmark,
      action: bookmark.created_at ? 'created' : 'updated',
      summaryPending: shouldAutoSummarize,
    });
  } catch (err: any) {
    console.error('POST bookmark error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 后台异步生成 AI 描述并写入数据库
async function generateAndSaveSummary(id: number, url: string, title: string) {
  const { chat, isAvailable } = await import('@/lib/ai');
  if (!isAvailable()) return;

  const text = await chat(
    [
      {
        role: 'system',
        content: '你是一个网站描述生成器。根据网站 URL 和标题，用中文生成一句精炼的描述（15字以内），说明这个网站是做什么用的。只输出描述文本，不要引号、不要前缀、不要其他内容。如果不确定，输出空字符串。',
      },
      { role: 'user', content: `URL: ${url}\n标题: ${title || '未知'}` },
    ],
    { temperature: 0.1, max_tokens: 80 }
  );

  if (text) {
    await sql`UPDATE bookmarks SET summary = ${text.trim()} WHERE id = ${id}`;
  }
}
