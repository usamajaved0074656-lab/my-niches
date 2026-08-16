import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Two interchangeable backends behind one interface:
 *   file     — data/niches.json (default, zero setup)
 *   supabase — Postgres over PostgREST (set SUPABASE_URL + SUPABASE_KEY)
 *
 * Both speak the same row shape, so server.js never branches on backend.
 */

const COLUMNS = [
  'id', 'title', 'status', 'difficulty', 'notes', 'tags',
  'likes', 'liked', 'saved', 'cover', 'channels', 'created_at',
];

/* ---------- .env ---------- */

export function loadEnv(file) {
  if (!fsSync.existsSync(file)) return;
  for (const line of fsSync.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}

/* ---------- shared ---------- */

const nowIso = () => new Date().toISOString();

export function newNiche(patch = {}) {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled niche',
    status: 'Researching',
    difficulty: 'Beginner Friendly',
    notes: '',
    tags: [],
    likes: 0,
    liked: false,
    saved: false,
    cover: null,
    channels: [],
    created_at: nowIso(),
    ...patch,
  };
}

/* ---------- file backend ---------- */

function fileStore(dbPath) {
  fsSync.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fsSync.existsSync(dbPath)) fsSync.writeFileSync(dbPath, '[]');

  const read = async () => {
    try {
      const rows = JSON.parse(await fs.readFile(dbPath, 'utf8'));
      // Rows written before the Supabase backend used camelCase createdAt.
      for (const r of rows) if (!r.created_at) r.created_at = r.createdAt || nowIso();
      return rows;
    } catch {
      return [];
    }
  };
  // Write to a temp file first so a crash mid-write cannot truncate the library.
  const write = async (rows) => {
    const tmp = `${dbPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
    await fs.rename(tmp, dbPath);
  };

  return {
    kind: 'file',
    label: dbPath,
    async all() {
      const rows = await read();
      return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async get(id) {
      return (await read()).find((r) => r.id === id) || null;
    },
    async insert(row) {
      const rows = await read();
      rows.unshift(row);
      await write(rows);
      return row;
    },
    async update(id, patch) {
      const rows = await read();
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) return null;
      Object.assign(rows[i], patch);
      await write(rows);
      return rows[i];
    },
    async remove(id) {
      const rows = await read();
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) return false;
      rows.splice(i, 1);
      await write(rows);
      return true;
    },
  };
}

/* ---------- supabase backend ---------- */

function supabaseStore(url, key) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/niches`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  async function call(path, init = {}) {
    const r = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    });
    const text = await r.text();
    if (!r.ok) {
      throw new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  const only = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => COLUMNS.includes(k)));

  return {
    kind: 'supabase',
    label: url,
    async all() {
      return (await call('?select=*&order=created_at.desc')) || [];
    },
    async get(id) {
      const rows = await call(`?select=*&id=eq.${encodeURIComponent(id)}`);
      return rows?.[0] || null;
    },
    async insert(row) {
      const rows = await call('', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(only(row)),
      });
      return rows?.[0] || row;
    },
    async update(id, patch) {
      const rows = await call(`?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(only(patch)),
      });
      return rows?.[0] || null;
    },
    async remove(id) {
      await call(`?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return true;
    },
  };
}

/* ---------- picker ---------- */

export function createStore({ dbPath }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) return supabaseStore(url, key);
  return fileStore(dbPath);
}
