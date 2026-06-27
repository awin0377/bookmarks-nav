import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { chat, isAvailable } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    // Check if AI is configured
    if (!isAvailable()) {
      return NextResponse.json(
        { error: 'AI 功能未配置，请设置 DEEPSEEK_API_KEY 环境变量', results: [] },
        { status: 503 }
      );
    }

    const { query } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json({ results: [] });
    }

    // Fetch all non-dead bookmarks (compact)
    const bookmarks = await sql`
      SELECT b.id, b.title, b.url, b.domain, c.name as category_name
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.is_dead = false
      ORDER BY b.id
    `;

    const bookmarkList = bookmarks.map((b: any) => ({
      id: b.id,
      t: b.title,
      d: b.domain,
      c: b.category_name || '其他',
    }));

    // Ask DeepSeek to find the most relevant bookmarks
    const content = await chat(
      [
        {
          role: 'system',
          content: `你是一个智能书签搜索引擎。用户会用自然语言描述想找什么类型或主题的网站。
你的任务：根据用户意图，从书签列表中找出最相关的书签。

规则：
1. 理解用户查询的真实意图（不是简单关键词匹配，而是语义理解）
2. 例如"前端开发"应匹配 React、Vue、CSS、JS 相关网站；"看视频"应匹配 YouTube、B站、Netflix 等
3. 按相关度排序，最多返回 20 个结果
4. 为每个匹配的书签写一句简短说明（8字以内），说明为什么匹配
5. 如果没有匹配的，返回空数组

返回纯 JSON：
{"results":[{"id":123,"note":"React 官方文档"},{"id":456,"note":"前端组件库"}]}

注意：只返回 JSON，不要任何其他文字。`,
        },
        {
          role: 'user',
          content: `用户查询："${query}"\n\n书签列表（共 ${bookmarkList.length} 个）：\n${JSON.stringify(bookmarkList)}`,
        },
      ],
      { temperature: 0.1, max_tokens: 2000, json: true }
    );

    if (!content) {
      return NextResponse.json({ results: [], query, error: 'AI 响应超时' });
    }

    // Parse AI response
    let parsed: { results: { id: number; note: string }[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code block
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        return NextResponse.json({ results: [], query, error: 'AI 响应格式异常' });
      }
    }

    const ids = (parsed.results || []).map((r) => r.id);

    if (ids.length === 0) {
      return NextResponse.json({ results: [], query });
    }

    // Fetch full bookmark data for matched IDs
    const matched = await sql`
      SELECT b.id, b.url, b.title, b.domain, b.icon, b.is_dead,
             c.name as category_name, c.icon as category_icon
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ANY(${ids})
    `;

    // Reorder to match AI ranking & attach notes
    const idMap = new Map(ids.map((id: number, i: number) => [id, i]));
    const notes = new Map((parsed.results || []).map((r) => [r.id, r.note || '']));
    const ordered = matched
      .map((b: any) => ({ ...b, ai_note: notes.get(b.id) || '' }))
      .sort((a: any, b: any) => (idMap.get(a.id) ?? 999) - (idMap.get(b.id) ?? 999));

    return NextResponse.json({ results: ordered, query });
  } catch (error: any) {
    console.error('AI Search error:', error);
    return NextResponse.json(
      { error: error.message || 'AI search failed', results: [] },
      { status: 500 }
    );
  }
}
