import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/bookmarks/[id] — 更新书签字段（summary, description, tags, features, title, url）
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

    // Build parameterized SET clause
    const setParts: string[] = [];
    const values: any[] = [];

    if (body.summary !== undefined) { setParts.push(`summary = $${values.length + 1}`); values.push(body.summary); }
    if (body.description !== undefined) { setParts.push(`description = $${values.length + 1}`); values.push(body.description); }
    if (body.tags !== undefined) {
      const t = typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags);
      setParts.push(`tags = $${values.length + 1}`); values.push(t);
    }
    if (body.features !== undefined) {
      const f = typeof body.features === 'string' ? body.features : JSON.stringify(body.features);
      setParts.push(`features = $${values.length + 1}`); values.push(f);
    }
    if (body.title !== undefined) { setParts.push(`title = $${values.length + 1}`); values.push(body.title); }
    if (body.sort_order !== undefined) { setParts.push(`sort_order = $${values.length + 1}`); values.push(body.sort_order); }

    if (setParts.length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
    }

    const setClause = setParts.join(', ');
    const queryStr = `UPDATE bookmarks SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;
    values.push(id);

    const result = await sql(queryStr, values);

    if (result.length === 0) {
      return NextResponse.json({ error: '书签不存在' }, { status: 404 });
    }
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
