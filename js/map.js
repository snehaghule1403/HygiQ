/* =========================================================
   map.js — live maps (Leaflet + CARTO / OpenStreetMap tiles)
   Used by the customer Explore page, the outlet page and the
   regulator's risk map. Everything degrades to the list views
   if the map library or the street tiles can't load.
   ========================================================= */
SP.Map = (function () {
  /* Bengaluru neighbourhood centres used to place outlets */
  const AREA_LL = {
    Koramangala: [12.9352, 77.6245],
    Malleshwaram: [13.0035, 77.5700],
    Indiranagar: [12.9719, 77.6412],
    Jayanagar: [12.9250, 77.5938],
    Whitefield: [12.9698, 77.7500],
    'HSR Layout': [12.9116, 77.6474],
    'MG Road': [12.9756, 77.6050],
    'BTM Layout': [12.9166, 77.6101],
    'Electronic City': [12.8452, 77.6602],
    Hebbal: [13.0358, 77.5970],
    Marathahalli: [12.9591, 77.6974],
  };
  const CITY = [12.9716, 77.6200];
  const FROM = AREA_LL['MG Road']; // distances are measured from here until "Near me" is used
  const maps = {};
  let me = null;

  /* Small, stable offset per outlet so outlets in one area don't sit on top of each other */
  const jitter = (id) => {
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
    return [((h % 100) / 100 - 0.5) * 0.012, ((((h / 100) | 0) % 100) / 100 - 0.5) * 0.012];
  };

  function coords(o) {
    if (Array.isArray(o.ll)) return o.ll;
    const base = AREA_LL[o.area] || CITY;
    const [a, b] = jitter(o.id);
    return [base[0] + a, base[1] + b];
  }

  function distKm([a1, b1], [a2, b2]) {
    const r = (x) => (x * Math.PI) / 180;
    const d = Math.sin(r(a2 - a1) / 2) ** 2 + Math.cos(r(a1)) * Math.cos(r(a2)) * Math.sin(r(b2 - b1) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(d));
  }
  const distanceOf = (o) => +distKm(me || FROM, coords(o)).toFixed(1);

  const available = () => typeof window.L === 'object' && !!window.L.map;

  function destroy(id) {
    if (maps[id]) { try { maps[id].remove(); } catch (e) { /* already gone */ } delete maps[id]; }
  }

  /* Create a map in element #id. Returns the Leaflet map, or null when the library is unavailable. */
  function make(id, center = CITY, zoom = 12) {
    destroy(id);
    const el = document.getElementById(id);
    if (!available() || !el) return null;
    const m = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(center, zoom);
    // Standard OpenStreetMap tiles (no API key). In dark mode the tiles are darkened with a CSS filter.
    el.classList.toggle('map-dark', SP.Theme.isDark());
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(m);
    let ok = 0, bad = 0;
    tiles.on('tileload', () => { ok++; });
    tiles.on('tileerror', () => {
      bad++;
      if (bad === 4 && !ok && !el.parentNode.querySelector('.map-note')) {
        const n = document.createElement('p');
        n.className = 'map-note';
        n.textContent = 'Street tiles could not load, so the map shows markers only. Check your internet connection.';
        el.after(n);
      }
    });
    m._hq = L.layerGroup().addTo(m);
    maps[id] = m;
    setTimeout(() => { if (maps[id] === m) m.invalidateSize({ animate: false }); }, 80);
    return m;
  }

  /* Round score/risk marker */
  const marker = (ll, label, tone, title) =>
    L.marker(ll, { icon: L.divIcon({ className: 'mk ' + tone, html: String(label), iconSize: [34, 34] }), title, keyboard: true, alt: title });

  function addMe(m) {
    if (!me) return;
    L.marker(me, { icon: L.divIcon({ className: 'mk me', html: 'You', iconSize: [36, 36] }), title: 'Your location' }).addTo(m._hq);
  }

  function fit(m, points, maxZoom = 14) {
    if (points.length > 1) m.fitBounds(points, { padding: [36, 36], maxZoom, animate: false });
    else if (points.length) m.setView(points[0], maxZoom, { animate: false });
  }

  /* Ask the browser for the visitor's location ("Near me") */
  function locate(onDone) {
    if (!navigator.geolocation) return SP.toast('Location is not available in this browser. Distances are from MG Road.', 'warn');
    navigator.geolocation.getCurrentPosition(
      (p) => { me = [p.coords.latitude, p.coords.longitude]; SP.toast('Showing distances from your location.', 'safe'); onDone && onDone(); },
      () => SP.toast('Location is blocked. Allow it in the browser’s address bar, or distances stay measured from MG Road.', 'warn'),
      { timeout: 8000, maximumAge: 600000 },
    );
  }

  return {
    AREA_LL, CITY, coords, distKm, distanceOf, available, make, destroy, marker, addMe, fit, locate,
    get me() { return me; },
    clearMe() { me = null; },
  };
})();
