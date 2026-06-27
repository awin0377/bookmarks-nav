// scripts/migrate.js — 创建 Neon 数据库表结构
const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Creating tables...\n');

  // 分类表
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `;
  console.log('  ✅ categories');

  // 书签表
  await sql`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      icon TEXT NOT NULL DEFAULT '',
      is_dead BOOLEAN NOT NULL DEFAULT false,
      last_checked TIMESTAMPTZ,
      summary TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('  ✅ bookmarks');

  // 点击记录表
  await sql`
    CREATE TABLE IF NOT EXISTS clicks (
      id SERIAL PRIMARY KEY,
      bookmark_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('  ✅ clicks');

  // 索引
  await sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_domain ON bookmarks(domain);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clicks_bookmark ON clicks(bookmark_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clicks_time ON clicks(clicked_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_dead ON bookmarks(is_dead) WHERE is_dead = true;`;
  console.log('  ✅ indexes');

  console.log('\nMigration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
