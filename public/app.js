const STATUSES = [
  { key: 'Researching', color: '#4aa3ff', label: 'Researching' },
  { key: 'Future', color: '#c07bff', label: 'Future ideas' },
  { key: 'Building', color: '#3ce01c', label: 'Building now' },
  { key: 'Parked', color: '#8d8d8d', label: 'Parked' },
];

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * The grid shows one card per CHANNEL. `filter` picks which niche ("group") to
 * show: 'all', 'saved', or a niche id.
 */
const state = { niches: [], filter: 'all', q: '', nicheQ: '', sort: 'new', openNiche: null, openCh: null };

/* ---------- icons (emoji render as tofu boxes on some Windows fonts) ---------- */

const svg = (size, body) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICON = {
  link: svg(13, '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
  note: svg(15, '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  bookmark: svg(15, '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  users: svg(13, '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>'),
  play: svg(13, '<path d="M6 4l14 8-14 8z"/>'),
  compass: svg(24, '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  dot: svg(9, '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>'),
  ring: svg(11, '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>'),
  sliders: svg(15, '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  open: svg(15, '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  close: svg(14, '<path d="M6 6l12 12M18 6L6 18"/>'),
  refresh: svg(14, '<path d="M20 11a8 8 0 1 0-1.6 5.6"/><path d="M20 4v7h-7"/>'),
  pencil: svg(14, '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg(14, '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  dots: svg(15, '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  star: svg(14, '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>'),
};

/* ---------- in-app dialogs (no native prompt/confirm) ---------- */

let dlgResolve = null;

function openDlg({ title, text, input, okLabel = 'OK', danger = false }) {
  $('dlgTitle').textContent = title;
  $('dlgText').textContent = text || '';
  $('dlgText').hidden = !text;
  const box = $('dlgInput');
  box.hidden = input === undefined;
  box.value = input?.value || '';
  box.placeholder = input?.placeholder || '';
  $('dlgOk').textContent = okLabel;
  $('dlgOk').className = danger ? 'btn-ghost danger' : 'btn-primary';
  $('dlg').hidden = false;
  setTimeout(() => (box.hidden ? $('dlgOk') : box).focus(), 30);
  return new Promise((r) => (dlgResolve = r));
}

function settleDlg(value) {
  $('dlg').hidden = true;
  const r = dlgResolve;
  dlgResolve = null;
  r?.(value);
}

const ask = (title, placeholder) => openDlg({ title, input: { placeholder }, okLabel: 'Create' });
const confirmDlg = (title, text, okLabel = 'Delete') => openDlg({ title, text, okLabel, danger: true });

$('dlgOk').onclick = () => settleDlg($('dlgInput').hidden ? true : $('dlgInput').value);
$('dlgCancel').onclick = () => settleDlg(null);
$('dlg').onclick = (e) => {
  if (e.target === $('dlg')) settleDlg(null);
};
$('dlgInput').onkeydown = (e) => {
  if (e.key === 'Enter') settleDlg($('dlgInput').value);
};

/* ---------- floating menu (sidebar rows, cards, context header) ---------- */

let menuEl = null;

function closeMenu() {
  menuEl?.remove();
  menuEl = null;
}

/** items: [{ label, icon?, danger?, checked?, onPick }] — a null entry is a divider. */
function openMenu(anchor, items) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'popmenu';
  el.innerHTML = items
    .map((it, i) =>
      it === null
        ? '<div class="pm-div"></div>'
        : `<button class="pm-item${it.danger ? ' danger' : ''}${it.checked ? ' on' : ''}" data-i="${i}">
             ${it.icon || ''}<span>${esc(it.label)}</span>
           </button>`,
    )
    .join('');
  document.body.appendChild(el);

  // Anchor under the button, pulled back inside the viewport if it would spill.
  const r = anchor.getBoundingClientRect();
  el.style.top = `${Math.round(r.bottom + 6)}px`;
  el.style.left = `${Math.round(Math.min(r.left, window.innerWidth - el.offsetWidth - 12))}px`;
  if (r.bottom + el.offsetHeight > window.innerHeight - 8) {
    el.style.top = `${Math.round(r.top - el.offsetHeight - 6)}px`;
  }

  el.onclick = (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    e.stopPropagation();
    const it = items[Number(b.dataset.i)];
    closeMenu();
    it?.onPick?.();
  };
  menuEl = el;
}

document.addEventListener('click', (e) => {
  if (menuEl && !menuEl.contains(e.target) && !e.target.closest('[data-menu]')) closeMenu();
});
window.addEventListener('resize', closeMenu);

/* ---------- niche actions, shared by every surface ---------- */

async function renameNiche(n) {
  const name = await openDlg({
    title: 'Rename niche',
    input: { value: n.title, placeholder: 'Niche name' },
    okLabel: 'Save',
  });
  if (name === null) return;
  const title = name.trim();
  if (!title || title === n.title) return;
  n.title = title;
  render();
  await api(`/api/niches/${n.id}`, 'PATCH', { title });
  toast('Renamed');
}

async function togglePin(n) {
  n.saved = !n.saved;
  render();
  await api(`/api/niches/${n.id}`, 'PATCH', { saved: n.saved });
  toast(n.saved ? `"${n.title}" pinned` : `"${n.title}" unpinned`);
}

async function deleteNicheById(id) {
  const n = nicheById(id);
  if (!n) return;
  const count = (n.channels || []).length;
  const ok = await confirmDlg(
    `"${n.title}" Delete this?`,
    count
      ? `${count} channels and all their notes will go too. This cannot be undone.`
      : 'Its notes will go too. This cannot be undone.',
  );
  if (!ok) return;
  await api(`/api/niches/${n.id}`, 'DELETE');
  state.niches = state.niches.filter((x) => x.id !== n.id);
  if (state.filter === n.id) state.filter = 'all';
  render();
  toast('Niche deleted');
}

function nicheMenu(anchor, n) {
  openMenu(anchor, [
    { label: 'Rename', icon: ICON.pencil, onPick: () => renameNiche(n) },
    { label: n.saved ? 'Unpin' : 'Pin to top', icon: ICON.star, onPick: () => togglePin(n) },
    { label: 'Settings & notes', icon: ICON.note, onPick: () => openNicheDrawer(n.id) },
    null,
    { label: 'Delete niche', icon: ICON.trash, danger: true, onPick: () => deleteNicheById(n.id) },
  ]);
}

/** Move one channel into another niche, straight from its card. */
function moveMenu(anchor, ch, from) {
  const targets = state.niches.filter((n) => n.id !== from.id);
  openMenu(anchor, [
    { label: 'Open on YouTube', icon: ICON.open, onPick: () => window.open(linkOf(ch), '_blank', 'noopener') },
    { label: 'Notes', icon: ICON.note, onPick: () => openChannelDrawer(from.id, ch.id) },
    { label: 'Refresh data', icon: ICON.refresh, onPick: () => refreshChannel(from, ch) },
    null,
    ...(targets.length
      ? targets.slice(0, 12).map((n) => ({
          label: `→ ${n.title}`,
          onPick: () => moveChannel(from, ch, n),
        }))
      : [{ label: 'No other niche', onPick: () => {} }]),
    null,
    { label: 'Remove from this niche', icon: ICON.trash, danger: true, onPick: () => removeChannel(from, ch) },
  ]);
}

/** Re-fetch a channel's live stats, avatar, banner and latest uploads. */
async function refreshChannel(niche, ch, btn) {
  if (btn?.dataset.busy) return;
  if (btn) {
    btn.dataset.busy = '1';
    btn.classList.add('spinning');
  }
  try {
    const fresh = await api(`/api/niches/${niche.id}/channels/${ch.id}/refresh`, 'POST');
    const i = niche.channels.findIndex((c) => c.id === fresh.id);
    niche.channels[i] = fresh;
    render();
    toast(`${fresh.title} refreshed`);
  } catch (e) {
    toast(e.message, true);
    if (btn) {
      delete btn.dataset.busy;
      btn.classList.remove('spinning');
    }
  }
}

async function moveChannel(from, ch, to) {
  try {
    const moved = await api(`/api/niches/${from.id}/channels/${ch.id}/move`, 'POST', { to: to.id });
    from.channels = from.channels.filter((c) => c.id !== ch.id);
    to.channels = [...(to.channels || []), moved];
    render();
    toast(`${moved.title} → ${to.title}`);
  } catch (e) {
    toast(e.message, true);
  }
}

async function removeChannel(from, ch) {
  const ok = await confirmDlg(`"${ch.title}" Remove this?`, `"${from.title}" will be removed from it, notes included.`, 'Remove');
  if (!ok) return;
  await api(`/api/niches/${from.id}/channels/${ch.id}`, 'DELETE');
  from.channels = from.channels.filter((c) => c.id !== ch.id);
  render();
  toast('Channel removed');
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = bad ? 'toast bad' : 'toast';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

/* ---------- api ---------- */

async function api(url, method = 'GET', body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') {
    showLock('Session expired — enter your password again.');
    throw new Error('unauthorized');
  }
  if (!r.ok) throw new Error(data.error || `${method} ${url} failed`);
  return data;
}

const load = async () => {
  state.niches = await api('/api/niches');
  render();
};

/* ---------- helpers ---------- */

const statusOf = (n) => STATUSES.find((s) => s.key === n.status) || STATUSES[0];
const nicheById = (id) => state.niches.find((n) => n.id === id);

function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (!iso || Number.isNaN(d)) return '';
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 30) return `${Math.floor(d)}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// "1.15K subs" / "5.91M subs" -> a number, for sorting.
function subCount(text) {
  const m = /([\d.,]+)\s*([KMB])?/i.exec(text || '');
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, '')) || 0;
  return n * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1);
}

/**
 * Images: try this machine's mirror in data/uploads first, fall back to the
 * YouTube CDN URL. The mirror only exists on the machine that saved the
 * channel, so on a second device every local path 404s and the fallback is
 * what actually renders.
 */
function pic(local, remote, cls = '') {
  const a = safeUrl(local);
  const b = safeUrl(remote);
  const src = a || b;
  if (!src) return '';
  const fb = a && b ? ` data-fallback="${esc(b)}"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt=""${fb} />`;
}

document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    img.src = img.dataset.fallback;
    delete img.dataset.fallback; // one retry only, no loop
  },
  true, // capture — image errors do not bubble
);

/**
 * Only http(s) may reach an href or src. Escaping alone does not stop
 * `javascript:` — a value that survived an import of hand-edited JSON could
 * otherwise become a clickable script.
 */
function safeUrl(u) {
  // Guard the empty case first: new URL('', origin) resolves to the page itself,
  // which would turn "no image" into a broken <img src="http://localhost:5173/">.
  if (!u) return '';
  try {
    const parsed = new URL(String(u), location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

const avatarOf = (c) => safeUrl(c.avatar || c.avatarUrl || '');
// Prefer the readable @handle URL over the /channel/UC… canonical form.
const linkOf = (c) =>
  safeUrl(c.watchUrl || (c.handle ? `https://www.youtube.com/${c.handle}` : c.url)) || 'https://www.youtube.com/';
/**
 * The channel's top videos. New records carry a `videos` array with views, age
 * and duration; channels saved before that still have parallel arrays, so they
 * keep rendering (without the numbers) until they are refreshed.
 */
function videosOf(c) {
  if (Array.isArray(c.topVideos) && c.topVideos.length) {
    return c.topVideos.map((v, i) => ({
      title: v.title || '',
      views: v.views || '',
      age: v.age || '',
      duration: v.duration || '',
      thumb: (c.videoThumbs || [])[i] || '',
      thumbUrl: v.thumbUrl || (c.videoThumbUrls || [])[i] || '',
    }));
  }
  const titles = c.videoTitles || [];
  return stripOf(c).map(([thumb, thumbUrl], i) => ({
    title: titles[i] || '', views: '', age: '', duration: '', thumb, thumbUrl,
  }));
}

// Pairs of [localPath, remoteUrl] for the channel's latest uploads.
const stripOf = (c) => {
  const local = c.videoThumbs || [];
  const remote = c.videoThumbUrls || [];
  const n = Math.max(local.length, remote.length);
  const pairs = Array.from({ length: n }, (_, i) => [local[i] || '', remote[i] || '']).filter((p) => p[0] || p[1]);
  return pairs.length ? pairs : [[c.thumb || '', c.thumbUrl || '']].filter((p) => p[0] || p[1]);
};

/* ---------- channel list ---------- */

/** Every channel, each tagged with the niche it belongs to. */
function allChannels() {
  return state.niches.flatMap((n) => (n.channels || []).map((c) => ({ ch: c, niche: n })));
}

/** Taken down by YouTube. Kept, but out of the way of the working library. */
const isGone = (r) => !!r.ch.removed;
const liveChannels = () => allChannels().filter((r) => !isGone(r));
const goneChannels = () => allChannels().filter(isGone);

function matches({ ch, niche }, q) {
  if (!q) return true;
  const hay = [
    ch.title, ch.handle, ch.notes, ch.videoTitle, (ch.videoTitles || []).join(' '),
    niche.title, niche.notes, (niche.tags || []).join(' '),
  ].join(' ').toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function visible() {
  const gone = state.filter === 'removed';
  let rows = allChannels().filter((r) => isGone(r) === gone);
  rows = rows.filter((r) => matches(r, state.q.trim().toLowerCase()));
  if (state.filter !== 'all' && !gone) rows = rows.filter((r) => r.niche.id === state.filter);

  const by = {
    new: (a, b) => new Date(b.ch.addedAt || 0) - new Date(a.ch.addedAt || 0),
    old: (a, b) => new Date(a.ch.addedAt || 0) - new Date(b.ch.addedAt || 0),
    subs: (a, b) => subCount(b.ch.subs) - subCount(a.ch.subs),
    title: (a, b) => String(a.ch.title).localeCompare(String(b.ch.title)),
  };
  return rows.sort(by[state.sort] || by.new);
}

/* ---------- render: filters ---------- */

/**
 * Sidebar is the only navigation now — the pills row said exactly the same thing
 * and cost three rows of vertical space once the library passed ~20 niches.
 * Saved niches surface as PINNED so the handful used daily stay at the top.
 */
function renderSidebar() {
  const total = liveChannels().length;
  const gone = goneChannels().length;
  const q = state.nicheQ.trim().toLowerCase();
  const hit = (n) => !q || n.title.toLowerCase().includes(q);

  const pinned = state.niches.filter((n) => n.saved && hit(n));
  const rest = state.niches.filter((n) => !n.saved && hit(n));
  const liveCount = (n) => (n.channels || []).filter((c) => !c.removed).length;

  // The ⋯ sits inside the row but stops the row's own click, so tapping it
  // opens the menu instead of switching niche.
  const row = (key, label, count, color, isNiche = false) =>
    `<div class="nav-row${state.filter === key ? ' active' : ''}">
       <button class="nav-item" data-f="${esc(key)}" title="${esc(label)}">
         <span class="dot-sm" style="background:${color}"></span>
         <span class="nav-name">${esc(label)}</span>
         <span class="badge">${count}</span>
       </button>
       ${isNiche ? `<button class="nav-more" data-menu data-niche="${esc(key)}" title="Rename, pin, delete">${ICON.dots}</button>` : ''}
     </div>`;

  const section = (title) => `<div class="nav-sec">${esc(title)}</div>`;

  let html = '';
  if (!q) html += row('all', 'All channels', total, '#8d8d8d');
  if (pinned.length) {
    html += section('★ Pinned');
    html += pinned.map((n) => row(n.id, n.title, liveCount(n), statusOf(n).color, true)).join('');
  }
  if (rest.length) {
    html += section(pinned.length ? 'All niches' : 'Niches');
    html += rest.map((n) => row(n.id, n.title, liveCount(n), statusOf(n).color, true)).join('');
  }
  if (!pinned.length && !rest.length) html += '<div class="nav-none">No niches found</div>';
  if (gone && !q) {
    html += section('Gone');
    html += row('removed', 'Removed by YouTube', gone, '#ff5d5d');
  }

  $('groupNav').innerHTML = html;
  $('countLabel').textContent =
    `${total} channel${total === 1 ? '' : 's'} · ${state.niches.length} niche${state.niches.length === 1 ? '' : 's'}`;

  renderCtx();
}

/** Header above the grid: what is on screen, plus actions for it. */
function renderCtx() {
  const n = nicheById(state.filter);
  const shown = visible().length;

  if (n) {
    const s = statusOf(n);
    $('ctxTitle').textContent = n.title;
    $('ctxPill').textContent = s.label;
    $('ctxPill').style.color = s.color;
    $('ctxPill').style.borderColor = `${s.color}55`;
    $('ctxPill').style.background = `${s.color}1f`;
    $('ctxPill').hidden = false;
    $('ctxActs').hidden = false;
    $('pinBtn').innerHTML = `${ICON.star} ${n.saved ? 'Pinned' : 'Pin'}`;
    $('pinBtn').classList.toggle('on', Boolean(n.saved));
    $('renameBtn').innerHTML = `${ICON.pencil} Rename`;
    $('ctxMore').innerHTML = ICON.dots;
    $('gbUrl').placeholder = `Paste a YouTube link to add it to "${n.title}"`;
  } else {
    $('ctxTitle').textContent = state.filter === 'removed' ? 'Removed by YouTube' : 'All channels';
    $('ctxPill').textContent = String(shown);
    $('ctxPill').style.color = 'var(--muted)';
    $('ctxPill').style.borderColor = 'var(--line-hi)';
    $('ctxPill').style.background = 'transparent';
    $('ctxPill').hidden = false;
    $('ctxActs').hidden = true;
    $('gbAdd').hidden = true;
  }
}

/* ---------- render: channel cards ---------- */

function channelCard({ ch, niche }) {
  const st = statusOf(niche);
  const vids = videosOf(ch).slice(0, 3);
  const meta = [ch.handle, ch.subs, ch.videos].filter(Boolean).map(esc).join(' · ');
  const av = avatarOf(ch);

  const bn = ch.banner || ch.bannerUrl;

  return `<article class="card${ch.removed ? ' is-gone' : ''}" data-cid="${esc(ch.id)}" data-nid="${esc(niche.id)}">
    <div class="card-banner">${bn ? pic(ch.banner, ch.bannerUrl) : ''}</div>
    ${
      ch.removed
        ? `<div class="gone-flag" title="${esc(ch.removedReason || '')}">
             Removed by YouTube${ch.removedAt ? ` · ${esc(ago(ch.removedAt))}` : ''}
           </div>`
        : ''
    }
    <div class="card-head">
      ${
        av
          ? pic(ch.avatar, ch.avatarUrl, 'head-av')
          : `<div class="head-av">${esc((ch.title || '?').trim().charAt(0).toUpperCase())}</div>`
      }
      <div class="who">
        <span class="who-name">
          <b>${esc(ch.title)}</b>
          <a class="pv-open" href="${esc(linkOf(ch))}" target="_blank" rel="noopener" data-stop
             title="Open on YouTube">${ICON.link}</a>
        </span>
        <span class="when">${esc(meta || '—')}</span>
        ${ch.description ? `<span class="who-desc">${esc(ch.description)}</span>` : ''}
      </div>
      <button class="status" data-stop data-f="${esc(niche.id)}"
        style="color:${st.color};border-color:${st.color}55;background:${st.color}1f"
        title="Show only this niche’s channels">${esc(niche.title)}</button>
    </div>

    ${
      vids.length
        ? `<div class="vids">
             ${vids
               .map(
                 (v) => `<figure class="vid">
                    <span class="vid-thumb">
                      ${pic(v.thumb, v.thumbUrl)}
                      ${v.duration ? `<span class="vid-dur">${esc(v.duration)}</span>` : ''}
                    </span>
                    <figcaption class="vid-title">${esc(v.title)}</figcaption>
                    <span class="vid-meta">${[v.views, v.age].filter(Boolean).map(esc).join(' · ')}</span>
                  </figure>`,
               )
               .join('')}
           </div>`
        : '<div class="vids empty-vids">NO VIDEOS FOUND</div>'
    }

    <div class="card-body">
      <div class="note-row">
        <p class="note-preview${ch.notes ? '' : ' is-empty'}">${esc(ch.notes || 'No notes yet')}</p>
        <button class="note-btn${ch.notes ? ' on' : ''}" data-stop data-note="${esc(ch.id)}" data-nid="${esc(niche.id)}"
          title="${ch.notes ? 'Open notes' : 'Write notes'}">${ICON.note}</button>
      </div>
      <div class="card-foot">
        <span class="chip">${ICON.play} ${esc(ago(ch.addedAt) || 'added')}</span>
        ${ch.subs ? `<span class="chip">${ICON.users} ${esc(ch.subs)}</span>` : ''}
        <span class="foot-acts">
          <button class="card-more" data-stop data-refresh="${esc(ch.id)}" data-nid="${esc(niche.id)}"
            title="Re-fetch subs, videos and thumbnails">${ICON.refresh}</button>
          <button class="card-more" data-menu data-move="${esc(ch.id)}" data-nid="${esc(niche.id)}"
            title="Move, notes, remove">${ICON.dots}</button>
          <button class="save${niche.saved ? ' on' : ''}" data-stop data-save="${esc(niche.id)}"
            title="${niche.saved ? 'Unpin this niche' : 'Pin this niche to the top of the sidebar'}">${ICON.bookmark}</button>
        </span>
      </div>
    </div>
  </article>`;
}

function render() {
  renderSidebar();
  const rows = visible();
  $('grid').innerHTML = rows.map(channelCard).join('');
  $('empty').hidden = rows.length > 0;

  const hasAny = allChannels().length > 0;
  $('emptyTitle').textContent = hasAny ? 'Nothing here' : 'No channels yet';
  $('emptyMsg').textContent = hasAny
    ? 'Try another niche or a different search.'
    : state.niches.length
      ? 'Paste a link above to add the first channel.'
      : 'Create your first niche, then start adding channels to it.';
  $('addBtnEmpty').hidden = hasAny || state.niches.length > 0;

  for (const b of $('filtersMenu').querySelectorAll('[data-sort]')) {
    b.classList.toggle('on', b.dataset.sort === state.sort);
  }
  if (state.openNiche) renderNicheDrawer();
  if (state.openCh) renderChannelDrawer();
}

/* ---------- channel drawer ---------- */

const openChannel = () => {
  const n = nicheById(state.openCh?.nid);
  const c = (n?.channels || []).find((x) => x.id === state.openCh?.cid);
  return c ? { ch: c, niche: n } : null;
};

function renderChannelDrawer() {
  const found = openChannel();
  if (!found) return closeChannelDrawer();
  const { ch, niche } = found;
  $('chDrawer').hidden = false;

  $('chHead').innerHTML = `
    ${avatarOf(ch) ? pic(ch.avatar, ch.avatarUrl, 'dh-av') : '<div class="dh-av"></div>'}
    <div class="dh-text">
      <span class="dh-name">
        ${esc(ch.title)}
        <a class="pv-open" href="${esc(linkOf(ch))}" target="_blank" rel="noopener"
           title="Open on YouTube">${ICON.open}</a>
      </span>
      <span class="dh-meta">${[ch.handle, ch.subs, ch.videos].filter(Boolean).map(esc).join(' · ') || '—'}</span>
    </div>`;

  $('chGroup').innerHTML = state.niches
    .map((n) => `<option value="${esc(n.id)}"${n.id === niche.id ? ' selected' : ''}>${esc(n.title)}</option>`)
    .join('');

  const vids = videosOf(ch);
  $('chBody').innerHTML = `
    ${ch.videoTitle ? `<p class="vt">Saved video: “${esc(ch.videoTitle)}”</p>` : ''}
    ${
      vids.length
        ? `<div class="block">
             <div class="block-head"><h3>Top videos</h3></div>
             <div class="vids wide">
               ${vids
                 .map(
                   (v) => `<figure class="vid">
                      <span class="vid-thumb">
                        ${pic(v.thumb, v.thumbUrl)}
                        ${v.duration ? `<span class="vid-dur">${esc(v.duration)}</span>` : ''}
                      </span>
                      <figcaption class="vid-title">${esc(v.title)}</figcaption>
                      <span class="vid-meta">${[v.views, v.age].filter(Boolean).map(esc).join(' · ')}</span>
                    </figure>`,
                 )
                 .join('')}
             </div>
           </div>`
        : ''
    }
    <div class="block">
      <div class="block-head"><h3>Notes for this channel</h3></div>
      <textarea id="chNotes" class="notes-area" rows="10"
        placeholder="Hook style, thumbnail pattern, what to copy…">${esc(ch.notes || '')}</textarea>
    </div>
    ${ch.description ? `<p class="muted small">${esc(ch.description.slice(0, 400))}</p>` : ''}`;

  $('chNotes').oninput = (e) => patchChannel({ notes: e.target.value });
}

function openChannelDrawer(nid, cid) {
  state.openCh = { nid, cid };
  renderChannelDrawer();
}

function closeChannelDrawer() {
  flushChannel();
  state.openCh = null;
  $('chDrawer').hidden = true;
  render();
  setTimeout(syncNow, 800);
}

/* ---------- niche drawer ---------- */

function renderNicheDrawer() {
  const n = nicheById(state.openNiche);
  if (!n) return closeNicheDrawer();
  $('drawer').hidden = false;
  $('d_title').value = n.title || '';
  $('d_status').innerHTML = STATUSES.map(
    (s) => `<option value="${esc(s.key)}"${n.status === s.key ? ' selected' : ''}>${esc(s.label)}</option>`,
  ).join('');
  $('d_tags').value = (n.tags || []).join(', ');
  if (document.activeElement !== $('d_notes')) $('d_notes').value = n.notes || '';
  const count = (n.channels || []).length;
  $('d_count').textContent = `${count} channel${count === 1 ? '' : 's'} is niche mein.`;
}

function openNicheDrawer(id) {
  state.openNiche = id;
  renderNicheDrawer();
}

function closeNicheDrawer() {
  flushNiche();
  state.openNiche = null;
  $('drawer').hidden = true;
  render();
  setTimeout(syncNow, 800);
}

/* ---------- autosave ---------- */

function flashSaved(which = 'saveState') {
  const el = $(which);
  el.textContent = 'saved';
  el.classList.add('on');
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => el.classList.remove('on'), 1200);
}

let nicheTimer;
let pendingNiche = null; // { id, patch } — batched so a fast field never cancels a slow one

async function flushNiche() {
  clearTimeout(nicheTimer);
  if (!pendingNiche) return;
  const { id, patch } = pendingNiche;
  pendingNiche = null;
  await api(`/api/niches/${id}`, 'PATCH', patch);
  flashSaved('saveState');
}

function patchNiche(patch, immediate = false) {
  const n = nicheById(state.openNiche);
  if (!n) return;
  Object.assign(n, patch);
  if (pendingNiche && pendingNiche.id !== n.id) flushNiche();
  pendingNiche = { id: n.id, patch: { ...(pendingNiche?.patch || {}), ...patch } };
  clearTimeout(nicheTimer);
  if (immediate) flushNiche();
  else nicheTimer = setTimeout(flushNiche, 500);
}

let chTimer;
let pendingCh = null;

async function flushChannel() {
  clearTimeout(chTimer);
  if (!pendingCh) return;
  const { nid, cid, patch } = pendingCh;
  pendingCh = null;
  await api(`/api/niches/${nid}/channels/${cid}`, 'PATCH', patch);
  flashSaved('chSaveState');
}

function patchChannel(patch) {
  const found = openChannel();
  if (!found) return;
  Object.assign(found.ch, patch);
  if (pendingCh && pendingCh.cid !== found.ch.id) flushChannel();
  pendingCh = { nid: found.niche.id, cid: found.ch.id, patch: { ...(pendingCh?.patch || {}), ...patch } };
  clearTimeout(chTimer);
  chTimer = setTimeout(flushChannel, 500);
}

/* ---------- events ---------- */

document.addEventListener('click', async (e) => {
  // Links and inline controls inside a card must not also open the drawer.
  const stop = e.target.closest('[data-stop]');
  const f = e.target.closest('[data-f]');
  if (f) {
    e.stopPropagation();
    state.filter = f.dataset.f;
    closeSideDrawer(); // narrow screens: picking a niche should reveal the grid
    render();
    return;
  }

  const nicheMenuBtn = e.target.closest('[data-niche]');
  if (nicheMenuBtn) {
    e.stopPropagation();
    const n = nicheById(nicheMenuBtn.dataset.niche);
    if (n) nicheMenu(nicheMenuBtn, n);
    return;
  }

  const refreshBtn = e.target.closest('[data-refresh]');
  if (refreshBtn) {
    e.stopPropagation();
    const n = nicheById(refreshBtn.dataset.nid);
    const c = (n?.channels || []).find((x) => x.id === refreshBtn.dataset.refresh);
    if (n && c) refreshChannel(n, c, refreshBtn);
    return;
  }

  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) {
    e.stopPropagation();
    const from = nicheById(moveBtn.dataset.nid);
    const ch = (from?.channels || []).find((c) => c.id === moveBtn.dataset.move);
    if (from && ch) moveMenu(moveBtn, ch, from);
    return;
  }

  const note = e.target.closest('[data-note]');
  if (note) {
    e.stopPropagation();
    openChannelDrawer(note.dataset.nid, note.dataset.note);
    setTimeout(() => {
      const ta = $('chNotes');
      ta?.focus();
      ta?.setSelectionRange(ta.value.length, ta.value.length);
    }, 80);
    return;
  }

  const save = e.target.closest('[data-save]');
  if (save) {
    e.stopPropagation();
    const n = nicheById(save.dataset.save);
    n.saved = !n.saved;
    await api(`/api/niches/${n.id}`, 'PATCH', { saved: n.saved });
    render();
    return;
  }

  if (stop) {
    e.stopPropagation();
    return;
  }

  const card = e.target.closest('.card');
  if (card) openChannelDrawer(card.dataset.nid, card.dataset.cid);
});

for (const [id, fn] of [
  ['chClose', closeChannelDrawer],
  ['chDone', closeChannelDrawer],
  ['closeDrawer', closeNicheDrawer],
  ['doneBtn', closeNicheDrawer],
]) {
  $(id).onclick = fn;
}
$('chClose').innerHTML = ICON.close;
$('closeDrawer').innerHTML = ICON.close;

$('chDrawer').addEventListener('click', (e) => {
  if (e.target === $('chDrawer')) closeChannelDrawer();
});
$('drawer').addEventListener('click', (e) => {
  if (e.target === $('drawer')) closeNicheDrawer();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('sideScrim').hidden) return closeSideDrawer();
  if (!$('dlg').hidden) return settleDlg(null);
  if (!$('chDrawer').hidden) return closeChannelDrawer();
  if (!$('drawer').hidden) return closeNicheDrawer();
});

/* move a channel to another niche */
$('chGroup').onchange = async (e) => {
  const found = openChannel();
  const target = nicheById(e.target.value);
  if (!found || !target || target.id === found.niche.id) return;
  await flushChannel();
  try {
    const moved = await api(`/api/niches/${found.niche.id}/channels/${found.ch.id}/move`, 'POST', { to: target.id });
    found.niche.channels = found.niche.channels.filter((c) => c.id !== found.ch.id);
    target.channels = [...(target.channels || []), moved];
    state.openCh = { nid: target.id, cid: moved.id };
    render();
    toast(`${moved.title} → ${target.title}`);
  } catch (err) {
    toast(err.message, true);
    renderChannelDrawer();
  }
};

$('chRefresh').onclick = async () => {
  const found = openChannel();
  if (!found) return;
  $('chRefresh').disabled = true;
  $('chRefresh').textContent = 'Refreshing…';
  await refreshChannel(found.niche, found.ch);
  $('chRefresh').disabled = false;
  $('chRefresh').textContent = 'Refresh stats';
};

$('chDelete').onclick = async () => {
  const found = openChannel();
  if (!found) return;
  const ok = await confirmDlg(
    `"${found.ch.title}" Remove this?`,
    `"${found.niche.title}" will lose it, notes included. This cannot be undone.`,
    'Remove',
  );
  if (!ok) return;
  await api(`/api/niches/${found.niche.id}/channels/${found.ch.id}`, 'DELETE');
  found.niche.channels = found.niche.channels.filter((c) => c.id !== found.ch.id);
  closeChannelDrawer();
  toast('Channel removed');
};

/* niche settings */
$('pinBtn').onclick = () => {
  const n = nicheById(state.filter);
  if (n) togglePin(n);
};

$('renameBtn').onclick = () => {
  const n = nicheById(state.filter);
  if (n) renameNiche(n);
};

$('ctxMore').onclick = (e) => {
  const n = nicheById(state.filter);
  if (n) nicheMenu(e.currentTarget, n);
};

$('gbAddBtn').onclick = () => {
  $('gbAdd').hidden = !$('gbAdd').hidden;
  $('gbErr').hidden = true;
  if (!$('gbAdd').hidden) $('gbUrl').focus();
};
$('gbCancel').onclick = () => {
  $('gbAdd').hidden = true;
  $('gbUrl').value = '';
  $('gbErr').hidden = true;
};
$('d_title').oninput = (e) => patchNiche({ title: e.target.value });
$('d_notes').oninput = (e) => patchNiche({ notes: e.target.value });
$('d_status').onchange = (e) => patchNiche({ status: e.target.value }, true);
$('d_tags').oninput = (e) =>
  patchNiche({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) });

$('deleteNiche').onclick = async () => {
  const id = state.openNiche;
  closeNicheDrawer();
  await deleteNicheById(id);
};

/* add channel into the selected niche */
$('gbAdd').onsubmit = async (e) => {
  e.preventDefault();
  const n = nicheById(state.filter);
  const url = $('gbUrl').value.trim();
  if (!n || !url) return;
  $('gbBtn').disabled = true;
  $('gbBtn').textContent = 'Fetching…';
  $('gbErr').hidden = true;
  try {
    const ch = await api(`/api/niches/${n.id}/channels`, 'POST', { url });
    if (ch.duplicate) {
      $('gbErr').textContent = `"${ch.title}" is already in this niche.`;
      $('gbErr').hidden = false;
      return;
    }
    n.channels = [...(n.channels || []), ch];
    $('gbUrl').value = '';
    $('gbAdd').hidden = true;
    render();
    toast(`${ch.title} added`);
  } catch (err) {
    $('gbErr').textContent = err.message;
    $('gbErr').hidden = false;
  } finally {
    $('gbBtn').disabled = false;
    $('gbBtn').textContent = 'Add channel';
  }
};

async function addNiche() {
  const title = await ask('New niche', 'e.g. AI Wildlife Docs');
  if (title === null) return;
  const n = await api('/api/niches', 'POST', { title: title.trim() || 'Untitled niche' });
  // Server reuses an existing niche when the name matches — don't list it twice.
  if (!nicheById(n.id)) state.niches.unshift(n);
  else toast(`"${n.title}" already exists — opened it`);
  state.filter = n.id;
  render();
  $('gbAdd').hidden = false;
  $('gbUrl').focus();
}

for (const id of ['addBtn', 'addBtnSide', 'addBtnEmpty']) $(id).onclick = addNiche;

$('search').oninput = (e) => {
  state.q = e.target.value;
  render();
};

/* On narrow screens the sidebar is off-canvas; ☰ slides it in. */
const openSideDrawer = () => {
  $('sidebar').classList.add('open');
  $('sideScrim').hidden = false;
};
function closeSideDrawer() {
  $('sidebar').classList.remove('open');
  $('sideScrim').hidden = true;
}
$('menuBtn').onclick = openSideDrawer;
$('sideScrim').onclick = closeSideDrawer;

$('nicheFind').oninput = (e) => {
  state.nicheQ = e.target.value;
  renderSidebar();
};

$('filtersBtn').onclick = (e) => {
  e.stopPropagation();
  $('filtersMenu').hidden = !$('filtersMenu').hidden;
};
$('filtersMenu').onclick = (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  state.sort = b.dataset.sort;
  $('filtersMenu').hidden = true;
  render();
};
document.addEventListener('click', (e) => {
  if (!$('filtersMenu').hidden && !e.target.closest('.filters-wrap')) $('filtersMenu').hidden = true;
});

$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(state.niches, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `my-niches-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${state.niches.length} niches exported`);
};

$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const res = await api('/api/import', 'POST', JSON.parse(await file.text()));
    await load();
    toast(`${res.added} niches imported${res.skipped ? `, ${res.skipped} already existed` : ''}`);
  } catch (err) {
    toast(err.message, true);
  }
};

/* ---------- multi-device sync ----------
 * Supabase is the shared source of truth, so another device's writes are
 * already in the database — this just pulls them in without a manual reload.
 * Skipped while a drawer is open so it can never overwrite what is being typed.
 */

const SYNC_MS = 15000;

async function syncNow() {
  if (!$('drawer').hidden || !$('chDrawer').hidden || !$('dlg').hidden) return;
  if (document.hidden) return;
  try {
    const rows = await api('/api/niches');
    // Compared against live state, not a stored snapshot — our own edits are
    // already in state, so only another device's changes trigger a re-render.
    if (JSON.stringify(rows) === JSON.stringify(state.niches)) return;
    state.niches = rows;
    render();
    toast('New data arrived');
  } catch {
    /* server ya net down — agle tick par phir koshish */
  }
}

setInterval(syncNow, SYNC_MS);
window.addEventListener('focus', syncNow);
document.addEventListener('visibilitychange', () => !document.hidden && syncNow());

/* ---------- login gate ---------- */

function showLock(msg) {
  $('lock').hidden = false;
  $('lockErr').hidden = !msg;
  $('lockErr').textContent = msg || '';
  setTimeout(() => $('lockPass').focus(), 40);
}

$('lockForm').onsubmit = async (e) => {
  e.preventDefault();
  $('lockBtn').disabled = true;
  $('lockBtn').textContent = 'Checking…';
  try {
    await api('/api/login', 'POST', { password: $('lockPass').value });
    $('lock').hidden = true;
    $('lockPass').value = '';
    await load();
  } catch (err) {
    showLock(err.message);
  } finally {
    $('lockBtn').disabled = false;
    $('lockBtn').textContent = 'Unlock';
  }
};

async function boot() {
  const gate = await api('/api/auth');
  if (gate.required && !gate.authorized) return showLock();
  await load();
}

$('emptyIcon').innerHTML = ICON.compass;
$('filtersIcon').innerHTML = ICON.sliders;
boot().catch((e) => toast(e.message, true));
