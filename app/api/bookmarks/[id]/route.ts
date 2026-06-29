import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/bookmarks/[id] — 更新书签字段
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效 ID' }, { status: 400 });
    }

    const body = await req.json();

    // 先取出当前记录，作为未传入字段的默认值
    const existing = await sql`SELECT * FROM bookmarks WHERE id = ${id}`;
    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: '书签不存在' }, { status: 404 });
    }
    const cur = existing[0];

    // 用 tagged template 一次性更新，未传入字段沿用当前值
    const result = await sql`
      UPDATE bookmarks SET
        summary      = ${body.summary !== undefined ? body.summary : cur.summary},
        description  = ${body.description !== undefined ? body.description : cur.description},
        tags         = ${body.tags !== undefined ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : cur.tags},
        features     = ${body.features !== undefined ? (typeof body.features === 'string' ? body.features : JSON.stringify(body.features)) : cur.features},
        title        = ${body.title !== undefined ? body.title : cur.title},
        sort_order   = ${body.sort_order !== undefined ? body.sort_order : cur.sort_order}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ bookmark: result[0] });
  } catch (err: any) {
    console.error('PATCH bookmark error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/bookmarks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效 ID' }, { status: 400 });
    }

    const result = await sql`DELETE FROM bookmarks WHERE id = ${id} RETURNING id, title`;

    if (result.length === 0) {
      return NextResponse.json({ error: '书签不存在' }, { status: 404 });
    }

    return NextResponse.json({ deleted: result[0] });
  } catch (err: any) {
    console.error('DELETE bookmark error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
