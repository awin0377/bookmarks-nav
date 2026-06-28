// app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

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

// POST — 创建自定义分类
export async function POST(req: NextRequest) {
  try {
    const { name, icon } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
    }

    // 检查是否已存在
    const existing = await sql`SELECT id FROM categories WHERE name = ${name.trim()}`;
    if (existing.length > 0) {
      return NextResponse.json({ category: existing[0], action: 'exists' });
    }

    // 获取最大 sort_order
    const maxSort = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM categories`;
    const sortOrder = Number(maxSort[0]?.next || 1);

    const result = await sql`
      INSERT INTO categories (name, icon, sort_order)
      VALUES (${name.trim()}, ${icon || ''}, ${sortOrder})
      RETURNING *;
    `;

    return NextResponse.json({ category: result[0], action: 'created' });
  } catch (err: any) {
    console.error('POST category error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
