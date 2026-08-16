/**
 * "+" button docked next to YouTube's Subscribe button.
 *
 * YouTube is a single-page app that re-renders its header on every navigation,
 * so nothing here is set up once — a tick re-checks the URL, re-finds the
 * Subscribe button, and re-attaches if YouTube threw our node away.
 */

const ID = 'nichecore-root';
const PANEL_ID = 'nichecore-panel';
let panelOpen = false;
let niches = [];
let lastUrl = '';
let rootEl = null;
let panelEl = null;
let busyId = null; // niche id currently receiving the channel
let currentTarget = null;

const SUBSCRIBE_SELECTORS = [
  'yt-subscribe-button-view-model',
  'ytd-subscribe-button-renderer',
  '#subscribe-button-shape',
  '#subscribe-button',
];

const send = (msg) =>
  new Promise((resolve, reject) =>
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      res?.error ? reject(new Error(res.error)) : resolve(res.data);
    }),
  );

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SVG = {
  plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3L2 20h20z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/></svg>',
};

/** Only channel and watch pages carry something worth saving. */
function pageTarget() {
  const u = new URL(location.href);
  if (u.pathname === '/watch' && u.searchParams.get('v')) {
    return { url: `https://www.youtube.com/watch?v=${u.searchParams.get('v')}`, label: 'ye video + channel' };
  }
  if (u.pathname.startsWith('/shorts/')) {
    return { url: `https://www.youtube.com${u.pathname.split('/').slice(0, 3).join('/')}`, label: 'ye short + channel' };
  }
  const ch = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/.exec(u.pathname);
  if (ch) return { url: `https://www.youtube.com/${ch[1]}`, label: 'ye channel' };
  return null;
}

function findAnchor() {
  for (const sel of SUBSCRIBE_SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      // Skip the hidden copies YouTube keeps around for other layouts.
      if (el.getClientRects().length) return anchorSlot(el);
    }
  }
  return null;
}

/**
 * YouTube wraps the Subscribe button in one or more single-child divs that are
 * themselves the flex items of the action row. Dropping our button next to the
 * inner element puts it *inside* that item — it overflows onto its own line and
 * skews the row's flex sizing, which visibly resizes other extensions' buttons.
 * Climbing out to the outermost single-child wrapper makes us a real sibling.
 */
function anchorSlot(el) {
  let node = el;
  while (
    node.parentElement &&
    node.parentElement !== document.body &&
    node.parentElement.children.length === 1
  ) {
    node = node.parentElement;
  }
  return node;
}

/* ---------- dom ---------- */

function statusOptions(active) {
  return ['Researching', 'Future', 'Building', 'Parked']
    .map((s) => `<option value="${s}"${s === active ? ' selected' : ''}>${s}</option>`)
    .join('');
}

function build(target) {
  const el = document.createElement('div');
  el.id = ID;
  // Icon only — a labelled pill overflows YouTube's action row and wraps to its own line.
  el.innerHTML = `
    <button class="nc-btn" id="nc-btn" title="My Niches mein save karo" aria-label="My Niches mein save karo">${SVG.plus}</button>`;
  el.querySelector('#nc-btn').onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel(target);
  };

  // The panel lives at the top of the document, not inside YouTube's button row —
  // that row clips overflow, which would slice a nested dropdown in half.
  panelEl = document.createElement('div');
  panelEl.id = PANEL_ID;
  panelEl.hidden = true;
  panelEl.innerHTML = `
    <div class="nc-head">
      <strong>Save ${esc(target.label)}</strong>
      <button class="nc-x" id="nc-close">✕</button>
    </div>

    <div class="nc-banner" id="nc-banner" hidden></div>

    <div id="nc-main">
      <input class="nc-search" id="nc-search" placeholder="Niche dhoondo…" />
      <div class="nc-list" id="nc-list"></div>
      <form class="nc-new" id="nc-new">
        <input id="nc-new-title" placeholder="+ Naya niche" />
        <select id="nc-new-status">${statusOptions('Researching')}</select>
        <button type="submit" id="nc-new-btn">Add</button>
      </form>
    </div>

    <div class="nc-off" id="nc-off" hidden>
      <div class="nc-off-ico">${SVG.alert}</div>
      <b>Server nahi mil raha</b>
      <p>Jis PC par My Niches chalti hai, wahan <b>start.cmd</b> chalao.<br/>Phir yahan wapas aa kar:</p>
      <button class="nc-retry" id="nc-retry">Dobara check karo</button>
    </div>`;
  document.documentElement.appendChild(panelEl);

  panelEl.querySelector('#nc-close').onclick = () => togglePanel(target, false);
  panelEl.querySelector('#nc-retry').onclick = () => connect(target);
  panelEl.querySelector('#nc-search').oninput = (ev) => renderList(target, ev.target.value);
  panelEl.querySelector('#nc-new').onsubmit = async (ev) => {
    ev.preventDefault();
    if (busyId) return;
    const box = panelEl.querySelector('#nc-new-title');
    const title = box.value.trim();
    if (!title) return;
    // Typing a name that already exists should reuse that niche, not clone it.
    const existing = niches.find((n) => n.title.trim().toLowerCase() === title.toLowerCase());
    if (existing) {
      box.value = '';
      return saveInto(existing, target);
    }
    const btn = panelEl.querySelector('#nc-new-btn');
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const niche = await send({ type: 'create', title, status: panelEl.querySelector('#nc-new-status').value });
      if (!niches.some((n) => n.id === niche.id)) niches.unshift(niche);
      box.value = '';
      await saveInto(niche, target);
    } catch (e) {
      fail(e, target);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add';
    }
  };
  return el;
}

/** Park the panel under the button, nudged left if it would run off-screen. */
function placePanel() {
  if (!panelEl || !rootEl || panelEl.hidden) return;
  const r = rootEl.getBoundingClientRect();
  const width = panelEl.offsetWidth || 330;
  panelEl.style.top = `${Math.round(r.bottom + 10)}px`;
  panelEl.style.left = `${Math.round(Math.max(12, Math.min(r.left, window.innerWidth - width - 16)))}px`;
}

/* ---------- panel states ---------- */

let bannerTimer;
function banner(html, kind) {
  const b = panelEl.querySelector('#nc-banner');
  b.innerHTML = html;
  b.className = `nc-banner ${kind}`;
  b.hidden = false;
  clearTimeout(bannerTimer);
  if (kind === 'ok') bannerTimer = setTimeout(() => (b.hidden = true), 3000);
  placePanel();
}

function setOffline(off) {
  panelEl.querySelector('#nc-main').hidden = off;
  panelEl.querySelector('#nc-off').hidden = !off;
  if (off) panelEl.querySelector('#nc-banner').hidden = true;
  placePanel();
}

function fail(e, target) {
  if (/server band/i.test(e.message)) return setOffline(true);
  banner(esc(e.message), 'bad');
}

/** Flash the + button into a ✓ so the result is visible even after the panel closes. */
function flashButton() {
  const btn = rootEl?.querySelector('#nc-btn');
  if (!btn) return;
  btn.classList.add('nc-done');
  btn.innerHTML = SVG.check;
  setTimeout(() => {
    btn.classList.remove('nc-done');
    btn.innerHTML = SVG.plus;
  }, 2000);
}

/* ---------- data flow ---------- */

async function connect(target) {
  setOffline(false);
  panelEl.querySelector('#nc-list').innerHTML = '<div class="nc-muted nc-loading">Server se connect ho raha hai…</div>';
  try {
    niches = await send({ type: 'niches' });
    renderList(target, panelEl.querySelector('#nc-search')?.value || '');
    placePanel();
  } catch (e) {
    setOffline(true);
  }
}

async function togglePanel(target, force) {
  if (!panelEl) return;
  panelOpen = force === undefined ? !panelOpen : force;
  panelEl.hidden = !panelOpen;
  if (!panelOpen) return;
  panelEl.querySelector('#nc-banner').hidden = true;
  placePanel();
  await connect(target);
  panelEl.querySelector('#nc-search')?.focus();
}

function renderList(target, q) {
  const list = panelEl.querySelector('#nc-list');
  const term = (q || '').trim().toLowerCase();
  const rows = niches.filter((n) => !term || n.title.toLowerCase().includes(term));
  if (!rows.length) {
    list.innerHTML = '<div class="nc-muted">Kuch nahi mila — neeche naya bana lo.</div>';
    return;
  }
  list.innerHTML = rows
    .map((n) => {
      const has = (n.channels || []).some((c) => sameTarget(c, target.url));
      const busy = busyId === n.id;
      const dim = busyId && !busy;
      const right = busy
        ? '<span class="nc-spin"></span><span class="nc-count">Add ho raha…</span>'
        : `<span class="nc-count">${has ? 'already ✓' : `${n.channels?.length || 0}`}</span>`;
      return `<button class="nc-row${has ? ' has' : ''}${busy ? ' busy' : ''}${dim ? ' dim' : ''}" data-id="${n.id}">
        <span class="nc-dot ${esc(n.status)}"></span>
        <span class="nc-name">${esc(n.title)}</span>
        ${right}
      </button>`;
    })
    .join('');
  for (const btn of list.querySelectorAll('.nc-row')) {
    btn.onclick = () => saveInto(niches.find((n) => n.id === btn.dataset.id), target);
  }
}

/** Same channel handle, or the exact same watch URL. */
function sameTarget(channel, url) {
  if (!channel) return false;
  if (channel.watchUrl && channel.watchUrl === url) return true;
  const handle = /\/(@[\w.-]+)/.exec(url)?.[1];
  return !!handle && channel.handle === handle;
}

async function saveInto(niche, target) {
  if (!niche || busyId) return;
  busyId = niche.id;
  panelEl.querySelector('#nc-banner').hidden = true;
  renderList(target, panelEl.querySelector('#nc-search')?.value || '');
  try {
    const ch = await send({ type: 'add', nicheId: niche.id, url: target.url });
    niche.channels = [...(niche.channels || []), ch];
    busyId = null;
    renderList(target, panelEl.querySelector('#nc-search')?.value || '');
    banner(`${SVG.check} <b>${esc(ch.title)}</b> &nbsp;→&nbsp; "${esc(niche.title)}" mein save ho gaya`, 'ok');
    flashButton();
  } catch (e) {
    busyId = null;
    renderList(target, panelEl.querySelector('#nc-search')?.value || '');
    fail(e, target);
  }
}

/* ---------- mount / spa navigation ---------- */

function detach() {
  rootEl?.remove();
  panelEl?.remove();
  rootEl = null;
  panelEl = null;
  panelOpen = false;
  busyId = null;
}

function tick() {
  const navigated = location.href !== lastUrl;
  if (navigated) {
    lastUrl = location.href;
    detach();
  }

  const target = pageTarget();
  if (!target) return detach();
  currentTarget = target;

  const slot = findAnchor();
  if (!slot) return; // header not rendered yet — try again next tick

  if (!rootEl) rootEl = build(target);
  // Re-attach whenever YouTube (or another extension) re-renders the row and
  // drops or displaces our node — this also keeps us right after Subscribe.
  if (rootEl.previousElementSibling !== slot || !document.contains(rootEl)) {
    slot.insertAdjacentElement('afterend', rootEl);
  }
}

document.addEventListener('yt-navigate-finish', tick);
document.addEventListener('click', (e) => {
  if (!panelOpen) return;
  if (rootEl?.contains(e.target) || panelEl?.contains(e.target)) return;
  togglePanel(currentTarget || {}, false);
});
window.addEventListener('scroll', placePanel, { passive: true });
window.addEventListener('resize', placePanel);
setInterval(tick, 600);
tick();
