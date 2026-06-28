// scripts/migrate-featured.js — 添加常用书签字段
const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Adding featured columns...\n');

  await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false`;
  console.log('  ✅ is_featured column added');

  await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
  console.log('  ✅ sort_order column added');

  await sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_featured ON bookmarks(is_featured) WHERE is_featured = true`;
  console.log('  ✅ index on is_featured');

  console.log('\nMigration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
