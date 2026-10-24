/* =========================================================
   voice.js — speech in and speech out
   English, Hindi and Marathi, using the browser's built-in
   Web Speech API (no AI key needed):
   - voice search and voice delivery logging (speech-to-text)
   - read-aloud summaries and spoken temperature alerts (text-to-speech)
   ========================================================= */
SP.Voice = (function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const CODE = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
  const NAMES = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };
  const canSpeak = 'speechSynthesis' in window;
  let lang = SP.Store.raw.get('hygiq:lang') || 'en';
  if (!CODE[lang]) lang = 'en';
  let auto = SP.Store.raw.get('hygiq:speak') === '1';
  let rec = null;

  /* Spoken phrases. {name} placeholders are filled by t(). */
  const T = {
    en: {
      label_safe: 'safe', label_warn: 'needs attention', label_danger: 'violation risk',
      kitchenSummary: 'Hygiene score {score}, {label}. {tasks} HACCP tasks are open. {temps}. {exp} batches expire within two days.',
      tempsOk: 'All temperatures are in the safe range',
      tempsBad: '{n} units are out of the safe range',
      outletSummary: '{name}. Hygiene score {score}, {label}. Last cleaned {h} hours ago. {ok} of {total} cold and hot units are in the safe range.',
      outletAllergy: '{safe} of {dishes} dishes are safe for your allergies.',
      tempAlert: 'Alert. {sensor} is at {value} degrees, outside the safe range.',
      autoOn: 'Read-aloud is on.',
      delivered: 'Added {item} to stock, expiry {date}.',
    },
    hi: {
      label_safe: 'सुरक्षित', label_warn: 'ध्यान देने की ज़रूरत', label_danger: 'उल्लंघन का खतरा',
      kitchenSummary: 'हाइजीन स्कोर {score}, {label}। {tasks} HACCP काम बाकी हैं। {temps}। {exp} बैच दो दिन में एक्सपायर होंगे।',
      tempsOk: 'सभी तापमान सुरक्षित सीमा में हैं',
      tempsBad: '{n} यूनिट सुरक्षित सीमा से बाहर हैं',
      outletSummary: '{name}। हाइजीन स्कोर {score}, {label}। आखिरी सफाई {h} घंटे पहले हुई। {total} में से {ok} यूनिट सुरक्षित तापमान पर हैं।',
      outletAllergy: 'आपकी एलर्जी के हिसाब से {dishes} में से {safe} डिश सुरक्षित हैं।',
      tempAlert: 'चेतावनी। {sensor} का तापमान {value} डिग्री है, जो सुरक्षित सीमा से बाहर है।',
      autoOn: 'आवाज़ में सूचना चालू है।',
      delivered: '{item} स्टॉक में जोड़ दिया गया, एक्सपायरी {date}।',
    },
    mr: {
      label_safe: 'सुरक्षित', label_warn: 'लक्ष देण्याची गरज', label_danger: 'उल्लंघनाचा धोका',
      kitchenSummary: 'स्वच्छता स्कोर {score}, {label}. {tasks} HACCP कामे बाकी आहेत. {temps}. {exp} बॅच दोन दिवसांत एक्सपायर होतील.',
      tempsOk: 'सर्व तापमान सुरक्षित मर्यादेत आहेत',
      tempsBad: '{n} युनिट सुरक्षित मर्यादेबाहेर आहेत',
      outletSummary: '{name}. स्वच्छता स्कोर {score}, {label}. शेवटची स्वच्छता {h} तासांपूर्वी झाली. {total} पैकी {ok} युनिट सुरक्षित तापमानावर आहेत.',
      outletAllergy: 'तुमच्या ॲलर्जीनुसार {dishes} पैकी {safe} पदार्थ सुरक्षित आहेत.',
      tempAlert: 'सावधान. {sensor} चे तापमान {value} अंश आहे, सुरक्षित मर्यादेबाहेर.',
      autoOn: 'आवाजात सूचना सुरू आहेत.',
      delivered: '{item} स्टॉकमध्ये जोडले, एक्सपायरी {date}.',
    },
  };
  const t = (key, vars = {}) => (T[lang][key] || T.en[key] || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  const scoreLabel = (score) => t('label_' + SP.scoreTone(score));
  const dateWords = (isoDate) => new Date(isoDate + 'T00:00').toLocaleDateString(CODE[lang], { day: 'numeric', month: 'long' });

  /* ---------- speech out ---------- */
  function speak(text) {
    if (!canSpeak) { SP.toast('Read-aloud is not supported in this browser.', 'warn'); return false; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 900));
      u.lang = CODE[lang];
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
      if (v) u.voice = v;
      u.rate = 1;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function stop() { try { if (canSpeak) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  /* Spoken only when the read-aloud toggle is on */
  function alert(text) { if (auto) speak(text); }
  if (canSpeak) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch (e) { /* ignore */ } }

  /* ---------- speech in ---------- */
  function listen({ onPartial, onFinal, btn }) {
    if (!SR) { SP.toast('Voice input works in Chrome or Edge. You can type instead.', 'warn'); return; }
    if (rec) { rec.stop(); return; }
    stop();
    const r = new SR();
    rec = r;
    r.lang = CODE[lang];
    r.interimResults = true;
    r.maxAlternatives = 1;
    let final = '';
    if (btn) { btn.classList.add('rec'); btn.setAttribute('aria-pressed', 'true'); }
    r.onresult = (e) => { let s = ''; for (const res of e.results) s += res[0].transcript; final = s; if (onPartial) onPartial(s); };
    r.onerror = (e) => {
      const m = {
        'not-allowed': 'Microphone access is blocked. Allow it from the browser’s address bar.',
        'service-not-allowed': 'Microphone access is blocked in this browser.',
        'no-speech': 'Didn’t hear anything. Tap the mic and speak.',
        network: 'Voice recognition needs an internet connection.',
        'audio-capture': 'No microphone found.',
      }[e.error];
      if (m) SP.toast(m, 'warn');
    };
    r.onend = () => {
      rec = null;
      if (btn) { btn.classList.remove('rec'); btn.setAttribute('aria-pressed', 'false'); }
      if (final.trim() && onFinal) onFinal(final.trim());
    };
    try { r.start(); } catch (e) { rec = null; if (btn) btn.classList.remove('rec'); SP.toast('Could not start the microphone.', 'warn'); }
  }

  /* ---------- delivery parser: English, Hinglish, Hindi and Marathi ----------
     "Paneer 5 kilo aaya, expiry 28 tareekh" → { item: "Paneer (5 kg)", expiry: <28th>, supplier }
     "टमाटर 10 किलो आया, 4 दिन"              → { item: "टमाटर (10 kg)", expiry: <today + 4> } */
  const UNIT = {
    kilogram: 'kg', kilo: 'kg', kgs: 'kg', kg: 'kg', 'किलोग्राम': 'kg', 'किलो': 'kg',
    grams: 'g', gram: 'g', g: 'g', 'ग्राम': 'g',
    litre: 'L', liter: 'L', ltr: 'L', l: 'L', 'लीटर': 'L', 'लिटर': 'L',
    pieces: 'pcs', piece: 'pcs', pcs: 'pcs', 'नग': 'pcs',
    packets: 'packets', packet: 'packets', 'पैकेट': 'packets', 'पाकीट': 'packets',
    dozen: 'dozen', 'दर्जन': 'dozen', 'डझन': 'dozen',
  };
  const UNIT_RE = Object.keys(UNIT).sort((a, b) => b.length - a.length).join('|');
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function parseDelivery(raw, suppliers = []) {
    const digits = '०१२३४५६७८९';
    const s = String(raw).replace(/[०-९]/g, (d) => digits.indexOf(d)).toLowerCase();

    const qm = s.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})(?![a-z])`));
    const qty = qm ? `${qm[1]} ${UNIT[qm[2]]}` : '';

    const today = new Date();
    let expiry = ymd(new Date(today.getTime() + 3 * 86400000));
    const dm = s.match(/(\d{1,2})\s*(?:tareekh|tarikh|tarik|tarakh|tarkh|th|st|nd|rd|date|तारीख|तारखेला|तारीखला|तारखे)/) || s.match(/(?:expiry|expire|expires|एक्सपायरी)\s*(?:on\s*)?(\d{1,2})(?!\s*(?:din|days?|divas|दिन|दिवस))/);
    if (dm && +dm[1] >= 1 && +dm[1] <= 31) {
      const x = new Date(today);
      if (+dm[1] < x.getDate()) x.setMonth(x.getMonth() + 1);
      x.setDate(+dm[1]);
      expiry = ymd(x);
    } else {
      const nm = s.match(/(\d+)\s*(?:din|days?|divas|दिन|दिवस)/);
      if (nm) expiry = ymd(new Date(today.getTime() + +nm[1] * 86400000));
    }

    const supplier = suppliers.find((x) => s.includes(String(x).toLowerCase().split(' ')[0])) || 'Logged by voice';

    let name = String(raw).split(/[,.।]/)[0]
      .replace(/[०-९\d]+(?:\.\d+)?/g, ' ')
      .replace(new RegExp(`(^|\\s)(${UNIT_RE})(?=\\s|$)`, 'gi'), ' ')
      .replace(/(^|\s)(aaya|aaye|aya|aayi|aali|aala|aale|arrived|came|received|delivered|aa gaya|आया|आए|आई|आ गया|आले|आला|आली|from|se|से|कडून)(?=\s|$)/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    if (supplier !== 'Logged by voice') {
      const word = String(supplier).split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      name = name.replace(new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'i'), ' ').replace(/\s+/g, ' ').trim();
    }
    if (!name) name = 'New item';
    name = name.charAt(0).toUpperCase() + name.slice(1);

    return { item: qty ? `${name} (${qty})` : name, supplier, expiry, heard: String(raw) };
  }

  /* Modal: speak (or type) a delivery, then hand the parsed result to onDone */
  function captureDelivery(onDone, suppliers = []) {
    const m = SP.modal({
      title: 'Log a delivery by voice',
      body: `<p class="muted">Tap the mic and say what arrived, for example <b>“Paneer 5 kilo aaya, expiry 28 tareekh”</b> or <b>“Tomatoes 10 kg from FreshTo, 4 days”</b>. Hindi and Marathi work too.</p>
        <div class="voice-stage">
          <button type="button" class="mic-big" id="vd-mic" aria-label="Start speaking" aria-pressed="false">${SP.icon('mic')}</button>
          <p id="vd-heard" class="voice-heard" aria-live="polite">Tap the mic to start · language: ${NAMES[lang]}</p>
        </div>
        <div class="field"><label for="vd-text">Or type what arrived</label><input class="input" id="vd-text" placeholder="Paneer 5 kilo aaya, expiry 28 tareekh"></div>`,
      actions: [{ label: 'Cancel' }, { label: 'Use this', kind: 'primary', onClick: (el) => {
        const txt = el.querySelector('#vd-text').value.trim();
        if (!txt) { SP.toast('Say or type what arrived first.', 'warn'); return false; }
        stop();
        onDone(parseDelivery(txt, suppliers));
      } }],
    });
    const mic = m.el.querySelector('#vd-mic');
    mic.onclick = () => listen({
      btn: mic,
      onPartial: (s) => { m.el.querySelector('#vd-heard').textContent = `“${s}”`; m.el.querySelector('#vd-text').value = s; },
      onFinal: (s) => { m.el.querySelector('#vd-text').value = s; m.close(); onDone(parseDelivery(s, suppliers)); },
    });
  }

  /* ---------- top-bar controls: language + read-aloud toggle ---------- */
  function controls() {
    return `<select class="voice-lang" data-voice-lang aria-label="Voice language">${Object.entries(NAMES).map(([k, v]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button class="icon-btn" data-voice-auto aria-pressed="${auto}" aria-label="Read alerts aloud" title="Read alerts aloud">${SP.icon(auto ? 'speaker' : 'mute')}</button>`;
  }
  const micButton = (id, label) => `<button type="button" class="icon-btn mic-btn" id="${id}" aria-label="${label}" aria-pressed="false">${SP.icon('mic')}</button>`;

  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-voice-lang]')) return;
    lang = e.target.value;
    SP.Store.raw.set('hygiq:lang', lang);
    document.querySelectorAll('[data-voice-lang]').forEach((x) => { x.value = lang; });
    SP.toast(`Voice language: ${NAMES[lang]}`, 'info');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-voice-auto]')) return;
    auto = !auto;
    SP.Store.raw.set('hygiq:speak', auto ? '1' : '0');
    document.querySelectorAll('[data-voice-auto]').forEach((x) => { x.setAttribute('aria-pressed', String(auto)); x.innerHTML = SP.icon(auto ? 'speaker' : 'mute'); });
    if (auto) speak(t('autoOn')); else stop();
    SP.toast(auto ? 'Alerts will be read aloud.' : 'Read-aloud alerts are off.', 'info');
  });
  window.addEventListener('hashchange', () => { if (rec) rec.stop(); });

  return {
    t, scoreLabel, dateWords, speak, stop, alert, listen, parseDelivery, captureDelivery, controls, micButton,
    canListen: !!SR, canSpeak,
    get lang() { return lang; },
  };
})();
