import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/bookmarks/[id] — 更新书签
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

    // Build SET clauses
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.title !== undefined) {
      setClauses.push(`title = $${idx++}`);
      values.push(body.title);
    }
    if (body.url !== undefined) {
      setClauses.push(`url = $${idx++}`);
      values.push(body.url);
      let domain = '';
      try { domain = new URL(body.url).hostname.replace(/^www\./, ''); } catch {}
      setClauses.push(`domain = $${idx++}`);
      values.push(domain);
    }
    if (body.summary !== undefined) {
      setClauses.push(`summary = $${idx++}`);
      values.push(body.summary);
    }
    if (body.category_id !== undefined) {
      setClauses.push(`category_id = $${idx++}`);
      values.push(body.category_id);
    }
    if (body.is_featured !== undefined) {
      setClauses.push(`is_featured = $${idx++}`);
      values.push(body.is_featured);
      // Auto-set sort_order for featured
      if (body.is_featured) {
        setClauses.push(`sort_order = COALESCE((SELECT COALESCE(MAX(sort_order), 0) + 1 FROM bookmarks WHERE is_featured = true AND id != ${id}), 1)`);
      } else {
        setClauses.push(`sort_order = 0`);
      }
    }
    if (body.sort_order !== undefined) {
      setClauses.push(`sort_order = $${idx++}`);
      values.push(body.sort_order);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE bookmarks SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    
    // Use raw query via the serverless driver's query method
    const { neon } = await import('@neondatabase/serverless');
    const driver = neon(process.env.DATABASE_URL!);
    const result: any = await driver(query, values);

    const rows = Array.isArray(result) ? result : (result?.rows || []);
    if (rows.length === 0) {
      return NextResponse.json({ error: '书签不存在' }, { status: 404 });
    }
    return NextResponse.json({ bookmark: rows[0] });
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
