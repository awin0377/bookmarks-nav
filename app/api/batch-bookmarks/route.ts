// app/api/batch-bookmarks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/batch-bookmarks
 *
 * 批量操作书签：
 * - action=delete: { ids: number[] } → 删除
 * - action=move:   { ids: number[], category_name: string } → 移动分类
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ids, category_name } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 必须是非空数组' }, { status: 400 });
    }

    if (action === 'delete') {
      const results = await Promise.all(
        ids.map((id: number) =>
          sql`DELETE FROM bookmarks WHERE id = ${id}`
            .then(() => 1)
            .catch((e: any) => { console.error(`batch-delete id=${id}:`, e); return 0; })
        )
      );
      const deleted = results.reduce((a: number, b: number) => a + b, 0);
      return NextResponse.json({ success: true, deleted });
    }

    if (action === 'move') {
      if (!category_name || !category_name.trim()) {
        return NextResponse.json({ error: 'category_name 不能为空' }, { status: 400 });
      }

      // 确保目标分类存在
      const catRows = await sql`SELECT id FROM categories WHERE name = ${category_name.trim()}`;
      if (!catRows || catRows.length === 0) {
        return NextResponse.json({ error: `分类「${category_name}」不存在` }, { status: 400 });
      }
      const catId = catRows[0].id;

      const results = await Promise.all(
        ids.map((id: number) =>
          sql`UPDATE bookmarks SET category_id = ${catId}, category_name = ${category_name.trim()} WHERE id = ${id}`
            .then(() => 1)
            .catch((e: any) => { console.error(`batch-move id=${id}:`, e); return 0; })
        )
      );
      const moved = results.reduce((a: number, b: number) => a + b, 0);
      return NextResponse.json({ success: true, moved });
    }

    return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[batch-bookmarks] error:', err);
    return NextResponse.json({ error: err.message || '批量操作失败' }, { status: 500 });
  }
}
