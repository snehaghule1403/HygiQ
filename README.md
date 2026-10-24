# HygiQ — Trust on every plate

HygiQ is a **live food-safety trust layer** for TechForFood (problem statement: *PROTECT — Smart Food Safety for Canteens, Restaurants & Consumers*). It connects four groups who rarely share data today:

- **Kitchens** (canteens, restaurants, cloud kitchens) log hygiene, stock and temperatures digitally and get a live, explainable 0–100 hygiene score.
- **Customers** scan a QR code at the counter to see the kitchen's real logs, filter the menu by their allergies, and report problems.
- **Homes** track fridge expiry dates, check whether food has spoiled, and check packets for family allergies.
- **Regulators** see risk across the city and get early warning when complaints cluster around a restaurant, an area or a supplier.

An **AI assistant (HygiQ AI)** works across all of it: it understands text, photos and voice, and answers in English, Hindi or Marathi.

It runs entirely in the browser with no backend and no build step. Open `index.html`, or deploy the folder as a static site.

---

## What's new in v2

v2 is a single-file app (`index.html`). The original multi-file version is kept as `classic.html`.

| Area | New in v2 |
|---|---|
| AI | Multimodal assistant grounded in the app's live data · AI photo inspection with violation boxes drawn on the photo · label reading (expiry, batch, allergens) · allergen tagging for new dishes · complaint triage · spoilage check from a photo · packet allergen check per family member · AI audit summary |
| Voice | Speak to HygiQ AI in English, Hindi or Marathi · replies read aloud · **voice delivery log** ("Paneer 5 kilo aaya, expiry 28 tareekh") adds stock hands-free |
| Kitchen | Photo-verified HACCP checks · leftover 2-hour timers · surplus donation · one-tap batch recall with impact preview · training quizzes and badges · downloadable audit report |
| Outbreaks | Supplier tracing: complaints at different kitchens that share a supplier raise one alert |
| Home | New role: fridge expiry tracker, "cook before it expires" suggestions, spoilage and packet checks |
| Maps | Live Pune map of outlets coloured by hygiene score, with "near me" distances · inspector **outbreak map** with complaint hotspots and lines tracing complaints back to a shared supplier depot |
| Demo | One-button demo mode plays the whole story in about 45 seconds |

## Features

### Kitchen staff
- **Live hygiene score** with five explainable parts: checklist 25, temperatures 30, stock 15, training 15, AI checks 15. Each part says exactly why it lost points.
- **HACCP checklist**: opening, cooking, cleaning and closing checks. Each tick records the time and the person. Add a photo and the AI confirms the task was really done.
- **AI kitchen inspection**: upload a photo; violations (bare hands, uncovered food, hair, open bins…) are boxed on the photo with a fix. "Mark fixed" raises the score.
- **Temperature monitoring**: fridges, freezer and hot-holding with sparklines, out-of-range alerts, fault simulation and manual probe readings.
- **Stock and batches**: soonest expiry first, label scanning, voice logging, discard and **one-tap recall** that shows which kitchens and how many customers will be notified.
- **Surplus food**: donate to an NGO or sell at a discount, with a pickup time.
- **Leftover timers**: the 2-hour rule for cooked food in the 5–60°C danger zone.
- **Menu and allergens**: "contains" and "may contain" (cross-contact) for every dish.
- **Team training**: quizzes that award badges and raise the score.
- **Audit report**: on-screen report, AI-written summary and a downloadable file.

### Customer
- **Explore** outlets on a map or a list with live scores: search, pure-veg filter, sort by score or distance, and **Near me** to measure distances from your location.
- **Kitchen live** (the QR page): live temperatures, today's check-ins with times, staff training, last AI check.
- **Allergy guard**: red = contains, amber = cross-contact risk, green = safe; one toggle hides unsafe dishes.
- **Report a problem** in any language, with an optional photo. The AI extracts dish, symptoms and severity.

### Home
- **My fridge** with expiry reminders and AI recipe suggestions that respect family allergies.
- **Is it spoiled?** photo check and **Safe for my family?** packet check (photo or pasted ingredients).

### Inspector
- **City watch**: an **outbreak map** of Pune with layers for outlets (coloured by risk), complaint hotspots and supplier links that trace complaints to a shared depot, outbreak alerts (same outlet, same area, same supplier), complaint workflow open → reviewed → resolved, and recalls from kitchens.
- **Outlets by risk**: risk combines score, complaints and live problems; each outlet has a full history timeline.
- **Inspections**: schedule (including urgent), then record Pass, Improvement notice or Fail with findings.

## How the AI runs

HygiQ picks the best AI it can reach, in this order:

1. **Inside claude.ai** (the published artifact): Claude, on the viewer's own account.
2. **Your own server** (`node server.js` locally, or the Vercel function on your deployment): **live AI with your key**, Claude or Gemini. The badge at the top shows "AI live · Claude" or "AI live · Gemini".
3. **Demo mode** (no key, or the file opened directly): every feature still works with answers computed from the app's data, labelled as demo results.

The key lives only on the server (`api/ai.js`), never in the browser.

### Get a key (pick one)

| Provider | Where | Default model | Cost |
|---|---|---|---|
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-3.6-flash` | Free tier with rate limits; free-tier prompts may be used by Google to improve products, so use sample data only |
| Claude | [console.anthropic.com](https://console.anthropic.com) | `claude-haiku-5-5` | Pay as you go, very low cost per request |

Both read photos, so the photo inspection, label reading and spoilage checks work with either. Set `AI_MODEL` to use a different model.

### Live AI on your computer

```bash
cp .env.example .env        # Windows: copy .env.example .env
# open .env and paste ONE key, e.g. GEMINI_API_KEY=your-key
node server.js              # Node 18 or newer, nothing to install
```

Open **http://localhost:3000**. The terminal prints "Live AI: Gemini" (or Claude) when the key is found.

### Live AI on Vercel

1. In your Vercel project, open **Settings → Environment Variables**.
2. Add `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) with your key, for Production.
3. Redeploy (**Deployments → ⋯ → Redeploy**).

`api/ai.js` becomes the `/api/ai` endpoint automatically. It limits each visitor to 40 AI requests per 10 minutes, but anyone with your site's link can use your key, so set a spending limit with your provider and remove the key after judging.

## Voice

- Uses the browser's built-in Web Speech API: speech recognition for the mic, speech synthesis for read-aloud. No extra libraries.
- Works best in **Chrome or Edge** on `http://localhost` or an `https://` site. Allow microphone access when asked.
- Languages: English (`en-IN`), Hindi (`hi-IN`), Marathi (`mr-IN`), chosen in the assistant panel.
- The microphone is blocked inside the claude.ai viewer; typing and read-aloud still work there.

## Maps

- Built with **Leaflet 1.9.4** (loaded from cdnjs) and **CARTO / OpenStreetMap** tiles, light or dark to match the theme. No API key needed.
- Coordinates of outlets and supplier depots are sample data for Pune.
- **Near me** uses the browser's location (allow it when asked). Without it, distances are measured from Hinjewadi.
- Inside the claude.ai viewer, street tiles are blocked, so the map shows markers, areas and the river on a plain background.

## Run locally

**With live AI:** `node server.js` after adding a key to `.env` (see above), then open http://localhost:3000.

**Without AI (demo mode):** double-click `index.html`, or serve the folder:

```bash
python -m http.server 8000      # then open http://localhost:8000
```

Use "Reset sample data" in the sidebar to start the demo fresh.

## Demo script (about 2 minutes)

1. Press **Play demo** and narrate the five steps: photo AI → fridge fails and the score drops → customer scans the QR → allergy guard → outbreak radar.
2. Open **Stock & temps**, tap the mic and say *"Paneer 5 kilo aaya, expiry 28 tareekh, Sai Dairy"*.
3. Open the assistant, switch to हिंदी and ask *"आज पहले क्या करना है?"*.
4. As the inspector, open the Sai Dairy alert and schedule an urgent inspection.

## Project structure

```
index.html          HygiQ v2: the whole app (UI, data, AI, voice, maps, demo mode)
api/ai.js           live AI endpoint (Claude or Gemini); the key stays on the server
server.js           local server with live AI: node server.js
.env.example        copy to .env and add your key (.env is git-ignored)
classic.html        HygiQ v1, kept for reference (uses css/ and js/)
css/style.css       v1 styles
js/*.js             v1 modules (data, app, auth, kitchen, consumer, regulator, demo)
assets/             favicon and logo
vercel.json         clean URLs; everything except /api falls back to index.html
```

## Tech stack
- Plain **HTML, CSS and JavaScript**: no framework and no build step
- **Web Speech API** for voice in and out
- **Leaflet** with CARTO / OpenStreetMap tiles for maps
- **Google Fonts**: Bricolage Grotesque, Figtree and JetBrains Mono, with system fallbacks
- Inline SVG icons; light and dark mode; works at phone width

## Deploy on Vercel
1. Push this folder to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Framework preset: **Other**. Leave the build command empty. Output directory: `.`
4. Add your AI key under **Environment Variables** (`GEMINI_API_KEY` or `ANTHROPIC_API_KEY`).
5. Click **Deploy**.

Or from the command line: `npx vercel --prod`

## Future scope
- **Real IoT sensors**: LoRaWAN or BLE probes streaming over MQTT
- **Production AI backend** with audit logs, and **CCTV spot-checks**
- **Predictive risk models**: forecast which kitchens are likely to fail inspection next
- **More languages**: Kannada, Tamil, Bengali, with voice-guided checklists
- **Regulator integrations**: FSSAI FoSCoS sync, plus WhatsApp and SMS outbreak alerts
- **Traceability**: signed batch records from farm to plate

---
*HygiQ — Trust on every plate.* Built for TechForFood; all data is simulated.
