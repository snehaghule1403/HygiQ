/* =========================================================
   auth.js — landing page, role selection, login & signup
   ========================================================= */
(function () {
  const { icon, esc, $, $$ } = SP;

  /* Per-role configuration: copy, accent and illustration */
  const ROLES = {
    kitchen: {
      label: 'Kitchen', cta: 'I run a kitchen', ic: 'chef', cls: 'r-kitchen', shell: 'role-kitchen',
      blurb: 'Digitise HACCP, monitor fridges live and prove your hygiene to every customer.',
      points: ['Live hygiene score', 'Photo-to-Violation AI', 'Temperature alerts'],
      quote: '“We passed our FSSAI audit in 40 minutes — every log was already there.”',
      who: 'Meera J., owner, Green Bowl Kitchen',
    },
    consumer: {
      label: 'Customer', cta: "I'm a customer", ic: 'user', cls: 'r-consumer', shell: 'role-consumer',
      blurb: 'See live hygiene scores, scan a QR to look inside the kitchen, and eat allergy-safe.',
      points: ['Live score badges', 'QR kitchen transparency', 'Personal Allergy Guard'],
      quote: '“My son has a peanut allergy. HygiQ is the first app that actually tells me what is safe.”',
      who: 'Kavya S., parent, Bengaluru',
    },
    regulator: {
      label: 'Regulator', cta: "I'm a regulator", ic: 'badge', cls: 'r-regulator', shell: 'role-regulator',
      blurb: 'Spot risk before it spreads with a live heatmap, complaint clustering and outbreak alerts.',
      points: ['Risk heatmap', 'Outbreak early warning', 'Inspection scheduler'],
      quote: '“We now inspect the right kitchens first instead of working through a paper list.”',
      who: 'Food Safety Officer, Ward 151',
    },
  };

  const ALLERGENS = ['peanuts', 'tree nuts', 'milk', 'eggs', 'gluten', 'soy', 'fish', 'shellfish', 'sesame', 'mustard'];

  /* Role illustrations — simple inline SVG scenes using the role colour */
  const ART = {
    kitchen: `<svg viewBox="0 0 400 300" class="art" role="img" aria-label="Illustration of a chef with a live temperature dashboard">
      <rect x="40" y="40" width="320" height="200" rx="24" fill="var(--surface)" stroke="var(--border)"/>
      <rect x="64" y="66" width="130" height="80" rx="14" fill="var(--kitchen-soft)"/>
      <path d="M84 126 A40 40 0 0 1 174 126" stroke="var(--kitchen)" stroke-width="10" fill="none" stroke-linecap="round"/>
      <text x="129" y="122" text-anchor="middle" font-weight="800" font-size="22" fill="var(--text)">92</text>
      <rect x="212" y="66" width="124" height="22" rx="8" fill="var(--safe-soft)"/><rect x="212" y="96" width="124" height="22" rx="8" fill="var(--safe-soft)"/><rect x="212" y="126" width="124" height="22" rx="8" fill="var(--warn-soft)"/>
      <circle cx="226" cy="77" r="5" fill="var(--safe)"/><circle cx="226" cy="107" r="5" fill="var(--safe)"/><circle cx="226" cy="137" r="5" fill="var(--warn)"/>
      <polyline points="64,210 100,190 130,198 170,170 210,182 250,160 290,172 336,150" fill="none" stroke="var(--kitchen)" stroke-width="4" stroke-linecap="round"/>
      <circle cx="320" cy="250" r="34" fill="var(--kitchen)"/><path d="M304 248a10 10 0 1 1 6-13 12 12 0 0 1 20 0 10 10 0 1 1 6 13v12h-32z" fill="#fff"/>
    </svg>`,
    consumer: `<svg viewBox="0 0 400 300" class="art" role="img" aria-label="Illustration of a phone scanning a restaurant QR code">
      <rect x="130" y="20" width="150" height="260" rx="28" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
      <rect x="150" y="56" width="110" height="110" rx="12" fill="var(--consumer-soft)"/>
      <g fill="var(--consumer)"><rect x="162" y="68" width="28" height="28" rx="4"/><rect x="220" y="68" width="28" height="28" rx="4"/><rect x="162" y="126" width="28" height="28" rx="4"/><rect x="204" y="112" width="12" height="12"/><rect x="226" y="132" width="20" height="12"/><rect x="204" y="140" width="12" height="14"/></g>
      <rect x="150" y="182" width="110" height="20" rx="8" fill="var(--safe-soft)"/><text x="205" y="196" text-anchor="middle" font-size="11" font-weight="800" fill="var(--safe)">SCORE 94 · SAFE</text>
      <rect x="150" y="212" width="80" height="10" rx="5" fill="var(--surface-2)"/><rect x="150" y="230" width="100" height="10" rx="5" fill="var(--surface-2)"/>
      <circle cx="80" cy="200" r="40" fill="var(--consumer)" opacity=".15"/><circle cx="330" cy="90" r="26" fill="var(--safe)" opacity=".2"/>
      <path d="M318 90l8 8 14-16" stroke="var(--safe)" stroke-width="5" fill="none" stroke-linecap="round"/>
    </svg>`,
    regulator: `<svg viewBox="0 0 400 300" class="art" role="img" aria-label="Illustration of a risk heatmap with an outbreak alert">
      <rect x="40" y="40" width="320" height="220" rx="24" fill="var(--surface)" stroke="var(--border)"/>
      <g>${Array.from({ length: 20 }, (_, i) => {
        const x = 64 + (i % 5) * 56, y = 64 + Math.floor(i / 5) * 46;
        const c = [6, 13].includes(i) ? 'var(--danger)' : [2, 7, 12, 18].includes(i) ? 'var(--warn)' : 'var(--safe)';
        return `<rect x="${x}" y="${y}" width="48" height="38" rx="8" fill="${c}" opacity="${[6, 13].includes(i) ? 0.9 : 0.35}"/>`;
      }).join('')}</g>
      <circle cx="190" cy="129" r="36" fill="none" stroke="var(--danger)" stroke-width="3" stroke-dasharray="6 6"/>
      <rect x="236" y="20" width="140" height="40" rx="12" fill="var(--danger)"/><text x="306" y="45" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">⚠ Cluster: 4 reports</text>
    </svg>`,
  };

  /* ===================== LANDING ===================== */
  SP.route('/', (app) => {
    const user = SP.Session.user;
    app.innerHTML = `<div class="landing">
      <header class="land-nav">
        ${SP.ui.brand()}
        <div class="row">
          <a class="btn ghost sm hide-xs" href="#/future">Future scope</a>
          ${user ? `<a class="btn primary sm" href="#${SP.homeFor(user.role)}">Open dashboard ${icon('arrowR')}</a>` : ''}
          ${SP.Theme.button()}
        </div>
      </header>

      <section class="hero">
        <div>
          <span class="eyebrow"><span class="dot"></span> Live food safety, verified every minute</span>
          <h1>${SP.TAGLINE.replace('every plate', '<em>every plate</em>')}</h1>
          <p class="lede">HygiQ is the live trust layer between kitchens, customers and regulators. Sensors, checklists and AI photo checks turn into one hygiene score that anyone can verify with a QR scan.</p>
          <div class="row" style="margin-top:26px">
            <a class="btn primary" href="#roles">Get started ${icon('arrowR')}</a>
            <button class="btn accent" data-demo>${icon('play')} Hackathon demo mode</button>
          </div>
          <p class="muted" style="font-size:13px;margin-top:10px">Demo mode plays the full story by itself in about 45 seconds.</p>
          <div class="hero-stats">
            <div><strong>4 min</strong><span>to digitise a HACCP day</span></div>
            <div><strong>24/7</strong><span>cold-chain monitoring</span></div>
            <div><strong>1 scan</strong><span>to see inside the kitchen</span></div>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="mock">
            <div class="row spread"><strong>Green Bowl Kitchen</strong><span class="live">Live</span></div>
            ${SP.ui.gauge('hero-gauge')}
            <div class="mock-rows">
              <div class="mock-row"><span>Walk-in fridge</span><span class="pill pill-safe">3.2°C</span></div>
              <div class="mock-row"><span>Opening checklist</span><span class="pill pill-safe">5/5</span></div>
              <div class="mock-row"><span>Fresh cream · B-2410-04</span><span class="pill pill-warn">Expires today</span></div>
            </div>
          </div>
          <div class="float-card a">${icon('camera')} AI check: gloves ✓</div>
          <div class="float-card b"><span class="pill pill-danger">!</span> Prep fridge 7.1°C — alert sent</div>
        </div>
      </section>

      <section class="section" id="roles" tabindex="-1">
        <h2>Who are you here as?</h2>
        <p class="sub">Each role gets its own dashboard. Pick one to sign in, create an account, or jump straight into a demo.</p>
        <div class="roles">
          ${Object.entries(ROLES).map(([key, r]) => `
            <a class="role-card ${r.cls}" href="#/login/${key}">
              <span class="role-icon">${icon(r.ic)}</span>
              <h3>${r.cta}</h3>
              <p>${r.blurb}</p>
              <ul>${r.points.map((p) => `<li>${icon('check')}${p}</li>`).join('')}</ul>
              <span class="go">Continue as ${r.label} ${icon('arrowR')}</span>
            </a>`).join('')}
        </div>
      </section>

      <section class="section">
        <h2>One score. Three sides of trust.</h2>
        <p class="sub">Everything a kitchen does feeds a single, explainable 0–100 hygiene score.</p>
        <div class="features">
          ${[
            ['thermo', 'Live cold chain', 'Fridge, freezer and hot-holding sensors stream readings. Out of range? Instant red alert.'],
            ['camera', 'Photo-to-Violation AI', 'Snap the kitchen; AI flags missing gloves, uncovered food and more, with fixes.'],
            ['list', 'Digital HACCP', 'Opening, cooking, cleaning and closing checks, tap-to-complete, time-stamped.'],
            ['shield', 'Allergy Guard', 'Customers save allergies once; unsafe dishes are hidden or flagged everywhere.'],
            ['siren', 'Outbreak early warning', 'Complaints that cluster around an outlet or area raise a flag for regulators.'],
            ['heart', 'Surplus to NGOs', 'Safe near-expiry food gets discounted or donated instead of binned.'],
          ].map(([i, t, d]) => `<div class="feature"><div class="fi">${icon(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
        </div>
      </section>

      <div class="cta-band">
        <div><h2>See the whole story in under a minute</h2><p>Demo mode plays it all: AI photo check, a live fridge alert, a QR scan and Allergy Guard.</p></div>
        <button class="btn ghost" data-demo>${icon('play')} Run demo mode</button>
      </div>
      <footer class="land-foot">© ${new Date().getFullYear()} ${SP.APP_NAME} · ${SP.TAGLINE} · Built for a hackathon. Demo data only.</footer>
    </div>`;

    SP.ui.animateGauge($('#hero-gauge'), 92);
    $('a[href="#roles"]', app).addEventListener('click', (e) => { e.preventDefault(); $('#roles').scrollIntoView({ behavior: 'smooth' }); $('#roles').focus({ preventScroll: true }); });
  });

  /* ===================== AUTH helpers ===================== */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const field = (id, label, type = 'text', attrs = '') => {
    const input = type === 'password'
      ? `<div class="pw-wrap"><input class="input" id="${id}" name="${id}" type="password" ${attrs} aria-describedby="${id}-err">
         <button type="button" class="icon-btn" data-pw="${id}" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div>`
      : `<input class="input" id="${id}" name="${id}" type="${type}" ${attrs} aria-describedby="${id}-err">`;
    return `<div class="field" data-field="${id}"><label for="${id}">${label}</label>${input}<span class="err" id="${id}-err" role="alert">${icon('alert')}<span></span></span></div>`;
  };

  const setErr = (form, id, msg) => {
    const f = $(`[data-field="${id}"]`, form);
    if (!f) return;
    f.classList.toggle('invalid', !!msg);
    const label = $('.err span', f); // some fields (like the outlet type dropdown) have no error label
    if (label) label.textContent = msg || '';
    $('input,select', f)?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  const bindPwToggles = (root) => $$('[data-pw]', root).forEach((b) => b.addEventListener('click', () => {
    const inp = $('#' + b.dataset.pw);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.innerHTML = icon(show ? 'eyeOff' : 'eye');
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    b.setAttribute('aria-pressed', String(show));
  }));

  function authLayout(role, mode, formHtml) {
    const r = ROLES[role];
    return `<div class="auth ${r.shell}">
      <aside class="auth-art">
        ${SP.ui.brand()}
        ${ART[role]}
        <blockquote>${r.quote}<small>— ${r.who}</small></blockquote>
      </aside>
      <section class="auth-form">
        <div class="top"><a href="#/" class="btn ghost sm">${icon('arrowL')} All roles</a>${SP.Theme.button()}</div>
        <div class="auth-box">
          <span class="role-tag">${icon(r.ic)} ${r.label} ${mode === 'login' ? 'sign in' : 'sign up'}</span>
          ${formHtml}
        </div>
      </section>
    </div>`;
  }

  /* Log in a user and route them to their own dashboard */
  function finishLogin(user, remember, msg) {
    SP.Session.login(user, remember);
    SP.toast(msg || `Welcome back, ${user.name.split(' ')[0]}!`, 'safe');
    SP.go(SP.homeFor(user.role));
  }

  SP.demoLogin = function (role) {
    const u = SP.Store.state.users.find((x) => x.role === role && x.demo);
    finishLogin(u, true, `Demo ${ROLES[role].label.toLowerCase()} account loaded.`);
  };

  /* ===================== LOGIN ===================== */
  SP.route('/login/:role', (app, { role }) => {
    if (!ROLES[role]) return SP.go('/');
    const d = SP.DEMO[role];
    app.innerHTML = authLayout(role, 'login', `
      <div><h1>Welcome back</h1><p class="muted">Sign in to your ${ROLES[role].label.toLowerCase()} dashboard.</p></div>
      <button class="btn block demo-btn" id="demo">${icon('zap')} Try demo account</button>
      <div class="divider">or sign in with email</div>
      <form id="login" novalidate class="stack">
        <div class="form-error" id="form-err" role="alert">${icon('alert')}<span></span></div>
        ${field('email', 'Email', 'email', 'autocomplete="email" inputmode="email" placeholder="you@example.com"')}
        ${field('password', 'Password', 'password', 'autocomplete="current-password" placeholder="Your password"')}
        <div class="row spread">
          <label class="check"><input type="checkbox" id="remember" checked> Remember me</label>
          <a href="#" id="forgot" style="font-size:14px">Forgot password?</a>
        </div>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
      <p class="demo-hint">Demo: <span class="mono">${esc(d.email)}</span> / <span class="mono">${esc(d.pass)}</span></p>
      <p class="switch-line">New here? <a href="#/signup/${role}">Create a ${ROLES[role].label.toLowerCase()} account</a></p>
    `);

    const form = $('#login');
    bindPwToggles(app);
    $('#demo').onclick = () => SP.demoLogin(role);
    $('#forgot').onclick = (e) => { e.preventDefault(); SP.toast('Password reset needs a backend. For the demo, use the demo account.', 'info'); };
    ['email', 'password'].forEach((id) => $('#' + id).addEventListener('input', () => { setErr(form, id, ''); $('#form-err').classList.remove('show'); }));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#email').value.trim().toLowerCase();
      const pass = $('#password').value;
      let ok = true;
      if (!email) { setErr(form, 'email', 'Enter your email address.'); ok = false; }
      else if (!EMAIL_RE.test(email)) { setErr(form, 'email', 'That email address does not look right.'); ok = false; }
      if (!pass) { setErr(form, 'password', 'Enter your password.'); ok = false; }
      if (!ok) return $('.invalid input', form)?.focus();

      const user = SP.Store.state.users.find((u) => u.email === email);
      const err = $('#form-err');
      if (!user || user.pass !== SP.hash(pass)) {
        $('span', err).textContent = 'Email or password is incorrect.';
        return err.classList.add('show');
      }
      if (user.role !== role) {
        $('span', err).innerHTML = `This is a ${ROLES[user.role].label.toLowerCase()} account. <a href="#/login/${user.role}">Sign in there</a>.`;
        return err.classList.add('show');
      }
      finishLogin(user, $('#remember').checked);
    });
  });

  /* ===================== SIGNUP ===================== */
  SP.route('/signup/:role', (app, { role }) => {
    if (!ROLES[role]) return SP.go('/');
    const extra = {
      kitchen: field('outlet', 'Kitchen / outlet name', 'text', 'placeholder="e.g. Green Bowl Kitchen" autocomplete="organization"') +
        `<div class="grid g2">${field('area', 'Area', 'text', 'placeholder="e.g. Koramangala"')}
         <div class="field" data-field="otype"><label for="otype">Type</label><select class="input" id="otype"><option>Restaurant</option><option>Canteen</option><option>Cloud kitchen</option><option>Street food</option></select></div></div>`,
      consumer: `<fieldset class="field" style="border:0;padding:0;margin:0"><legend style="font-weight:600;font-size:14px;margin-bottom:8px">Allergies (optional) — we'll guard your menu</legend>
        <div class="allergy-grid">${ALLERGENS.map((a) => `<button type="button" class="chip" aria-pressed="false" data-allergen="${a}">${a}</button>`).join('')}</div></fieldset>`,
      regulator: `<div class="grid g2">${field('officer', 'Officer ID', 'text', 'placeholder="FSO-1234"')}${field('zone', 'Jurisdiction', 'text', 'placeholder="e.g. Bengaluru East"')}</div>`,
    }[role];

    app.innerHTML = authLayout(role, 'signup', `
      <div><h1>Create your account</h1><p class="muted">${ROLES[role].blurb}</p></div>
      <button class="btn block demo-btn" id="demo">${icon('zap')} Skip — try demo account</button>
      <div class="divider">or sign up</div>
      <form id="signup" novalidate class="stack">
        ${field('name', 'Full name', 'text', 'autocomplete="name" placeholder="Your name"')}
        ${field('email', 'Email', 'email', 'autocomplete="email" inputmode="email" placeholder="you@example.com"')}
        ${extra}
        ${field('password', 'Password', 'password', 'autocomplete="new-password" placeholder="At least 8 characters"')}
        ${field('confirm', 'Confirm password', 'password', 'autocomplete="new-password" placeholder="Repeat password"')}
        <label class="check"><input type="checkbox" id="remember" checked> Remember me on this device</label>
        <button class="btn primary block" type="submit">Create account</button>
      </form>
      <p class="switch-line">Already have an account? <a href="#/login/${role}">Sign in</a></p>
    `);

    const form = $('#signup');
    bindPwToggles(app);
    $('#demo').onclick = () => SP.demoLogin(role);
    $$('[data-allergen]', app).forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
    $$('input', form).forEach((i) => i.addEventListener('input', () => setErr(form, i.id, '')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (id) => ($('#' + id)?.value || '').trim();
      const errs = {};
      if (v('name').length < 2) errs.name = 'Enter your full name.';
      const email = v('email').toLowerCase();
      if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address.';
      else if (SP.Store.state.users.some((u) => u.email === email)) errs.email = 'An account with this email already exists.';
      const pw = $('#password').value;
      if (pw.length < 8) errs.password = 'Use at least 8 characters.';
      else if (!/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) errs.password = 'Include at least one letter and one number.';
      if ($('#confirm').value !== pw) errs.confirm = 'Passwords do not match.';
      if (role === 'kitchen') {
        if (v('outlet').length < 2) errs.outlet = 'Enter your outlet name.';
        if (v('area').length < 2) errs.area = 'Enter your area.';
      }
      if (role === 'regulator') {
        if (!/^FSO-\d{4}$/i.test(v('officer'))) errs.officer = 'Format: FSO-1234';
        if (v('zone').length < 2) errs.zone = 'Enter your jurisdiction.';
      }
      $$('[data-field]', form).forEach((f) => setErr(form, f.dataset.field, errs[f.dataset.field]));
      if (Object.keys(errs).length) return $('.invalid input', form)?.focus();

      const st = SP.Store.state;
      const user = { id: SP.uid('u'), role, name: v('name'), email, pass: SP.hash(pw), outletId: null, allergies: [], demo: false };
      if (role === 'kitchen') {
        // A new kitchen starts with a fresh, honest state (empty checklist, no badges)
        const id = SP.uid('o');
        st.outlets.push({ id, name: v('outlet'), area: v('area'), type: $('#otype').value, veg: false, distance: +(Math.random() * 5 + 0.5).toFixed(1), cuisine: $('#otype').value, lat: 1, lng: 2 });
        const k = SP.seedKitchen(id, 'good');
        k.checklist = SP.makeChecklist();
        k.staff = [{ id: SP.uid('st'), name: v('name'), role: 'Owner', badges: [] }];
        k.aiChecks = []; k.surplus = []; k.tempLog = [];
        st.kitchens[id] = k;
        user.outletId = id;
      }
      if (role === 'consumer') user.allergies = $$('[data-allergen][aria-pressed="true"]', form).map((b) => b.dataset.allergen);
      if (role === 'regulator') { user.officerId = v('officer').toUpperCase(); user.zone = v('zone'); }
      st.users.push(user);
      SP.Store.save();
      finishLogin(user, $('#remember').checked, `Account created. Welcome to ${SP.APP_NAME}, ${user.name.split(' ')[0]}!`);
    });
  });

  SP.ROLES = ROLES;
  SP.ALLERGENS = ALLERGENS;
})();
