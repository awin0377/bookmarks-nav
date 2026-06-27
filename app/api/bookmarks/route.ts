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
    const { url, title, category_name } = body;

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

    const result = await sql`
      INSERT INTO bookmarks (url, title, domain, category_id)
      VALUES (${url}, ${title}, ${domain}, ${categoryId})
      ON CONFLICT (url) DO UPDATE SET title = ${title}, domain = ${domain}, category_id = COALESCE(${categoryId}, bookmarks.category_id)
      RETURNING id, url, title, domain, category_id, created_at;
    `;

    return NextResponse.json({ bookmark: result[0], action: result[0].created_at ? 'created' : 'updated' });
  } catch (err: any) {
    console.error('POST bookmark error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
