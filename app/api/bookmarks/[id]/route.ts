import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

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
