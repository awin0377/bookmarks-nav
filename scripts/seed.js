// scripts/seed.js — 从 bookmarks_data.json 导入数据到 Neon
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function seed() {
  // 读取 JSON 数据
  const dataPath = path.join(__dirname, '..', '..', 'bookmarks_data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw);

  const categories = data.categories || {};
  const catNames = Object.keys(categories);
  console.log(`Found ${catNames.length} categories, ${Object.values(categories).flat().length} bookmarks`);

  // 插入分类
  const catMap = {};
  for (let i = 0; i < catNames.length; i++) {
    const name = catNames[i];
    const result = await sql`
      INSERT INTO categories (name, icon, sort_order)
      VALUES (${name}, '', ${i})
      ON CONFLICT (name) DO UPDATE SET sort_order = ${i}
      RETURNING id;
    `;
    catMap[name] = result[0].id;
    console.log(`  ✅ ${name} → id=${catMap[name]}`);
  }

  // 插入书签
  let inserted = 0;
  let skipped = 0;
  for (const [catName, items] of Object.entries(categories)) {
    const catId = catMap[catName];
    for (const item of items) {
      try {
        await sql`
          INSERT INTO bookmarks (url, title, domain, category_id, icon)
          VALUES (
            ${item.url},
            ${item.title},
            ${getDomain(item.url)},
            ${catId},
            ${item.icon || ''}
          )
          ON CONFLICT (url) DO UPDATE SET
            title = EXCLUDED.title,
            category_id = ${catId},
            domain = ${getDomain(item.url)};
        `;
        inserted++;
      } catch (err) {
        console.log(`  ⚠️  Skipped: ${item.title?.substring(0, 50)}`);
        skipped++;
      }
    }
  }

  console.log(`\nSeed complete! Inserted: ${inserted}, Skipped: ${skipped}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
