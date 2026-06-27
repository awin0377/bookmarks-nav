// app/api/clicks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { bookmark_id } = await req.json();
    if (!bookmark_id) {
      return NextResponse.json({ error: 'bookmark_id required' }, { status: 400 });
    }
    await sql`INSERT INTO clicks (bookmark_id) VALUES (${bookmark_id});`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const recent = await sql`
      SELECT b.*, c.name as category_name, COUNT(cl.id)::int as click_count, MAX(cl.clicked_at) as last_clicked
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN clicks cl ON b.id = cl.bookmark_id
      WHERE b.is_dead = false
      GROUP BY b.id, c.name
      ORDER BY last_clicked DESC NULLS LAST
      LIMIT ${limit};
    `;
    return NextResponse.json({ recent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
