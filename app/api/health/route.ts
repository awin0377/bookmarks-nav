import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus: string = 'unknown';
  let dbError = '';
  let bookmarkCount = -1;
  let categoryCount = -1;

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      dbStatus = 'missing_url';
      dbError = 'DATABASE_URL is not set';
    } else {
      const sql = neon(dbUrl);
      const [bCount, cCount] = await Promise.all([
        sql`SELECT COUNT(*) as c FROM bookmarks`,
        sql`SELECT COUNT(*) as c FROM categories`,
      ]);
      bookmarkCount = Number(bCount[0]?.c ?? 0);
      categoryCount = Number(cCount[0]?.c ?? 0);
      dbStatus = 'ok';
    }
  } catch (err: any) {
    dbStatus = 'error';
    dbError = err.message || String(err);
  }

  return NextResponse.json({
    status: 'ok',
    db: dbStatus,
    db_error: dbError || null,
    bookmarks: bookmarkCount,
    categories: categoryCount,
    env: {
      has_db_url: !!process.env.DATABASE_URL,
      has_deepseek: !!process.env.DEEPSEEK_API_KEY,
      has_password: !!process.env.PASSWORD,
      node_env: process.env.NODE_ENV || 'unknown',
    },
  });
}
