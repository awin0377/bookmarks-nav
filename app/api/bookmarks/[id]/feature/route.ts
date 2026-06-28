// app/api/bookmarks/[id]/feature/route.ts — 切换常用标记
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    // 切换 is_featured 状态，同时设置 sort_order 为最大+1（新标记的放最后）
    const result = await sql`
      UPDATE bookmarks
      SET is_featured = NOT is_featured,
          sort_order = CASE
            WHEN is_featured THEN 0
            ELSE (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM bookmarks WHERE is_featured = true)
          END
      WHERE id = ${id}
      RETURNING id, title, is_featured, sort_order;
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    return NextResponse.json({ bookmark: result[0] });
  } catch (err: any) {
    console.error('Feature toggle error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
