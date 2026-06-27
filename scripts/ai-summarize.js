// scripts/ai-summarize.js — 批量 AI 生成书签描述
// 用法: node scripts/ai-summarize.js [--reset] [--concurrency=5]
const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) {
  console.error('❌ DEEPSEEK_API_KEY not set in .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Parse CLI args
const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const CONCURRENCY = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '10', 10);

// Progress file for resume
const PROGRESS_FILE = path.join(__dirname, '..', '.ai-summarize-progress.json');

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')); } catch { return { done: [] }; }
}
function saveProgress(done) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ done, updated: new Date().toISOString() }));
}

async function callDeepSeek(title, url) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个书签描述助手。用一句简短的中文（最多15个字）描述这个网站是做什么的。只输出描述本身，不要加任何前缀、解释或标点。' },
        { role: 'user', content: `标题：${title}\n网址：${url}` },
      ],
      temperature: 0.3,
      max_tokens: 30,
    });

    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text = json.choices?.[0]?.message?.content?.trim() || '';
          resolve(text.replace(/["""'']/g, '').slice(0, 50));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`🔮 AI 批量书签描述生成器`);
  console.log(`   并发数: ${CONCURRENCY} | 重置: ${RESET}\n`);

  // Get bookmarks needing summary
  let rows;
  if (RESET) {
    await sql`UPDATE bookmarks SET summary = ''`;
    rows = await sql`SELECT id, url, title FROM bookmarks ORDER BY id`;
    console.log(`📋 重置所有书签，共 ${rows.length} 条\n`);
  } else {
    rows = await sql`SELECT id, url, title FROM bookmarks WHERE summary = '' OR summary IS NULL ORDER BY id`;
    console.log(`📋 需要生成描述的书签: ${rows.length} 条\n`);
  }

  if (rows.length === 0) {
    console.log('✅ 所有书签已有描述！');
    fs.unlinkSync(PROGRESS_FILE);
    process.exit(0);
  }

  const progress = RESET ? { done: [] } : loadProgress();
  const doneSet = new Set(progress.done);
  const pending = rows.filter(r => !doneSet.has(r.id));

  if (pending.length < rows.length) {
    console.log(`📌 断点续传: 已完成 ${rows.length - pending.length}，剩余 ${pending.length}\n`);
  }

  let completed = 0;
  let failures = 0;
  const startTime = Date.now();
  const doneIds = [...progress.done];

  // Process in batches
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const summary = await callDeepSeek(row.title, row.url);
        if (summary) {
          await sql`UPDATE bookmarks SET summary = ${summary} WHERE id = ${row.id}`;
        }
        return { id: row.id, title: row.title, summary };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        completed++;
        doneIds.push(r.value.id);
        if (completed % 10 === 0 || completed === pending.length) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (completed / (elapsed / 60)).toFixed(0);
          process.stdout.write(`\r⏳ ${completed}/${pending.length} (${rate}/min) — ${r.value.title.slice(0, 25)} → ${r.value.summary || 'N/A'}          `);
        }
      } else {
        failures++;
      }
    }

    // Save progress periodically
    if (completed % 50 === 0) saveProgress(doneIds);

    // Rate limit: 50ms between batches
    if (i + CONCURRENCY < pending.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // Final save
  saveProgress(doneIds);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ 完成！`);
  console.log(`   成功: ${completed} | 失败: ${failures}`);
  console.log(`   耗时: ${totalElapsed}s`);
  console.log(`   进度已保存至: ${PROGRESS_FILE}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
