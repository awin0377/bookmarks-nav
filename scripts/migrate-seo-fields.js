// scripts/migrate-seo-fields.js — 添加 SEO 字段：tags, features, description
const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Adding SEO fields...\n');

  // tags: JSON 字符串数组，如 '["免费","国内直连","AI"]'
  await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]'`;
  console.log('  ✅ tags column added');

  // features: 三个核心卖点，JSON 字符串数组，如 '["一键生成PPT","支持中文","免费使用"]'
  await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS features TEXT NOT NULL DEFAULT '[]'`;
  console.log('  ✅ features column added');

  // description: 扩展为更长的 SEO 描述（最多 200 字），区别于短 summary
  await sql`ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
  console.log('  ✅ description column added');

  // 将现有 summary 迁移到 description（如果 description 为空）
  await sql`
    UPDATE bookmarks 
    SET description = summary 
    WHERE description = '' AND summary != ''
  `;
  console.log('  ✅ migrated existing summaries to descriptions');

  console.log('\nDone! SEO fields ready.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
