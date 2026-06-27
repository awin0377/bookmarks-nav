import { NextRequest, NextResponse } from 'next/server';

// Password from env variable, default: '123456'
const PASSWORD = process.env.PASSWORD || '123456';
const COOKIE_NAME = 'bn_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes and login page
  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Simple token: base64("timestamp:password_hash")
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [ts, hash] = decoded.split(':');

    // Verify password matches
    if (hash !== simpleHash(PASSWORD)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check expiry (30 days)
    const tokenTime = parseInt(ts, 10);
    if (Date.now() - tokenTime > COOKIE_MAX_AGE * 1000) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
