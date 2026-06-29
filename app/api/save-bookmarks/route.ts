import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/save-bookmarks
 *
 * 接收前端最新书签数组，同步到数据库：
 * 1. 查询 DB 现有 ID，找出前端已移除的书签 → 逐条并发删除
 * 2. 逐条并发更新 sort_order（置顶/排序）
 *
 * Body: { bookmarks: { id: number; sort_order: number }[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bookmarks: { id: number; sort_order: number }[] = body.bookmarks;

    if (!Array.isArray(bookmarks)) {
      return NextResponse.json({ error: 'bookmarks 必须是一个数组' }, { status: 400 });
    }

    if (bookmarks.length === 0) {
      return NextResponse.json({ error: '书签数组不能为空' }, { status: 400 });
    }

    // ── Step 1: 查询数据库现有的所有书签 ID ──
    const existing = await sql`SELECT id FROM bookmarks`;
    const existingRows: { id: number }[] = Array.isArray(existing) ? existing : [];

    // ── Step 2: 找出需要删除的 ID（DB 有但前端没有） ──
    const incomingIds = new Set(bookmarks.map((b) => b.id));
    const idsToDelete: number[] = [];
    for (const row of existingRows) {
      if (row && typeof row.id === 'number' && !incomingIds.has(row.id)) {
        idsToDelete.push(row.id);
      }
    }

    // ── Step 3: 逐条并发删除已移除的书签 ──
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const deleteResults = await Promise.all(
        idsToDelete.map((id) =>
          sql`DELETE FROM bookmarks WHERE id = ${id}`
            .then(() => 1)
            .catch((e: any) => {
              console.error(`[save-bookmarks] 删除 id=${id} 失败:`, e);
              return 0;
            })
        )
      );
      deletedCount = deleteResults.reduce((a, b) => a + b, 0);
    }

    // ── Step 4: 逐条并发更新 sort_order ──
    const updateResults = await Promise.all(
      bookmarks
        .filter((b) => b && typeof b.id === 'number')
        .map((b) =>
          sql`UPDATE bookmarks SET sort_order = ${b.sort_order ?? 0} WHERE id = ${b.id}`
            .then(() => 1)
            .catch((e: any) => {
              console.error(`[save-bookmarks] 更新 id=${b.id} 失败:`, e);
              return 0;
            })
        )
    );
    const updatedCount = updateResults.reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      synced: updatedCount,
      deleted: deletedCount,
    });
  } catch (err: any) {
    console.error('[save-bookmarks] error:', err);
    return NextResponse.json({ error: err.message || '同步失败' }, { status: 500 });
  }
}
