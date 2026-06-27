import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { chat, isAvailable } from '@/lib/ai';

export const dynamic = 'force-dynamic';

// POST /api/import — AI 自动导入书签
// 输入: { url: "https://..." }
// 流程: 抓取网页标题 → AI 判断分类 → AI 生成描述 → 写入 DB
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url 必填' }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    let domain = '';
    try { domain = new URL(normalizedUrl).hostname.replace(/^www\./, ''); } catch { }

    // ── Step 1: Fetch page title ──
    let title = '';
    let description = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        // Extract <title>
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim().slice(0, 200);

        // Extract meta description
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)
          || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i);
        if (descMatch) description = descMatch[1].trim().slice(0, 300);
      }
    } catch {
      // Can't fetch — continue with empty title
    }

    if (!title) title = domain || normalizedUrl;

    // ── Step 2: AI classify + summarize ──
    let categoryName = '';
    let summary = '';

    if (isAvailable()) {
      // Get category list
      const cats = await sql`SELECT name FROM categories ORDER BY sort_order`;
      const catNames = (cats as any[]).map(c => c.name);

      const aiResult = await chat([
        {
          role: 'system',
          content: `你是一个书签分类助手。根据用户提供的网站信息，判断它最适合以下哪个分类，并生成一句话中文描述。

分类列表: ${catNames.join('、')}

请返回 JSON 格式:
{"category": "分类名称（必须从列表中选）", "summary": "一句话中文描述这个网站是做什么的"}

注意: summary 不要超过 30 个字。`
        },
        {
          role: 'user',
          content: `URL: ${normalizedUrl}\n标题: ${title}\n域名: ${domain}${description ? `\n网页描述: ${description}` : ''}`
        }
      ], { temperature: 0.3, max_tokens: 200, json: true });

      if (aiResult) {
        try {
          const parsed = JSON.parse(aiResult);
          if (parsed.category && catNames.includes(parsed.category)) {
            categoryName = parsed.category;
          }
          if (parsed.summary) {
            summary = parsed.summary.slice(0, 100);
          }
        } catch { /* JSON parse failed, continue */ }
      }
    }

    // ── Step 3: Save to DB ──
    let categoryId: number | null = null;
    if (categoryName) {
      const catRows = await sql`SELECT id FROM categories WHERE name = ${categoryName}`;
      if ((catRows as any[]).length > 0) {
        categoryId = (catRows as any[])[0].id;
      }
    }

    const result = await sql`
      INSERT INTO bookmarks (url, title, domain, category_id, summary)
      VALUES (${normalizedUrl}, ${title}, ${domain}, ${categoryId}, ${summary})
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        domain = EXCLUDED.domain,
        category_id = COALESCE(EXCLUDED.category_id, bookmarks.category_id),
        summary = EXCLUDED.summary
      RETURNING id, url, title, domain, category_id, summary;
    `;

    // Get category name for response
    if (categoryId) {
      const catRow = await sql`SELECT name FROM categories WHERE id = ${categoryId}`;
      categoryName = (catRow as any[])[0]?.name || categoryName;
    }

    return NextResponse.json({
      bookmark: {
        ...(result as any[])[0],
        category_name: categoryName,
      },
      auto: { title_fetched: !!title, ai_classified: !!categoryName, ai_summarized: !!summary },
    });
  } catch (err: any) {
    console.error('Import error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
