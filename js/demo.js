/* =========================================================
   demo.js — Hackathon demo mode + Future scope page
   Demo mode auto-plays the 4-step story:
   1. Photo AI flags a violation
   2. A fridge drifts out of range and the score drops live
   3. A customer scans the QR and sees the logs
   4. Allergy Guard hides unsafe dishes
   ========================================================= */
SP.Demo = (function () {
  const STEPS = [
    ['Photo AI', 'The kitchen snaps a prep-station photo. AI flags bare hands and uncovered food, with fixes.'],
    ['Live sensors', 'The prep fridge starts warming up. Watch the alert fire and the hygiene score drop live.'],
    ['QR scan', "A customer scans the table QR and sees the kitchen's real logs: temperatures, cleaning, training."],
    ['Allergy Guard', 'She is allergic to peanuts and milk. One tap hides every unsafe dish on the menu.'],
  ];
  let running = false, stop = false, bar = null;
  const $ = SP.$;

  /* Sleep that can be interrupted by the Stop button */
  async function wait(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (stop) throw new Error('stopped'); await SP.sleep(100); }
  }
  /* Poll until fn() returns something truthy (or time out) */
  async function waitFor(fn, timeout = 8000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (stop) throw new Error('stopped'); const v = fn(); if (v) return v; await SP.sleep(120); }
    return null;
  }
  function focusEl(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('demo-focus');
    setTimeout(() => el.classList.remove('demo-focus'), 2600);
  }
  function showBar() {
    bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Demo mode');
    bar.innerHTML = `<div class="demo-steps">${STEPS.map((s, i) => `<span data-ds="${i}"><b>${i + 1}</b>${s[0]}</span>`).join('')}</div>
      <p class="demo-cap" aria-live="polite">Starting demo…</p>
      <button class="btn ghost sm" data-demo-stop>${SP.icon('x')} Stop demo</button>`;
    document.body.appendChild(bar);
    bar.querySelector('[data-demo-stop]').onclick = () => { stop = true; };
  }
  function setStep(i, done) {
    SP.$$('[data-ds]', bar).forEach((s, n) => { s.classList.toggle('on', n === i && !done); s.classList.toggle('done', n < i || done); });
    $('.demo-cap', bar).textContent = done ? "That's HygiQ: one live trust layer for kitchens, customers and regulators." : STEPS[i][1];
  }
  function phoneScan() {
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `<div class="phone" role="img" aria-label="Customer scanning the outlet QR code"><div class="phone-notch"></div><div class="qr-box" id="demo-qr"></div><span class="laser"></span><p>Scanning table QR…</p></div>`;
    document.body.appendChild(el);
    SP.renderQR($('#demo-qr'), SP.outletUrl('o1'), 150);
    return el;
  }

  async function run() {
    if (running) return;
    running = true; stop = false;
    const st = SP.Store.state;
    // Fresh state for the demo kitchen and customer only; other data is untouched
    st.kitchens.o1 = SP.seedKitchen('o1', 'good');
    const cust = st.users.find((u) => u.id === 'u-consumer');
    cust.allergies = ['peanuts', 'milk']; cust.allergyMode = 'flag';
    SP.Store.save();
    SP.$$('.modal-backdrop').forEach((m) => m.remove());
    showBar();
    let overlay = null;
    try {
      /* 1 — Photo AI */
      setStep(0);
      SP.Session.login(st.users.find((u) => u.id === 'u-kitchen'), true);
      SP.go('/kitchen/ai');
      const btn = await waitFor(() => $('#sample'));
      focusEl(btn); await wait(1400);
      btn && btn.click();
      focusEl(await waitFor(() => $('.issue'), 9000));
      await wait(3800);

      /* 2 — fridge goes out of range, score drops live */
      setStep(1);
      SP.go('/kitchen/overview');
      focusEl(await waitFor(() => $('#k-gauge')?.dataset.v && $('#k-gauge')));
      await wait(1500);
      const fridge = st.kitchens.o1.sensors.find((s) => s.id === 's2');
      fridge.fault = true; SP.Store.save();
      SP.toast('Prep fridge compressor fault simulated.', 'warn', 'Demo');
      await waitFor(() => !SP.inRange(fridge), 15000);
      focusEl($('#k-gauge'));
      await wait(4500);

      /* 3 — customer scans the QR and sees the logs */
      setStep(2);
      overlay = phoneScan();
      await wait(2600);
      overlay.remove(); overlay = null;
      SP.Session.login(cust, true);
      SP.go('/outlet/o1');
      await waitFor(() => $('.outlet-hero'));
      await wait(800);
      focusEl(SP.$$('#view .card')[5] || $('#view .card'));
      await wait(4200);

      /* 4 — Allergy Guard hides unsafe dishes */
      setStep(3);
      focusEl(await waitFor(() => $('#menu')));
      await wait(2200);
      $('[data-amode="hide"]')?.click();
      await wait(600);
      focusEl($('#menu'));
      await wait(3500);
      setStep(3, true);
      SP.toast('Demo complete. Explore any role from the home page.', 'safe', 'Demo finished');
      await wait(5000);
    } catch (e) {
      if (e.message !== 'stopped') { console.error(e); SP.toast('The demo stopped unexpectedly.', 'warn'); }
    } finally {
      if (overlay) overlay.remove();
      // put the fridge back to normal so the demo kitchen is healthy again
      const f = st.kitchens.o1.sensors.find((s) => s.id === 's2');
      f.fault = false; f.value = 4.0; SP.Store.save();
      if (bar) bar.remove();
      bar = null; running = false;
    }
  }

  document.addEventListener('click', (e) => { if (e.target.closest('[data-demo]')) { e.preventDefault(); run(); } });
  return { run, get running() { return running; } };
})();

/* =========================================================
   Future scope page
   ========================================================= */
SP.route('/future', (app) => {
  const items = [
    ['thermo', 'Real IoT sensors', 'Plug-and-play LoRaWAN or BLE probes in every fridge, freezer and bain-marie stream readings over MQTT. The simulated feed already uses the same data model, so swapping in hardware is a configuration change.', 'Pilot'],
    ['box', 'Blockchain traceability', 'Each batch gets a signed, append-only record from farm to plate. Recalls reach every affected outlet in seconds, and no one can edit a log after the fact.', 'Research'],
    ['zap', 'Predictive risk models', 'Models trained on temperature drift, complaint text, inspection history and weather predict which kitchens are likely to fail next week, so inspectors go there first.', 'Prototype'],
    ['user', 'Multilingual support', 'Hindi, Kannada, Tamil, Marathi and Bengali for kitchen staff, with voice-guided checklists for low-literacy teams and an icon-first interface.', 'Next release'],
    ['camera', 'Production vision AI', 'Replace the simulated model with a fine-tuned vision model on a secure backend. The frontend already calls one provider function, so nothing else changes.', 'Integration ready'],
    ['badge', 'Regulator integrations', 'Two-way sync with FSSAI FoSCoS licences and state inspection systems, plus WhatsApp and SMS alerts for outbreak clusters.', 'Partnerships'],
  ];
  app.innerHTML = `<div class="landing">
    <header class="land-nav">${SP.ui.brand()}<div class="row"><a class="btn ghost sm" href="#/">${SP.icon('arrowL')} Home</a>${SP.Theme.button()}</div></header>
    <section class="section" style="padding-top:20px">
      <span class="eyebrow">${SP.icon('rocket')} Roadmap</span>
      <h2 style="text-align:left;margin-top:14px">Where ${SP.APP_NAME} goes next</h2>
      <p class="sub" style="text-align:left;margin-left:0">The hackathon build proves the trust loop end to end. Here is how it scales to every kitchen in the country.</p>
      <div class="features">${items.map(([i, t, d, tag]) => `<article class="feature"><div class="row spread" style="margin-bottom:12px"><div class="fi" style="margin:0">${SP.icon(i)}</div><span class="pill pill-info">${tag}</span></div><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
    </section>
    <div class="cta-band"><div><h2>See today's build in action</h2><p>Watch the 4-step story play out on its own.</p></div><button class="btn ghost" data-demo>${SP.icon('play')} Run demo mode</button></div>
    <footer class="land-foot">© ${new Date().getFullYear()} ${SP.APP_NAME} · ${SP.TAGLINE}</footer>
  </div>`;
});
