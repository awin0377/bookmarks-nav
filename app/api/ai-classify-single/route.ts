import { NextRequest, NextResponse } from 'next/server';
import { chat, isAvailable } from '@/lib/ai';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai-classify-single
 *
 * 单条书签 AI 清洗：
 * 1. 接收 { id, title, description }
 * 2. 调 DeepSeek 生成 category / 3 tags / ≤100字 seo_description
 * 3. 校验 category 与 DB 分类匹配
 * 4. 写回 Neon 数据库对应 bookmark 记录
 *
 * Body:   { id: number; title: string; description?: string }
 * Returns: { success: true; bookmark: { id, category_name, tags, description } } | { error }
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Check API key ──
    if (!isAvailable()) {
      return NextResponse.json(
        { error: 'DeepSeek API 未配置（请设置 DEEPSEEK_API_KEY 环境变量）' },
        { status: 503 }
      );
    }

    // ── 2. Parse input ──
    const body = await req.json();
    const { id, title, description } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: '缺少有效的 id 字段' }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: '缺少 title 字段' }, { status: 400 });
    }

    // ── 3. Verify bookmark exists ──
    const [existing] = await sql`
      SELECT id, title, category_name FROM bookmarks WHERE id = ${id}
    ` as any[];
    if (!existing) {
      return NextResponse.json({ error: `书签 id=${id} 不存在` }, { status: 404 });
    }

    // ── 4. Fetch all categories from DB ──
    const categories = await sql`
      SELECT id, name FROM categories ORDER BY sort_order ASC
    ` as { id: number; name: string }[];

    if (categories.length === 0) {
      return NextResponse.json({ error: '数据库中暂无分类' }, { status: 400 });
    }

    const categoryNames = categories.map((c) => c.name);

    // ── 5. Build prompts ──
    const systemPrompt = buildSystemPrompt(categoryNames);
    const userPrompt = buildUserPrompt(title, description);

    // ── 6. Call DeepSeek ──
    const raw = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2, max_tokens: 500, json: true }
    );

    if (!raw) {
      return NextResponse.json(
        { error: 'DeepSeek API 返回为空' },
        { status: 502 }
      );
    }

    // ── 7. Parse JSON ──
    let obj: any;
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      obj = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'AI 返回了非 JSON 格式，请重试' },
        { status: 500 }
      );
    }

    // ── 8. Validate & resolve category ──
    const aiCategory: string = (obj.category || '').trim();
    if (!aiCategory) {
      return NextResponse.json(
        { error: 'AI 未返回 category 字段' },
        { status: 500 }
      );
    }

    // Exact match
    let matched = categories.find((c) => c.name === aiCategory);
    // Fuzzy match
    if (!matched) {
      matched = categories.find(
        (c) => c.name.includes(aiCategory) || aiCategory.includes(c.name)
      );
    }
    const finalCategory = matched ? matched.name : aiCategory;

    // ── 9. Parse tags (3, Chinese, 2-6 chars) ──
    let tags: string[] = [];
    if (Array.isArray(obj.tags)) {
      tags = obj.tags
        .filter((t: any) => typeof t === 'string' && t.trim().length >= 2)
        .map((t: string) => t.trim())
        .slice(0, 3);
    }
    while (tags.length < 3) tags.push('');

    // ── 10. Parse seo_description (≤100 chars) ──
    let seoDesc: string = '';
    if (typeof obj.seo_description === 'string') {
      seoDesc = obj.seo_description.trim().slice(0, 100);
    }

    // ── 11. Write back to Neon ──
    await sql`
      UPDATE bookmarks
      SET
        category_name = ${finalCategory},
        tags = ${JSON.stringify(tags)},
        description = ${seoDesc}
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      bookmark: {
        id,
        category_name: finalCategory,
        tags,
        description: seoDesc,
      },
    });
  } catch (err: any) {
    console.error('[ai-classify-single] error:', err);
    return NextResponse.json(
      { error: err.message || 'AI 分类失败' },
      { status: 500 }
    );
  }
}

/**
 * 构建系统提示词
 * 要求 AI 输出 { category, tags, seo_description }
 */
function buildSystemPrompt(categoryNames: string[]): string {
  const list = categoryNames.map((n) => `"${n}"`).join(', ');

  return `你是一个精通中文互联网工具和 SaaS 产品的分类与 SEO 优化专家。

## 你的任务
根据用户提供的工具名称和描述，完成以下三项输出：

### 1. category（分类）
从以下 ${categoryNames.length} 个现有分类中，选择最精准的一个：
${list}

分类原则：优先根据工具的核心用途匹配；如果没有完全匹配的，选最接近的那个。

### 2. tags（3个标签）
- 必须是 2-6 个汉字的中文短语
- 描述工具的核心功能、技术栈或使用场景
- 避免泛词（如"工具""软件"），要具体（如"跨境电商""API网关""视频剪辑"）
- 不要使用英文或中英混合

### 3. seo_description（SEO 描述，≤100字）
- 用于 Google 搜索引擎展示
- 一句话概括该工具的核心价值和使用场景
- 包含工具名称
- 自然流畅，适合搜索摘要展示

## 输出格式 — 必须严格遵守
只返回一个合法 JSON 对象，不要带任何 markdown、注释或额外文字：

{ "category": "分类名", "tags": ["标签1", "标签2", "标签3"], "seo_description": "一句话 SEO 描述" }`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(title: string, description?: string): string {
  const desc = description && description.trim()
    ? `\n当前描述：${description.trim()}`
    : '';
  return `请为以下工具生成分类、标签和 SEO 描述：\n\n名称：${title.trim()}${desc}`;
}
