/* =========================================================
   app.js — core runtime: storage, icons, UI helpers, router, shell
   Loaded after data.js and before the role modules.
   ========================================================= */
window.SP = window.SP || {};

/* ---------------------------------------------------------
   Storage: localStorage guarded by try/catch, with an
   in-memory fallback (private mode, blocked storage, etc.)
   --------------------------------------------------------- */
SP.Store = (function () {
  const KEY = 'hygiq:v1';
  const mem = {};
  let ok = true;
  try { localStorage.setItem('__sp', '1'); localStorage.removeItem('__sp'); } catch (e) { ok = false; }

  const raw = {
    get(k) { try { return ok ? localStorage.getItem(k) : mem[k] ?? null; } catch (e) { return mem[k] ?? null; } },
    set(k, v) { mem[k] = v; try { if (ok) localStorage.setItem(k, v); } catch (e) { /* quota or blocked */ } },
    del(k) { delete mem[k]; try { if (ok) localStorage.removeItem(k); } catch (e) {} },
  };

  let state;
  try { state = JSON.parse(raw.get(KEY)); } catch (e) { state = null; }
  if (!state || state.version !== 4) state = SP.seedState();

  return {
    persistent: ok,
    get state() { return state; },
    save() { raw.set(KEY, JSON.stringify(state)); },
    reset() { state = SP.seedState(); this.save(); },
    raw,
  };
})();

/* ---------------------------------------------------------
   Session: "remember me" → persisted; otherwise this tab only.
   --------------------------------------------------------- */
SP.Session = (function () {
  const KEY = 'hygiq:session';
  let current = null;
  try { current = JSON.parse(SP.Store.raw.get(KEY)) || JSON.parse(sessionStorage.getItem(KEY)); } catch (e) {}
  return {
    get user() { return current ? SP.Store.state.users.find((u) => u.id === current.userId) || null : null; },
    login(user, remember) {
      current = { userId: user.id };
      const v = JSON.stringify(current);
      if (remember) SP.Store.raw.set(KEY, v);
      try { sessionStorage.setItem(KEY, v); } catch (e) {}
    },
    logout() {
      current = null;
      SP.Store.raw.del(KEY);
      try { sessionStorage.removeItem(KEY); } catch (e) {}
    },
  };
})();

/* ---------------------------------------------------------
   Utilities
   --------------------------------------------------------- */
SP.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
SP.$ = (sel, root = document) => root.querySelector(sel);
SP.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
SP.uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 8);
SP.fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
SP.fmtDate = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
SP.relTime = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  return Math.round(h / 24) + ' d ago';
};
SP.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------
   Inline SVG icon set (Lucide-style strokes)
   --------------------------------------------------------- */
const ICONS = {
  logo: '<path d="M12 2.5 4 6v6c0 5 3.4 8.6 8 9.5 4.6-.9 8-4.5 8-9.5V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  chef: '<path d="M6 13.9A4 4 0 1 1 8.4 6.3a4.5 4.5 0 0 1 7.2 0A4 4 0 1 1 18 13.9V20H6z"/><path d="M6 17h12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  badge: '<path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z"/><path d="M9 12h6M12 9v6"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 9h3M14 15h3"/>',
  thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  camera: '<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z"/><circle cx="12" cy="13" r="3.5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.2 13.6 7 22l5-3 5 3-1.2-8.4"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  alert: '<path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z"/>',
  siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6M5 21h14a0 0 0 0 0 0 0v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  store: '<path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
};
SP.icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

/* ---------------------------------------------------------
   Toasts
   --------------------------------------------------------- */
SP.toast = function (msg, tone = 'safe', title) {
  let host = SP.$('#toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-' + tone;
  el.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
  const ic = { safe: 'check', warn: 'alert', danger: 'siren', info: 'bell' }[tone] || 'bell';
  el.innerHTML = `${SP.icon(ic)}<div>${title ? `<strong>${SP.esc(title)}</strong>` : ''}<span>${SP.esc(msg)}</span></div>
    <button class="icon-btn sm" aria-label="Dismiss notification">${SP.icon('x')}</button>`;
  el.querySelector('button').onclick = () => close();
  host.appendChild(el);
  const t = setTimeout(close, 4500);
  function close() { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 250); }
};

/* ---------------------------------------------------------
   Modal (accessible: focus trap-lite, Esc to close)
   --------------------------------------------------------- */
SP.modal = function ({ title, body, actions = [], wide = false }) {
  const prev = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <header><h2 id="m-title">${SP.esc(title)}</h2><button class="icon-btn" data-close aria-label="Close dialog">${SP.icon('x')}</button></header>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<footer>${actions.map((a, i) => `<button class="btn ${a.kind || 'ghost'}" data-act="${i}">${a.label}</button>`).join('')}</footer>` : ''}
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  actions.forEach((a, i) => wrap.querySelector(`[data-act="${i}"]`).addEventListener('click', () => { if (a.onClick?.(wrap) !== false) close(); }));
  setTimeout(() => (wrap.querySelector('input,select,textarea,button:not([data-close])') || wrap.querySelector('button'))?.focus(), 30);
  return { el: wrap, close };
};

/* ---------------------------------------------------------
   Theme (light / dark / system)
   --------------------------------------------------------- */
SP.Theme = {
  init() {
    const t = SP.Store.raw.get('hygiq:theme');
    if (t) document.documentElement.dataset.theme = t;
  },
  isDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  },
  toggle() {
    const next = this.isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    SP.Store.raw.set('hygiq:theme', next);
    SP.$$('[data-theme-toggle]').forEach((b) => (b.innerHTML = SP.icon(next === 'dark' ? 'sun' : 'moon')));
  },
  button() {
    return `<button class="icon-btn" data-theme-toggle aria-label="Toggle dark mode">${SP.icon(this.isDark() ? 'sun' : 'moon')}</button>`;
  },
};

/* ---------------------------------------------------------
   Shared components
   --------------------------------------------------------- */
SP.ui = {
  brand(small) {
    return `<a href="#/" class="brand ${small ? 'sm' : ''}" aria-label="${SP.APP_NAME} home">
      <span class="brand-mark">${SP.icon('logo')}</span><span class="brand-name">${SP.APP_NAME}</span></a>`;
  },
  scorePill(score) {
    const t = SP.scoreTone(score);
    return `<span class="pill pill-${t}" aria-label="Hygiene score ${score} of 100, ${SP.scoreLabel(score)}">${score}</span>`;
  },
  empty(icon, title, text, action = '') {
    return `<div class="empty">${SP.icon(icon)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
  },
  skeleton(n = 4) {
    return `<div class="skel-grid" aria-busy="true" aria-label="Loading">${'<div class="skel"></div>'.repeat(n)}</div>`;
  },
  /* Semi-circular animated gauge. Call SP.ui.animateGauge(el, value) after insert. */
  gauge(id) {
    return `<div class="gauge" id="${id}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-label="Hygiene score">
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <path class="g-track" d="M20 110 A80 80 0 0 1 180 110" pathLength="100"/>
        <path class="g-fill" d="M20 110 A80 80 0 0 1 180 110" pathLength="100" stroke-dasharray="0 100"/>
      </svg>
      <div class="g-val"><strong>0</strong><span>/100</span></div>
      <div class="g-label">—</div>
    </div>`;
  },
  animateGauge(el, value) {
    if (!el) return;
    const from = +el.dataset.v || 0;
    el.dataset.v = value;
    const tone = SP.scoreTone(value);
    el.className = 'gauge tone-' + tone + (value < from ? ' dropped' : '');
    el.setAttribute('aria-valuenow', value);
    el.querySelector('.g-fill').setAttribute('stroke-dasharray', `${value} 100`);
    el.querySelector('.g-label').textContent = SP.scoreLabel(value);
    const num = el.querySelector('.g-val strong');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { num.textContent = value; return; }
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / 700);
      num.textContent = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
};

/* ---------------------------------------------------------
   Router — hash based so it works from file:// and Vercel.
   Routes register with SP.route(pattern, handler, {role}).
   --------------------------------------------------------- */
SP.routes = [];
SP.route = (pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  SP.routes.push({ re, keys, handler, opts });
};
SP.go = (path) => { location.hash = '#' + path; };
SP.cleanups = [];
SP.onLeave = (fn) => SP.cleanups.push(fn);

SP.homeFor = (role) => ({ kitchen: '/kitchen', consumer: '/consumer', regulator: '/regulator' }[role] || '/');

SP.render = function () {
  SP.cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) {} });
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const app = SP.$('#app');
  for (const r of SP.routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    // Role guard: each role sees only its own dashboard
    if (r.opts.role) {
      const u = SP.Session.user;
      if (!u) { SP.toast('Please sign in to continue.', 'info'); return SP.go('/login/' + r.opts.role); }
      if (u.role !== r.opts.role) { SP.toast('That area belongs to a different role.', 'warn'); return SP.go(SP.homeFor(u.role)); }
    }
    app.classList.remove('page-in');
    void app.offsetWidth; // restart the transition
    app.classList.add('page-in');
    try { r.handler(app, params); }
    catch (err) {
      console.error(err);
      app.innerHTML = `<main class="center-page">${SP.ui.empty('alert', 'Something went wrong', 'This screen failed to load. Your data is safe.', '<a class="btn primary" href="#/">Back to home</a>')}</main>`;
    }
    window.scrollTo(0, 0);
    return;
  }
  app.innerHTML = `<main class="center-page">${SP.ui.empty('alert', 'Page not found', 'That link does not lead anywhere.', '<a class="btn primary" href="#/">Back to home</a>')}</main>`;
};

/* ---------------------------------------------------------
   Dashboard shell — sidebar on desktop, bottom tabs on mobile
   --------------------------------------------------------- */
SP.shell = function ({ role, nav, active, title, subtitle, content, actions = '' }) {
  const u = SP.Session.user;
  const items = nav.map((n) => `<a href="#${n.href}" class="nav-item ${n.id === active ? 'active' : ''}" ${n.id === active ? 'aria-current="page"' : ''}>
      ${SP.icon(n.icon)}<span>${n.label}</span>${n.badge ? `<em class="nav-badge">${n.badge}</em>` : ''}</a>`).join('');
  return `<div class="shell role-${role}">
    <aside class="sidebar" aria-label="Main navigation">
      ${SP.ui.brand()}
      <nav>${items}</nav>
      <div class="side-foot">
        <div class="me"><span class="avatar">${SP.esc(u.name[0])}</span><div><strong>${SP.esc(u.name)}</strong><small>${{ kitchen: 'Kitchen manager', consumer: 'Customer', regulator: 'Food safety officer' }[role]}</small></div></div>
        <button class="btn ghost block" data-logout>${SP.icon('logout')} Sign out</button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="mobile-brand">${SP.ui.brand(true)}</div>
        <div class="titles"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
        <div class="top-actions">${actions}<button class="btn ghost sm hide-xs" data-demo aria-label="Run hackathon demo mode">${SP.icon('play')} Demo</button>${SP.Theme.button()}<button class="icon-btn mobile-only" data-logout aria-label="Sign out">${SP.icon('logout')}</button></div>
      </header>
      <main id="view" class="view" tabindex="-1">${content}</main>
    </div>
    <nav class="bottombar" aria-label="Main navigation">${items}</nav>
  </div>`;
};

/* Global delegated handlers */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-theme-toggle]')) SP.Theme.toggle();
  if (e.target.closest('[data-logout]')) { SP.Session.logout(); SP.toast('You have been signed out.', 'info'); SP.go('/'); }
});

window.addEventListener('hashchange', SP.render);
window.addEventListener('DOMContentLoaded', () => {
  SP.Theme.init();
  if (!SP.Store.persistent) setTimeout(() => SP.toast('Browser storage is blocked — data will reset when you close the tab.', 'warn'), 600);
  SP.render();
});
