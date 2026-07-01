import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: 'Server misconfigured: PASSWORD not set' }, { status: 500 });
  }

  if (password !== expected) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  // Generate token
  const token = Buffer.from(`${Date.now()}:${simpleHash(expected)}`).toString('base64');

  const response = NextResponse.json({ success: true });

  response.cookies.set('bn_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
