// app/api/categories/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/categories/reorder
 * Body: { ids: number[] } — 按新顺序排列的分类 ID 列表
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 必须是非空数组' }, { status: 400 });
    }

    // 逐条并发更新 sort_order
    const results = await Promise.all(
      ids.map((id: number, index: number) =>
        sql`UPDATE categories SET sort_order = ${index} WHERE id = ${id}`
          .then(() => 1)
          .catch((e: any) => { console.error(`reorder cat id=${id}:`, e); return 0; })
      )
    );

    const updated = results.reduce((a: number, b: number) => a + b, 0);
    return NextResponse.json({ success: true, updated });
  } catch (err: any) {
    console.error('[categories/reorder] error:', err);
    return NextResponse.json({ error: err.message || '排序失败' }, { status: 500 });
  }
}
