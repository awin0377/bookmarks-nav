import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: max 60s for serverless function

// GET /api/cron/check-links — 定时死链检测
// 每次检测 50 条，轮询所有书签
// 被 middleware 的 CRON_SECRET 保护
export async function GET() {
  const startTime = Date.now();

  try {
    // Get a batch of 50 bookmarks to check (rotate based on last_checked)
    const batch = await sql`
      SELECT id, url
      FROM bookmarks
      WHERE is_dead = false
      ORDER BY COALESCE(last_checked, '1970-01-01') ASC, id ASC
      LIMIT 50
    `;

    const bookmarks = batch as any[];
    if (bookmarks.length === 0) {
      return NextResponse.json({ message: 'No bookmarks to check', checked: 0 });
    }

    let deadCount = 0;
    let aliveCount = 0;
    const results: { id: number; url: string; status: string }[] = [];

    // Check each URL (sequential to avoid overwhelming)
    for (const b of bookmarks) {
      const status = await checkUrl(b.url);

      if (status === 'dead') {
        await sql`UPDATE bookmarks SET is_dead = true, last_checked = NOW() WHERE id = ${b.id}`;
        deadCount++;
      } else {
        await sql`UPDATE bookmarks SET last_checked = NOW() WHERE id = ${b.id}`;
        aliveCount++;
      }

      results.push({ id: b.id, url: b.url, status });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      checked: bookmarks.length,
      alive: aliveCount,
      dead: deadCount,
      elapsed_seconds: elapsed,
      sample: results.slice(0, 5),
    });
  } catch (err: any) {
    console.error('Cron check-links error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function checkUrl(url: string): Promise<'alive' | 'dead'> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkChecker/1.0)' },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    // 200-399 = alive, 400-499 (except 429) = dead, 500+ = might be temporary, treat as alive
    if (res.status >= 200 && res.status < 400) return 'alive';
    if (res.status === 429 || res.status >= 500) return 'alive'; // Don't mark as dead for server errors
    return 'dead'; // 400-428 = dead
  } catch {
    // Network error, DNS failure, timeout — could be temporary
    // Do a second attempt with HEAD
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (res.status >= 200 && res.status < 400) return 'alive';
      if (res.status === 429 || res.status >= 500) return 'alive';
      return 'dead';
    } catch {
      return 'dead';
    }
  }
}
