/* =========================================================
   consumer.js — Customer side
   Explore outlets · QR kitchen transparency · Allergy Guard ·
   complaints · barcode/label check. Also the public /outlet/:id page
   that an outlet's QR code opens (no login needed).
   ========================================================= */
(function () {
  const { icon, esc, $, $$ } = SP;
  const S = () => SP.Store.state;
  const me = () => SP.Session.user;
  const save = () => SP.Store.save();
  SP.Consumer = {};

  const NAV = [
    { id: 'explore', label: 'Explore', icon: 'store', href: '/consumer' },
    { id: 'allergy', label: 'Allergy Guard', icon: 'shield', href: '/consumer/allergy' },
    { id: 'scan', label: 'Label check', icon: 'zap', href: '/consumer/scan' },
    { id: 'complaints', label: 'Report', icon: 'alert', href: '/consumer/complaints' },
  ];

  /* ---------------- shared helpers ---------------- */
  const scoreOf = (o) => SP.computeScore(S().kitchens[o.id]);

  /* Allergy Guard: unsafe = contains allergen, caution = cross-contact risk */
  SP.dishRisk = (dish, allergies = []) => {
    const hit = dish.allergens.filter((a) => allergies.includes(a));
    if (hit.length) return { level: 'unsafe', hit };
    const may = dish.mayContain.filter((a) => allergies.includes(a));
    if (may.length) return { level: 'caution', hit: may };
    return { level: 'safe', hit: [] };
  };

  /* Public URL that the QR encodes. Works on any static host. */
  SP.outletUrl = (id) => location.href.split('#')[0] + '#/outlet/' + encodeURIComponent(id);

  /* Render a real, scannable QR (qrcodejs from cdnjs). Falls back to a link if the CDN is unreachable. */
  SP.renderQR = function (el, text, size = 176) {
    if (!el) return;
    el.innerHTML = '';
    if (typeof window.QRCode !== 'function') {
      el.innerHTML = `<p class="muted" style="font-size:13px">QR library could not load (offline?). Share this link instead:<br><a href="${esc(text)}">${esc(text)}</a></p>`;
      return;
    }
    new window.QRCode(el, { text, width: size, height: size, colorDark: '#0f1f17', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'QR code linking to ' + text);
  };
  SP.qrCard = (o) => `<section class="card stack" style="text-align:center;justify-items:center">
      <div class="card-head" style="margin:0;width:100%"><h2>Kitchen QR</h2><span class="pill pill-info">Scan me</span></div>
      <div class="qr-box" id="qr-${esc(o.id)}"></div>
      <p class="muted" style="font-size:13px;max-width:260px">Scan to see ${esc(o.name)}'s live temperature logs, cleaning and training records.</p>
      <div class="row" style="justify-content:center"><button class="btn ghost sm" data-qr-dl="${esc(o.id)}">${icon('download')} Download QR</button>
      <a class="btn ghost sm" href="#/outlet/${esc(o.id)}">${icon('eye')} Open public view</a></div>
    </section>`;
  SP.bindQR = (o) => {
    SP.renderQR($('#qr-' + o.id), SP.outletUrl(o.id));
    $(`[data-qr-dl="${o.id}"]`)?.addEventListener('click', () => {
      const box = $('#qr-' + o.id);
      const src = box.querySelector('canvas')?.toDataURL('image/png') || box.querySelector('img')?.src;
      if (!src) return SP.toast('QR not available offline.', 'warn');
      const a = Object.assign(document.createElement('a'), { href: src, download: `hygiq-qr-${o.name.replace(/\W+/g, '-').toLowerCase()}.png` });
      document.body.appendChild(a); a.click(); a.remove();
      SP.toast('QR code downloaded. Print it for your counter or tables.', 'safe');
    });
  };

  /* ---------------- transparency panel (used by outlet page + public QR page) ---------------- */
  SP.transparency = function (o) {
    const k = S().kitchens[o.id];
    const today = new Date().toDateString();
    const todays = k.tempLog.filter((l) => new Date(l.at).toDateString() === today);
    const items = Object.values(k.checklist).flat();
    const doneN = items.filter((i) => i.done).length;
    const trained = k.staff.filter((s) => s.badges.length > 0).length;
    const cleanH = (Date.now() - new Date(k.lastCleaning)) / 3600000;
    return `
      <div class="grid g4">
        <div class="card kpi"><span class="ki bg-${cleanH < 4 ? 'safe' : cleanH < 8 ? 'warn' : 'danger'}">${icon('refresh')}</span><div><strong>${SP.relTime(k.lastCleaning)}</strong><span>last deep clean</span></div></div>
        <div class="card kpi"><span class="ki bg-${doneN / items.length > 0.6 ? 'safe' : 'warn'}">${icon('list')}</span><div><strong>${doneN}/${items.length}</strong><span>HACCP checks today</span></div></div>
        <div class="card kpi"><span class="ki bg-${trained / k.staff.length >= 0.75 ? 'safe' : 'warn'}">${icon('award')}</span><div><strong>${trained}/${k.staff.length}</strong><span>staff trained</span></div></div>
        <div class="card kpi"><span class="ki bg-${k.sensors.every(SP.inRange) ? 'safe' : 'danger'}">${icon('thermo')}</span><div><strong>${k.sensors.filter(SP.inRange).length}/${k.sensors.length}</strong><span>units in safe range</span></div></div>
      </div>
      <div class="grid g2">
        <section class="card">
          <div class="card-head"><div><h2>Live temperatures</h2><p>Sensor readings right now</p></div><span class="live">Live</span></div>
          ${k.sensors.map((s) => { const ok = SP.inRange(s), r = SP.RANGES[s.type]; return `<div class="li"><span class="dot-s" style="background:var(--${ok ? 'safe' : 'danger'})"></span><div class="grow">${esc(s.name)}<small>${r.label} · safe ${r.min} to ${r.max}°C</small></div><span class="pill pill-${ok ? 'safe' : 'danger'} mono">${s.value.toFixed(1)}°C</span></div>`; }).join('')}
          <h3 style="font-size:14px;margin:16px 0 4px">Today's log</h3>
          ${todays.length ? todays.slice(0, 6).map((l) => `<div class="li"><small class="mono" style="width:52px">${SP.fmtTime(l.at)}</small><div class="grow">${esc(l.sensor)}</div><span class="pill pill-${l.ok ? 'safe' : 'danger'}">${l.value}°C</span></div>`).join('') : '<p class="muted" style="font-size:13px">No manual logs yet today.</p>'}
        </section>
        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>Recent AI hygiene checks</h2></div>
            ${k.aiChecks.length ? k.aiChecks.slice(0, 3).map((a) => { const open = a.issues.filter((i) => !i.fixed); return `<div class="li"><span class="dot-s" style="background:var(--${open.length ? 'warn' : 'safe'})"></span><div class="grow">${open.length ? `${open.length} open issue(s): ${open.map((i) => esc(i.title)).join(', ')}` : a.issues.length ? `${a.issues.length} issue(s) found and fixed` : 'All clear'}<small>${SP.relTime(a.at)}</small></div></div>`; }).join('') : SP.ui.empty('camera', 'No AI checks yet', 'This kitchen has not run a photo check.')}
          </section>
          <section class="card">
            <div class="card-head"><h2>Staff training</h2></div>
            ${k.staff.map((s) => `<div class="staff-row"><span class="avatar">${esc(s.name[0])}</span><div><strong>${esc(s.name.split(' ')[0])}</strong><small class="muted" style="display:block">${esc(s.role)}</small></div>
              <div class="mini-badges">${SP.QUIZZES.map((q) => `<i class="${s.badges.includes(q.id) ? '' : 'off'}" title="${q.badge}">${icon(q.icon)}</i>`).join('')}</div></div>`).join('')}
          </section>
        </div>
      </div>`;
  };

  /* ---------------- menu with Allergy Guard ---------------- */
  function menuHTML(o, allergies, mode) {
    const dishes = SP.menuFor(o.id).map((d) => ({ ...d, risk: SP.dishRisk(d, allergies) }));
    const shown = mode === 'hide' ? dishes.filter((d) => d.risk.level !== 'unsafe') : dishes;
    const hidden = dishes.length - shown.length;
    return `<section class="card" id="menu">
      <div class="card-head"><div><h2>Menu</h2><p>${allergies.length ? `Allergy Guard on for: <strong>${allergies.join(', ')}</strong>` : 'No allergies saved'}</p></div>
        ${allergies.length ? `<div class="tabs" role="radiogroup" aria-label="Allergy Guard mode" style="flex:none">
          <button class="tab" role="radio" data-amode="flag" aria-selected="${mode === 'flag'}" aria-checked="${mode === 'flag'}">Flag</button>
          <button class="tab" role="radio" data-amode="hide" aria-selected="${mode === 'hide'}" aria-checked="${mode === 'hide'}">Hide unsafe</button></div>` : ''}</div>
      ${hidden ? `<div class="banner" style="background:var(--consumer-soft);color:var(--consumer);margin-bottom:12px">${icon('shield')}<span>${hidden} dish(es) hidden because they contain your allergens.</span></div>` : ''}
      ${shown.length ? `<div class="grid g2" style="gap:10px">${shown.map((d) => `
        <div class="dish dish-${d.risk.level}">
          <span class="veg-mark ${d.veg ? 'veg' : 'nonveg'}" aria-label="${d.veg ? 'Vegetarian' : 'Non-vegetarian'}"></span>
          <div class="grow"><strong>${esc(d.name)}</strong><small>₹${d.price}${d.allergens.length ? ' · contains ' + d.allergens.join(', ') : ' · no major allergens'}</small>
            ${d.risk.level === 'unsafe' ? `<span class="pill pill-danger">${icon('alert')} Contains ${d.risk.hit.join(', ')}</span>` : d.risk.level === 'caution' ? `<span class="pill pill-warn">${icon('alert')} Cross-contact risk: ${d.risk.hit.join(', ')}</span>` : allergies.length ? `<span class="pill pill-safe">${icon('check')} Safe for you</span>` : ''}</div>
        </div>`).join('')}</div>` : SP.ui.empty('shield', 'No safe dishes here', 'Every dish on this menu contains one of your allergens. Try another outlet.')}
    </section>`;
  }

  SP.Consumer.allergyMode = () => (me()?.role === 'consumer' && me().allergyMode) || 'flag';
  SP.Consumer.setAllergyMode = (m) => { const u = me(); if (u?.role === 'consumer') { u.allergyMode = m; save(); } };

  /* Outlet header + body; reused for logged-in and public views */
  function outletBody(o, { publicView }) {
    const score = scoreOf(o);
    const u = me();
    const allergies = u?.role === 'consumer' ? u.allergies || [] : [];
    return `
      <section class="card outlet-hero">
        <div class="stack" style="gap:6px">
          <div class="row"><span class="veg-mark ${o.veg ? 'veg' : 'nonveg'}" aria-label="${o.veg ? 'Pure veg' : 'Veg & non-veg'}"></span><span class="muted">${esc(o.type)} · ${esc(o.cuisine)}</span></div>
          <h2 style="font-size:24px">${esc(o.name)}</h2>
          <p class="muted">${icon('pin')} ${esc(o.area)} · ${SP.Map.distanceOf(o)} km away</p>
          <div class="row" style="margin-top:8px">
            <button class="btn ghost sm" id="listen-outlet">${icon('speaker')} Listen</button>
            ${publicView ? '' : `<button class="btn ghost sm" id="complain">${icon('alert')} Report a problem</button>`}
            <span class="pill pill-info">${icon('eye')} Verified by HygiQ sensors & logs</span>
          </div>
        </div>
        <div style="display:grid;place-items:center">${SP.ui.gauge('o-gauge')}</div>
      </section>
      ${SP.transparency(o)}
      <div class="grid g2" style="align-items:start">
        <div id="menu-wrap">${menuHTML(o, allergies, SP.Consumer.allergyMode())}</div>
        <div class="stack">
          ${SP.qrCard(o)}
          <section class="card"><div class="card-head"><h2>Location</h2><span class="muted" style="font-size:13px">${esc(o.area)}, Bengaluru</span></div>
            <div id="o-map" class="mapbox sm" role="region" aria-label="Map showing where ${esc(o.name)} is"></div></section>
        </div>
      </div>
      ${publicView && !(u?.role === 'consumer') ? `<section class="card row spread"><div><h2>Have allergies?</h2><p class="muted">Sign in as a customer and Allergy Guard will flag unsafe dishes for you.</p></div><a class="btn primary" href="#/login/consumer">Sign in</a></section>` : ''}`;
  }

  function bindOutlet(o) {
    SP.ui.animateGauge($('#o-gauge'), scoreOf(o));
    SP.bindQR(o);
    $('#complain')?.addEventListener('click', () => SP.go('/consumer/complaints?outlet=' + o.id));

    // Read the kitchen's hygiene summary aloud in the chosen voice language
    $('#listen-outlet').addEventListener('click', () => {
      const k = S().kitchens[o.id];
      const score = scoreOf(o);
      const u = me();
      const allergies = u?.role === 'consumer' ? u.allergies || [] : [];
      const dishes = SP.menuFor(o.id);
      let text = SP.Voice.t('outletSummary', {
        name: o.name, score, label: SP.Voice.scoreLabel(score),
        h: Math.max(1, Math.round((Date.now() - new Date(k.lastCleaning)) / 3600000)),
        ok: k.sensors.filter(SP.inRange).length, total: k.sensors.length,
      });
      if (allergies.length) text += ' ' + SP.Voice.t('outletAllergy', { safe: dishes.filter((d) => SP.dishRisk(d, allergies).level === 'safe').length, dishes: dishes.length });
      SP.Voice.speak(text);
    });

    // Small location map
    const m = SP.Map.make('o-map', SP.Map.coords(o), 15);
    if (m) {
      const score = scoreOf(o);
      SP.Map.marker(SP.Map.coords(o), score, SP.scoreTone(score), o.name).bindPopup(`<b>${esc(o.name)}</b><br>${esc(o.area)}`).addTo(m._hq);
      SP.Map.addMe(m);
    } else if ($('#o-map')) {
      $('#o-map').outerHTML = `<p class="muted" style="font-size:13px">The map could not load. ${esc(o.area)}, Bengaluru.</p>`;
    }
    $('#menu-wrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-amode]');
      if (!b) return;
      SP.Consumer.setAllergyMode(b.dataset.amode);
      $('#menu-wrap').innerHTML = menuHTML(o, me().allergies || [], b.dataset.amode);
      SP.toast(b.dataset.amode === 'hide' ? 'Unsafe dishes are now hidden.' : 'Unsafe dishes are now flagged.', 'info');
    });
  }

  /* ===================== Explore ===================== */
  const filters = { q: '', min: 0, diet: 'all', sort: 'score', mode: 'list' };
  /* Outlets after search and filters, with live score and distance (from "Near me" or MG Road) */
  function filteredOutlets() {
    let list = S().outlets.map((o) => ({ ...o, score: scoreOf(o), distance: SP.Map.distanceOf(o) }));
    const q = filters.q.toLowerCase();
    if (q) list = list.filter((o) => (o.name + ' ' + o.area + ' ' + o.cuisine).toLowerCase().includes(q));
    if (filters.min) list = list.filter((o) => o.score >= filters.min);
    if (filters.diet === 'veg') list = list.filter((o) => o.veg);
    if (filters.diet === 'nonveg') list = list.filter((o) => !o.veg);
    return list.sort((a, b) => (filters.sort === 'score' ? b.score - a.score : a.distance - b.distance));
  }

  /* Map view of the same filtered outlets: markers coloured by hygiene score */
  function drawExploreMap() {
    const area = $('#map-area');
    if (!area) return;
    if (filters.mode !== 'map') { SP.Map.destroy('exMap'); area.innerHTML = ''; return; }
    if (!SP.Map.available()) { area.innerHTML = `<section class="card">${SP.ui.empty('map', 'The map could not load', 'Check your internet connection. The list below still works.')}</section>`; return; }
    area.innerHTML = `<section class="card">
      <div id="exMap" class="mapbox" role="region" aria-label="Map of outlets coloured by hygiene score"></div>
      <div class="map-legend"><span><i class="lg-safe"></i>Safe 80+</span><span><i class="lg-warn"></i>60–79</span><span><i class="lg-danger"></i>Below 60</span>${SP.Map.me ? '<span><i class="lg-me"></i>You</span>' : ''}</div>
    </section>`;
    const m = SP.Map.make('exMap');
    if (!m) return;
    const list = filteredOutlets();
    const pts = list.map((o) => SP.Map.coords(o));
    SP.Map.addMe(m);
    if (SP.Map.me) pts.push(SP.Map.me);
    list.forEach((o) => {
      SP.Map.marker(SP.Map.coords(o), o.score, SP.scoreTone(o.score), `${o.name}, hygiene score ${o.score}`)
        .bindPopup(`<b>${esc(o.name)}</b><br><span class="muted">${esc(o.cuisine)} · ${esc(o.area)} · ${o.distance} km</span><br>Hygiene score <b>${o.score}</b> · ${SP.scoreLabel(o.score)}<br><a class="btn primary sm" href="#/consumer/outlet/${o.id}">View kitchen</a>`)
        .addTo(m._hq);
    });
    SP.Map.fit(m, pts);
  }

  function exploreList() {
    const u = me();
    const list = filteredOutlets();
    if (!list.length) return SP.ui.empty('store', 'No outlets match', 'Try clearing a filter or searching a different area.', '<button class="btn ghost" id="clear-f">Clear filters</button>');
    return `<div class="grid g3">${list.map((o) => {
      const safeN = SP.menuFor(o.id).filter((d) => SP.dishRisk(d, u.allergies || []).level === 'safe').length;
      const tone = SP.scoreTone(o.score);
      return `<a class="card outlet-card" href="#/consumer/outlet/${o.id}">
        <div class="row spread"><span class="veg-mark ${o.veg ? 'veg' : 'nonveg'}" aria-label="${o.veg ? 'Pure veg' : 'Veg & non-veg'}"></span>${SP.ui.scorePill(o.score)}</div>
        <h3>${esc(o.name)}</h3>
        <p class="muted">${esc(o.cuisine)}</p>
        <div class="row" style="font-size:13px;gap:14px"><span>${icon('pin')} ${esc(o.area)}</span><span>${o.distance} km</span></div>
        <div class="score-strip"><i style="width:${o.score}%;background:var(--${tone})"></i></div>
        <div class="row spread" style="font-size:13px"><span class="t-${tone}" style="font-weight:700">${SP.scoreLabel(o.score)}</span>
          ${u.allergies?.length ? `<span class="muted">${icon('shield')} ${safeN} dishes safe for you</span>` : ''}</div>
      </a>`;
    }).join('')}</div>`;
  }
  function viewExplore() {
    const chip = (grp, val, label) => `<button class="chip" data-f="${grp}" data-v="${val}" aria-pressed="${String(filters[grp]) === String(val)}">${label}</button>`;
    return `
      <div class="search-row"><label class="sr-only" for="q">Search outlets</label>
        <div class="search">${icon('eye')}<input class="input" id="q" type="search" placeholder="Search by name, area or cuisine" value="${esc(filters.q)}"></div>
        ${SP.Voice.micButton('q-mic', 'Search by voice')}</div>
      <div class="row" role="group" aria-label="Filters">
        ${chip('mode', 'list', `${icon('list')} List`)}${chip('mode', 'map', `${icon('map')} Map`)}
        <button class="chip" id="near-me" aria-pressed="${!!SP.Map.me}">${icon('locate')} Near me</button>
        <span class="sep"></span>${chip('min', 0, 'Any score')}${chip('min', 80, 'Safe 80+')}${chip('min', 60, '60+')}
        <span class="sep"></span>${chip('diet', 'all', 'All')}${chip('diet', 'veg', 'Pure veg')}${chip('diet', 'nonveg', 'Non-veg')}
        <span class="sep"></span>${chip('sort', 'score', 'Top rated')}${chip('sort', 'distance', 'Nearest')}
      </div>
      <div id="map-area"></div>
      <div id="results">${exploreList()}</div>`;
  }
  function bindExplore() {
    const refresh = () => { $('#results').innerHTML = exploreList(); $('#clear-f')?.addEventListener('click', clear); drawExploreMap(); };
    const syncChips = () => $$('[data-f]').forEach((c) => c.setAttribute('aria-pressed', String(String(filters[c.dataset.f]) === c.dataset.v)));
    $('#q-mic').addEventListener('click', () => SP.Voice.listen({
      btn: $('#q-mic'),
      onPartial: (s) => { $('#q').value = s; },
      onFinal: (s) => { $('#q').value = s; filters.q = s.trim(); refresh(); SP.toast(`Searching for “${s}”`, 'info'); },
    }));
    $('#near-me').addEventListener('click', () => {
      if (SP.Map.me) { SP.Map.clearMe(); filters.sort = 'score'; $('#near-me').setAttribute('aria-pressed', 'false'); syncChips(); refresh(); return; }
      SP.Map.locate(() => { filters.sort = 'distance'; filters.mode = 'map'; $('#near-me').setAttribute('aria-pressed', 'true'); syncChips(); refresh(); });
    });
    drawExploreMap();
    const clear = () => { Object.assign(filters, { q: '', min: 0, diet: 'all' }); $('#q').value = ''; $$('[data-f]').forEach((c) => c.setAttribute('aria-pressed', String(String(filters[c.dataset.f]) === c.dataset.v))); refresh(); };
    let t;
    $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { filters.q = e.target.value.trim(); refresh(); }, 150); });
    $$('[data-f]').forEach((c) => c.addEventListener('click', () => {
      filters[c.dataset.f] = isNaN(+c.dataset.v) ? c.dataset.v : +c.dataset.v;
      $$(`[data-f="${c.dataset.f}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      refresh();
    }));
    $('#clear-f')?.addEventListener('click', clear);
  }

  /* ===================== Allergy profile ===================== */
  function viewAllergy() {
    const u = me();
    return `
      <section class="card stack">
        <div class="card-head" style="margin:0"><div><h2>Your allergies</h2><p>Saved once, applied to every menu on HygiQ.</p></div>${icon('shield')}</div>
        <div class="allergy-grid" role="group" aria-label="Allergens">${SP.ALLERGENS.map((a) => `<button class="chip" data-al="${a}" aria-pressed="${(u.allergies || []).includes(a)}">${a}</button>`).join('')}</div>
        <div class="field"><label>When a dish contains an allergen</label>
          <div class="tabs" role="radiogroup" aria-label="Allergy Guard mode">
            <button class="tab" role="radio" data-mode="flag" aria-selected="${SP.Consumer.allergyMode() === 'flag'}" aria-checked="${SP.Consumer.allergyMode() === 'flag'}">Flag it with a warning</button>
            <button class="tab" role="radio" data-mode="hide" aria-selected="${SP.Consumer.allergyMode() === 'hide'}" aria-checked="${SP.Consumer.allergyMode() === 'hide'}">Hide it from menus</button></div></div>
        <button class="btn primary" id="save-al">${icon('check')} Save allergy profile</button>
      </section>
      <section class="card">
        <div class="card-head"><h2>How Allergy Guard works</h2></div>
        <div class="grid g3">
          <div class="dish dish-unsafe"><div class="grow"><strong>Contains</strong><small>Listed as an ingredient. Hidden or flagged red.</small></div></div>
          <div class="dish dish-caution"><div class="grow"><strong>Cross-contact</strong><small>Prepared on shared equipment. Flagged amber.</small></div></div>
          <div class="dish dish-safe"><div class="grow"><strong>Safe for you</strong><small>No match with your profile. Marked green.</small></div></div>
        </div>
        <p class="muted" style="font-size:13px;margin-top:12px">Allergen data comes from each kitchen's batch and recipe records. Always tell staff about severe allergies.</p>
      </section>`;
  }
  function bindAllergy() {
    $$('[data-al]').forEach((c) => c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'))));
    $$('[data-mode]').forEach((t) => t.addEventListener('click', () => $$('[data-mode]').forEach((x) => { x.setAttribute('aria-selected', String(x === t)); x.setAttribute('aria-checked', String(x === t)); })));
    $('#save-al').onclick = () => {
      const u = me();
      u.allergies = $$('[data-al][aria-pressed="true"]').map((c) => c.dataset.al);
      u.allergyMode = $('[data-mode][aria-selected="true"]').dataset.mode;
      save();
      SP.toast(u.allergies.length ? `Guarding against ${u.allergies.join(', ')}.` : 'No allergies saved. All dishes will show normally.', 'safe', 'Profile saved');
    };
  }

  /* ===================== Label / barcode check ===================== */
  let scanResult = null;
  function viewScan() {
    const u = me();
    let res = '';
    if (scanResult === 'loading') res = `<div class="scan-status"><span class="spinner"></span> Reading barcode and checking label…</div>${SP.ui.skeleton(1)}`;
    else if (scanResult?.notFound) res = SP.ui.empty('alert', 'Product not found', `No label data for code ${esc(scanResult.code)}. Try one of the sample products.`);
    else if (scanResult) {
      const p = scanResult;
      const d = SP.daysLeft(p.expiry);
      const hit = p.allergens.filter((a) => (u.allergies || []).includes(a));
      const exp = d < 0 ? ['danger', `Expired ${-d} day(s) ago — do not consume`] : d <= 3 ? ['warn', `Expires in ${d} day(s)`] : ['safe', `In date · ${d} days left`];
      res = `<div class="stack">
        <div><h2 style="font-size:20px">${esc(p.name)}</h2><p class="muted">${esc(p.brand)} · batch ${esc(p.batch)} · <span class="mono">${esc(p.code)}</span></p></div>
        <div class="banner ${exp[0] === 'safe' ? '' : exp[0]}" ${exp[0] === 'safe' ? 'style="background:var(--safe-soft);color:var(--safe)"' : ''}>${icon(exp[0] === 'safe' ? 'check' : 'alert')}<span>${exp[1]} (${SP.fmtDate(p.expiry)})</span></div>
        <div class="banner ${hit.length ? 'danger' : ''}" ${hit.length ? '' : 'style="background:var(--safe-soft);color:var(--safe)"'}>${icon('shield')}<span>${hit.length ? `Contains your allergens: ${hit.join(', ')}` : (u.allergies || []).length ? 'No match with your allergy profile' : 'Save allergies to get personal warnings'}</span></div>
        <div><h3 style="font-size:14px;margin-bottom:6px">Ingredients</h3><div class="allergy-grid">${p.ingredients.map((i) => `<span class="pill pill-info">${esc(i)}</span>`).join('')}</div></div>
        <div><h3 style="font-size:14px;margin-bottom:6px">Declared allergens</h3>${p.allergens.length ? `<div class="allergy-grid">${p.allergens.map((a) => `<span class="pill ${hit.includes(a) ? 'pill-danger' : 'pill-warn'}">${a}</span>`).join('')}</div>` : '<p class="muted">None declared</p>'}</div>
      </div>`;
    } else res = SP.ui.empty('zap', 'Scan a product', 'Point your camera at a barcode, or pick a sample product to try it.');

    return `<div class="grid g2" style="align-items:start">
      <section class="card stack">
        <div class="scanner ${scanResult === 'loading' ? 'scanning' : ''}" aria-hidden="true"><div class="bars-code">${Array.from({ length: 34 }, (_, i) => `<i style="width:${[2, 4, 1, 3][i % 4]}px"></i>`).join('')}</div><span class="laser"></span></div>
        <form id="code-form" class="row" novalidate style="flex-wrap:nowrap"><label class="sr-only" for="code">Barcode number</label>
          <input class="input" id="code" inputmode="numeric" placeholder="Enter 13-digit barcode" maxlength="13"><button class="btn primary">Check</button></form>
        <p class="muted" style="font-size:13px">Sample products:</p>
        <div class="stack" style="gap:8px">${Object.entries(SP.PRODUCTS).map(([code, p]) => `<button class="btn ghost block" data-code="${code}" style="justify-content:space-between"><span>${esc(p.name)}</span><span class="mono muted" style="font-size:12px">${code}</span></button>`).join('')}</div>
      </section>
      <section class="card" aria-live="polite">${res}</section>
    </div>`;
  }
  function bindScan(rerender) {
    const check = async (code) => {
      if (!/^\d{8,13}$/.test(code)) return SP.toast('Enter a valid 8–13 digit barcode.', 'warn');
      scanResult = 'loading'; rerender();
      await SP.sleep(1100);
      const p = SP.PRODUCTS[code];
      scanResult = p ? { ...p, code } : { notFound: true, code };
      if (location.hash.startsWith('#/consumer/scan')) rerender();
    };
    $('#code-form').addEventListener('submit', (e) => { e.preventDefault(); check($('#code').value.trim()); });
    $$('[data-code]').forEach((b) => (b.onclick = () => check(b.dataset.code)));
  }

  /* ===================== Complaints ===================== */
  const CATEGORIES = ['Food poisoning', 'Hygiene', 'Foreign object', 'Allergen', 'Expired food', 'Pests', 'Other'];
  let pendingPhoto = null;

  /* Downscale photos so they fit comfortably in localStorage */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, 480 / Math.max(img.width, img.height));
          const c = Object.assign(document.createElement('canvas'), { width: img.width * scale, height: img.height * scale });
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.7));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function viewComplaints() {
    const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('outlet');
    const mine = S().complaints.filter((c) => c.userId === me().id);
    const statusPill = { open: 'pill-warn', reviewed: 'pill-info', resolved: 'pill-safe' };
    return `<div class="grid g2" style="align-items:start">
      <section class="card">
        <div class="card-head"><div><h2>Report a food safety problem</h2><p>Reports go to the outlet and the local food safety officer.</p></div></div>
        <form id="cform" class="stack" novalidate>
          <div class="field" data-field="c-outlet"><label for="c-outlet">Outlet</label><select class="input" id="c-outlet"><option value="">Choose an outlet</option>${S().outlets.map((o) => `<option value="${o.id}" ${o.id === pre ? 'selected' : ''}>${esc(o.name)} — ${esc(o.area)}</option>`).join('')}</select><span class="err">${icon('alert')}<span>Choose the outlet.</span></span></div>
          <fieldset class="field" style="border:0;padding:0;margin:0" data-field="c-cat"><legend style="font-weight:600;font-size:14px;margin-bottom:8px">Category</legend>
            <div class="allergy-grid">${CATEGORIES.map((c) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="false">${c}</button>`).join('')}</div><span class="err">${icon('alert')}<span>Pick a category.</span></span></fieldset>
          <div class="field" data-field="c-text"><label for="c-text">What happened?</label><textarea class="input" id="c-text" maxlength="500" placeholder="When did you eat, what did you order, and what went wrong?"></textarea><span class="err">${icon('alert')}<span>Describe the problem (at least 15 characters).</span></span></div>
          <div class="field"><label for="c-photo">Photo (optional)</label>
            <label class="dropzone" for="c-photo" style="padding:18px" id="c-dz">${pendingPhoto ? `<img src="${pendingPhoto}" alt="Selected complaint photo" style="max-height:160px;border-radius:10px">` : `${icon('camera')}<span>Add a photo</span>`}</label>
            <input type="file" id="c-photo" accept="image/*" class="sr-only"></div>
          <button class="btn primary">${icon('arrowR')} Submit report</button>
        </form>
      </section>
      <section class="card">
        <div class="card-head"><h2>Your reports</h2></div>
        ${mine.length ? mine.map((c) => { const o = S().outlets.find((x) => x.id === c.outletId); return `<div class="li" style="align-items:flex-start">${c.photo ? `<img src="${c.photo}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px">` : `<span class="ki bg-warn" style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center">${icon('alert')}</span>`}
          <div class="grow"><strong>${esc(c.category)}</strong> · ${esc(o?.name || 'Unknown outlet')}<small>${esc(c.text)}</small><small>${SP.relTime(c.at)}</small></div><span class="pill ${statusPill[c.status]}">${c.status}</span></div>`; }).join('') : SP.ui.empty('alert', 'No reports yet', 'If something goes wrong after a meal, report it here. It helps protect everyone.')}
      </section>
    </div>`;
  }
  function bindComplaints(rerender) {
    const form = $('#cform');
    $$('[data-cat]').forEach((c) => c.addEventListener('click', () => { $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); $('[data-field="c-cat"]').classList.remove('invalid'); }));
    $('#c-photo').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!f.type.startsWith('image/')) return SP.toast('Please choose an image.', 'warn');
      try { pendingPhoto = await shrink(f); $('#c-dz').innerHTML = `<img src="${pendingPhoto}" alt="Selected complaint photo" style="max-height:160px;border-radius:10px">`; }
      catch (err) { SP.toast('Could not read that photo.', 'danger'); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const outletId = $('#c-outlet').value, cat = $('[data-cat][aria-pressed="true"]')?.dataset.cat, text = $('#c-text').value.trim();
      $('[data-field="c-outlet"]').classList.toggle('invalid', !outletId);
      $('[data-field="c-cat"]').classList.toggle('invalid', !cat);
      $('[data-field="c-text"]').classList.toggle('invalid', text.length < 15);
      if (!outletId || !cat || text.length < 15) return;
      const u = me();
      S().complaints.unshift({ id: SP.uid('c'), outletId, category: cat, text, photo: pendingPhoto, at: new Date().toISOString(), user: u.name.split(' ')[0] + ' ' + (u.name.split(' ')[1]?.[0] || '') + '.', userId: u.id, status: 'open' });
      pendingPhoto = null;
      save();
      history.replaceState(null, '', '#/consumer/complaints');
      rerender();
      SP.toast('Thanks. The outlet and food safety officer have been notified.', 'safe', 'Report submitted');
    });
  }

  /* ===================== Routes ===================== */
  const TITLES = {
    explore: ['Find safe food near you', 'Live hygiene scores from real kitchen logs'],
    allergy: ['Allergy Guard', 'Your personal allergen filter for every menu'],
    scan: ['Label check', 'Scan a packaged product to check ingredients and expiry'],
    complaints: ['Report a problem', 'Your reports help regulators act faster'],
  };
  const VIEWS = { explore: [viewExplore, bindExplore], allergy: [viewAllergy, bindAllergy], scan: [viewScan, bindScan], complaints: [viewComplaints, bindComplaints] };

  function page(app, tab) {
    const [title, sub] = TITLES[tab];
    app.innerHTML = SP.shell({ role: 'consumer', nav: NAV, active: tab, title, subtitle: sub, content: SP.ui.skeleton(4) });
    const [view, bind] = VIEWS[tab];
    const draw = () => { const v = $('#view'); if (!v) return; v.innerHTML = view(); bind(draw); };
    setTimeout(draw, 250);
  }
  SP.route('/consumer', (app) => page(app, 'explore'), { role: 'consumer' });
  SP.route('/consumer/allergy', (app) => page(app, 'allergy'), { role: 'consumer' });
  SP.route('/consumer/scan', (app) => { scanResult = null; page(app, 'scan'); }, { role: 'consumer' });
  SP.route('/consumer/complaints', (app) => page(app, 'complaints'), { role: 'consumer' });

  SP.route('/consumer/outlet/:id', (app, { id }) => {
    const o = S().outlets.find((x) => x.id === id);
    app.innerHTML = SP.shell({
      role: 'consumer', nav: NAV, active: 'explore', title: o ? 'Kitchen transparency' : 'Outlet not found', subtitle: o ? 'Live data from this kitchen, verified by HygiQ' : '',
      actions: `<a class="btn ghost sm" href="#/consumer">${icon('arrowL')} Back</a>`,
      content: o ? SP.ui.skeleton(4) : SP.ui.empty('store', 'Outlet not found', 'This outlet may have been removed.', '<a class="btn primary" href="#/consumer">Back to explore</a>'),
    });
    if (o) setTimeout(() => { $('#view').innerHTML = outletBody(o, { publicView: false }); bindOutlet(o); }, 300);
  }, { role: 'consumer' });

  /* Public page opened by scanning an outlet's QR — no login required */
  SP.route('/outlet/:id', (app, { id }) => {
    const o = S().outlets.find((x) => x.id === id);
    app.innerHTML = `<div class="public role-consumer">
      <header class="land-nav">${SP.ui.brand()}<div class="row">${me() ? `<a class="btn ghost sm" href="#${SP.homeFor(me().role)}">My dashboard</a>` : '<a class="btn ghost sm" href="#/login/consumer">Sign in</a>'}${SP.Theme.button()}</div></header>
      <main class="view" id="view" style="margin:0 auto">${o
        ? `<p class="eyebrow" style="width:max-content"><span class="dot"></span> QR Kitchen Transparency</p>${outletBody(o, { publicView: true })}`
        : SP.ui.empty('alert', 'Outlet not found', 'This QR code does not match an outlet on HygiQ.', '<a class="btn primary" href="#/">Go to HygiQ</a>')}</main>
    </div>`;
    if (o) bindOutlet(o);
  });
})();
