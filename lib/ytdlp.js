import { execFile } from 'node:child_process';

/**
 * Optional second source for channel data.
 *
 * The HTML scraper is the primary path: it is the only one that carries the
 * "N ago" upload age, and it needs nothing installed — which matters because
 * the hosted build has no binaries. But YouTube rate-limits it after a couple
 * of dozen rapid requests, which is exactly what a bulk refresh does. yt-dlp
 * goes through YouTube's own API instead, so it keeps working when scraping
 * starts failing. Used only as a fallback, and only when it is installed.
 */

let cached = null;

export function ytdlpAvailable() {
  if (cached !== null) return cached;
  cached = new Promise((resolve) => {
    execFile('yt-dlp', ['--version'], { timeout: 10_000 }, (err) => resolve(!err));
  });
  return cached;
}

const run = (args, timeout) =>
  new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr || '';
        return reject(err);
      }
      resolve(stdout);
    });
  });

/**
 * YouTube's own wording for a channel that no longer exists. Matched only
 * against these exact phrases: a timeout or a rate-limit must never be read as
 * "removed", or one bad afternoon would empty the library.
 */
const GONE = [
  [/removed because it violated/i, 'Removed by YouTube for violating Community Guidelines.'],
  [/account (has been|was) terminated/i, 'The account behind this channel was terminated.'],
  [/channel does not exist/i, 'This channel no longer exists on YouTube.'],
  [/channel is (not available|no longer available)/i, 'This channel is no longer available on YouTube.'],
];

/**
 * Our own wording for what YouTube said, rather than a slice of its page: the
 * notice sits in a wall of minified script, so quoting it verbatim is noise.
 */
export const goneReason = (text) => {
  if (!text) return '';
  for (const [re, say] of GONE) if (re.test(text)) return say;
  return '';
};

const humanViews = (n) => {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K views`;
  return `${n} views`;
};

const humanSubs = (n) => {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1e6) return `${+(n / 1e6).toFixed(2)}M subs`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(2)}K subs`;
  return `${n} subs`;
};

const clock = (secs) => {
  if (!Number.isFinite(secs) || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Returns { title, subs, videos: [{ id, title, views, duration }] }, or
 * { gone: reason } when YouTube says the channel no longer exists, or null when
 * the lookup simply failed and nothing can be concluded from it.
 * Videos come back ranked by view count — the channel's best, not its newest.
 */
export async function ytdlpChannel(channelUrl, limit = 6, scan = 30) {
  if (!channelUrl || !(await ytdlpAvailable())) return null;
  const url = `${channelUrl.replace(/\/$/, '')}/videos`;
  try {
    const out = await run(
      ['--flat-playlist', '--dump-single-json', '--playlist-items', `1-${scan}`, '--no-warnings', url],
      120_000,
    );
    const o = JSON.parse(out);
    const videos = (o.entries || [])
      .filter((e) => e && e.id)
      .map((e) => ({
        id: e.id,
        title: e.title || '',
        viewsRaw: Number(e.view_count) || 0,
        views: humanViews(Number(e.view_count)),
        age: '', // flat mode carries no upload date; the HTML path supplies it
        duration: clock(Number(e.duration)),
      }))
      .sort((a, b) => b.viewsRaw - a.viewsRaw)
      .slice(0, limit)
      .map(({ viewsRaw, ...v }) => v);

    return {
      title: o.channel || o.uploader || '',
      subs: humanSubs(Number(o.channel_follower_count)),
      description: (o.description || '').split('\n')[0].slice(0, 300),
      videos,
    };
  } catch (e) {
    const gone = goneReason(e?.stderr || e?.message);
    return gone ? { gone } : null;
  }
}
