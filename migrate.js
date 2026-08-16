import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, loadEnv, newNiche } from './store.js';

/**
 * One-way copy: data/niches.json  ->  Supabase.
 * Run once after filling SUPABASE_KEY in .env:  node migrate.js
 * Safe to re-run — rows that already exist in Supabase are skipped.
 * The local JSON file is never modified, so it stays as a backup.
 */

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(ROOT, '.env'));

const store = createStore({ dbPath: path.join(ROOT, 'data', 'niches.json') });
if (store.kind !== 'supabase') {
  console.error('SUPABASE_URL / SUPABASE_KEY .env mein set nahi hain — kuch migrate nahi hoga.');
  process.exit(1);
}

const localPath = path.join(ROOT, 'data', 'niches.json');
if (!fs.existsSync(localPath)) {
  console.error(`${localPath} nahi mili.`);
  process.exit(1);
}

const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
const remote = await store.all();
const have = new Set(remote.map((r) => r.id));

let added = 0;
for (const raw of local) {
  if (have.has(raw.id)) {
    console.log(`skip  ${raw.title} (pehle se Supabase mein hai)`);
    continue;
  }
  const row = newNiche({ ...raw });
  row.created_at = raw.created_at || raw.createdAt || row.created_at;
  await store.insert(row);
  added += 1;
  console.log(`added ${row.title}  (${row.channels?.length || 0} channels)`);
}

console.log(`\nDone — ${added} niches Supabase par gaye, ${local.length - added} pehle se the.`);
console.log(`Local backup waise hi para hai: ${localPath}`);
