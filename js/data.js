/* =========================================================
   data.js — seeded demo data + shared domain logic
   Everything here is plain data / pure functions so the other
   modules (kitchen, consumer, regulator) read from one source.
   ========================================================= */
window.SP = window.SP || {};

/** Change the product name in one place. */
SP.APP_NAME = 'HygiQ';
SP.TAGLINE = 'Trust on every plate.';

/* ---------- time helpers (seed data is relative to "now") ---------- */
const DAY = 86400000, HOUR = 3600000, MIN = 60000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
// local calendar date, d days from today (YYYY-MM-DD)
const inDays = (d) => { const t = new Date(Date.now() + d * DAY); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

/* ---------- safe operating ranges per sensor type (°C) ---------- */
SP.RANGES = {
  fridge:  { min: 0,   max: 5,   label: 'Fridge',      target: 3 },
  freezer: { min: -25, max: -15, label: 'Freezer',     target: -19 },
  hot:     { min: 63,  max: 85,  label: 'Hot-holding', target: 70 },
};

/* ---------- HACCP checklist template ---------- */
SP.CHECKLIST_TEMPLATE = {
  opening: [
    'Staff health declarations signed',
    'Hand-wash stations stocked (soap, towels)',
    'Fridge & freezer temperatures recorded',
    'Pest check — no droppings or damage',
    'Prep surfaces sanitised',
  ],
  cooking: [
    'Core temperature ≥ 75°C probed for meats',
    'Raw and cooked foods stored separately',
    'Colour-coded boards used correctly',
    'Allergen ingredients labelled at station',
  ],
  cleaning: [
    'Floors swept and mopped',
    'Dishwasher rinse ≥ 82°C verified',
    'Bins emptied and lids closed',
    'Chopping boards sanitised',
  ],
  closing: [
    'Leftovers labelled with date & time',
    'Hot-holding units switched off & cleaned',
    'Cold room door sealed',
    'Gas & electrical points checked',
  ],
};

/* Build a fresh checklist; `doneUpTo` pre-ticks the first N sections for demo realism. */
SP.makeChecklist = function (preDone = {}, by = 'Ravi K.') {
  const out = {};
  for (const [section, items] of Object.entries(SP.CHECKLIST_TEMPLATE)) {
    out[section] = items.map((label, i) => ({
      id: section + '-' + i,
      label,
      done: i < (preDone[section] || 0),
      at: i < (preDone[section] || 0) ? ago((5 - i) * HOUR) : null,
      by: i < (preDone[section] || 0) ? by : null,
    }));
  }
  return out;
};

/* ---------- training quizzes ---------- */
SP.QUIZZES = [
  {
    id: 'q-temp', title: 'Temperature Control', badge: 'Cold Chain Pro', icon: 'thermo',
    questions: [
      { q: 'What is the safe maximum temperature for a fridge?', a: ['8°C', '5°C', '10°C'], c: 1 },
      { q: 'Hot food must be held at or above…', a: ['63°C', '50°C', '40°C'], c: 0 },
      { q: 'The "danger zone" for bacterial growth is…', a: ['-18°C to 0°C', '5°C to 63°C', '70°C to 90°C'], c: 1 },
    ],
  },
  {
    id: 'q-allergen', title: 'Allergen Awareness', badge: 'Allergen Guardian', icon: 'shield',
    questions: [
      { q: 'How many major allergens must be declared (FSSAI/EU)?', a: ['8', '14', '5'], c: 1 },
      { q: 'Best way to avoid cross-contact?', a: ['Wipe the knife', 'Separate tools & surfaces', 'Cook longer'], c: 1 },
      { q: 'A customer says they are allergic. You should…', a: ['Guess', 'Check the allergen matrix & tell the chef', 'Remove garnish'], c: 1 },
    ],
  },
  {
    id: 'q-hygiene', title: 'Personal Hygiene', badge: 'Clean Hands Hero', icon: 'hand',
    questions: [
      { q: 'Minimum hand-wash time?', a: ['5 seconds', '20 seconds', '2 minutes'], c: 1 },
      { q: 'Gloves should be changed…', a: ['Once per shift', 'Between raw and ready-to-eat tasks', 'Never'], c: 1 },
      { q: 'With vomiting/diarrhoea, staff must stay away for…', a: ['48 hours after symptoms stop', '2 hours', 'No need'], c: 0 },
    ],
  },
];

/* ---------- outlets (shared by consumer + regulator in later phases) ---------- */
SP.seedOutlets = () => [
  // ll = [latitude, longitude] in Bengaluru, used by the live maps
  { id: 'o1', name: 'Green Bowl Kitchen', area: 'Koramangala', type: 'Restaurant', veg: false, distance: 0.8, cuisine: 'Healthy · Bowls', lat: 2, lng: 3, ll: [12.9352, 77.6245] },
  { id: 'o2', name: 'Campus Central Canteen', area: 'Malleshwaram', type: 'Canteen', veg: true, distance: 1.4, cuisine: 'South Indian · Thali', lat: 1, lng: 1, ll: [13.0068, 77.5713] },
  { id: 'o3', name: 'Spice Route Biryani', area: 'Indiranagar', type: 'Restaurant', veg: false, distance: 2.1, cuisine: 'Biryani · Mughlai', lat: 3, lng: 4, ll: [12.9784, 77.6408] },
  { id: 'o4', name: 'Annapurna Bhojanalaya', area: 'Jayanagar', type: 'Restaurant', veg: true, distance: 3.0, cuisine: 'Gujarati · Thali', lat: 4, lng: 1, ll: [12.9250, 77.5938] },
  { id: 'o5', name: 'Tech Park Food Court', area: 'Whitefield', type: 'Canteen', veg: false, distance: 5.6, cuisine: 'Multi-cuisine', lat: 0, lng: 4, ll: [12.9698, 77.7500] },
  { id: 'o6', name: 'Mama Mia Pizzeria', area: 'Indiranagar', type: 'Restaurant', veg: true, distance: 2.4, cuisine: 'Italian · Pizza', lat: 3, lng: 3, ll: [12.9719, 77.6412] },
  { id: 'o7', name: 'Chai & Chaat Corner', area: 'Koramangala', type: 'Street food', veg: true, distance: 1.1, cuisine: 'Street food · Snacks', lat: 2, lng: 2, ll: [12.9279, 77.6271] },
  { id: 'o8', name: 'Ocean Catch Seafood', area: 'Indiranagar', type: 'Restaurant', veg: false, distance: 2.7, cuisine: 'Seafood · Coastal', lat: 3, lng: 2, ll: [12.9660, 77.6380] },
];

/* Full kitchen operational state for one outlet. `quality` tunes how good the seed looks. */
/* Distinct teams per outlet so every kitchen's records look like its own */
const TEAMS = [
  [['Ravi Kumar', 'Head Chef'], ['Priya Nair', 'Sous Chef'], ['Arjun Mehta', 'Line Cook'], ['Fatima Shaikh', 'Kitchen Porter']],
  [['Lakshmi Iyer', 'Canteen Manager'], ['Murugan S.', 'Cook'], ['Deepa R.', 'Cook'], ['Basavaraj H.', 'Helper']],
  [['Salim Qureshi', 'Head Chef'], ['Anil Yadav', 'Tandoor Cook'], ['Rohit Das', 'Line Cook'], ['Manoj P.', 'Kitchen Porter']],
  [['Hetal Shah', 'Owner-Chef'], ['Kiran Patel', 'Cook'], ['Bhavna Joshi', 'Cook'], ['Suresh M.', 'Helper']],
  [['Vikas Sharma', 'Food Court Manager'], ['Tenzin L.', 'Wok Cook'], ['Nisha George', 'Line Cook'], ['Ajay Kumar', 'Server']],
  [['Marco Fernandes', 'Head Chef'], ['Elena Pinto', 'Pizzaiolo'], ['Rahul Menon', 'Line Cook'], ['Sunita B.', 'Kitchen Porter']],
  [['Pappu Singh', 'Owner'], ['Gopal K.', 'Chaat Maker'], ['Meena D.', 'Helper'], ['Raju T.', 'Helper']],
  [['Prakash Shetty', 'Head Chef'], ['Sandeep Kotian', 'Fish Cook'], ['Reshma P.', 'Line Cook'], ['Ganesh A.', 'Kitchen Porter']],
];
SP.seedKitchen = function (outletId, quality = 'good') {
  const good = quality === 'good';
  const n = (parseInt(String(outletId).replace(/\D/g, ''), 10) || 1) - 1;
  const team = TEAMS[n % TEAMS.length];
  const short = team[0][0].split(' ')[0] + ' ' + (team[0][0].split(' ')[1] || '')[0] + '.';
  const j = (v, amt) => +(v + (((n * 37) % 10) / 10 - 0.5) * amt).toFixed(1); // per-outlet jitter
  const sensors = [
    { id: 's1', name: 'Walk-in Fridge', type: 'fridge',  value: j(3.2, 1.2) },
    { id: 's2', name: 'Prep Fridge',    type: 'fridge',  value: good ? 4.1 : 6.8 },
    { id: 's3', name: 'Deep Freezer',   type: 'freezer', value: j(-19.4, 2) },
    { id: 's4', name: 'Bain-marie',     type: 'hot',     value: j(68.5, 4) },
  ].map((s) => ({ ...s, fault: false, history: Array.from({ length: 20 }, () => +(s.value + (Math.random() - 0.5) * 0.8).toFixed(1)) }));

  return {
    outletId,
    // the demo kitchen (o1) starts safely green so demo mode can show a live drop
    checklist: SP.makeChecklist(outletId === 'o1' ? { opening: 5, cooking: 4, cleaning: 3 } : good ? { opening: 5, cooking: 2 + (n % 3), cleaning: 1 + (n % 4), closing: n % 2 } : { opening: 2 + (n % 2), cooking: n % 2 }, short),
    sensors,
    tempLog: [
      { at: ago((25 + n * 7) * MIN), sensor: 'Walk-in Fridge', value: j(3.1, 1.4), ok: true, by: short },
      { at: ago((80 + n * 11) * MIN), sensor: 'Deep Freezer', value: j(-19.8, 2), ok: true, by: short },
      { at: ago((2 + n * 0.3) * HOUR), sensor: 'Bain-marie', value: j(69, 4), ok: true, by: short },
      ...(good ? [{ at: ago(4 * HOUR), sensor: 'Prep Fridge', value: j(4.0, 1), ok: true, by: short }] : [{ at: ago(3 * HOUR), sensor: 'Prep Fridge', value: 6.6, ok: false, by: short }]),
    ],
    batches: [
      { id: 'B-2410-01', item: 'Paneer (2 kg)',        supplier: 'Nandini Dairy',   qty: 4,  received: inDays(-3), expiry: inDays(1),  allergens: ['milk'] },
      { id: 'B-2410-02', item: 'Chicken breast',       supplier: 'FreshTo Farms',   qty: 12, received: inDays(-1), expiry: inDays(2),  allergens: [] },
      { id: 'B-2410-03', item: 'Basmati rice (25 kg)', supplier: 'India Gate',      qty: 3,  received: inDays(-20), expiry: inDays(140), allergens: [] },
      { id: 'B-2410-04', item: 'Fresh cream',          supplier: 'Amul',            qty: 6,  received: inDays(-4), expiry: good ? inDays(0) : inDays(-1), allergens: ['milk'] },
      { id: 'B-2410-05', item: 'Peanut chutney',       supplier: 'In-house',        qty: 2,  received: inDays(-1), expiry: inDays(3),  allergens: ['peanuts'] },
      { id: 'B-2410-06', item: 'Whole-wheat bread',    supplier: 'Modern Bakery',   qty: 20, received: inDays(-2), expiry: inDays(4),  allergens: ['gluten'] },
    ],
    staff: team.map(([name, role], i) => ({ id: 'st' + (i + 1), name, role,
      badges: good ? [['q-temp', 'q-hygiene'], ['q-allergen'], [], ['q-hygiene']][i] : [['q-temp'], [], [], []][i] })),
    aiChecks: [
      good ? { id: 'ai1', at: ago((20 + n * 3) * HOUR), result: 'pass', issues: [], note: 'Prep station — all clear' }
           : { id: 'ai1', at: ago((10 + n) * HOUR), result: 'fail', issues: [{ code: 'hair', title: 'Hair not covered', severity: 'medium', fix: 'Staff in the food zone must wear a hairnet or cap.', box: [18, 8, 18, 18], fixed: false }], note: '' },
    ],
    surplus: [
      { id: 'sp1', item: 'Veg biryani (8 portions)', mode: 'donate', ngo: 'Robin Hood Army', pickup: '21:30', at: ago(DAY) },
    ],
    recalls: [],
    alerts: [],
    lastCleaning: ago(good ? 95 * MIN : 9 * HOUR),
  };
};

/* ---------- demo users (password hashes computed at seed time) ---------- */
SP.DEMO = {
  kitchen:   { email: 'kitchen@hygiq.demo',   pass: 'Demo@123', name: 'Ravi Kumar',     outletId: 'o1' },
  consumer:  { email: 'customer@hygiq.demo',  pass: 'Demo@123', name: 'Ananya Rao' },
  regulator: { email: 'inspector@hygiq.demo', pass: 'Demo@123', name: 'Dr. S. Iyer, FSO' },
};

/* Tiny non-cryptographic hash — demo only, there is no backend. */
SP.hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
};

SP.seedState = function () {
  const outlets = SP.seedOutlets();
  const kitchens = {};
  const qualities = { o1: 'good', o2: 'good', o3: 'poor', o4: 'good', o5: 'poor', o6: 'good', o7: 'good', o8: 'poor' };
  outlets.forEach((o) => (kitchens[o.id] = SP.seedKitchen(o.id, qualities[o.id])));
  const users = Object.entries(SP.DEMO).map(([role, d]) => ({
    id: 'u-' + role, role, name: d.name, email: d.email, pass: SP.hash(d.pass), outletId: d.outletId || null,
    allergies: role === 'consumer' ? ['peanuts', 'milk'] : [], demo: true,
  }));
  return { version: 5, outlets, kitchens, users, complaints: SP.seedComplaints(), inspections: SP.seedInspections() };
};

/* ---------- menus (dish allergens + cross-contact risks) ---------- */
const DISHES = {
  o1: [['Quinoa Buddha Bowl', 1, 220, ['sesame'], ['peanuts']], ['Paneer Tikka Salad', 1, 260, ['milk'], []], ['Grilled Chicken Bowl', 0, 320, [], ['sesame']], ['Peanut Satay Noodles', 1, 280, ['peanuts', 'gluten', 'soy'], []], ['Greek Yogurt Parfait', 1, 180, ['milk', 'tree nuts'], []], ['Avocado Toast', 1, 240, ['gluten'], ['milk']]],
  o2: [['Masala Dosa', 1, 60, [], ['peanuts']], ['Idli Sambar', 1, 45, [], []], ['Curd Rice', 1, 50, ['milk'], []], ['South Indian Thali', 1, 110, ['milk'], ['peanuts', 'mustard']], ['Medu Vada', 1, 40, [], ['gluten']], ['Filter Coffee', 1, 25, ['milk'], []]],
  o3: [['Hyderabadi Chicken Biryani', 0, 340, ['milk'], ['tree nuts']], ['Mutton Dum Biryani', 0, 420, ['milk', 'tree nuts'], []], ['Veg Biryani', 1, 260, ['milk'], ['tree nuts']], ['Mirchi ka Salan', 1, 120, ['peanuts', 'sesame'], []], ['Double ka Meetha', 1, 140, ['milk', 'gluten', 'tree nuts'], []], ['Raita', 1, 60, ['milk'], []]],
  o4: [['Gujarati Thali', 1, 280, ['milk', 'gluten'], ['peanuts']], ['Dhokla', 1, 80, ['gluten'], ['mustard']], ['Khandvi', 1, 90, ['milk'], ['mustard', 'sesame']], ['Undhiyu', 1, 160, ['peanuts', 'sesame'], []], ['Shrikhand', 1, 90, ['milk', 'tree nuts'], []], ['Masala Chaas', 1, 40, ['milk'], []]],
  o5: [['Chicken Shawarma', 0, 160, ['gluten', 'sesame'], ['milk']], ['Veg Hakka Noodles', 1, 140, ['gluten', 'soy'], ['eggs']], ['Egg Fried Rice', 0, 150, ['eggs', 'soy'], ['gluten']], ['Paneer Butter Masala', 1, 210, ['milk', 'tree nuts'], []], ['Fish & Chips', 0, 260, ['fish', 'gluten'], ['shellfish']], ['Fresh Lime Soda', 1, 50, [], []]],
  o6: [['Margherita Pizza', 1, 320, ['gluten', 'milk'], []], ['Pesto Pasta', 1, 360, ['gluten', 'milk', 'tree nuts'], []], ['Garden Salad', 1, 220, [], ['tree nuts', 'mustard']], ['Garlic Bread', 1, 160, ['gluten', 'milk'], ['eggs']], ['Tiramisu', 1, 240, ['eggs', 'milk', 'gluten'], []], ['Arrabbiata Pasta (vegan)', 1, 300, ['gluten'], ['milk']]],
  o7: [['Pani Puri', 1, 50, ['gluten'], []], ['Bhel Puri', 1, 60, ['peanuts', 'gluten'], []], ['Samosa Chaat', 1, 70, ['gluten', 'milk'], ['peanuts']], ['Masala Chai', 1, 20, ['milk'], []], ['Vada Pav', 1, 30, ['gluten'], ['sesame']], ['Corn Chaat', 1, 50, [], ['peanuts']]],
  o8: [['Prawn Ghee Roast', 0, 420, ['shellfish', 'milk'], []], ['Fish Thali', 0, 320, ['fish', 'milk'], ['shellfish', 'mustard']], ['Crab Sukka', 0, 480, ['shellfish'], ['mustard']], ['Neer Dosa', 1, 60, [], ['fish']], ['Veg Kori Rotti', 1, 180, ['gluten'], ['fish', 'shellfish']], ['Sol Kadhi', 1, 60, [], []]],
};
SP.menuFor = (outletId) => (DISHES[outletId] || [
  ['Chef\'s Special Thali', 1, 180, ['milk', 'gluten'], ['peanuts']], ['Dal Tadka', 1, 120, ['milk'], ['mustard']], ['Jeera Rice', 1, 90, [], []], ['Chicken Curry', 0, 220, ['milk'], ['tree nuts']],
]).map(([name, veg, price, allergens, mayContain], i) => ({ id: outletId + '-d' + i, name, veg: !!veg, price, allergens, mayContain }));

/* ---------- packaged products for the label checker ---------- */
SP.PRODUCTS = {
  '8901058851298': { name: 'Choco Crunch Cookies', brand: 'Sunfeast', ingredients: ['wheat flour', 'sugar', 'cocoa', 'palm oil', 'milk solids', 'hazelnut paste', 'soy lecithin'], allergens: ['gluten', 'milk', 'tree nuts', 'soy'], expiry: inDays(48), batch: 'SF2409B' },
  '8906002580157': { name: 'Classic Salted Peanuts', brand: 'Haldiram\'s', ingredients: ['peanuts', 'edible vegetable oil', 'salt'], allergens: ['peanuts'], expiry: inDays(120), batch: 'HR0918' },
  '8901262150231': { name: 'Toned Milk 500 ml', brand: 'Amul', ingredients: ['toned milk'], allergens: ['milk'], expiry: inDays(-1), batch: 'AM2210' },
  '8904063210104': { name: 'Masala Oats', brand: 'Saffola', ingredients: ['rolled oats', 'spices', 'dehydrated vegetables', 'salt', 'mustard powder'], allergens: ['gluten', 'mustard'], expiry: inDays(2), batch: 'SO0611' },
  '8901725181222': { name: 'Plain Rice Cakes', brand: 'Kellogg\'s', ingredients: ['brown rice', 'salt'], allergens: [], expiry: inDays(210), batch: 'KR4401' },
};

/* ---------- seeded complaints: Spice Route + Indiranagar form a cluster ---------- */
SP.seedComplaints = () => [
  { id: 'c1', outletId: 'o3', category: 'Food poisoning', text: 'Stomach cramps and vomiting about 5 hours after the chicken biryani.', at: ago(5 * HOUR), user: 'Rahul M.', status: 'open' },
  { id: 'c2', outletId: 'o3', category: 'Food poisoning', text: 'Two of us got sick after lunch yesterday. Raita tasted sour.', at: ago(19 * HOUR), user: 'Sneha P.', status: 'open' },
  { id: 'c3', outletId: 'o8', category: 'Food poisoning', text: 'Nausea after the prawn dish. Smelled off.', at: ago(26 * HOUR), user: 'Imran A.', status: 'open' },
  { id: 'c4', outletId: 'o3', category: 'Hygiene', text: 'Staff handling money and then serving food without gloves.', at: ago(30 * HOUR), user: 'Divya K.', status: 'open' },
  { id: 'c5', outletId: 'o5', category: 'Foreign object', text: 'Found a hair in the noodles.', at: ago(3 * DAY), user: 'Karthik B.', status: 'reviewed' },
  { id: 'c6', outletId: 'o6', category: 'Allergen', text: 'Ordered vegan pasta but it seemed to have cheese on it.', at: ago(5 * DAY), user: 'Pooja D.', status: 'resolved' },
];

/* =========================================================
   Hygiene score — single source of truth (0–100)
   Weights: checklist 25 · temperatures 30 · stock 15 · training 15 · AI 15
   ========================================================= */
SP.inRange = (s) => s.value >= SP.RANGES[s.type].min && s.value <= SP.RANGES[s.type].max;

SP.daysLeft = (iso) => Math.floor((new Date(iso + 'T23:59:59') - Date.now()) / DAY);

SP.scoreBreakdown = function (k) {
  const items = Object.values(k.checklist).flat();
  const checklist = 25 * (items.filter((i) => i.done).length / items.length);
  const temps = 30 * (k.sensors.filter(SP.inRange).length / k.sensors.length);
  const expired = k.batches.filter((b) => SP.daysLeft(b.expiry) < 0).length;
  const stock = Math.max(0, 15 - expired * 6);
  const training = 15 * (k.staff.reduce((a, s) => a + s.badges.length, 0) / (k.staff.length * SP.QUIZZES.length || 1));
  const lastAI = k.aiChecks[0];
  const ai = Math.max(0, 15 - (lastAI ? lastAI.issues.filter((i) => !i.fixed).length * 5 : 0));
  return { checklist, temps, stock, training, ai };
};

SP.computeScore = function (k) {
  const b = SP.scoreBreakdown(k);
  return Math.round(Math.min(100, Math.max(0, b.checklist + b.temps + b.stock + b.training + b.ai)));
};

/* green ≥ 80, amber 60–79, red < 60 */
SP.scoreTone = (s) => (s >= 80 ? 'safe' : s >= 60 ? 'warn' : 'danger');
SP.scoreLabel = (s) => (s >= 80 ? 'Safe' : s >= 60 ? 'Needs attention' : 'Violation risk');

/* ---------- seeded inspection history ---------- */
SP.seedInspections = () => [
  { id: 'in1', outletId: 'o3', date: inDays(-34), time: '11:00', type: 'Routine inspection', notes: '', urgent: false, status: 'done', result: 'Improvement notice', findings: 'Raw chicken stored above cooked rice in walk-in. Pest-proofing gaps near back door.', completedAt: new Date(Date.now() - 34 * DAY).toISOString() },
  { id: 'in2', outletId: 'o1', date: inDays(-21), time: '15:30', type: 'Routine inspection', notes: '', urgent: false, status: 'done', result: 'Pass', findings: 'Excellent records. HACCP fully digitised.', completedAt: new Date(Date.now() - 21 * DAY).toISOString() },
  { id: 'in3', outletId: 'o5', date: inDays(-9), time: '12:00', type: 'Complaint follow-up', notes: '', urgent: false, status: 'done', result: 'Improvement notice', findings: 'Hairnets not worn on noodle station.', completedAt: new Date(Date.now() - 9 * DAY).toISOString() },
  { id: 'in4', outletId: 'o8', date: inDays(4), time: '10:30', type: 'Sampling visit', notes: 'Take prawn samples for lab', urgent: false, status: 'scheduled' },
];
