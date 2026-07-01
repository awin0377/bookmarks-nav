import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.PASSWORD
const COOKIE_NAME = 'bn_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ── Rate Limiting ──────────────────────────────────
// Simple in-memory rate limiter (per serverless instance)
// 5 requests per minute for /api/ai/ routes
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetAt: entry.resetAt };
}

// Cleanup old entries every 5 minutes to prevent memory leak
let lastCleanup = Date.now();
function cleanupRateLimit() {
  const now = Date.now();
  if (now - lastCleanup > 5 * 60 * 1000) {
    for (const [ip, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(ip);
    }
    lastCleanup = now;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate limit AI routes ──
  if (pathname.startsWith('/api/ai/')) {
    cleanupRateLimit();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试', retry_after: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }
  }

  // ── Cron routes: require secret token ──
  if (pathname.startsWith('/api/cron/')) {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    // If CRON_SECRET is not set, deny access
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Allow all API routes, static files, and login page
  if (
    pathname.startsWith('/api/') ||
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // If PASSWORD env is not configured, deny all access (redirect to login)
  if (!PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check auth cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [ts, hash] = decoded.split(':');

    if (hash !== simpleHash(PASSWORD)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

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
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
