import { NextRequest, NextResponse } from 'next/server';
import { chat, isAvailable } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isAvailable()) {
      return NextResponse.json(
        { error: 'AI 功能未配置，请设置 DEEPSEEK_API_KEY' },
        { status: 503 }
      );
    }

    const { url, title } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const summary = await chat(
      [
        {
          role: 'system',
          content:
            '你是一个网站描述生成器。根据网站 URL 和标题，用中文生成一句精炼的描述（15字以内），说明这个网站是做什么用的。只输出描述文本，不要引号、不要前缀、不要其他内容。如果不确定，输出空字符串。',
        },
        {
          role: 'user',
          content: `URL: ${url}\n标题: ${title || '未知'}`,
        },
      ],
      { temperature: 0.1, max_tokens: 80 }
    );

    return NextResponse.json({
      summary: summary?.trim() || '',
      url,
      title,
    });
  } catch (error: any) {
    console.error('AI Summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Summary generation failed' },
      { status: 500 }
    );
  }
}
