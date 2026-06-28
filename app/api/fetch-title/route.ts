// app/api/fetch-title/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // Fetch the page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return NextResponse.json({ error: `HTTP ${response.status}` }, { status: 200 });
    }

    const html = await response.text();

    // Extract <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : '';

    // Clean up common suffixes
    title = title
      .replace(/\s*[-–|]\s*[^-–|\n]*$/, '') // Remove " - Site Name"
      .replace(/\s+/g, ' ')
      .trim();

    if (!title) {
      title = parsedUrl.hostname.replace(/^www\./, '');
    }

    // Extract domain
    const domain = parsedUrl.hostname.replace(/^www\./, '');

    return NextResponse.json({ title, domain });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: '请求超时' }, { status: 200 });
    }
    console.error('fetch-title error:', err);
    return NextResponse.json({ error: err.message || '抓取失败' }, { status: 200 });
  }
}
