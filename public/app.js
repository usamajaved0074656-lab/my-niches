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
const state = { niches: [], filter: 'all', q: '', sort: 'new', openNiche: null, openCh: null };

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
    showLock('Session khatam ho gaya — dobara password daalo.');
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

function matches({ ch, niche }, q) {
  if (!q) return true;
  const hay = [
    ch.title, ch.handle, ch.notes, ch.videoTitle, (ch.videoTitles || []).join(' '),
    niche.title, niche.notes, (niche.tags || []).join(' '),
  ].join(' ').toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function visible() {
  let rows = allChannels().filter((r) => matches(r, state.q.trim().toLowerCase()));
  if (state.filter === 'saved') rows = rows.filter((r) => r.niche.saved);
  else if (state.filter !== 'all') rows = rows.filter((r) => r.niche.id === state.filter);

  const by = {
    new: (a, b) => new Date(b.ch.addedAt || 0) - new Date(a.ch.addedAt || 0),
    old: (a, b) => new Date(a.ch.addedAt || 0) - new Date(b.ch.addedAt || 0),
    subs: (a, b) => subCount(b.ch.subs) - subCount(a.ch.subs),
    title: (a, b) => String(a.ch.title).localeCompare(String(b.ch.title)),
  };
  return rows.sort(by[state.sort] || by.new);
}

/* ---------- render: filters ---------- */

function renderFilters() {
  const total = allChannels().length;
  const savedCount = allChannels().filter((r) => r.niche.saved).length;

  const items = [
    { key: 'all', label: 'All channels', count: total, icon: ICON.ring },
    ...state.niches.map((n) => ({
      key: n.id,
      label: n.title,
      count: (n.channels || []).length,
      color: statusOf(n).color,
    })),
    { key: 'saved', label: 'Saved', count: savedCount, icon: ICON.bookmark },
  ];

  $('pills').innerHTML = items
    .map(
      (i) =>
        `<button class="pill${state.filter === i.key ? ' active' : ''}" data-f="${esc(i.key)}">
           ${esc(i.label)} <span class="n">${i.count}</span>
         </button>`,
    )
    .join('');

  $('groupNav').innerHTML = items
    .map(
      (i) =>
        `<button class="nav-item${state.filter === i.key ? ' active' : ''}" data-f="${esc(i.key)}">
           <span class="ico" style="color:${i.color || 'inherit'}">${i.icon || ICON.dot}</span>
           ${esc(i.label)} <span class="badge">${i.count}</span>
         </button>`,
    )
    .join('');

  $('countLabel').textContent =
    `${total} channel${total === 1 ? '' : 's'} · ${state.niches.length} niche${state.niches.length === 1 ? '' : 's'}`;

  // Group toolbar only makes sense with a single niche selected.
  const n = nicheById(state.filter);
  $('groupbar').hidden = !n;
  if (n) {
    const s = statusOf(n);
    $('gbDot').style.background = s.color;
    $('gbTitle').innerHTML = `${esc(n.title)} <span class="gb-status" style="color:${s.color}">${esc(s.label)}</span>`;
    $('gbUrl').placeholder = `YouTube link paste karo — "${n.title}" mein add ho jayega`;
  }
}

/* ---------- render: channel cards ---------- */

function channelCard({ ch, niche }) {
  const s = statusOf(niche);
  const strip = stripOf(ch).slice(0, 3);
  const titles = ch.videoTitles || [];
  const meta = [ch.handle, ch.subs, ch.videos].filter(Boolean).map(esc).join(' · ');
  const av = avatarOf(ch);

  return `<article class="card" data-cid="${esc(ch.id)}" data-nid="${esc(niche.id)}">
    <div class="card-head">
      ${av ? pic(ch.avatar, ch.avatarUrl, 'head-av') : `<div class="head-av">${esc((ch.title || '?').trim().charAt(0).toUpperCase())}</div>`}
      <div class="who">
        <span class="who-name">
          <b>${esc(ch.title)}</b>
          <a class="pv-open" href="${esc(linkOf(ch))}" target="_blank" rel="noopener" data-stop
             title="YouTube par kholo">${ICON.link}</a>
        </span>
        <span class="when">${esc(meta || '—')}</span>
      </div>
      <button class="status" data-stop data-f="${esc(niche.id)}"
        style="color:${s.color};border-color:${s.color}55;background:${s.color}1f"
        title="Sirf is niche ke channels dikhao">${esc(niche.title)}</button>
    </div>

    ${
      strip.length
        ? `<div class="cover">
             ${pic(ch.banner, ch.bannerUrl, 'pv-banner')}
             <div class="pv-strip">
               ${strip
                 .map(
                   ([l, r], i) => `<figure>
                      ${pic(l, r)}
                      ${titles[i] ? `<figcaption>${esc(titles[i])}</figcaption>` : ''}
                    </figure>`,
                 )
                 .join('')}
             </div>
           </div>`
        : '<div class="cover blank">NO VIDEOS FOUND</div>'
    }

    <div class="card-body">
      <div class="note-row">
        <p class="note-preview${ch.notes ? '' : ' is-empty'}">${esc(ch.notes || 'Notes abhi khaali hain')}</p>
        <button class="note-btn${ch.notes ? ' on' : ''}" data-stop data-note="${esc(ch.id)}" data-nid="${esc(niche.id)}"
          title="${ch.notes ? 'Notes kholo' : 'Notes likho'}">${ICON.note}</button>
      </div>
      <div class="card-foot">
        <span class="chip">${ICON.play} ${esc(ago(ch.addedAt) || 'added')}</span>
        ${ch.subs ? `<span class="chip">${ICON.users} ${esc(ch.subs)}</span>` : ''}
        <button class="save${niche.saved ? ' on' : ''}" data-stop data-save="${esc(niche.id)}"
          title="Poora niche save karo">${ICON.bookmark}</button>
      </div>
    </div>
  </article>`;
}

function render() {
  renderFilters();
  const rows = visible();
  $('grid').innerHTML = rows.map(channelCard).join('');
  $('empty').hidden = rows.length > 0;

  const hasAny = allChannels().length > 0;
  $('emptyTitle').textContent = hasAny ? 'Yahan kuch nahi mila' : 'Abhi koi channel nahi hai';
  $('emptyMsg').textContent = hasAny
    ? 'Koi dusra niche ya search try karo.'
    : state.niches.length
      ? 'Upar link paste kar ke pehla channel add karo.'
      : 'Pehla niche bana kar usme channels dalna shuru karo.';
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
           title="YouTube par kholo">${ICON.open}</a>
      </span>
      <span class="dh-meta">${[ch.handle, ch.subs, ch.videos].filter(Boolean).map(esc).join(' · ') || '—'}</span>
    </div>`;

  $('chGroup').innerHTML = state.niches
    .map((n) => `<option value="${esc(n.id)}"${n.id === niche.id ? ' selected' : ''}>${esc(n.title)}</option>`)
    .join('');

  const strip = stripOf(ch);
  const titles = ch.videoTitles || [];
  $('chBody').innerHTML = `
    ${ch.videoTitle ? `<p class="vt">Saved video: “${esc(ch.videoTitle)}”</p>` : ''}
    ${
      strip.length
        ? `<div class="block">
             <div class="block-head"><h3>Latest uploads</h3></div>
             <div class="pv-strip wide">
               ${strip
                 .map(
                   ([l, r], i) => `<figure>
                      ${pic(l, r)}
                      ${titles[i] ? `<figcaption>${esc(titles[i])}</figcaption>` : ''}
                    </figure>`,
                 )
                 .join('')}
             </div>
           </div>`
        : ''
    }
    <div class="block">
      <div class="block-head"><h3>Is channel ke notes</h3></div>
      <textarea id="chNotes" class="notes-area" rows="10"
        placeholder="Hook style, thumbnail pattern, kya copy karna hai…">${esc(ch.notes || '')}</textarea>
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
    render();
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
  try {
    const fresh = await api(`/api/niches/${found.niche.id}/channels/${found.ch.id}/refresh`, 'POST');
    const i = found.niche.channels.findIndex((c) => c.id === fresh.id);
    found.niche.channels[i] = fresh;
    render();
    toast(`${fresh.title} refresh ho gaya`);
  } catch (err) {
    toast(err.message, true);
  } finally {
    $('chRefresh').disabled = false;
    $('chRefresh').textContent = 'Refresh stats';
  }
};

$('chDelete').onclick = async () => {
  const found = openChannel();
  if (!found) return;
  const ok = await confirmDlg(
    `"${found.ch.title}" hata dein?`,
    `"${found.niche.title}" se nikal jayega, uske notes bhi. Wapas nahi aayega.`,
    'Remove',
  );
  if (!ok) return;
  await api(`/api/niches/${found.niche.id}/channels/${found.ch.id}`, 'DELETE');
  found.niche.channels = found.niche.channels.filter((c) => c.id !== found.ch.id);
  closeChannelDrawer();
  toast('Channel hata diya');
};

/* niche settings */
$('gbSettings').onclick = () => openNicheDrawer(state.filter);
$('d_title').oninput = (e) => patchNiche({ title: e.target.value });
$('d_notes').oninput = (e) => patchNiche({ notes: e.target.value });
$('d_status').onchange = (e) => patchNiche({ status: e.target.value }, true);
$('d_tags').oninput = (e) =>
  patchNiche({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) });

$('deleteNiche').onclick = async () => {
  const n = nicheById(state.openNiche);
  if (!n) return;
  const count = (n.channels || []).length;
  const ok = await confirmDlg(
    `"${n.title}" delete karein?`,
    count
      ? `${count} channel aur unke saath sare notes bhi chale jayenge. Wapas nahi aayega.`
      : 'Iske notes bhi chale jayenge. Wapas nahi aayega.',
  );
  if (!ok) return;
  await api(`/api/niches/${n.id}`, 'DELETE');
  state.niches = state.niches.filter((x) => x.id !== n.id);
  if (state.filter === n.id) state.filter = 'all';
  closeNicheDrawer();
  toast('Niche delete ho gaya');
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
    n.channels = [...(n.channels || []), ch];
    $('gbUrl').value = '';
    render();
    toast(`${ch.title} add ho gaya`);
  } catch (err) {
    $('gbErr').textContent = err.message;
    $('gbErr').hidden = false;
  } finally {
    $('gbBtn').disabled = false;
    $('gbBtn').textContent = 'Add channel';
  }
};

async function addNiche() {
  const title = await ask('Naya niche', 'e.g. AI Wildlife Docs');
  if (title === null) return;
  const n = await api('/api/niches', 'POST', { title: title.trim() || 'Untitled niche' });
  // Server reuses an existing niche when the name matches — don't list it twice.
  if (!nicheById(n.id)) state.niches.unshift(n);
  else toast(`"${n.title}" pehle se hai — wahi khol diya`);
  state.filter = n.id;
  render();
  $('gbUrl').focus();
}

for (const id of ['addBtn', 'addBtnSide', 'addBtnEmpty']) $(id).onclick = addNiche;

$('search').oninput = (e) => {
  state.q = e.target.value;
  render();
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
  toast(`${state.niches.length} niches export ho gaye`);
};

$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const res = await api('/api/import', 'POST', JSON.parse(await file.text()));
    await load();
    toast(`${res.added} niches import hue${res.skipped ? `, ${res.skipped} pehle se maujood the` : ''}`);
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
    toast('Naya data aa gaya');
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
  $('lockBtn').textContent = 'Check ho raha…';
  try {
    await api('/api/login', 'POST', { password: $('lockPass').value });
    $('lock').hidden = true;
    $('lockPass').value = '';
    await load();
  } catch (err) {
    showLock(err.message);
  } finally {
    $('lockBtn').disabled = false;
    $('lockBtn').textContent = 'Kholo';
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
