const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const send = (msg) =>
  new Promise((resolve, reject) =>
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      res?.error ? reject(new Error(res.error)) : resolve(res.data);
    }),
  );

const CHECK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';

let niches = [];
let target = null;
let busyId = null;

function targetFrom(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$/.test(u.hostname) && u.hostname !== 'youtu.be') return null;
  if (u.hostname === 'youtu.be') return { url: `https://www.youtube.com/watch?v=${u.pathname.slice(1)}`, label: 'video' };
  if (u.pathname === '/watch' && u.searchParams.get('v')) {
    return { url: `https://www.youtube.com/watch?v=${u.searchParams.get('v')}`, label: 'video' };
  }
  if (u.pathname.startsWith('/shorts/')) {
    return { url: `https://www.youtube.com${u.pathname.split('/').slice(0, 3).join('/')}`, label: 'short' };
  }
  const ch = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/.exec(u.pathname);
  return ch ? { url: `https://www.youtube.com/${ch[1]}`, label: 'channel' } : null;
}

function banner(html, kind) {
  const b = $('banner');
  b.innerHTML = html;
  b.className = `banner ${kind}`;
  b.hidden = false;
}

function setOffline(off) {
  $('main').hidden = off;
  $('off').hidden = !off;
}

const sameTarget = (channel, url) => {
  if (!channel) return false;
  if (channel.watchUrl && channel.watchUrl === url) return true;
  const handle = /\/(@[\w.-]+)/.exec(url)?.[1];
  return !!handle && channel.handle === handle;
};

function render(q = '') {
  const term = q.trim().toLowerCase();
  const rows = niches.filter((n) => !term || n.title.toLowerCase().includes(term));
  $('list').innerHTML = rows.length
    ? rows
        .map((n) => {
          const has = (n.channels || []).some((c) => sameTarget(c, target.url));
          const busy = busyId === n.id;
          const right = busy
            ? '<span class="spin"></span>'
            : `<span class="c">${has ? 'already ✓' : n.channels?.length || 0}</span>`;
          return `<button class="row${busy ? ' busy' : ''}${busyId && !busy ? ' dim' : ''}${has ? ' has' : ''}" data-id="${n.id}">
             <span class="n">${esc(n.title)}</span>${right}
           </button>`;
        })
        .join('')
    : '<div class="muted">Koi niche nahi mila.</div>';

  for (const btn of $('list').querySelectorAll('.row')) {
    btn.onclick = async () => {
      if (busyId) return;
      const niche = niches.find((n) => n.id === btn.dataset.id);
      busyId = niche.id;
      $('banner').hidden = true;
      render($('search').value);
      try {
        const ch = await send({ type: 'add', nicheId: niche.id, url: target.url });
        niche.channels = [...(niche.channels || []), ch];
        busyId = null;
        render($('search').value);
        banner(`${CHECK} <b>${esc(ch.title)}</b> → "${esc(niche.title)}" mein save ho gaya`, 'ok');
      } catch (e) {
        busyId = null;
        render($('search').value);
        if (/server band/i.test(e.message)) setOffline(true);
        else banner(esc(e.message), 'bad');
      }
    };
  }
}

async function connect() {
  setOffline(false);
  $('list').innerHTML = '<div class="muted">Server se connect ho raha hai…</div>';
  try {
    niches = await send({ type: 'niches' });
    render();
  } catch {
    setOffline(true);
  }
}

$('search').oninput = (e) => render(e.target.value);
$('retry').onclick = connect;
$('openApp').onclick = async () => {
  const { base } = await send({ type: 'getApiBase' });
  chrome.tabs.create({ url: base });
};

$('toggleCfg').onclick = async () => {
  const box = $('cfg');
  box.hidden = !box.hidden;
  if (box.hidden) return;
  const s = await send({ type: 'getSettings' });
  $('cfgBase').value = s.base;
  $('cfgKey').value = s.key;
};

$('cfgSave').onclick = async () => {
  await send({ type: 'saveSettings', base: $('cfgBase').value, key: $('cfgKey').value });
  $('cfg').hidden = true;
  banner('Settings save ho gayi', 'ok');
  await connect();
};

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  target = targetFrom(tab?.url || '');
  $('target').textContent = target
    ? `${target.label}: ${target.url.replace('https://www.youtube.com/', '')}`
    : 'Ye YouTube ka channel/video page nahi hai.';
  if (!target) {
    $('list').innerHTML = '<div class="muted">Kisi channel ya video page par jao, phir yahan se save karo.</div>';
    return;
  }
  await connect();
})();
