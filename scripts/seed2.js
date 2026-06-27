// scripts/seed2.js — 稳健版本，逐条插入 + 错误日志
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

async function seed() {
  const dataPath = path.join(__dirname, '..', '..', 'bookmarks_data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const cats = data.categories;

  console.log(`Categories: ${Object.keys(cats).length}, Total items: ${Object.values(cats).flat().length}`);

  // Get existing category IDs
  const catRows = await sql`SELECT id, name FROM categories`;
  const catMap = {};
  catRows.forEach(r => { catMap[r.name] = r.id; });

  let inserted = 0, skipped = 0, errors = 0;

  for (const [catName, items] of Object.entries(cats)) {
    const catId = catMap[catName];
    if (!catId) {
      console.log(`  SKIP: ${catName} — no category id`);
      continue;
    }
    let catInserted = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await sql`
          INSERT INTO bookmarks (url, title, domain, category_id, icon)
          VALUES (${item.url}, ${item.title || 'Untitled'}, ${getDomain(item.url)}, ${catId}, ${item.icon || ''})
          ON CONFLICT (url) DO NOTHING
        `;
        catInserted++;
      } catch (e) {
        errors++;
        if (errors <= 5) {
          console.error(`  ERR [${catName} #${i}]: ${e.message?.substring(0, 120)}`);
          console.error(`    URL: ${(item.url||'').substring(0, 120)}`);
        }
      }
    }
    if (catInserted > 0) console.log(`  ✅ ${catName}: +${catInserted}`);
    inserted += catInserted;
  }

  const cnt = await sql`SELECT COUNT(*) as c FROM bookmarks`;
  console.log(`\nDone! Inserted: ${inserted}, Total in DB: ${cnt[0].c}, Errors: ${errors}`);
}

seed().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
