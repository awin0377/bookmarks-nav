// app/api/bookmarks/reorder/route.ts — 批量排序常用书签
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// PUT — 接收 id 数组，按顺序设置 sort_order
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids } = body; // number[] — 按新顺序排列的 bookmark id 列表

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 必须是长度 > 0 的数组' }, { status: 400 });
    }

    // 批量更新 sort_order
    for (let i = 0; i < ids.length; i++) {
      await sql`UPDATE bookmarks SET sort_order = ${i + 1} WHERE id = ${ids[i]}`;
    }

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err: any) {
    console.error('Reorder error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
