import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/save-bookmarks
 *
 * 接收前端最新书签数组，同步到数据库：
 * 1. 删除数据库中存在但前端数组中已移除的书签（代表用户在前端执行了删除操作）
 * 2. 批量更新剩余书签的 sort_order（代表用户在前端执行了置顶/排序操作）
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

    // 提取前端传来的 ID 集合
    const incomingIds = new Set(bookmarks.map((b) => b.id));

    // ── Step 1: 查询数据库现有的所有书签 ID ──
    const existing = await sql`SELECT id FROM bookmarks`;
    const existingRows = existing as { id: number }[];

    // ── Step 2: 找出需要删除的 ID（DB 有但前端没有） ──
    const idsToDelete: number[] = [];
    for (const row of existingRows) {
      if (!incomingIds.has(row.id)) {
        idsToDelete.push(row.id);
      }
    }

    // ── Step 3: 删除已移除的书签 ──
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      // 分批删除，每批最多 500 条，避免 SQL 过长
      const batchSize = 500;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
        await sql(`DELETE FROM bookmarks WHERE id IN (${placeholders})`, batch);
        deletedCount += batch.length;
      }
    }

    // ── Step 4: 批量更新 sort_order ──
    let updatedCount = 0;
    if (bookmarks.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = bookmarks.slice(i, i + batchSize);

        const params: any[] = [];
        const whenClauses: string[] = [];

        batch.forEach((b, idx) => {
          const idParamIdx = idx * 2 + 1;
          const orderParamIdx = idx * 2 + 2;
          whenClauses.push(`WHEN $${idParamIdx} THEN $${orderParamIdx}::integer`);
          params.push(b.id, b.sort_order);
        });

        const idPlaceholders = batch.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        const allParams = [...params, ...batch.map((b) => b.id)];

        const query = `
          UPDATE bookmarks
          SET sort_order = CASE id ${whenClauses.join(' ')} END
          WHERE id IN (${idPlaceholders})
        `;

        await sql(query, allParams);
        updatedCount += batch.length;
      }
    }

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
