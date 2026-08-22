/**
 * Every network call lives here. Because the manifest declares host_permissions
 * for localhost:5173, fetches from the service worker skip CORS entirely — the
 * content script never touches the API directly.
 */

const DEFAULT_API = 'http://localhost:5173';

async function settings() {
  const { apiBase, appKey } = await chrome.storage.local.get(['apiBase', 'appKey']);
  return { base: (apiBase || DEFAULT_API).replace(/\/$/, ''), key: appKey || '' };
}

/**
 * The password only ever leaves this machine over https, or to localhost.
 * A typo'd http:// address must not put it on the wire in plaintext.
 */
function keyAllowed(base) {
  try {
    const u = new URL(base);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

async function call(path, method = 'GET', body) {
  const { base, key } = await settings();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (key) {
    if (!keyAllowed(base)) {
      throw new Error('Password sirf https ya localhost par bheja ja sakta hai — server ka address theek karo.');
    }
    headers['x-app-key'] = key; // hosted server ka password
  }
  let r;
  try {
    r = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      base.includes('localhost')
        ? 'My Niches server band hai — start.cmd chalao.'
        : `Server se raabta nahi ho raha (${base}).`,
    );
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('Password ghalat ya set nahi — extension settings mein daalo.');
  if (!r.ok) throw new Error(data.error || `${method} ${path} failed`);
  return data;
}

const HANDLERS = {
  ping: () => call('/api/config'),
  niches: () => call('/api/niches'),
  create: ({ title, status }) => call('/api/niches', 'POST', { title, status }),
  add: ({ nicheId, url, notes }) => call(`/api/niches/${nicheId}/channels`, 'POST', { url, notes }),
  note: ({ nicheId, chId, notes }) => call(`/api/niches/${nicheId}/channels/${chId}`, 'PATCH', { notes }),
  saveSettings: async ({ base, key }) => {
    await chrome.storage.local.set({ apiBase: (base || DEFAULT_API).trim(), appKey: (key || '').trim() });
    return { ok: true };
  },
  getSettings: async () => settings(),
  getApiBase: async () => ({ base: (await settings()).base }),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const fn = HANDLERS[msg?.type];
  if (!fn) {
    sendResponse({ error: `unknown message ${msg?.type}` });
    return false;
  }
  Promise.resolve(fn(msg))
    .then((data) => sendResponse({ data }))
    .catch((err) => sendResponse({ error: String(err.message || err) }));
  return true; // keep the channel open for the async reply
});
