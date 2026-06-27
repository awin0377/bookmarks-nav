import OpenAI from 'openai';

// DeepSeek API — fully OpenAI-compatible
// Docs: https://platform.deepseek.com/api-docs
// Lazy-init to avoid build-time errors when API key is not set

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return _client;
}

export function isAvailable(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

export async function chat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number; max_tokens?: number; json?: boolean }
): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.warn('DEEPSEEK_API_KEY not configured');
    return null;
  }
  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.max_tokens ?? 1000,
      ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('DeepSeek API error:', error);
    return null;
  }
}
