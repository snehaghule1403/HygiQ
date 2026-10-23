/* =========================================================
   regulator.js — Food safety officer dashboard
   Risk heatmap · outlets by risk · complaint feed ·
   outbreak early warning · inspections · full outlet history
   ========================================================= */
(function () {
  const { icon, esc, $, $$ } = SP;
  const S = () => SP.Store.state;
  const save = () => SP.Store.save();
  const HOUR = 3600000;

  const NAV = [
    { id: 'overview', label: 'Overview', icon: 'home', href: '/regulator' },
    { id: 'outlets', label: 'Outlets', icon: 'store', href: '/regulator/outlets' },
    { id: 'complaints', label: 'Complaints', icon: 'alert', href: '/regulator/complaints' },
    { id: 'inspections', label: 'Inspections', icon: 'list', href: '/regulator/inspections' },
  ];

  /* ---------------- risk model ----------------
     Risk (0–100) = inverse hygiene score (60%) + open complaints in 7 days (up to 30)
                    + live violations: out-of-range sensors, expired stock (up to 10) */
  const SERIOUS = ['Food poisoning', 'Hygiene', 'Pests', 'Expired food', 'Allergen'];
  SP.riskOf = function (o) {
    const k = S().kitchens[o.id];
    const score = SP.computeScore(k);
    const recent = S().complaints.filter((c) => c.outletId === o.id && c.status !== 'resolved' && Date.now() - new Date(c.at) < 7 * 24 * HOUR);
    const live = k.sensors.filter((s) => !SP.inRange(s)).length + k.batches.filter((b) => SP.daysLeft(b.expiry) < 0).length;
    const risk = Math.round(Math.min(100, (100 - score) * 0.6 + Math.min(30, recent.length * 10) + Math.min(10, live * 5)));
    return { risk, score, complaints: recent.length, live };
  };
  const riskTone = (r) => (r >= 40 ? 'danger' : r >= 20 ? 'warn' : 'safe');
  const riskLabel = (r) => (r >= 40 ? 'High risk' : r >= 20 ? 'Medium' : 'Low');

  /* ---------------- Outbreak Early Warning ----------------
     Outlet cluster: ≥ 2 serious complaints at one outlet within 48 h.
     Area cluster:   ≥ 3 serious complaints across one area within 72 h. */
  SP.outbreaks = function () {
    const now = Date.now();
    const serious = S().complaints.filter((c) => SERIOUS.includes(c.category) && c.status !== 'resolved');
    const out = [];
    S().outlets.forEach((o) => {
      const hits = serious.filter((c) => c.outletId === o.id && now - new Date(c.at) < 48 * HOUR);
      if (hits.length >= 2) out.push({ kind: 'outlet', key: o.id, title: o.name, area: o.area, count: hits.length, window: '48 h', items: hits, outletIds: [o.id] });
    });
    const areas = [...new Set(S().outlets.map((o) => o.area))];
    areas.forEach((a) => {
      const ids = S().outlets.filter((o) => o.area === a).map((o) => o.id);
      const hits = serious.filter((c) => ids.includes(c.outletId) && now - new Date(c.at) < 72 * HOUR);
      const outletsHit = new Set(hits.map((c) => c.outletId));
      if (hits.length >= 3 && outletsHit.size >= 2) out.push({ kind: 'area', key: a, title: a, area: a, count: hits.length, window: '72 h', items: hits, outletIds: [...outletsHit] });
    });
    return out;
  };

  const outletById = (id) => S().outlets.find((o) => o.id === id);
  const statusPill = { open: 'pill-warn', reviewed: 'pill-info', resolved: 'pill-safe' };

  /* ---------------- heatmap ----------------
     Outlets are placed on a 5×5 city grid by (lat, lng). Each cell takes the
     colour of its riskiest outlet; empty cells stay neutral. */
  function heatmap() {
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const here = S().outlets.filter((o) => o.lat === r && o.lng === c).map((o) => ({ o, ...SP.riskOf(o) }));
      const top = here.sort((a, b) => b.risk - a.risk)[0];
      const tone = top ? riskTone(top.risk) : 'none';
      cells.push(top
        ? `<a class="heat-cell heat-${tone}" href="#/regulator/outlet/${top.o.id}" style="--a:${0.35 + top.risk / 140}" aria-label="${esc(here.map((h) => h.o.name).join(', '))}: risk ${top.risk}">
            <strong>${top.risk}</strong><span>${esc(top.o.name.split(' ').slice(0, 2).join(' '))}${here.length > 1 ? ` +${here.length - 1}` : ''}</span></a>`
        : `<div class="heat-cell heat-none" aria-hidden="true"></div>`);
    }
    return `<div class="heatmap" role="group" aria-label="Risk heatmap of outlets by location">${cells.join('')}</div>
      <div class="row" style="font-size:12px;margin-top:10px;gap:14px"><span class="row" style="gap:6px"><i class="lg heat-safe"></i>Low</span><span class="row" style="gap:6px"><i class="lg heat-warn"></i>Medium</span><span class="row" style="gap:6px"><i class="lg heat-danger"></i>High</span><span class="muted">Click a cell for full history</span></div>`;
  }

  function outbreakCards(list) {
    if (!list.length) return `<div class="banner" style="background:var(--safe-soft);color:var(--safe)">${icon('check')}<span>No complaint clusters detected in the last 72 hours.</span></div>`;
    return list.map((ob) => `<div class="outbreak" role="alert">
        <span class="ob-icon">${icon('siren')}</span>
        <div class="grow"><strong>${ob.kind === 'outlet' ? 'Outlet cluster' : 'Area cluster'}: ${esc(ob.title)}</strong>
          <small>${ob.count} serious complaints in ${ob.window}${ob.kind === 'area' ? ` across ${ob.outletIds.length} outlets` : ` · ${esc(ob.area)}`} · ${[...new Set(ob.items.map((c) => c.category))].join(', ')}</small></div>
        <button class="btn danger sm" data-inspect="${ob.outletIds[0]}" data-urgent="1">${icon('zap')} Urgent inspection</button>
        <a class="btn ghost sm" href="#/regulator/outlet/${ob.outletIds[0]}">View logs</a>
      </div>`).join('');
  }

  function complaintRow(c, withActions = true) {
    const o = outletById(c.outletId);
    return `<div class="li" style="align-items:flex-start">
      ${c.photo ? `<img src="${c.photo}" alt="Complaint photo" style="width:52px;height:52px;object-fit:cover;border-radius:10px">` : `<span class="ki bg-${SERIOUS.includes(c.category) ? 'danger' : 'warn'}" style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex:none">${icon('alert')}</span>`}
      <div class="grow"><strong>${esc(c.category)}</strong> · <a href="#/regulator/outlet/${c.outletId}">${esc(o?.name || 'Unknown')}</a> <span class="muted">· ${esc(o?.area || '')}</span>
        <small>"${esc(c.text)}"</small><small>${esc(c.user)} · ${SP.relTime(c.at)}</small></div>
      <div class="stack" style="gap:6px;justify-items:end"><span class="pill ${statusPill[c.status]}">${c.status}</span>
        ${withActions && c.status !== 'resolved' ? `<button class="btn ghost sm" data-cstatus="${c.id}" data-to="${c.status === 'open' ? 'reviewed' : 'resolved'}">${c.status === 'open' ? 'Mark reviewed' : 'Resolve'}</button>` : ''}</div>
    </div>`;
  }

  /* ===================== Overview ===================== */
  function viewOverview() {
    const ranked = S().outlets.map((o) => ({ o, ...SP.riskOf(o) })).sort((a, b) => b.risk - a.risk);
    const obs = SP.outbreaks();
    const open = S().complaints.filter((c) => c.status === 'open');
    const upcoming = S().inspections.filter((i) => i.status === 'scheduled');
    const avg = Math.round(ranked.reduce((a, r) => a + r.score, 0) / ranked.length);
    const kpi = (ic, tone, v, l) => `<div class="card kpi"><span class="ki bg-${tone}">${icon(ic)}</span><div><strong>${v}</strong><span>${l}</span></div></div>`;
    return `
      <section class="stack" style="gap:10px" aria-label="Outbreak early warning"><h2 class="sec-title">${icon('siren')} Outbreak early warning</h2>${outbreakCards(obs)}</section>
      <div class="grid g4">
        ${kpi('store', 'safe', ranked.length, 'outlets monitored')}
        ${kpi('shield', SP.scoreTone(avg), avg, 'average hygiene score')}
        ${kpi('alert', open.length ? 'warn' : 'safe', open.length, 'open complaints')}
        ${kpi('list', 'safe', upcoming.length, 'inspections scheduled')}
      </div>
      <div class="grid g2" style="align-items:start">
        <section class="card"><div class="card-head"><div><h2>Risk heatmap</h2><p>Jurisdiction grid · riskiest outlet per block</p></div></div>${heatmap()}</section>
        <section class="card"><div class="card-head"><div><h2>Highest risk outlets</h2><p>Inspect from the top down</p></div><a class="btn ghost sm" href="#/regulator/outlets">See all</a></div>
          ${ranked.slice(0, 5).map(riskRow).join('')}</section>
      </div>
      <section class="card"><div class="card-head"><div><h2>Live complaint feed</h2><p>Newest first</p></div><a class="btn ghost sm" href="#/regulator/complaints">All complaints</a></div>
        ${S().complaints.length ? S().complaints.slice(0, 5).map((c) => complaintRow(c)).join('') : SP.ui.empty('alert', 'No complaints', 'Customer reports will stream in here.')}</section>`;
  }

  const riskRow = (r) => `<div class="li">
      <span class="risk-badge bg-${riskTone(r.risk)}" aria-label="Risk ${r.risk}">${r.risk}</span>
      <div class="grow"><a href="#/regulator/outlet/${r.o.id}"><strong>${esc(r.o.name)}</strong></a><small>${esc(r.o.area)} · score ${r.score} · ${r.complaints} complaint(s) · ${r.live} live violation(s)</small></div>
      <button class="btn ghost sm" data-inspect="${r.o.id}">${icon('list')} Schedule</button></div>`;

  /* ===================== Outlets list ===================== */
  let oq = '';
  function outletsList() {
    const rows = S().outlets.map((o) => ({ o, ...SP.riskOf(o) }))
      .filter((r) => !oq || (r.o.name + r.o.area).toLowerCase().includes(oq.toLowerCase()))
      .sort((a, b) => b.risk - a.risk);
    if (!rows.length) return SP.ui.empty('store', 'No outlets match', 'Try a different name or area.');
    return `<div class="table-wrap"><table><thead><tr><th>Risk</th><th>Outlet</th><th>Area</th><th>Score</th><th>Complaints (7d)</th><th>Last inspection</th><th></th></tr></thead><tbody>
      ${rows.map((r) => {
        const last = S().inspections.filter((i) => i.outletId === r.o.id && i.status === 'done').sort((a, b) => b.date.localeCompare(a.date))[0];
        return `<tr><td><span class="risk-badge bg-${riskTone(r.risk)}">${r.risk}</span></td><td><a href="#/regulator/outlet/${r.o.id}"><strong>${esc(r.o.name)}</strong></a><br><small class="muted">${esc(r.o.type)}</small></td>
        <td>${esc(r.o.area)}</td><td>${SP.ui.scorePill(r.score)}</td><td>${r.complaints}</td><td>${last ? `${SP.fmtDate(last.date)} · ${esc(last.result)}` : '<span class="muted">Never</span>'}</td>
        <td><button class="btn ghost sm" data-inspect="${r.o.id}">Schedule</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  function viewOutlets() {
    return `<section class="card"><div class="card-head"><div><h2>All outlets by risk</h2><p>Risk blends hygiene score, recent complaints and live violations</p></div>
      <div class="search" style="min-width:min(100%,280px)">${icon('eye')}<label class="sr-only" for="oq">Search outlets</label><input class="input" id="oq" type="search" placeholder="Search outlets" value="${esc(oq)}"></div></div>
      <div id="o-list">${outletsList()}</div></section>`;
  }

  /* ===================== Complaints ===================== */
  let cfilter = 'all';
  function viewComplaints() {
    const list = S().complaints.filter((c) => cfilter === 'all' || c.status === cfilter);
    const count = (s) => S().complaints.filter((c) => s === 'all' || c.status === s).length;
    return `<section class="stack" style="gap:10px"><h2 class="sec-title">${icon('siren')} Clusters</h2>${outbreakCards(SP.outbreaks())}</section>
      <section class="card">
        <div class="tabs" role="tablist" aria-label="Filter complaints" style="margin-bottom:12px">
          ${['all', 'open', 'reviewed', 'resolved'].map((s) => `<button class="tab" role="tab" data-cf="${s}" aria-selected="${cfilter === s}">${s[0].toUpperCase() + s.slice(1)} <small>${count(s)}</small></button>`).join('')}</div>
        ${list.length ? list.map((c) => complaintRow(c)).join('') : SP.ui.empty('check', 'Nothing here', `No ${cfilter === 'all' ? '' : cfilter + ' '}complaints.`)}
      </section>`;
  }

  /* ===================== Inspections ===================== */
  function viewInspections() {
    const ins = [...S().inspections].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const up = ins.filter((i) => i.status === 'scheduled');
    const done = ins.filter((i) => i.status === 'done').reverse();
    const row = (i) => { const o = outletById(i.outletId); return `<div class="li">
      <div class="date-chip"><strong>${new Date(i.date + 'T00:00').getDate()}</strong><span>${new Date(i.date + 'T00:00').toLocaleDateString([], { month: 'short' })}</span></div>
      <div class="grow"><a href="#/regulator/outlet/${i.outletId}"><strong>${esc(o?.name || '')}</strong></a> ${i.urgent ? '<span class="pill pill-danger">Urgent</span>' : ''}<small>${esc(i.type)} · ${esc(i.time)} · ${esc(o?.area || '')}${i.notes ? ' · ' + esc(i.notes) : ''}</small>${i.result ? `<small>Result: <strong>${esc(i.result)}</strong></small>` : ''}</div>
      ${i.status === 'scheduled' ? `<button class="btn primary sm" data-complete="${i.id}">Record result</button>` : `<span class="pill ${i.result === 'Pass' ? 'pill-safe' : i.result === 'Fail' ? 'pill-danger' : 'pill-warn'}">${esc(i.result)}</span>`}</div>`; };
    return `<div class="grid g2" style="align-items:start">
      <section class="card"><div class="card-head"><div><h2>Upcoming</h2><p>${up.length} scheduled</p></div><button class="btn primary sm" data-inspect="">${icon('plus')} Schedule</button></div>
        ${up.length ? up.map(row).join('') : SP.ui.empty('list', 'No inspections scheduled', 'Schedule one from the risk list or with the button above.')}</section>
      <section class="card"><div class="card-head"><h2>Completed</h2></div>${done.length ? done.map(row).join('') : SP.ui.empty('check', 'No completed inspections yet', 'Recorded results appear here and in each outlet\'s history.')}</section>
    </div>`;
  }

  /* ---------------- shared modals ---------------- */
  function scheduleModal(outletId, urgent, after) {
    const today = new Date();
    const d = new Date(today.getTime() + (urgent ? 1 : 3) * 86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    SP.modal({
      title: urgent ? 'Schedule urgent inspection' : 'Schedule inspection',
      body: `<div class="field"><label for="i-outlet">Outlet</label><select class="input" id="i-outlet">${S().outlets.map((o) => `<option value="${o.id}" ${o.id === outletId ? 'selected' : ''}>${esc(o.name)} — risk ${SP.riskOf(o).risk}</option>`).join('')}</select></div>
        <div class="grid g2"><div class="field"><label for="i-date">Date</label><input class="input" id="i-date" type="date" value="${iso}" min="${iso.slice(0, 4)}-01-01"></div>
        <div class="field"><label for="i-time">Time</label><input class="input" id="i-time" type="time" value="${urgent ? '10:00' : '11:30'}"></div></div>
        <div class="field"><label for="i-type">Type</label><select class="input" id="i-type"><option ${urgent ? 'selected' : ''}>Complaint follow-up</option><option ${urgent ? '' : 'selected'}>Routine inspection</option><option>Re-inspection</option><option>Sampling visit</option></select></div>
        <div class="field"><label for="i-notes">Notes (optional)</label><input class="input" id="i-notes" placeholder="e.g. Check cold room and raita prep"></div>
        <label class="check"><input type="checkbox" id="i-urgent" ${urgent ? 'checked' : ''}> Mark as urgent</label>
        <p class="form-error" id="i-err">${icon('alert')}<span>Choose a date that is today or later.</span></p>`,
      actions: [{ label: 'Cancel' }, { label: 'Schedule', kind: 'primary', onClick: (m) => {
        const date = $('#i-date', m).value;
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (!date || date < todayIso) { $('#i-err', m).classList.add('show'); return false; }
        const oid = $('#i-outlet', m).value;
        S().inspections.push({ id: SP.uid('in'), outletId: oid, date, time: $('#i-time', m).value || '10:00', type: $('#i-type', m).value, notes: $('#i-notes', m).value.trim(), urgent: $('#i-urgent', m).checked, status: 'scheduled' });
        save(); after && after();
        SP.toast(`${outletById(oid).name} · ${SP.fmtDate(date + 'T00:00')} at ${$('#i-time', m).value}. The outlet has been notified.`, 'safe', 'Inspection scheduled');
      } }],
    });
  }
  function completeModal(id, after) {
    const i = S().inspections.find((x) => x.id === id);
    SP.modal({
      title: 'Record inspection result',
      body: `<p><strong>${esc(outletById(i.outletId).name)}</strong> · ${esc(i.type)}</p>
        <div class="tabs" role="radiogroup" aria-label="Result">${['Pass', 'Improvement notice', 'Fail'].map((r, n) => `<button class="tab" role="radio" data-res="${r}" aria-selected="${n === 0}" aria-checked="${n === 0}">${r}</button>`).join('')}</div>
        <div class="field"><label for="r-notes">Findings</label><textarea class="input" id="r-notes" placeholder="What did you observe?"></textarea></div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save result', kind: 'primary', onClick: (m) => {
        i.status = 'done'; i.result = $('[data-res][aria-selected="true"]', m).dataset.res; i.findings = $('#r-notes', m).value.trim(); i.completedAt = new Date().toISOString();
        save(); after && after();
        SP.toast(`Result recorded: ${i.result}.`, i.result === 'Pass' ? 'safe' : 'warn');
      } }],
    }).el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-res]');
      if (t) $$('[data-res]').forEach((x) => { x.setAttribute('aria-selected', String(x === t)); x.setAttribute('aria-checked', String(x === t)); });
    });
  }

  /* ===================== Outlet full history ===================== */
  function viewHistory(o) {
    const k = S().kitchens[o.id];
    const r = SP.riskOf(o);
    const comps = S().complaints.filter((c) => c.outletId === o.id);
    const ins = S().inspections.filter((i) => i.outletId === o.id).sort((a, b) => b.date.localeCompare(a.date));
    const items = Object.values(k.checklist).flat();
    const expired = k.batches.filter((b) => SP.daysLeft(b.expiry) < 0);

    /* one merged timeline of everything this kitchen logged */
    const timeline = [
      ...k.tempLog.map((l) => ({ at: l.at, tone: l.ok ? 'safe' : 'danger', ic: 'thermo', t: `${l.sensor}: ${l.value}°C ${l.ok ? '' : '(out of range)'}` })),
      ...k.alerts.map((a) => ({ at: a.at, tone: 'danger', ic: 'siren', t: a.text })),
      ...k.aiChecks.map((a) => ({ at: a.at, tone: a.issues.filter((i) => !i.fixed).length ? 'warn' : 'safe', ic: 'camera', t: a.issues.length ? `AI check: ${a.issues.map((i) => i.title + (i.fixed ? ' (fixed)' : '')).join('; ')}` : 'AI check: all clear' })),
      ...items.filter((i) => i.done).map((i) => ({ at: i.at, tone: 'safe', ic: 'check', t: `HACCP: ${i.label} — ${i.by}` })),
      ...k.recalls.map((x) => ({ at: x.at, tone: 'danger', ic: 'siren', t: `Recall ${x.batch} ${x.item}: ${x.reason}` })),
      ...comps.map((c) => ({ at: c.at, tone: 'warn', ic: 'alert', t: `Complaint (${c.category}): ${c.text}` })),
      ...ins.filter((i) => i.completedAt).map((i) => ({ at: i.completedAt, tone: i.result === 'Pass' ? 'safe' : 'danger', ic: 'badge', t: `Inspection ${i.result}${i.findings ? ': ' + i.findings : ''}` })),
    ].filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));

    return `
      <section class="card outlet-hero">
        <div class="stack" style="gap:6px"><span class="muted">${esc(o.type)} · ${esc(o.cuisine)} · ${esc(o.area)}</span><h2 style="font-size:24px">${esc(o.name)}</h2>
          <div class="row"><span class="risk-badge bg-${riskTone(r.risk)}">${r.risk}</span><strong class="t-${riskTone(r.risk)}">${riskLabel(r.risk)}</strong><span class="muted">· ${comps.length} complaint(s) total · ${expired.length} expired batch(es)</span></div>
          <div class="row" style="margin-top:8px"><button class="btn primary sm" data-inspect="${o.id}">${icon('list')} Schedule inspection</button><a class="btn ghost sm" href="#/outlet/${o.id}">${icon('eye')} Public view</a><button class="btn ghost sm" id="h-report">${icon('download')} Audit report</button></div></div>
        <div style="display:grid;place-items:center">${SP.ui.gauge('h-gauge')}</div>
      </section>
      <div class="grid g2" style="align-items:start">
        <section class="card"><div class="card-head"><h2>Score breakdown</h2></div><div class="bars" id="h-bars"></div>
          <h3 style="font-size:14px;margin:18px 0 6px">Sensors now</h3>
          ${k.sensors.map((s) => `<div class="li"><span class="dot-s" style="background:var(--${SP.inRange(s) ? 'safe' : 'danger'})"></span><div class="grow">${esc(s.name)}</div><span class="pill pill-${SP.inRange(s) ? 'safe' : 'danger'} mono">${s.value.toFixed(1)}°C</span></div>`).join('')}
          <h3 style="font-size:14px;margin:18px 0 6px">Inspections</h3>
          ${ins.length ? ins.map((i) => `<div class="li"><div class="grow">${SP.fmtDate(i.date + 'T00:00')} · ${esc(i.type)}<small>${i.status === 'done' ? esc(i.result) : 'Scheduled ' + esc(i.time)}</small></div></div>`).join('') : '<p class="muted" style="font-size:13px">No inspections on record.</p>'}
        </section>
        <section class="card"><div class="card-head"><div><h2>Full log history</h2><p>${timeline.length} events from sensors, staff, AI and customers</p></div></div>
          <div class="timeline">${timeline.length ? timeline.slice(0, 40).map((e) => `<div class="tl-item"><span class="tl-dot bg-${e.tone}">${icon(e.ic)}</span><div><span>${esc(e.t)}</span><small>${SP.fmtDate(e.at)} ${SP.fmtTime(e.at)}</small></div></div>`).join('') : SP.ui.empty('list', 'No logs yet', 'This kitchen has not recorded anything.')}</div>
        </section>
      </div>`;
  }

  /* ===================== Routing ===================== */
  const TITLES = {
    overview: ['Jurisdiction overview', 'Live risk across every kitchen you oversee'],
    outlets: ['Outlets by risk', 'Prioritise inspections with live data'],
    complaints: ['Complaint feed', 'Customer reports, triaged'],
    inspections: ['Inspections', 'Schedule visits and record results'],
  };
  const VIEWS = { overview: viewOverview, outlets: viewOutlets, complaints: viewComplaints, inspections: viewInspections };

  /* One delegated handler per page for all regulator actions */
  function bindCommon(draw) {
    const v = $('#view');
    v.addEventListener('click', (e) => {
      const ins = e.target.closest('[data-inspect]');
      if (ins) return scheduleModal(ins.dataset.inspect, !!ins.dataset.urgent, draw);
      const cs = e.target.closest('[data-cstatus]');
      if (cs) { const c = S().complaints.find((x) => x.id === cs.dataset.cstatus); c.status = cs.dataset.to; save(); draw(); return SP.toast(`Complaint marked ${c.status}.`, 'info'); }
      const cf = e.target.closest('[data-cf]');
      if (cf) { cfilter = cf.dataset.cf; return draw(); }
      const cp = e.target.closest('[data-complete]');
      if (cp) return completeModal(cp.dataset.complete, draw);
    });
    v.addEventListener('input', (e) => { if (e.target.id === 'oq') { oq = e.target.value.trim(); $('#o-list').innerHTML = outletsList(); } });
  }

  function page(app, tab) {
    const [title, sub] = TITLES[tab];
    const obN = SP.outbreaks().length;
    const nav = NAV.map((n) => ({ ...n, badge: n.id === 'complaints' && obN ? obN : '' }));
    app.innerHTML = SP.shell({ role: 'regulator', nav, active: tab, title, subtitle: sub, content: SP.ui.skeleton(4) });
    const draw = () => { const v = $('#view'); if (v) v.innerHTML = VIEWS[tab](); };
    setTimeout(() => { draw(); bindCommon(draw); }, 300);
  }

  SP.route('/regulator', (app) => page(app, 'overview'), { role: 'regulator' });
  SP.route('/regulator/outlets', (app) => page(app, 'outlets'), { role: 'regulator' });
  SP.route('/regulator/complaints', (app) => page(app, 'complaints'), { role: 'regulator' });
  SP.route('/regulator/inspections', (app) => page(app, 'inspections'), { role: 'regulator' });

  SP.route('/regulator/outlet/:id', (app, { id }) => {
    const o = outletById(id);
    app.innerHTML = SP.shell({
      role: 'regulator', nav: NAV, active: 'outlets', title: o ? 'Outlet history' : 'Outlet not found', subtitle: o ? 'Every log, alert, complaint and inspection' : '',
      actions: `<a class="btn ghost sm" href="#/regulator/outlets">${icon('arrowL')} Back</a>`,
      content: o ? SP.ui.skeleton(3) : SP.ui.empty('store', 'Outlet not found', 'It may have been removed.', '<a class="btn primary" href="#/regulator/outlets">All outlets</a>'),
    });
    if (!o) return;
    const draw = () => {
      $('#view').innerHTML = viewHistory(o);
      const k = S().kitchens[o.id];
      const b = SP.scoreBreakdown(k);
      $('#h-bars').innerHTML = [['Checklist', b.checklist, 25], ['Temperatures', b.temps, 30], ['Stock & expiry', b.stock, 15], ['Training', b.training, 15], ['AI checks', b.ai, 15]]
        .map(([l, v, max]) => { const p = (v / max) * 100; return `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${p}%;background:var(--${p >= 80 ? 'safe' : p >= 50 ? 'warn' : 'danger'})"></i></div><strong>${Math.round(v)}/${max}</strong></div>`; }).join('');
      SP.ui.animateGauge($('#h-gauge'), SP.computeScore(k));
      $('#h-report').onclick = () => {
        const url = URL.createObjectURL(new Blob([SP.Kitchen.reportHTML(k, o)], { type: 'text/html' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `hygiq-audit-${o.name.replace(/\W+/g, '-').toLowerCase()}.html` });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        SP.toast('Audit report downloaded.', 'safe');
      };
    };
    setTimeout(() => { draw(); bindCommon(draw); }, 300);
  }, { role: 'regulator' });
})();
