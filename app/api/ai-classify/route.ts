import { NextRequest, NextResponse } from 'next/server';
import { chat, isAvailable } from '@/lib/ai';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai-classify
 *
 * 对未分类书签进行 AI 智能研判：
 * 1. 动态读取数据库中所有现有分类
 * 2. 根据书签的 title + description，让 DeepSeek 从现有分类中选出最匹配的一个
 * 3. 同时生成 3 个中文核心标签（tags）
 *
 * Body: { title: string; description?: string }
 * Returns: { category: string; tags: string[]; category_id?: number }
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
    const { title, description } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: '缺少 title 字段' }, { status: 400 });
    }

    // ── 3. Fetch existing categories from DB ──
    const categories = await sql`
      SELECT id, name FROM categories ORDER BY sort_order ASC
    ` as { id: number; name: string }[];

    if (categories.length === 0) {
      return NextResponse.json({ error: '数据库中暂无分类，请先创建分类' }, { status: 400 });
    }

    const categoryNames = categories.map((c) => c.name);

    // ── 4. Build prompt ──
    const systemPrompt = buildSystemPrompt(categoryNames);
    const userPrompt = buildUserPrompt(title, description);

    // ── 5. Call DeepSeek ──
    const raw = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2, max_tokens: 300, json: true }
    );

    if (!raw) {
      return NextResponse.json(
        { error: 'DeepSeek API 返回为空，请稍后重试' },
        { status: 502 }
      );
    }

    // ── 6. Parse & validate JSON ──
    const parsed = parseClassification(raw, categories);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('[ai-classify] error:', err);
    return NextResponse.json(
      { error: err.message || 'AI 分类失败' },
      { status: 500 }
    );
  }
}

/**
 * 构建系统提示词
 * 核心约束：
 *  - category 必须从提供的列表中精确选择一个
 *  - tags 必须是 3 个 2-6 字的中文标签
 *  - 只返回 JSON，不含任何额外文字
 */
function buildSystemPrompt(categoryNames: string[]): string {
  const list = categoryNames.map((n) => `"${n}"`).join(', ');

  return `你是一个精通中文互联网工具和 SaaS 产品的分类专家。

## 你的任务
根据用户提供的工具名称和描述，从以下 ${categoryNames.length} 个现有分类中，选择最精准的一个，并生成 3 个核心标签。

## 可用分类
${list}

## 分类原则
- 优先根据工具的**核心用途**匹配分类，不要被工具名称里的个别字眼误导
- 如果工具横跨多个领域，选择最主要的那个
- 如果没有任何分类匹配，选择最接近的那个，不要拒绝回答

## 标签原则
- 必须是 2-6 个汉字的中文短语
- 描述工具的核心功能、技术栈或使用场景
- 避免泛词（如"工具""软件""平台"），要具体（如"视频剪辑""API网关""跨境电商"）
- 不要使用英文或中英混合标签

## 输出格式
你必须**只**返回一个合法的 JSON 对象，不要带 markdown 标记、注释或任何额外文字：

{ "category": "分类名", "tags": ["标签1", "标签2", "标签3"] }`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(title: string, description?: string): string {
  if (description && description.trim()) {
    return `请分类以下工具：\n\n名称：${title.trim()}\n描述：${description.trim()}`;
  }
  return `请分类以下工具：\n\n名称：${title.trim()}`;
}

/**
 * 解析 DeepSeek 返回的 JSON，并做校验 + 容错
 */
function parseClassification(
  raw: string,
  categories: { id: number; name: string }[]
): { category: string; tags: string[]; category_id: number | null } {
  let obj: any;

  try {
    // 去掉可能的 markdown 代码块包裹
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    obj = JSON.parse(cleaned);
  } catch {
    throw new Error('AI 返回了非 JSON 格式，请重试');
  }

  // ── 校验 category ──
  if (!obj.category || typeof obj.category !== 'string') {
    throw new Error('AI 返回结果中缺少 category 字段');
  }

  const aiCategory = obj.category.trim();

  // 精确匹配数据库中的分类
  const matched = categories.find(
    (c) => c.name === aiCategory
  );

  // 如果精确匹配失败，尝试模糊匹配
  let finalCategory = aiCategory;
  let categoryId: number | null = matched?.id ?? null;

  if (!matched) {
    // 模糊匹配：contains 或相似度
    const fuzzy = categories.find((c) =>
      c.name.includes(aiCategory) || aiCategory.includes(c.name)
    );
    if (fuzzy) {
      finalCategory = fuzzy.name;
      categoryId = fuzzy.id;
    }
    // 如果模糊也不匹配，保留 AI 返回的但 category_id 为 null
  }

  // ── 校验 tags ──
  let tags: string[] = [];
  if (Array.isArray(obj.tags) && obj.tags.length > 0) {
    tags = obj.tags
      .filter((t: any) => typeof t === 'string' && t.trim().length >= 2)
      .map((t: string) => t.trim())
      .slice(0, 3);
  }

  // 如果 tags 不够 3 个，用空字符串补齐（前端会过滤）
  while (tags.length < 3) {
    tags.push('');
  }

  return {
    category: finalCategory,
    tags,
    category_id: categoryId,
  };
}
