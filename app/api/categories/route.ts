// app/api/categories/route.ts
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    const categories = await sql`
      SELECT c.*, COUNT(b.id)::int as bookmark_count
      FROM categories c
      LEFT JOIN bookmarks b ON c.id = b.category_id AND b.is_dead = false
      GROUP BY c.id
      ORDER BY c.sort_order ASC;
    `;
    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
