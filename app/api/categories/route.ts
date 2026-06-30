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

// PUT — 更新分类（含排序）
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    }

    if (sort_order !== undefined) {
      // Update sort_order only
      await sql`UPDATE categories SET sort_order = ${sort_order} WHERE id = ${id}`;
      return NextResponse.json({ success: true, id, sort_order });
    }

    if (name !== undefined) {
      await sql`UPDATE categories SET name = ${name} WHERE id = ${id}`;
      return NextResponse.json({ success: true, id, name });
    }

    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — 批量重排分类顺序
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { reorder } = body;
    if (!reorder || !Array.isArray(reorder)) {
      return NextResponse.json({ error: 'reorder 数组必填' }, { status: 400 });
    }
    for (const item of reorder) {
      await sql`UPDATE categories SET sort_order = ${item.sort_order} WHERE id = ${item.id}`;
    }
    return NextResponse.json({ success: true, reordered: reorder.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — 删除分类
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    }
    // Unlink bookmarks first
    await sql`UPDATE bookmarks SET category_id = NULL WHERE category_id = ${id}`;
    const result = await sql`DELETE FROM categories WHERE id = ${id} RETURNING *`;
    if (result.length === 0) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }
    return NextResponse.json({ deleted: result[0] });
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
