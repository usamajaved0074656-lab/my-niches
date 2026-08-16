import crypto from 'node:crypto';

/**
 * Optional password gate.
 *
 * No APP_PASSWORD set  -> wide open (local use, unchanged behaviour).
 * APP_PASSWORD set     -> every /api call needs either a signed session cookie
 *                         (browser) or an `x-app-key` header (extension).
 *
 * There are no user accounts: one shared password, one shared library. That is
 * deliberate — this is a personal tool, not a multi-tenant product.
 */

const COOKIE = 'mn_session';
const DAYS = 30;

export const passwordSet = () => Boolean(process.env.APP_PASSWORD);

/** Constant-time compare that also tolerates different lengths. */
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Bumped by logout so existing tokens stop verifying. Stateless tokens have no
// server-side record to delete, so this epoch is the revocation handle.
let epoch = 1;
export const revokeAllSessions = () => (epoch += 1);

function sign(expiry, ep = epoch) {
  return crypto
    .createHmac('sha256', String(process.env.APP_PASSWORD))
    .update(`mn:${ep}:${expiry}`)
    .digest('hex');
}

function makeToken() {
  const expiry = Date.now() + DAYS * 86400_000;
  return `${expiry}.${epoch}.${sign(expiry)}`;
}

function validToken(token) {
  const [expiry, ep, mac] = String(token || '').split('.');
  if (!expiry || !ep || !mac) return false;
  if (Number(ep) !== epoch) return false;
  if (Number(expiry) < Date.now()) return false;
  // Recompute rather than parse — a forged mac cannot survive this.
  return sameSecret(mac, sign(Number(expiry), Number(ep)));
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Behind a proxy (Render) the original scheme arrives in x-forwarded-proto. */
const isHttps = (req) =>
  (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

export function sessionCookie(req) {
  const bits = [
    `${COOKIE}=${makeToken()}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${DAYS * 86400}`,
  ];
  if (isHttps(req)) bits.push('Secure');
  return bits.join('; ');
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`;

/**
 * Returns 'ok' | 'no' | 'locked'.
 *
 * The x-app-key header carries the password itself, so it must go through the
 * same brake as /api/login — otherwise it is an unthrottled password oracle.
 * Cookies are skipped by the brake: they are unforgeable, so a bad one is not
 * a guess worth counting.
 */
export function authorized(req) {
  if (!passwordSet()) return 'ok';

  const key = req.headers['x-app-key'];
  if (key !== undefined && key !== '') {
    if (locked(req)) return 'locked';
    if (sameSecret(key, process.env.APP_PASSWORD)) {
      noteSuccess(req);
      return 'ok';
    }
    noteFailure(req);
    return 'no';
  }

  return validToken(readCookie(req, COOKIE)) ? 'ok' : 'no';
}

/* ---------- brute-force brake ---------- */

const attempts = new Map(); // ip -> { count, until }
const MAX_TRIES = 8;
const LOCK_MS = 10 * 60_000;
const MAX_IPS = 5000;

// A global brake as well as a per-IP one: x-forwarded-for is attacker-supplied,
// so rotating it would otherwise buy unlimited guesses.
const GLOBAL_MAX = 40;
const GLOBAL_WINDOW_MS = 10 * 60_000;
let globalFails = [];

export function clientIp(req) {
  // Proxies append, so the *last* hop is the one our proxy actually saw.
  // Taking the first entry would trust whatever the client sent.
  const chain = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return chain.length ? chain[chain.length - 1] : req.socket.remoteAddress || 'unknown';
}

function globalLocked() {
  const cutoff = Date.now() - GLOBAL_WINDOW_MS;
  globalFails = globalFails.filter((t) => t > cutoff);
  return globalFails.length >= GLOBAL_MAX;
}

export function locked(req) {
  if (globalLocked()) return true;
  const rec = attempts.get(clientIp(req));
  if (!rec) return false;
  if (Date.now() > rec.until) {
    attempts.delete(clientIp(req));
    return false;
  }
  return rec.count >= MAX_TRIES;
}

export function noteFailure(req) {
  const ip = clientIp(req);
  const rec = attempts.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  rec.until = Date.now() + LOCK_MS;
  attempts.set(ip, rec);
  globalFails.push(Date.now());

  // Bounded: a spoofed-header flood must not grow this map forever.
  if (attempts.size > MAX_IPS) {
    const now = Date.now();
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
    if (attempts.size > MAX_IPS) attempts.clear();
  }
}

export function noteSuccess(req) {
  attempts.delete(clientIp(req));
  globalFails = [];
}

export function checkPassword(given) {
  return passwordSet() && sameSecret(given, process.env.APP_PASSWORD);
}
