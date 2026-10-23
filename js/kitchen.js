/* =========================================================
   kitchen.js — Kitchen dashboard
   Tabs: overview · haccp · temps · stock · ai · staff · surplus · report
   ========================================================= */
(function () {
  const { icon, esc, $, $$ } = SP;
  const S = () => SP.Store.state;
  const me = () => SP.Session.user;
  const K = () => S().kitchens[me().outletId];
  const outlet = () => S().outlets.find((o) => o.id === me().outletId);
  const save = () => SP.Store.save();

  const NAV = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'haccp', label: 'HACCP', icon: 'list' },
    { id: 'temps', label: 'Temperatures', icon: 'thermo' },
    { id: 'stock', label: 'Batches', icon: 'box' },
    { id: 'ai', label: 'AI Scan', icon: 'camera' },
    { id: 'staff', label: 'Training', icon: 'award' },
    { id: 'surplus', label: 'Surplus', icon: 'heart' },
    { id: 'report', label: 'Report & QR', icon: 'file' },
  ];
  const TITLES = {
    overview: ['Kitchen overview', 'Your live hygiene score and what needs attention'],
    haccp: ['Digital HACCP checklist', 'Tap a task to complete it. Every tick is time-stamped.'],
    temps: ['Temperature monitoring', 'Live sensor feed for fridges, freezers and hot-holding'],
    stock: ['Expiry & batch tracker', 'Know what expires next, and recall a batch in one tap'],
    ai: ['Photo-to-Violation AI', 'Upload a kitchen photo to check for hygiene violations'],
    staff: ['Staff training', 'Short quizzes earn badges and lift your score'],
    surplus: ['Surplus food', 'Discount or donate safe near-expiry food'],
    report: ['Audit report & QR', 'A printable summary for inspectors, and your public kitchen QR'],
  };

  /* ===================== Live sensor simulator ===================== */
  const FAULT_TARGET = { fridge: 9.2, freezer: -8.5, hot: 51 };
  let timer = null;

  function tick() {
    const k = K();
    if (!k) return;
    k.sensors.forEach((s) => {
      const r = SP.RANGES[s.type];
      const wasOk = SP.inRange(s);
      const target = s.fault ? FAULT_TARGET[s.type] : r.target;
      // drift 35% toward the target, plus a little sensor noise
      s.value = +(s.value + (target - s.value) * 0.35 + (Math.random() - 0.5) * 0.5).toFixed(1);
      s.history.push(s.value);
      if (s.history.length > 30) s.history.shift();
      const nowOk = SP.inRange(s);
      if (wasOk && !nowOk) {
        k.alerts.unshift({ id: SP.uid('al'), at: new Date().toISOString(), sensorId: s.id, text: `${s.name} at ${s.value}°C — outside ${r.min}–${r.max}°C` });
        k.tempLog.unshift({ at: new Date().toISOString(), sensor: s.name, value: s.value, ok: false, auto: true });
        SP.toast(`${s.name} reads ${s.value}°C (safe: ${r.min} to ${r.max}°C). Hygiene score lowered.`, 'danger', 'Temperature alert');
      } else if (!wasOk && nowOk) {
        k.tempLog.unshift({ at: new Date().toISOString(), sensor: s.name, value: s.value, ok: true, auto: true });
        SP.toast(`${s.name} is back in the safe range.`, 'safe', 'Recovered');
      }
    });
    if (k.tempLog.length > 60) k.tempLog.length = 60;
    save();
    refreshLive();
  }
  function startSensors() { stopSensors(); timer = setInterval(tick, 3000); }
  function stopSensors() { clearInterval(timer); timer = null; }

  /* Update only live parts of the page so forms are never wiped */
  function refreshLive() {
    const k = K();
    SP.ui.animateGauge($('#k-gauge'), SP.computeScore(k));
    const bars = $('#k-bars'); if (bars) bars.innerHTML = breakdownBars(k);
    const ban = $('#k-banner'); if (ban) ban.innerHTML = alertBanner(k);
    k.sensors.forEach((s) => { const el = $(`[data-sensor="${s.id}"]`); if (el) el.outerHTML = sensorCard(s); });
    const log = $('#temp-log'); if (log) log.innerHTML = tempLogRows(k);
    const n = k.sensors.filter((s) => !SP.inRange(s)).length;
    $$('.nav-item[href="#/kitchen/temps"]').forEach((a) => {
      let b = $('.nav-badge', a);
      if (n && !b) a.insertAdjacentHTML('beforeend', `<em class="nav-badge">${n}</em>`);
      else if (b) n ? (b.textContent = n) : b.remove();
    });
  }

  /* ===================== Shared pieces ===================== */
  function breakdownBars(k) {
    const b = SP.scoreBreakdown(k);
    const rows = [['Checklist', b.checklist, 25], ['Temperatures', b.temps, 30], ['Stock & expiry', b.stock, 15], ['Training', b.training, 15], ['AI checks', b.ai, 15]];
    return rows.map(([l, v, max]) => {
      const pct = (v / max) * 100;
      const c = pct >= 80 ? 'var(--safe)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
      return `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${pct}%;background:${c}"></i></div><strong>${Math.round(v)}/${max}</strong></div>`;
    }).join('');
  }

  function alertBanner(k) {
    const out = k.sensors.filter((s) => !SP.inRange(s));
    if (!out.length) return '';
    return `<div class="banner danger" role="alert">${icon('siren')}<span>${out.map((s) => `${esc(s.name)}: <strong>${s.value}°C</strong>`).join(' · ')} — out of safe range</span>
      <a class="btn danger sm" href="#/kitchen/temps">Fix now</a></div>`;
  }

  function expiryPill(b) {
    const d = SP.daysLeft(b.expiry);
    if (d < 0) return `<span class="pill pill-danger">Expired ${-d}d ago</span>`;
    if (d === 0) return `<span class="pill pill-warn">Expires today</span>`;
    if (d <= 2) return `<span class="pill pill-warn">${d}d left</span>`;
    return `<span class="pill pill-safe">${d}d left</span>`;
  }

  function sparkline(s) {
    const r = SP.RANGES[s.type];
    const h = s.history;
    const lo = Math.min(...h, r.min) - 1, hi = Math.max(...h, r.max) + 1;
    const y = (v) => 44 - ((v - lo) / (hi - lo)) * 44;
    const pts = h.map((v, i) => `${(i / (h.length - 1)) * 200},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">
      <rect class="band" x="0" y="${y(r.max)}" width="200" height="${y(r.min) - y(r.max)}"/><polyline points="${pts}"/></svg>`;
  }

  function sensorCard(s) {
    const r = SP.RANGES[s.type];
    const ok = SP.inRange(s);
    return `<article class="card sensor ${ok ? '' : 'out'}" data-sensor="${s.id}" aria-label="${esc(s.name)} ${s.value} degrees, ${ok ? 'in range' : 'out of range'}">
      <div class="row spread"><strong>${esc(s.name)}</strong><span class="live">${ok ? 'Live' : 'Alert'}</span></div>
      <div class="row spread" style="align-items:flex-end"><span class="reading">${s.value.toFixed(1)}°C</span><span class="pill ${ok ? 'pill-safe' : 'pill-danger'}">${ok ? 'In range' : 'Out of range'}</span></div>
      ${sparkline(s)}
      <div class="row spread"><small class="muted">${r.label} · safe ${r.min} to ${r.max}°C</small>
        <button class="btn ${s.fault ? 'primary' : 'ghost'} sm" data-fault="${s.id}">${s.fault ? icon('check') + ' Restore' : icon('zap') + ' Simulate fault'}</button></div>
    </article>`;
  }

  const tempLogRows = (k) => k.tempLog.length
    ? k.tempLog.slice(0, 12).map((l) => `<tr><td>${SP.fmtTime(l.at)} <small class="muted">${SP.relTime(l.at)}</small></td><td>${esc(l.sensor)}</td><td class="mono">${l.value}°C</td><td><span class="pill ${l.ok ? 'pill-safe' : 'pill-danger'}">${l.ok ? 'OK' : 'Alert'}</span></td><td><small class="muted">${l.auto ? 'Sensor' : esc(l.by || 'Manual')}</small></td></tr>`).join('')
    : `<tr><td colspan="5">${SP.ui.empty('thermo', 'No readings yet', 'Readings appear here as sensors report or when you log one manually.')}</td></tr>`;

  /* ===================== TAB: overview ===================== */
  function viewOverview(k) {
    const items = Object.values(k.checklist).flat();
    const open = items.filter((i) => !i.done).length;
    const expSoon = k.batches.filter((b) => SP.daysLeft(b.expiry) <= 2).length;
    const badges = k.staff.reduce((a, s) => a + s.badges.length, 0);
    const outN = k.sensors.filter((s) => !SP.inRange(s)).length;
    const lastAI = k.aiChecks[0];
    const kpi = (ic, tone, val, label, href) => `<a class="card kpi" href="#/kitchen/${href}" style="text-decoration:none;color:inherit"><span class="ki bg-${tone}">${icon(ic)}</span><div><strong>${val}</strong><span>${label}</span></div></a>`;
    const activity = [
      ...k.tempLog.slice(0, 4).map((l) => ({ at: l.at, ic: 'thermo', tone: l.ok ? 'safe' : 'danger', t: `${l.sensor} logged ${l.value}°C` })),
      ...k.aiChecks.slice(0, 3).map((a) => ({ at: a.at, ic: 'camera', tone: a.issues.length ? 'warn' : 'safe', t: a.issues.length ? `AI scan flagged ${a.issues.length} issue(s)` : 'AI scan passed' })),
      ...items.filter((i) => i.done && i.at).slice(-3).map((i) => ({ at: i.at, ic: 'check', tone: 'safe', t: `${i.label}` })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 7);

    return `
      <div id="k-banner">${alertBanner(k)}</div>
      <section class="card score-hero" aria-labelledby="sh">
        <div style="display:grid;place-items:center;gap:8px">${SP.ui.gauge('k-gauge')}<small class="muted">Updates live as logs change</small></div>
        <div class="stack">
          <div class="card-head" style="margin:0"><div><h2 id="sh">Hygiene score breakdown</h2><p>${esc(outlet().name)} · ${esc(outlet().area)}</p></div>
            <a class="btn ghost sm" href="#/kitchen/report">${icon('file')} Audit report</a></div>
          <div class="bars" id="k-bars">${breakdownBars(k)}</div>
        </div>
      </section>
      <div class="grid g4">
        ${kpi('list', open ? 'warn' : 'safe', open, 'open HACCP tasks', 'haccp')}
        ${kpi('thermo', outN ? 'danger' : 'safe', outN || 'All OK', outN ? 'sensors out of range' : 'temperatures in range', 'temps')}
        ${kpi('box', expSoon ? 'warn' : 'safe', expSoon, 'batches expiring ≤ 2 days', 'stock')}
        ${kpi('award', 'safe', badges, 'staff badges earned', 'staff')}
      </div>
      <div class="grid g2">
        <section class="card">
          <div class="card-head"><h2>Quick actions</h2></div>
          <div class="grid g2" style="gap:10px">
            <a class="btn ghost" href="#/kitchen/ai">${icon('camera')} Run AI photo check</a>
            <a class="btn ghost" href="#/kitchen/temps">${icon('thermo')} Log a temperature</a>
            <a class="btn ghost" href="#/kitchen/stock">${icon('siren')} Recall a batch</a>
            <a class="btn ghost" href="#/kitchen/surplus">${icon('heart')} List surplus food</a>
          </div>
          <p class="muted" style="margin-top:14px;font-size:13px">Last AI check: ${lastAI ? `${SP.relTime(lastAI.at)} — ${lastAI.issues.filter((i) => !i.fixed).length ? `<span class="t-warn">${lastAI.issues.filter((i) => !i.fixed).length} open issue(s)</span>` : '<span class="t-safe">all clear</span>'}` : 'never'} · Last cleaning: ${SP.relTime(k.lastCleaning)}</p>
        </section>
        <section class="card">
          <div class="card-head"><h2>Recent activity</h2></div>
          ${activity.length ? activity.map((a) => `<div class="li"><span class="ki bg-${a.tone}" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center">${icon(a.ic)}</span><div class="grow">${esc(a.t)}<small>${SP.relTime(a.at)}</small></div></div>`).join('') : SP.ui.empty('bell', 'Nothing yet today', 'Complete a checklist task or log a reading to get started.')}
        </section>
      </div>`;
  }

  /* ===================== TAB: HACCP ===================== */
  let haccpSection = 'opening';
  function viewHaccp(k) {
    const sec = k.checklist[haccpSection];
    const all = Object.values(k.checklist).flat();
    const label = { opening: 'Opening', cooking: 'Cooking', cleaning: 'Cleaning', closing: 'Closing' };
    return `
      <div class="card">
        <div class="card-head"><div><h2>Today · ${SP.fmtDate(new Date().toISOString())}</h2><p>${all.filter((i) => i.done).length} of ${all.length} checks complete</p></div>
          <button class="btn ghost sm" id="reset-day">${icon('refresh')} Start new day</button></div>
        <div class="bar" style="margin-bottom:16px"><i style="width:${(all.filter((i) => i.done).length / all.length) * 100}%"></i></div>
        <div class="tabs" role="tablist" aria-label="Checklist sections">
          ${Object.keys(k.checklist).map((s) => {
            const d = k.checklist[s].filter((i) => i.done).length;
            return `<button class="tab" role="tab" aria-selected="${s === haccpSection}" data-sec="${s}">${label[s]} <small>${d}/${k.checklist[s].length}</small></button>`;
          }).join('')}
        </div>
        <div class="stack" style="margin-top:16px;gap:10px" role="tabpanel" aria-label="${label[haccpSection]} checks">
          ${sec.map((t) => `<button class="task ${t.done ? 'done' : ''}" data-task="${t.id}" aria-pressed="${t.done}">
              <span class="tick">${icon('check')}</span>
              <span class="grow"><span class="tl">${esc(t.label)}</span>${t.done ? `<small>Done ${SP.fmtTime(t.at)} by ${esc(t.by)}</small>` : '<small>Tap to complete</small>'}</span></button>`).join('')}
        </div>
      </div>`;
  }
  function bindHaccp(k, rerender) {
    $$('[data-sec]').forEach((b) => (b.onclick = () => { haccpSection = b.dataset.sec; rerender(); }));
    $$('[data-task]').forEach((b) => (b.onclick = () => {
      const t = k.checklist[haccpSection].find((x) => x.id === b.dataset.task);
      t.done = !t.done; t.at = t.done ? new Date().toISOString() : null; t.by = t.done ? me().name.split(' ')[0] + ' ' + (me().name.split(' ')[1]?.[0] || '') + '.' : null;
      if (t.done && haccpSection === 'cleaning') k.lastCleaning = t.at;
      save(); rerender();
      const sec = k.checklist[haccpSection];
      if (t.done && sec.every((x) => x.done)) SP.toast(`${haccpSection[0].toUpperCase() + haccpSection.slice(1)} checklist complete.`, 'safe', 'Section done');
    }));
    $('#reset-day').onclick = () => SP.modal({
      title: 'Start a new day?', body: '<p>This clears today\'s ticks so you can begin a fresh HACCP day. Previous days stay in your audit history.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Start new day', kind: 'primary', onClick: () => { k.checklist = SP.makeChecklist(); save(); rerender(); SP.toast('New HACCP day started.', 'info'); } }],
    });
  }

  /* ===================== TAB: temperatures ===================== */
  function viewTemps(k) {
    return `
      <div id="k-banner">${alertBanner(k)}</div>
      <div class="grid g4">${k.sensors.map(sensorCard).join('')}</div>
      <div class="grid g2">
        <section class="card">
          <div class="card-head"><h2>Log a manual reading</h2><p>Probe checks for food or units without sensors</p></div>
          <form id="manual" class="stack" novalidate>
            <div class="field"><label for="m-sensor">Unit</label><select class="input" id="m-sensor">${k.sensors.map((s) => `<option value="${s.id}">${esc(s.name)} (${SP.RANGES[s.type].label})</option>`).join('')}</select></div>
            <div class="field" data-field="m-val"><label for="m-val">Reading (°C)</label><input class="input" id="m-val" type="number" step="0.1" inputmode="decimal" placeholder="e.g. 3.5" aria-describedby="m-val-err"><span class="err" id="m-val-err">${icon('alert')}<span></span></span></div>
            <button class="btn primary">${icon('plus')} Save reading</button>
          </form>
        </section>
        <section class="card">
          <div class="card-head"><h2>Temperature log</h2><p>Latest 12 entries</p></div>
          <div class="table-wrap"><table><thead><tr><th>Time</th><th>Unit</th><th>Reading</th><th>Status</th><th>By</th></tr></thead><tbody id="temp-log">${tempLogRows(k)}</tbody></table></div>
        </section>
      </div>`;
  }
  function bindTemps(k) {
    $('#view').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fault]');
      if (!b) return;
      const s = k.sensors.find((x) => x.id === b.dataset.fault);
      s.fault = !s.fault;
      save();
      SP.toast(s.fault ? `Simulating a fault on ${s.name}. Watch the reading drift.` : `${s.name} restored. Reading will return to normal.`, s.fault ? 'warn' : 'info');
      $(`[data-sensor="${s.id}"]`).outerHTML = sensorCard(s);
    });
    $('#manual').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = $('[data-field="m-val"]');
      const v = parseFloat($('#m-val').value);
      if (isNaN(v) || v < -40 || v > 120) { f.classList.add('invalid'); $('.err span', f).textContent = 'Enter a reading between -40 and 120°C.'; return $('#m-val').focus(); }
      f.classList.remove('invalid');
      const s = k.sensors.find((x) => x.id === $('#m-sensor').value);
      const r = SP.RANGES[s.type];
      const ok = v >= r.min && v <= r.max;
      k.tempLog.unshift({ at: new Date().toISOString(), sensor: s.name, value: v, ok, by: me().name.split(' ')[0] });
      save();
      $('#temp-log').innerHTML = tempLogRows(k);
      $('#m-val').value = '';
      SP.toast(ok ? `${v}°C logged for ${s.name}.` : `${v}°C is outside ${r.min}–${r.max}°C. Take corrective action and re-check in 30 min.`, ok ? 'safe' : 'danger', ok ? 'Reading saved' : 'Out of range');
    });
  }

  /* ===================== TAB: batches + recall ===================== */
  function viewStock(k) {
    const sorted = [...k.batches].sort((a, b) => a.expiry.localeCompare(b.expiry));
    const expiring = sorted.filter((b) => SP.daysLeft(b.expiry) <= 2);
    return `
      ${expiring.length ? `<div class="banner warn">${icon('alert')}<span>${expiring.length} batch(es) expire within 2 days: ${expiring.map((b) => esc(b.item)).join(', ')}</span><a class="btn ghost sm" href="#/kitchen/surplus">List as surplus</a></div>` : ''}
      <section class="card">
        <div class="card-head"><div><h2>Batches in stock</h2><p>Sorted by expiry — first to expire, first out</p></div>
          <button class="btn primary sm" id="add-batch">${icon('plus')} Add batch</button></div>
        ${sorted.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Batch</th><th>Item</th><th>Supplier</th><th>Qty</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
          <tbody>${sorted.map((b) => `<tr><td class="mono">${esc(b.id)}</td><td><strong>${esc(b.item)}</strong>${b.allergens.length ? `<br><small class="muted">Contains: ${b.allergens.join(', ')}</small>` : ''}</td>
            <td>${esc(b.supplier)}</td><td>${b.qty}</td><td>${SP.fmtDate(b.expiry)}</td><td>${expiryPill(b)}</td>
            <td><div class="row" style="flex-wrap:nowrap"><button class="btn danger sm" data-recall="${esc(b.id)}" aria-label="Recall batch ${esc(b.id)}">${icon('siren')} Recall</button>
            <button class="icon-btn sm" data-del="${esc(b.id)}" aria-label="Remove batch ${esc(b.id)} from stock">${icon('x')}</button></div></td></tr>`).join('')}</tbody></table></div>`
          : SP.ui.empty('box', 'No batches tracked', 'Add your first delivery to start tracking expiry dates.')}
      </section>
      <section class="card">
        <div class="card-head"><h2>Recall history</h2></div>
        ${k.recalls.length ? k.recalls.map((r) => `<div class="li"><span class="dot-s" style="background:var(--danger)"></span><div class="grow"><strong>${esc(r.item)}</strong> · <span class="mono">${esc(r.batch)}</span><small>${SP.fmtDate(r.at)} · ${r.outlets} outlets, ${r.customers} customers notified · Reason: ${esc(r.reason)}</small></div></div>`).join('') : SP.ui.empty('siren', 'No recalls', 'Recalls you issue will be listed here for your audit trail.')}
      </section>`;
  }
  function bindStock(k, rerender) {
    $('#add-batch').onclick = () => SP.modal({
      title: 'Add a batch',
      body: `<div class="field"><label for="b-item">Item</label><input class="input" id="b-item" placeholder="e.g. Tomatoes (5 kg)"></div>
        <div class="grid g2"><div class="field"><label for="b-sup">Supplier</label><input class="input" id="b-sup" placeholder="Supplier"></div>
        <div class="field"><label for="b-qty">Quantity</label><input class="input" id="b-qty" type="number" min="1" value="1"></div></div>
        <div class="field"><label for="b-exp">Expiry date</label><input class="input" id="b-exp" type="date" value="${new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)}"></div>
        <div class="field"><label>Allergens</label><div class="allergy-grid">${SP.ALLERGENS.map((a) => `<button type="button" class="chip" aria-pressed="false" data-al="${a}">${a}</button>`).join('')}</div></div>
        <p class="form-error" id="b-err">${icon('alert')}<span>Item, supplier and expiry are required.</span></p>`,
      actions: [{ label: 'Cancel' }, { label: 'Add batch', kind: 'primary', onClick: (m) => {
        const item = $('#b-item', m).value.trim(), sup = $('#b-sup', m).value.trim(), exp = $('#b-exp', m).value;
        if (!item || !sup || !exp) { $('#b-err', m).classList.add('show'); return false; }
        const d = new Date();
        k.batches.push({ id: `B-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(k.batches.length + 1).padStart(2, '0')}${Math.random().toString(36).slice(2, 4).toUpperCase()}`, item, supplier: sup, qty: +$('#b-qty', m).value || 1, received: d.toISOString().slice(0, 10), expiry: exp, allergens: $$('[data-al][aria-pressed="true"]', m).map((b) => b.dataset.al) });
        save(); rerender(); SP.toast(`${item} added to stock.`, 'safe');
      } }],
    });
    document.body.addEventListener('click', chipToggle);
    SP.onLeave(() => document.body.removeEventListener('click', chipToggle));
    $$('[data-del]').forEach((b) => (b.onclick = () => { k.batches = k.batches.filter((x) => x.id !== b.dataset.del); save(); rerender(); SP.toast('Batch removed from stock.', 'info'); }));
    $$('[data-recall]').forEach((b) => (b.onclick = () => openRecall(k, b.dataset.recall, rerender)));
  }
  const chipToggle = (e) => { const c = e.target.closest('.modal [data-al]'); if (c) c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); };

  /* Recall: find who received this batch — other outlets using the same supplier + recent customers */
  SP.Kitchen = SP.Kitchen || {};
  SP.Kitchen.recallImpact = function (k, batch) {
    const sameSupplier = S().outlets.filter((o) => o.id !== k.outletId && S().kitchens[o.id]?.batches.some((x) => x.supplier === batch.supplier));
    const names = ['Ananya R.', 'Rahul M.', 'Sneha P.', 'Vikram S.', 'Divya K.', 'Imran A.', 'Neha G.', 'Karthik B.', 'Pooja D.', 'Aditya V.'];
    const seed = batch.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const customers = 18 + (seed % 40);
    return { outlets: sameSupplier, customers, sample: names.slice(seed % 4, (seed % 4) + 5) };
  };
  function openRecall(k, id, rerender) {
    const b = k.batches.find((x) => x.id === id);
    const imp = SP.Kitchen.recallImpact(k, b);
    SP.modal({
      title: `Recall ${b.item}`, wide: true,
      body: `<div class="banner danger">${icon('siren')}<span>Batch <span class="mono">${esc(b.id)}</span> from ${esc(b.supplier)} will be pulled and everyone below notified.</span></div>
        <div class="grid g2">
          <div class="card"><h2 style="margin-bottom:8px">${imp.outlets.length} outlet(s) on the same supply</h2>
            ${imp.outlets.length ? imp.outlets.map((o) => `<div class="li"><span class="dot-s" style="background:var(--warn)"></span><div class="grow">${esc(o.name)}<small>${esc(o.area)} · ${esc(o.type)}</small></div></div>`).join('') : '<p class="muted">No other outlets received this supplier\'s stock.</p>'}</div>
          <div class="card"><h2 style="margin-bottom:8px">${imp.customers} customers who ordered</h2>
            ${imp.sample.map((n) => `<div class="li"><span class="avatar" style="width:30px;height:30px;font-size:13px">${n[0]}</span><div class="grow">${n}<small>SMS + app notification</small></div></div>`).join('')}
            <small class="muted">+ ${imp.customers - imp.sample.length} more</small></div>
        </div>
        <div class="field"><label for="r-reason">Reason for recall</label>
          <select class="input" id="r-reason"><option>Suspected contamination</option><option>Supplier notice</option><option>Temperature abuse</option><option>Undeclared allergen</option><option>Customer illness report</option></select></div>`,
      actions: [{ label: 'Cancel' }, { label: `${icon('siren')} Issue recall & notify`, kind: 'danger', onClick: (m) => {
        k.recalls.unshift({ batch: b.id, item: b.item, at: new Date().toISOString(), outlets: imp.outlets.length, customers: imp.customers, reason: $('#r-reason', m).value });
        k.batches = k.batches.filter((x) => x.id !== b.id);
        save(); rerender();
        SP.toast(`${imp.outlets.length} outlets and ${imp.customers} customers notified. Regulator informed.`, 'danger', 'Recall issued');
      } }],
    });
  }

  /* ===================== TAB: AI photo scan ===================== */
  /* Vision provider. Swap `provider` for a real API later: implement analyzeRemote()
     to POST the image to your backend (never put API keys in the browser). */
  const ISSUE_LIBRARY = [
    { code: 'no_gloves', title: 'Bare hands handling ready-to-eat food', severity: 'high', fix: 'Wear disposable gloves; change them between raw and ready-to-eat tasks.', box: [12, 48, 26, 30] },
    { code: 'uncovered', title: 'Uncovered food container', severity: 'high', fix: 'Cover with a lid or cling film and label with prep time.', box: [56, 58, 30, 24] },
    { code: 'hair', title: 'Hair not covered', severity: 'medium', fix: 'Staff in the food zone must wear a hairnet or cap.', box: [18, 8, 18, 18] },
    { code: 'cross', title: 'Raw meat stored above cooked food', severity: 'high', fix: 'Store raw meat on the lowest shelf, below ready-to-eat items.', box: [62, 18, 26, 30] },
    { code: 'bin', title: 'Open waste bin near prep area', severity: 'medium', fix: 'Use a pedal bin with a closed lid, away from prep surfaces.', box: [82, 66, 14, 26] },
    { code: 'surface', title: 'Visible residue on prep surface', severity: 'medium', fix: 'Clean, then sanitise with food-safe sanitiser; log on the cleaning checklist.', box: [36, 70, 24, 18] },
  ];
  SP.Vision = {
    provider: 'simulated', // 'simulated' | 'remote'
    async analyze(dataUrl, opts = {}) {
      if (this.provider === 'remote') return this.analyzeRemote(dataUrl);
      await SP.sleep(opts.fast ? 1400 : 2600);
      // deterministic pseudo-random pick from image data so the same photo gives the same result
      let h = 0; for (let i = 0; i < dataUrl.length; i += 97) h = (h * 31 + dataUrl.charCodeAt(i)) | 0;
      h = Math.abs(h);
      if (opts.force) return { issues: ISSUE_LIBRARY.filter((i) => opts.force.includes(i.code)).map((i) => ({ ...i, fixed: false })), confidence: 0.94 };
      const n = h % 4; // 0–3 issues
      const picks = [...ISSUE_LIBRARY].sort((a, b) => ((h >> a.code.length) % 7) - ((h >> b.code.length) % 7)).slice(0, n);
      return { issues: picks.map((i) => ({ ...i, fixed: false })), confidence: 0.86 + (h % 10) / 100 };
    },
    async analyzeRemote(dataUrl) {
      // Example contract: POST /api/vision { image } → { issues: [{code,title,severity,fix,box:[x,y,w,h]}] }
      const res = await fetch('/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }) });
      if (!res.ok) throw new Error('Vision API error ' + res.status);
      return res.json();
    },
  };

  /* A generated sample kitchen photo (inline SVG) so the demo works without uploads */
  SP.Kitchen.samplePhoto = function () {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#c9d6d0"/><rect y="200" width="400" height="100" fill="#8a9a92"/><rect x="0" y="210" width="400" height="12" fill="#e7eeea"/>
      <rect x="240" y="40" width="120" height="110" rx="6" fill="#eef3f1" stroke="#9fb1a8" stroke-width="3"/><rect x="250" y="70" width="40" height="22" fill="#d0574d"/><rect x="300" y="100" width="50" height="22" fill="#e8c26b"/>
      <circle cx="100" cy="60" r="28" fill="#5b3a29"/><rect x="66" y="88" width="68" height="110" rx="18" fill="#ffffff"/><rect x="40" y="150" width="60" height="18" rx="9" fill="#e0b48c"/><circle cx="40" cy="160" r="12" fill="#e0b48c"/>
      <ellipse cx="290" cy="196" rx="54" ry="16" fill="#f1f1f1"/><ellipse cx="290" cy="190" rx="48" ry="12" fill="#d98c3a"/><rect x="150" y="214" width="90" height="40" rx="6" fill="#b9a68d" opacity=".7"/>
      <rect x="335" y="200" width="50" height="80" rx="6" fill="#4b5a53"/><rect x="330" y="196" width="60" height="8" fill="#3a463f" transform="rotate(-15 360 200)"/></svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  };

  let aiState = { img: null, status: 'idle', result: null }; // idle | scanning | done | error
  function viewAI(k) {
    const r = aiState.result;
    const stage = aiState.img
      ? `<div class="scan-stage ${aiState.status === 'scanning' ? 'scanning' : ''}"><img src="${aiState.img}" alt="Uploaded kitchen photo">
          ${aiState.status === 'done' && r ? r.issues.map((i) => `<div class="bbox ${i.severity === 'high' ? '' : 'warn'}" style="left:${i.box[0]}%;top:${i.box[1]}%;width:${i.box[2]}%;height:${i.box[3]}%"><span>${esc(i.title.split(' ').slice(0, 3).join(' '))}</span></div>`).join('') : ''}</div>`
      : `<label class="dropzone" for="photo" id="dz">${icon('upload')}<strong>Drop a kitchen photo or tap to upload</strong><span class="muted">JPG or PNG, up to 8 MB. Photos stay on your device.</span></label>`;

    let side;
    if (aiState.status === 'scanning') side = `<div class="scan-status"><span class="spinner" aria-hidden="true"></span> Scanning for gloves, coverings, storage order, surfaces…</div>${SP.ui.skeleton(2)}`;
    else if (aiState.status === 'error') side = SP.ui.empty('alert', 'Scan failed', 'The image could not be analysed. Try another photo.', '<button class="btn primary" data-ai-reset>Try again</button>');
    else if (aiState.status === 'done' && r) {
      const lastChk = k.aiChecks[0];
      side = r.issues.length
        ? `<div class="banner danger">${icon('alert')}<span>${r.issues.length} violation(s) found · ${Math.round(r.confidence * 100)}% confidence</span></div>
           ${lastChk.issues.map((i, idx) => `<div class="issue ${i.fixed ? 'fixed' : ''}"><span class="ii bg-${i.severity === 'high' ? 'danger' : 'warn'}">${icon('alert')}</span>
             <div class="grow"><h4>${esc(i.title)}</h4><p><strong>Fix:</strong> ${esc(i.fix)}</p></div>
             ${i.fixed ? `<span class="pill pill-safe">Fixed</span>` : `<button class="btn ghost sm" data-fix="${idx}">${icon('check')} Mark fixed</button>`}</div>`).join('')}`
        : `<div class="banner" style="background:var(--safe-soft);color:var(--safe)">${icon('check')}<span>No violations detected · ${Math.round(r.confidence * 100)}% confidence</span></div>`;
      side += `<button class="btn ghost" data-ai-reset>${icon('camera')} Scan another photo</button>`;
    } else side = SP.ui.empty('camera', 'No photo yet', 'Upload a photo of a prep station, fridge or serving line. We check for 6 common violations.', `<button class="btn ghost" id="sample">${icon('zap')} Use sample photo</button>`);

    return `
      <div class="grid g2">
        <section class="card stack">${stage}<input type="file" id="photo" accept="image/*" class="sr-only"></section>
        <section class="card stack" aria-live="polite"><div class="card-head" style="margin:0"><h2>Results</h2><span class="pill pill-info">${SP.Vision.provider === 'simulated' ? 'Simulated model' : 'Live model'}</span></div>${side}</section>
      </div>
      <section class="card">
        <div class="card-head"><h2>Scan history</h2></div>
        ${k.aiChecks.length ? k.aiChecks.slice(0, 8).map((a) => `<div class="li"><span class="dot-s" style="background:var(--${a.issues.filter((i) => !i.fixed).length ? 'warn' : 'safe'})"></span><div class="grow">${a.issues.length ? `${a.issues.length} issue(s): ${a.issues.map((i) => esc(i.title)).join('; ')}` : esc(a.note || 'All clear')}<small>${SP.fmtDate(a.at)} ${SP.fmtTime(a.at)}</small></div>
          <span class="pill ${a.issues.filter((i) => !i.fixed).length ? 'pill-warn' : 'pill-safe'}">${a.issues.filter((i) => !i.fixed).length ? 'Open' : 'Clear'}</span></div>`).join('') : SP.ui.empty('camera', 'No scans yet', 'Your AI hygiene checks will appear here.')}
      </section>`;
  }

  SP.Kitchen.runScan = async function (dataUrl, opts = {}, rerender) {
    const k = K();
    aiState = { img: dataUrl, status: 'scanning', result: null };
    rerender && rerender();
    try {
      const result = await SP.Vision.analyze(dataUrl, opts);
      aiState.status = 'done'; aiState.result = result;
      k.aiChecks.unshift({ id: SP.uid('ai'), at: new Date().toISOString(), result: result.issues.length ? 'fail' : 'pass', issues: result.issues, note: result.issues.length ? '' : 'All clear' });
      save();
      SP.toast(result.issues.length ? `${result.issues.length} violation(s) flagged. See suggested fixes.` : 'No violations found.', result.issues.length ? 'warn' : 'safe', 'AI check complete');
    } catch (err) {
      console.error(err); aiState.status = 'error';
    }
    if (location.hash.startsWith('#/kitchen/ai')) rerender && rerender();
  };

  function bindAI(k, rerender) {
    const input = $('#photo');
    const handle = (file) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) return SP.toast('Please choose an image file.', 'warn');
      if (file.size > 8 * 1024 * 1024) return SP.toast('That image is over 8 MB.', 'warn');
      const fr = new FileReader();
      fr.onload = () => SP.Kitchen.runScan(fr.result, {}, rerender);
      fr.onerror = () => { aiState.status = 'error'; rerender(); };
      fr.readAsDataURL(file);
    };
    input.onchange = () => handle(input.files[0]);
    const dz = $('#dz');
    if (dz) {
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
      dz.addEventListener('drop', (e) => handle(e.dataTransfer.files[0]));
      dz.tabIndex = 0;
      dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    }
    $('#sample')?.addEventListener('click', () => SP.Kitchen.runScan(SP.Kitchen.samplePhoto(), { force: ['no_gloves', 'uncovered'] }, rerender));
    $$('[data-ai-reset]').forEach((b) => (b.onclick = () => { aiState = { img: null, status: 'idle', result: null }; rerender(); }));
    $$('[data-fix]').forEach((b) => (b.onclick = () => {
      k.aiChecks[0].issues[+b.dataset.fix].fixed = true; save(); rerender();
      SP.toast('Issue marked as fixed. Score updated.', 'safe');
    }));
  }

  /* ===================== TAB: staff training ===================== */
  function viewStaff(k) {
    const total = k.staff.length * SP.QUIZZES.length;
    const earned = k.staff.reduce((a, s) => a + s.badges.length, 0);
    return `
      <div class="grid g3">${SP.QUIZZES.map((q) => {
        const n = k.staff.filter((s) => s.badges.includes(q.id)).length;
        return `<section class="card stack"><div class="badge-tile ${n ? '' : 'locked'}"><span class="medal">${icon(q.icon)}</span><strong>${q.badge}</strong><small class="muted">${n}/${k.staff.length} staff earned</small></div>
          <div><h2>${q.title}</h2><p class="muted" style="font-size:13px">${q.questions.length} questions · pass with all correct</p></div>
          <button class="btn primary" data-quiz="${q.id}">${icon('play')} Take quiz</button></section>`;
      }).join('')}</div>
      <section class="card">
        <div class="card-head"><div><h2>Team</h2><p>${earned} of ${total} badges earned · ${Math.round((earned / (total || 1)) * 100)}% trained</p></div>
          <button class="btn ghost sm" id="add-staff">${icon('plus')} Add staff</button></div>
        ${k.staff.length ? k.staff.map((s) => `<div class="staff-row"><span class="avatar">${esc(s.name[0])}</span><div><strong>${esc(s.name)}</strong><small class="muted" style="display:block">${esc(s.role)}</small></div>
          <div class="mini-badges">${SP.QUIZZES.map((q) => `<i class="${s.badges.includes(q.id) ? '' : 'off'}" title="${q.badge}${s.badges.includes(q.id) ? '' : ' (not earned)'}">${icon(q.icon)}</i>`).join('')}</div></div>`).join('') : SP.ui.empty('user', 'No staff yet', 'Add your team to track training.')}
      </section>`;
  }
  function bindStaff(k, rerender) {
    $('#add-staff').onclick = () => SP.modal({
      title: 'Add staff member',
      body: `<div class="field"><label for="s-name">Name</label><input class="input" id="s-name" placeholder="Full name"></div>
        <div class="field"><label for="s-role">Role</label><select class="input" id="s-role"><option>Line Cook</option><option>Sous Chef</option><option>Head Chef</option><option>Server</option><option>Kitchen Porter</option></select></div>
        <p class="form-error" id="s-err">${icon('alert')}<span>Enter a name.</span></p>`,
      actions: [{ label: 'Cancel' }, { label: 'Add', kind: 'primary', onClick: (m) => {
        const n = $('#s-name', m).value.trim();
        if (n.length < 2) { $('#s-err', m).classList.add('show'); return false; }
        k.staff.push({ id: SP.uid('st'), name: n, role: $('#s-role', m).value, badges: [] }); save(); rerender(); SP.toast(`${n} added to the team.`, 'safe');
      } }],
    });
    $$('[data-quiz]').forEach((b) => (b.onclick = () => runQuiz(k, SP.QUIZZES.find((q) => q.id === b.dataset.quiz), rerender)));
  }
  function runQuiz(k, quiz, rerender) {
    let step = -1, correct = 0, staffId = k.staff[0]?.id;
    if (!staffId) return SP.toast('Add a staff member first.', 'warn');
    const m = SP.modal({ title: quiz.title, body: '<div id="qz"></div>' });
    const box = $('#qz', m.el);
    const draw = () => {
      if (step === -1) {
        box.innerHTML = `<div class="field"><label for="qz-staff">Who is taking the quiz?</label><select class="input" id="qz-staff">${k.staff.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
          <button class="btn primary block" id="qz-go">Start ${icon('arrowR')}</button>`;
        $('#qz-go', box).onclick = () => { staffId = $('#qz-staff', box).value; step = 0; draw(); };
        return;
      }
      if (step >= quiz.questions.length) {
        const pass = correct === quiz.questions.length;
        const s = k.staff.find((x) => x.id === staffId);
        if (pass && !s.badges.includes(quiz.id)) { s.badges.push(quiz.id); save(); }
        box.innerHTML = `<div class="badge-tile ${pass ? '' : 'locked'}" style="padding:28px"><span class="medal" style="width:76px;height:76px">${icon(quiz.icon)}</span>
          <h3>${pass ? `Badge earned: ${quiz.badge}!` : 'Not quite'}</h3><p class="muted">${correct}/${quiz.questions.length} correct${pass ? ` · ${esc(s.name)}'s training is updated.` : ' · Get all answers right to earn the badge.'}</p></div>
          <button class="btn ${pass ? 'primary' : 'ghost'} block" id="qz-done">${pass ? 'Done' : 'Try again'}</button>`;
        $('#qz-done', box).onclick = () => { if (pass) { m.close(); rerender(); SP.toast(`${s.name} earned "${quiz.badge}". Score updated.`, 'safe', 'New badge'); } else { step = 0; correct = 0; draw(); } };
        return;
      }
      const q = quiz.questions[step];
      box.innerHTML = `<div class="quiz-progress"><i style="width:${(step / quiz.questions.length) * 100}%"></i></div>
        <p class="muted">Question ${step + 1} of ${quiz.questions.length}</p><h3 style="margin:6px 0 16px">${esc(q.q)}</h3>
        ${q.a.map((a, i) => `<button class="quiz-opt" data-a="${i}">${esc(a)}</button>`).join('')}`;
      $$('[data-a]', box).forEach((b) => (b.onclick = () => {
        const i = +b.dataset.a;
        $$('[data-a]', box).forEach((x) => (x.disabled = true));
        b.classList.add(i === q.c ? 'right' : 'wrong');
        if (i !== q.c) $(`[data-a="${q.c}"]`, box).classList.add('right'); else correct++;
        setTimeout(() => { step++; draw(); }, 850);
      }));
      $('[data-a]', box).focus();
    };
    draw();
  }

  /* ===================== TAB: surplus ===================== */
  const NGOS = ['Robin Hood Army', 'Feeding India', 'No Food Waste', 'Akshaya Patra'];
  function viewSurplus(k) {
    const eligible = k.batches.filter((b) => { const d = SP.daysLeft(b.expiry); return d >= 0 && d <= 2; });
    return `
      <section class="card">
        <div class="card-head"><div><h2>Eligible near-expiry stock</h2><p>Only in-date items stored at safe temperatures can be listed.</p></div></div>
        ${eligible.length ? eligible.map((b) => `<div class="li"><span class="ki bg-warn" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center">${icon('box')}</span>
          <div class="grow"><strong>${esc(b.item)}</strong><small>${esc(b.id)} · qty ${b.qty} · ${SP.fmtDate(b.expiry)}</small></div>${expiryPill(b)}
          <button class="btn primary sm" data-list="${esc(b.id)}">List</button></div>`).join('') : SP.ui.empty('heart', 'Nothing near expiry', 'Items within 2 days of expiry will appear here.')}
      </section>
      <section class="card">
        <div class="card-head"><h2>Active listings</h2></div>
        ${k.surplus.length ? k.surplus.map((s, i) => `<div class="li"><span class="dot-s" style="background:var(--${s.collected ? 'muted' : s.mode === 'donate' ? 'safe' : 'warn'})"></span>
          <div class="grow"><strong>${esc(s.item)}</strong><small>${s.mode === 'donate' ? `Donating to ${esc(s.ngo)}` : `${s.discount}% off for customers`} · pickup ${esc(s.pickup)} · listed ${SP.relTime(s.at)}</small></div>
          ${s.collected ? '<span class="pill pill-safe">Collected</span>' : `<button class="btn ghost sm" data-collect="${i}">Mark collected</button>`}</div>`).join('') : SP.ui.empty('heart', 'No listings yet', 'List surplus food to cut waste and help your community.')}
      </section>`;
  }
  function bindSurplus(k, rerender) {
    $$('[data-collect]').forEach((b) => (b.onclick = () => { k.surplus[+b.dataset.collect].collected = true; save(); rerender(); SP.toast('Marked as collected. Thank you for reducing waste!', 'safe'); }));
    $$('[data-list]').forEach((b) => (b.onclick = () => {
      const batch = k.batches.find((x) => x.id === b.dataset.list);
      const m = SP.modal({
        title: `List ${batch.item}`,
        body: `<div class="tabs" role="radiogroup" aria-label="Listing type"><button class="tab" role="radio" aria-selected="true" aria-checked="true" data-mode="discount">Discount for customers</button><button class="tab" role="radio" aria-selected="false" aria-checked="false" data-mode="donate">Donate to NGO</button></div>
          <div id="mode-discount" class="field"><label for="disc">Discount</label><select class="input" id="disc"><option>30</option><option selected>50</option><option>70</option></select></div>
          <div id="mode-donate" class="field" hidden><label for="ngo">NGO partner</label><select class="input" id="ngo">${NGOS.map((n) => `<option>${n}</option>`).join('')}</select></div>
          <div class="field"><label for="pick">Pickup time</label><input class="input" id="pick" type="time" value="21:30"></div>`,
        actions: [{ label: 'Cancel' }, { label: 'Publish listing', kind: 'primary', onClick: (el) => {
          const mode = $('[data-mode][aria-selected="true"]', el).dataset.mode;
          k.surplus.unshift({ id: SP.uid('sp'), item: `${batch.item} (qty ${batch.qty})`, mode, discount: +$('#disc', el).value, ngo: $('#ngo', el).value, pickup: $('#pick', el).value || '21:30', at: new Date().toISOString() });
          save(); rerender();
          SP.toast(mode === 'donate' ? `${$('#ngo', el).value} has been notified for pickup.` : 'Listing is live for nearby customers.', 'safe', 'Surplus listed');
        } }],
      });
      $$('[data-mode]', m.el).forEach((t) => (t.onclick = () => {
        $$('[data-mode]', m.el).forEach((x) => { x.setAttribute('aria-selected', String(x === t)); x.setAttribute('aria-checked', String(x === t)); });
        $('#mode-discount', m.el).hidden = t.dataset.mode !== 'discount';
        $('#mode-donate', m.el).hidden = t.dataset.mode !== 'donate';
      }));
    }));
  }

  /* ===================== TAB: audit report ===================== */
  SP.Kitchen.reportHTML = function (k, o) {
    const score = SP.computeScore(k);
    const b = SP.scoreBreakdown(k);
    const all = Object.values(k.checklist).flat();
    const tone = { safe: '#12a150', warn: '#c27803', danger: '#d92d20' }[SP.scoreTone(score)];
    const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>HygiQ audit report — ${esc(o.name)}</title>
      <style>body{font-family:system-ui,Segoe UI,sans-serif;color:#0f1f17;max-width:820px;margin:32px auto;padding:0 20px}h1{margin:0}h2{border-bottom:2px solid #0e9f5a;padding-bottom:4px;margin-top:28px;font-size:18px}
      table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #dbe7df;padding:6px 8px;text-align:left}th{background:#eef5f0}.score{font-size:48px;font-weight:800;color:${tone}}.muted{color:#56695e}.top{display:flex;justify-content:space-between;align-items:center}
      @media print{button{display:none}}</style></head><body>
      <div class="top"><div><h1>Food Safety Audit Report</h1><p class="muted">${esc(o.name)} · ${esc(o.area)} · ${esc(o.type)}<br>Generated ${new Date().toLocaleString()} by HygiQ</p></div><div class="score">${score}<span style="font-size:18px">/100</span></div></div>
      <button onclick="window.print()" style="padding:8px 16px;margin-top:8px">Print / Save as PDF</button>
      <h2>Score breakdown</h2><table><tr><th>Area</th><th>Points</th><th>Max</th></tr>
      ${row(['HACCP checklist', Math.round(b.checklist), 25])}${row(['Temperature control', Math.round(b.temps), 30])}${row(['Stock & expiry', Math.round(b.stock), 15])}${row(['Staff training', Math.round(b.training), 15])}${row(['AI photo checks', Math.round(b.ai), 15])}</table>
      <h2>HACCP checklist (today)</h2><table><tr><th>Section</th><th>Check</th><th>Status</th><th>Time</th><th>By</th></tr>
      ${Object.entries(k.checklist).map(([s, items]) => items.map((i) => row([s, esc(i.label), i.done ? '✔ Done' : '✘ Pending', i.at ? SP.fmtTime(i.at) : '—', esc(i.by || '—')])).join('')).join('')}</table>
      <p class="muted">${all.filter((i) => i.done).length} of ${all.length} checks complete.</p>
      <h2>Temperature units</h2><table><tr><th>Unit</th><th>Type</th><th>Current</th><th>Safe range</th><th>Status</th></tr>
      ${k.sensors.map((s) => row([esc(s.name), SP.RANGES[s.type].label, s.value + '°C', `${SP.RANGES[s.type].min} to ${SP.RANGES[s.type].max}°C`, SP.inRange(s) ? '✔ In range' : '✘ OUT OF RANGE'])).join('')}</table>
      <h2>Temperature log</h2><table><tr><th>Time</th><th>Unit</th><th>Reading</th><th>Status</th></tr>${k.tempLog.slice(0, 20).map((l) => row([new Date(l.at).toLocaleString(), esc(l.sensor), l.value + '°C', l.ok ? 'OK' : 'Alert'])).join('')}</table>
      <h2>Batches</h2><table><tr><th>Batch</th><th>Item</th><th>Supplier</th><th>Expiry</th><th>Allergens</th></tr>${k.batches.map((x) => row([esc(x.id), esc(x.item), esc(x.supplier), x.expiry, x.allergens.join(', ') || '—'])).join('')}</table>
      <h2>Staff training</h2><table><tr><th>Name</th><th>Role</th><th>Badges</th></tr>${k.staff.map((s) => row([esc(s.name), esc(s.role), s.badges.map((id) => SP.QUIZZES.find((q) => q.id === id)?.badge).join(', ') || 'None'])).join('')}</table>
      <h2>AI photo checks</h2><table><tr><th>Date</th><th>Result</th><th>Issues</th></tr>${k.aiChecks.map((a) => row([new Date(a.at).toLocaleString(), a.issues.length ? 'Issues found' : 'Pass', a.issues.map((i) => esc(i.title) + (i.fixed ? ' (fixed)' : '')).join('; ') || '—'])).join('')}</table>
      <h2>Recalls</h2>${k.recalls.length ? `<table><tr><th>Date</th><th>Batch</th><th>Reason</th><th>Notified</th></tr>${k.recalls.map((r) => row([SP.fmtDate(r.at), esc(r.batch + ' ' + r.item), esc(r.reason), `${r.outlets} outlets, ${r.customers} customers`])).join('')}</table>` : '<p class="muted">None.</p>'}
      <p class="muted" style="margin-top:40px">Signature of manager: ______________________ &nbsp; Inspector: ______________________</p></body></html>`;
  };
  function viewReport(k) {
    const score = SP.computeScore(k);
    return `<section class="card stack">
      <div class="card-head" style="margin:0"><div><h2>${esc(outlet().name)} — audit summary</h2><p>Includes checklist, temperatures, batches, training, AI checks and recalls.</p></div>${SP.ui.scorePill(score)}</div>
      <div class="grid g4">
        <div class="kpi"><span class="ki">${icon('list')}</span><div><strong>${Object.values(k.checklist).flat().filter((i) => i.done).length}</strong><span>checks done</span></div></div>
        <div class="kpi"><span class="ki">${icon('thermo')}</span><div><strong>${k.tempLog.length}</strong><span>temperature logs</span></div></div>
        <div class="kpi"><span class="ki">${icon('camera')}</span><div><strong>${k.aiChecks.length}</strong><span>AI checks</span></div></div>
        <div class="kpi"><span class="ki">${icon('siren')}</span><div><strong>${k.recalls.length}</strong><span>recalls</span></div></div>
      </div>
      <div class="row"><button class="btn primary" id="rep-print">${icon('file')} Open printable report</button><button class="btn ghost" id="rep-dl">${icon('download')} Download (.html)</button></div>
      <p class="muted" style="font-size:13px">Tip: in the printable view, choose "Save as PDF" to share with an inspector.</p>
    </section>
    ${SP.qrCard(outlet())}`;
  }
  function bindReport(k) {
    SP.bindQR(outlet());
    const html = () => SP.Kitchen.reportHTML(k, outlet());
    $('#rep-print').onclick = () => {
      const w = window.open('', '_blank');
      if (!w) return SP.toast('Pop-up blocked. Use Download instead.', 'warn');
      w.document.write(html()); w.document.close(); setTimeout(() => w.print(), 400);
    };
    $('#rep-dl').onclick = () => {
      const url = URL.createObjectURL(new Blob([html()], { type: 'text/html' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `hygiq-audit-${outlet().name.replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html` });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      SP.toast('Audit report downloaded.', 'safe');
    };
  }

  /* ===================== Route ===================== */
  const VIEWS = {
    overview: [viewOverview], haccp: [viewHaccp, bindHaccp], temps: [viewTemps, bindTemps], stock: [viewStock, bindStock],
    ai: [viewAI, bindAI], staff: [viewStaff, bindStaff], surplus: [viewSurplus, bindSurplus], report: [viewReport, bindReport],
  };
  let firstLoad = true;

  function page(app, { tab = 'overview' }) {
    if (!VIEWS[tab]) return SP.go('/kitchen');
    const k = K();
    if (!k) {
      app.innerHTML = `<main class="center-page">${SP.ui.empty('alert', 'Kitchen not found', 'This account is not linked to an outlet.', '<button class="btn primary" data-logout>Sign out</button>')}</main>`;
      return;
    }
    const outN = k.sensors.filter((s) => !SP.inRange(s)).length;
    const nav = NAV.map((n) => ({ ...n, href: '/kitchen/' + n.id, badge: n.id === 'temps' && outN ? outN : '' }));
    const [title, sub] = TITLES[tab];
    app.innerHTML = SP.shell({
      role: 'kitchen', nav, active: tab, title, subtitle: sub,
      actions: `<span class="pill pill-info" style="display:none" aria-hidden="true"></span>`,
      content: SP.ui.skeleton(4),
    });
    const [view, bind] = VIEWS[tab];
    const draw = () => {
      const v = $('#view');
      if (!v) return;
      v.innerHTML = view(k);
      bind && bind(k, draw);
      SP.ui.animateGauge($('#k-gauge'), SP.computeScore(k));
    };
    // brief skeleton on first load, instant afterwards
    setTimeout(draw, firstLoad ? 450 : 0);
    firstLoad = false;
    startSensors();
    SP.onLeave(stopSensors);
  }

  SP.route('/kitchen', (app) => page(app, {}), { role: 'kitchen' });
  SP.route('/kitchen/:tab', page, { role: 'kitchen' });
})();
