import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createStore, loadEnv, newNiche } from '../store.js';
import { ytdlpChannel, goneReason } from './ytdlp.js';
import {
  authorized, checkPassword, clearCookie, locked,
  noteFailure, noteSuccess, passwordSet, revokeAllSessions, sessionCookie,
} from '../auth.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const DB = path.join(DATA, 'niches.json');
const MAX_BODY = 30 * 1024 * 1024;

loadEnv(path.join(ROOT, '.env'));
export const PORT = Number(process.env.PORT) || 5173;

/**
 * Hosting platforms set their own marker env vars. On one of those, a missing
 * APP_PASSWORD would silently publish the entire library to anyone with the
 * URL — so refuse to boot instead of failing open.
 */
export const HOSTED = Boolean(
  process.env.RENDER || process.env.FLY_APP_NAME || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL,
);

/**
 * Returns a list of fatal misconfigurations. The launcher turns these into a
 * clean exit; a serverless function cannot exit, so it reports them per-request
 * instead of dying silently.
 */
export function configErrors() {
  const bad = [];
  if (HOSTED && !process.env.APP_PASSWORD) {
    bad.push('APP_PASSWORD is not set. A public deploy will not run without a password.');
  }
  if (process.env.APP_PASSWORD && process.env.APP_PASSWORD.length < 8) {
    bad.push('APP_PASSWORD is too short — use at least 8 characters (16+ is better).');
  }
  // A typo'd pair used to fall back to the local file store, which on a hosted
  // ephemeral disk means the data quietly disappears on the next restart.
  if (Boolean(process.env.SUPABASE_URL) !== Boolean(process.env.SUPABASE_KEY)) {
    bad.push('SUPABASE_URL and SUPABASE_KEY — set both or neither. Only one is set right now.');
  }
  if (HOSTED && !process.env.SUPABASE_URL) {
    bad.push('Supabase is required when hosted — otherwise the data is wiped on every restart.');
  }
  return bad;
}

export const store = createStore({ dbPath: DB });

// YouTube blocks default fetch agents, so every outbound request carries a browser UA.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Serverless filesystems are read-only, and there is nothing to mirror there anyway.
const CAN_WRITE = !process.env.VERCEL;
if (CAN_WRITE) fsSync.mkdirSync(UPLOADS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function readBody(req, cap = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > cap) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function json(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* ---------- images ---------- */

async function saveDataUrl(dataUrl, prefix) {
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return null;
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const name = `${prefix}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(UPLOADS, name), Buffer.from(m[3], 'base64'));
  return `/uploads/${name}`;
}

/**
 * Hosted disks (Render's free tier) are wiped on every restart and redeploy, so
 * mirroring there just burns time and then 404s. Cards already carry the
 * YouTube CDN URL as a fallback, which is what actually renders in that case.
 */
const MIRROR = process.env.MIRROR_IMAGES === '0' ? false : CAN_WRITE && !process.env.RENDER;

// Mirrors a remote image into data/uploads so cards keep working offline.
async function mirrorImage(url, prefix) {
  if (!url || !MIRROR) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').split(';')[0];
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[type] || 'jpg';
    const name = `${prefix}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(UPLOADS, name), Buffer.from(await r.arrayBuffer()));
    return `/uploads/${name}`;
  } catch {
    return null;
  }
}

async function removeImage(p) {
  if (!p || !p.startsWith('/uploads/')) return;
  try {
    await fs.unlink(path.join(UPLOADS, path.basename(p)));
  } catch {}
}

/* ---------- youtube link resolver ---------- */

const pick = (html, re) => {
  const m = re.exec(html);
  return m ? m[1] : null;
};

const decodeEntities = (s) =>
  !s
    ? s
    : s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\\u0026/g, '&');

function normalizeYouTubeUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = u.startsWith('@') ? `https://www.youtube.com/${u}` : `https://${u}`;
  try {
    const url = new URL(u);
    if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== 'youtu.be') return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Thrown only when YouTube itself says the channel is gone — never for a
 * timeout, a 429 or a network blip. Callers flag the channel instead of
 * deleting it, so the notes and the last known stats survive.
 */
export class ChannelGone extends Error {
  constructor(reason) {
    super(reason || 'This channel is no longer on YouTube.');
    this.reason = reason || 'This channel is no longer on YouTube.';
  }
}

/** A /channel/UC… id is permanent, so a 404 on one is proof, not ambiguity. */
const isChannelId = (u) => /\/channel\/UC[\w-]{20,}/.test(String(u));

async function fetchHtml(url) {
  // Without hl/gl YouTube serves the caller's locale, which breaks every "N subscribers" match.
  const u = new URL(url);
  u.searchParams.set('hl', 'en');
  u.searchParams.set('gl', 'US');
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  });
  if (r.status === 404) {
    if (isChannelId(u)) throw new ChannelGone('YouTube no longer has this channel.');
    throw new Error('YouTube returned 404 for that link — check the handle.');
  }
  if (!r.ok) throw new Error(`YouTube returned ${r.status}`);

  return r.text();
}

// Pulls name / avatar / subs / video count straight out of the channel page HTML.
async function resolveYouTube(rawUrl) {
  const url = normalizeYouTubeUrl(rawUrl);
  if (!url) throw new Error('Give a valid YouTube link (channel or video).');

  const isVideo = url.hostname === 'youtu.be' || url.pathname === '/watch' || url.pathname.startsWith('/shorts/');
  let pageUrl = url.toString();
  const out = { url: pageUrl, kind: isVideo ? 'video' : 'channel' };

  if (isVideo) {
    try {
      const r = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`,
        { headers: { 'User-Agent': UA } },
      );
      if (r.ok) {
        const o = await r.json();
        out.videoTitle = o.title;
        out.title = o.author_name;
        out.thumbRemote = o.thumbnail_url;
        out.channelUrl = o.author_url;
      }
    } catch {}
    // Follow through to the channel so we still land on an avatar + sub count.
    if (out.channelUrl) pageUrl = out.channelUrl;
  }

  let html = '';
  let htmlError = null;
  try {
    html = await fetchHtml(pageUrl);
  } catch (e) {
    if (e instanceof ChannelGone) throw e;
    // /c/Name and /user/Name are legacy forms; retry the modern @handle before giving up.
    const last = pageUrl.split('?')[0].replace(/\/$/, '').split('/').pop();
    let retried = false;
    if (!isVideo && last && !last.startsWith('@')) {
      try {
        html = await fetchHtml(`https://www.youtube.com/@${last}`);
        retried = true;
      } catch {}
    }
    if (!retried && !out.title) htmlError = e;
  }

  if (html) {
    out.title = decodeEntities(pick(html, /<meta property="og:title" content="([^"]+)"/)) || out.title;
    out.description = decodeEntities(pick(html, /<meta property="og:description" content="([^"]*)"/)) || '';
    out.avatarRemote = pick(html, /<meta property="og:image" content="([^"]+)"/);
    out.bannerRemote = decodeEntities(pick(html, /"imageBannerViewModel":\{"image":\{"sources":\[\{"url":"([^"]+)"/));
    out.canonical = pick(html, /<link rel="canonical" href="([^"]+)"/);
    out.handle =
      pick(html, /"canonicalBaseUrl":"\/(@[^"]+)"/) ||
      (out.canonical && /\/(@[\w.-]+)/.exec(out.canonical)?.[1]) ||
      (/\/(@[\w.-]+)/.exec(url.pathname)?.[1] ?? null);
    // The channel header stores its own counts as "content":"513M subscribers"; the
    // "simpleText" form belongs to *featured* channels, so it is only a last resort.
    const anchored = out.handle
      ? new RegExp(`${out.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*?([\\d.,]+[KMB]?)[^"\\d]{0,4}subscribers`)
      : null;
    out.subs =
      pick(html, /"content":"([\d.,]+[KMB]?) subscribers?"/) ||
      (anchored && pick(html, anchored)) ||
      pick(html, /"subscriberCountText":\{"simpleText":"([\d.,]+[KMB]?) subscribers?"/) ||
      null;
    if (out.subs) out.subs += ' subs';

    out.videos = pick(html, /"content":"([\d.,]+[KMB]?) videos?"/);
    if (out.videos) out.videos += ' videos';
    out.channelUrl = out.channelUrl || out.canonical;
  }

  out.recent = await recentVideos(out.channelUrl || out.canonical || pageUrl);

  // YouTube starts refusing the HTML after a couple of dozen quick requests,
  // which is exactly what a bulk refresh does. yt-dlp goes through YouTube's
  // API instead, so it fills in whatever scraping could not get.
  // A terminated channel is served as a normal 200 page carrying the notice.
  // Only worth reading when nothing else parsed: a live page always has a title,
  // and its video titles must never be mistaken for YouTube's own wording.
  if (html && !out.title) {
    const said = goneReason(decodeEntities(html.replace(/<[^>]+>/g, ' ')));
    if (said) throw new ChannelGone(said);
  }

  if (!out.recent.length || !out.title || !out.subs) {
    const alt = await ytdlpChannel(out.channelUrl || out.canonical || url.toString());
    if (alt?.gone) throw new ChannelGone(alt.gone);
    if (alt) {
      out.title = out.title || alt.title;
      out.subs = out.subs || alt.subs;
      out.description = out.description || alt.description;
      if (!out.recent.length) out.recent = alt.videos;
      if (!out.handle) out.handle = /\/(@[\w.-]+)/.exec(url.pathname)?.[1] || '';
    }
  }

  out.videoIds = out.recent.map((v) => v.id);

  // Only now is it truly hopeless: neither source produced a channel.
  if (!out.title) throw htmlError || new Error('Could not read channel info from that link.');
  return out;
}

/**
 * Latest uploads from the channel's /videos tab — these become the card preview.
 * Each grid item is one "lockupViewModel" block, so splitting on that keeps a
 * video's id and its title paired; a flat regex over the page would mix them up.
 */
/** "1.2K views" -> 1200, so the page's own videos can be ranked. */
function viewsToNumber(text) {
  const m = /([\d.,]+)\s*([KMB])?/i.exec(text || '');
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, '')) || 0;
  return n * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1);
}

/**
 * The channel's best videos, not its newest — that is what says whether a niche
 * works. YouTube's own `sort=p` is applied after load and does not change the
 * served HTML, but the first page already carries ~30 videos with view counts,
 * so ranking those gives the same list its Popular tab shows.
 */
async function recentVideos(channelUrl, limit = 6) {
  if (!channelUrl) return [];
  try {
    const html = await fetchHtml(`${channelUrl.replace(/\/$/, '')}/videos`);
    const out = [];
    const seen = new Set();
    for (const block of html.split('"lockupViewModel":').slice(1)) {
      const id = pick(block, /\/vi\/([\w-]{11})\//);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        title: decodeEntities(pick(block, /"title":\{"content":"([^"]+)"/)) || '',
        // These three are what make a card judgeable at a glance, and they sit
        // inside the same lockup block as the id — a page-wide regex would pair
        // one video's views with another's title.
        views: pick(block, /"content":"([\d.,]+[KMB]? views?)"/) || '',
        age: pick(block, /"content":"([^"]{2,20} ago)"/) || '',
        duration: pick(block, /"thumbnailBadgeViewModel":\{"text":"(\d{1,2}:\d{2}(?::\d{2})?)"/) || '',
      });
    }
    out.sort((a, b) => viewsToNumber(b.views) - viewsToNumber(a.views));
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

/* ---------- shapes ---------- */

const NICHE_FIELDS = ['title', 'status', 'difficulty', 'notes', 'tags', 'liked', 'saved', 'likes', 'color'];
const CHANNEL_FIELDS = ['title', 'handle', 'url', 'subs', 'videos', 'notes', 'kind', 'videoTitle'];

const apply = (src, target, fields) => {
  for (const k of fields) if (k in src) target[k] = src[k];
  if (Array.isArray(target.tags)) target.tags = target.tags.map((t) => String(t).trim()).filter(Boolean);
  return target;
};

async function buildChannel(meta, extra = {}) {
  const id = crypto.randomUUID();
  return {
    id,
    kind: meta.kind || 'channel',
    title: meta.title || 'Untitled channel',
    videoTitle: meta.videoTitle || '',
    handle: meta.handle || '',
    url: meta.channelUrl || meta.url,
    watchUrl: meta.kind === 'video' ? meta.url : '',
    subs: meta.subs || '',
    videos: meta.videos || '',
    description: meta.description || '',
    avatar: await mirrorImage(meta.avatarRemote, `av-${id}`),
    thumb: await mirrorImage(meta.thumbRemote, `th-${id}`),
    // Keep the YouTube CDN URLs too — if data/uploads is ever lost, cards still render.
    avatarUrl: meta.avatarRemote || '',
    thumbUrl: meta.thumbRemote || '',
    banner: await mirrorImage(meta.bannerRemote, `bn-${id}`),
    bannerUrl: meta.bannerRemote || '',
    videoThumbs: await Promise.all(
      (meta.videoIds || []).map((vid, i) => mirrorImage(`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`, `vt-${id}-${i}`)),
    ).then((paths) => paths.filter(Boolean)),
    videoThumbUrls: (meta.videoIds || []).map((vid) => `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`),
    videoTitles: (meta.recent || []).map((v) => v.title || ''),
    videoIds: meta.videoIds || [],
    // NOT `videos` — that key already holds the "53 videos" count string.
    topVideos: (meta.recent || []).map((v, i) => ({
      id: v.id,
      title: v.title || '',
      views: v.views || '',
      age: v.age || '',
      duration: v.duration || '',
      thumbUrl: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    })),
    notes: '',
    addedAt: new Date().toISOString(),
    ...extra,
  };
}

/* ---------- static ---------- */

async function serveStatic(res, pathname) {
  let filePath;
  if (pathname.startsWith('/uploads/')) {
    filePath = path.join(UPLOADS, path.basename(pathname));
  } else {
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    filePath = path.resolve(PUBLIC, rel);
    // Needs the separator: a bare prefix check also accepts a sibling
    // directory whose name merely starts with "public".
    if (filePath !== PUBLIC && !filePath.startsWith(PUBLIC + path.sep)) {
      return json(res, 403, { error: 'forbidden' });
    }
  }
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

/* ---------- routes ---------- */

/** Shared by the local server (server.js) and the serverless entry (api/index.js). */
export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    // decodeURIComponent throws on a malformed escape like "/%" — outside this
    // try that became an unhandled rejection and killed the whole process,
    // which any unauthenticated request could trigger.
    let p;
    try {
      p = decodeURIComponent(url.pathname);
    } catch {
      return json(res, 400, { error: 'bad request' });
    }
    const m = (re) => re.exec(p);

    /* ---------- auth gate ---------- */

    if (p === '/api/login' && req.method === 'POST') {
      if (locked(req)) return json(res, 429, { error: 'Too many wrong attempts — try again in 10 minutes.' });
      const { password } = await readBody(req, 4096); // tiny cap: pre-auth route
      if (!checkPassword(password)) {
        noteFailure(req);
        return json(res, 401, { error: 'Wrong password.' });
      }
      noteSuccess(req);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(req) });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (p === '/api/logout' && req.method === 'POST') {
      revokeAllSessions();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie() });
      return res.end(JSON.stringify({ ok: true }));
    }

    // Tells the login page whether a password is even required here.
    if (p === '/api/auth' && req.method === 'GET') {
      return json(res, 200, { required: passwordSet(), authorized: authorized(req) === 'ok' });
    }

    if (p.startsWith('/api/')) {
      const verdict = authorized(req);
      if (verdict === 'locked') {
        return json(res, 429, { error: 'Too many wrong attempts — try again shortly.' });
      }
      if (verdict !== 'ok') return json(res, 401, { error: 'unauthorized' });
    }

    if (p === '/api/config' && req.method === 'GET') {
      return json(res, 200, { backend: store.kind, target: store.label, locked: passwordSet() });
    }

    if (p === '/api/niches' && req.method === 'GET') return json(res, 200, await store.all());

    if (p === '/api/niches' && req.method === 'POST') {
      const body = await readBody(req);
      const row = apply(body, newNiche(), NICHE_FIELDS);
      // Same name (case-insensitive) => reuse the existing niche. Duplicates
      // came from the extension and the app both "creating" an existing name.
      const norm = row.title.trim().toLowerCase();
      const dup = (await store.all()).find((r) => String(r.title).trim().toLowerCase() === norm);
      if (dup) return json(res, 200, dup);
      row.cover = await saveDataUrl(body.imageDataUrl, `cv-${row.id}`);
      return json(res, 201, await store.insert(row));
    }

    // Restore a whole library from an exported backup.
    if (p === '/api/import' && req.method === 'POST') {
      const body = await readBody(req);
      const incoming = Array.isArray(body) ? body : body.niches;
      if (!Array.isArray(incoming)) return json(res, 400, { error: 'No niches array found in that backup file.' });
      const existing = new Set((await store.all()).map((r) => r.id));
      let added = 0;
      for (const raw of incoming) {
        if (!raw || existing.has(raw.id)) continue;
        const row = newNiche({ ...raw, id: raw.id || crypto.randomUUID() });
        row.created_at = raw.created_at || raw.createdAt || row.created_at;
        await store.insert(row);
        added += 1;
      }
      return json(res, 200, { added, skipped: incoming.length - added });
    }

    // Preview a link without saving it.
    if (p === '/api/resolve' && req.method === 'POST') {
      const { url: link } = await readBody(req);
      return json(res, 200, await resolveYouTube(link));
    }

    let match = m(/^\/api\/niches\/([\w-]+)$/);
    if (match) {
      const row = await store.get(match[1]);
      if (!row) return json(res, 404, { error: 'not found' });

      if (req.method === 'GET') return json(res, 200, row);

      if (req.method === 'PATCH') {
        const body = await readBody(req);
        const patch = apply(body, {}, NICHE_FIELDS);
        if (body.imageDataUrl) {
          await removeImage(row.cover);
          patch.cover = await saveDataUrl(body.imageDataUrl, `cv-${row.id}`);
        }
        return json(res, 200, await store.update(row.id, patch));
      }

      if (req.method === 'DELETE') {
        await removeImage(row.cover);
        for (const c of row.channels || []) {
          await removeImage(c.avatar);
          await removeImage(c.thumb);
        }
        await store.remove(row.id);
        return json(res, 200, { ok: true });
      }
    }

    match = m(/^\/api\/niches\/([\w-]+)\/channels$/);
    if (match && req.method === 'POST') {
      const body = await readBody(req);
      const niche = await store.get(match[1]);
      if (!niche) return json(res, 404, { error: 'not found' });
      const meta = await resolveYouTube(body.url);

      // Same channel twice in one niche is always an accident — the extension
      // and the app both just appended, so re-adding silently made a copy.
      const already = (niche.channels || []).find(
        (c) => (meta.handle && c.handle === meta.handle) || (meta.channelUrl && c.url === meta.channelUrl),
      );
      if (already) return json(res, 200, { ...already, duplicate: true });

      const channel = await buildChannel(meta, { notes: body.notes || '' });
      const channels = [...(niche.channels || []), channel];
      await store.update(niche.id, { channels });
      return json(res, 201, channel);
    }

    // Move a channel into another niche, notes and images intact.
    match = m(/^\/api\/niches\/([\w-]+)\/channels\/([\w-]+)\/move$/);
    if (match && req.method === 'POST') {
      const { to } = await readBody(req);
      const from = await store.get(match[1]);
      const dest = await store.get(to);
      if (!from || !dest) return json(res, 404, { error: 'not found' });
      const channel = (from.channels || []).find((c) => c.id === match[2]);
      if (!channel) return json(res, 404, { error: 'not found' });
      if (from.id === dest.id) return json(res, 200, channel);

      await store.update(from.id, { channels: (from.channels || []).filter((c) => c.id !== channel.id) });
      await store.update(dest.id, { channels: [...(dest.channels || []), channel] });
      return json(res, 200, channel);
    }

    // Re-fetch a channel's live stats, avatar and latest uploads. Notes are kept.
    match = m(/^\/api\/niches\/([\w-]+)\/channels\/([\w-]+)\/refresh$/);
    if (match && req.method === 'POST') {
      const niche = await store.get(match[1]);
      if (!niche) return json(res, 404, { error: 'not found' });
      const channels = [...(niche.channels || [])];
      const ci = channels.findIndex((c) => c.id === match[2]);
      if (ci === -1) return json(res, 404, { error: 'not found' });

      const old = channels[ci];

      let meta;
      try {
        meta = await resolveYouTube(old.watchUrl || old.url);
      } catch (e) {
        if (!(e instanceof ChannelGone)) throw e;
        // Keep every byte of it — notes, thumbnails, the last stats we saw. A
        // channel YouTube took down is still research; it just moves aside.
        channels[ci] = { ...old, removed: true, removedAt: new Date().toISOString(), removedReason: e.reason };
        await store.update(niche.id, { channels });
        return json(res, 200, channels[ci]);
      }

      const fresh = await buildChannel(meta, { notes: old.notes || '' });
      for (const p of [old.avatar, old.thumb, old.banner, ...(old.videoThumbs || [])]) await removeImage(p);
      // Rebuilt from `fresh`, so a channel that came back loses the flag by itself.
      channels[ci] = { ...fresh, id: old.id, addedAt: old.addedAt, kind: old.kind, watchUrl: old.watchUrl };
      await store.update(niche.id, { channels });
      return json(res, 200, channels[ci]);
    }

    match = m(/^\/api\/niches\/([\w-]+)\/channels\/([\w-]+)$/);
    if (match) {
      const niche = await store.get(match[1]);
      if (!niche) return json(res, 404, { error: 'not found' });
      const channels = [...(niche.channels || [])];
      const ci = channels.findIndex((c) => c.id === match[2]);
      if (ci === -1) return json(res, 404, { error: 'not found' });

      if (req.method === 'PATCH') {
        channels[ci] = apply(await readBody(req), { ...channels[ci] }, CHANNEL_FIELDS);
        await store.update(niche.id, { channels });
        return json(res, 200, channels[ci]);
      }
      if (req.method === 'DELETE') {
        await removeImage(channels[ci].avatar);
        await removeImage(channels[ci].thumb);
        channels.splice(ci, 1);
        await store.update(niche.id, { channels });
        return json(res, 200, { ok: true });
      }
    }

    if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    return await serveStatic(res, p);
  } catch (err) {
    return json(res, 400, { error: String(err.message || err) });
  }
}
