# HygiQ — Trust on every plate

HygiQ is a **live food-safety trust layer** that connects three groups who rarely share data today:

- **Kitchens** (restaurants, canteens, cloud kitchens) log hygiene digitally and get a live 0–100 hygiene score.
- **Customers** scan a QR code at the table to see the kitchen's real logs, and filter menus by their allergies.
- **Regulators** see risk across their whole jurisdiction and get early warning when complaints cluster.

It runs entirely in the browser with no backend and no build step. Open `index.html`, or deploy the folder as a static site.

---

## Features

### Kitchen dashboard
- **Live hygiene score** — an animated gauge that recalculates whenever a log changes. It has five parts: checklist 25, temperatures 30, stock and expiry 15, training 15, AI checks 15.
- **Digital HACCP checklist** — opening, cooking, cleaning and closing checks. Tap to complete; each tick records the time and the person.
- **Temperature monitoring** — a simulated live sensor feed for fridges, freezers and hot-holding, with sparklines. A reading out of range triggers a red alert and lowers the score. Manual probe readings can be logged too.
- **Expiry & batch tracker** — first-expiring items come first, with "expiring soon" and "expired" warnings.
- **Photo-to-Violation AI** — upload a photo; a scanning animation runs, then the issues are marked on the photo with suggested fixes.
- **One-tap recall** — shows which outlets and customers would be notified before you confirm.
- **Staff training** — quizzes that award badges and raise the score.
- **Surplus food** — list in-date food that is near expiry at a discount, or donate it to an NGO.
- **Audit report** — a printable report (save as PDF from the print dialog) and a downloadable `.html` copy.
- **Kitchen QR** — a real, scannable QR code you can download and print.

### Customer side
- **Explore** — outlets with live score badges. Search, filter by score and by veg / non-veg, and sort by score or distance.
- **QR Kitchen Transparency** (`#/outlet/<id>`, no login needed) — live temperatures, today's log, last cleaning, staff training badges and recent AI checks.
- **Allergy Guard** — save your allergies once. Every menu then marks each dish as *contains* (red), *cross-contact risk* (amber) or *safe* (green), and can hide unsafe dishes completely.
- **Complaint reporting** — with a category and an optional photo (resized in the browser before saving).
- **Label check** — a simulated barcode scan that shows ingredients, expiry status and personal allergen warnings.

### Regulator side
- **Outbreak Early Warning** — flags ≥ 2 serious complaints at one outlet within 48 h, or ≥ 3 across one area within 72 h.
- **Risk heatmap** — a 5×5 city grid coloured by the riskiest outlet in each block.
- **Outlets by risk** — risk combines the hygiene score, recent complaints and current problems (sensors out of range, expired stock).
- **Complaint feed** — move complaints from open to reviewed to resolved.
- **Inspections** — schedule visits (including urgent ones), then record a pass, improvement notice or fail with findings.
- **Full outlet history** — one timeline of every temperature log, alert, AI check, HACCP tick, recall, complaint and inspection.

### Extras
- **Hackathon demo mode** — one button plays the whole story by itself in about 45 seconds:
  photo AI flags violations → a fridge goes out of range and the score drops live → a customer scans the QR → Allergy Guard hides unsafe dishes.
- **Future scope** page (`#/future`).
- Light and dark mode, mobile-first layout (bottom tab bar on phones, sidebar on desktop), toasts, skeleton loaders, page transitions, and empty / loading / error states.
- Accessibility: ARIA labels, visible focus, keyboard support, large tap targets, and reduced-motion support.

## What makes it different
1. **One explainable score.** Every point traces back to a specific log.
2. **Trust you can verify.** Customers see the evidence, not just a sticker on the door.
3. **Closes the loop.** A customer complaint reaches the regulator's outbreak radar in real time.
4. **Built for people with allergies.** Cross-contact risk is flagged, not only listed ingredients.
5. **Cuts waste.** Safe near-expiry food goes to NGOs instead of the bin.

## Screenshots
Add your screenshots to `assets/screenshots/` with these names and they will show here:

| Landing | Kitchen | Customer QR view | Regulator |
|---|---|---|---|
| ![Landing](assets/screenshots/landing.png) | ![Kitchen](assets/screenshots/kitchen.png) | ![QR view](assets/screenshots/outlet.png) | ![Regulator](assets/screenshots/regulator.png) |

## Demo login credentials
Every login screen also has a **Try demo account** button.

| Role | Email | Password |
|---|---|---|
| Kitchen | `kitchen@hygiq.demo` | `Demo@123` |
| Customer | `customer@hygiq.demo` | `Demo@123` |
| Regulator | `inspector@hygiq.demo` | `Demo@123` |

> Accounts and passwords exist only in your browser's local storage. There is no server, so this is for demos only.

## Tech stack
- Plain **HTML, CSS and JavaScript** (ES2020): no framework and no build step
- **Hash-based router**, so it works from `file://` and from any static host
- **localStorage** with a `try/catch` guard and an in-memory fallback
- **qrcodejs 1.0.0** from cdnjs for QR codes (falls back to a plain link when offline)
- **Google Fonts**: Plus Jakarta Sans and JetBrains Mono, with system font fallbacks
- Inline SVG icons and illustrations

## Project structure
```
index.html          page shell and script order
css/style.css       design system, light and dark themes, all components
js/data.js          seeded demo data and the hygiene-score logic
js/app.js           storage, session, router, toasts, modals, theme, dashboard shell
js/auth.js          landing page, role selection, login and signup
js/kitchen.js       kitchen dashboard, sensor simulator, vision AI provider
js/consumer.js      explore, QR transparency, Allergy Guard, complaints, label check
js/regulator.js     risk model, outbreak detection, heatmap, inspections, history
js/demo.js          hackathon demo mode and the future scope page
assets/             favicon and logo
vercel.json         clean URLs and fallback to index.html
```

## Run locally
The simplest option: **double-click `index.html`.** Everything works offline except Google Fonts and the QR code library.

For QR codes that point at a real address, serve the folder instead:
```bash
npx serve .
```
Then open the address it prints (usually http://localhost:3000).

To reset all demo data, clear the site's local storage in your browser's dev tools (the `hygiq:*` keys).

## Deploy

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "HygiQ hackathon build"
git branch -M main
git remote add origin https://github.com/<your-username>/hygiq.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. Framework preset: **Other**. Leave the build command empty. Output directory: `.` (the project root).
3. Click **Deploy**. `vercel.json` already sets clean URLs and sends unknown paths to `index.html`.

Or use the command line:
```bash
npx vercel --prod
```

After deploying, every outlet's QR code points at your live URL, so it can be scanned from any phone.

## Plugging in a real vision API
Photo checks go through one provider object in `js/kitchen.js`:
```js
SP.Vision.provider = 'remote';   // default is 'simulated'
```
In `remote` mode it sends the image to `POST /api/vision` and expects
`{ issues: [{ code, title, severity, fix, box: [x, y, w, h] }] }` back.
Put the API key in a serverless function (for example a Vercel function in `/api`), **never in the browser**. This build uses no API keys, so there is no `.env.example`.

## Future scope
- **Real IoT sensors**: LoRaWAN or BLE temperature probes streaming over MQTT
- **Blockchain traceability**: append-only, signed batch records from farm to plate
- **Predictive risk models**: forecast which kitchens are likely to fail inspection next
- **Multilingual support**: regional languages and voice-guided checklists for kitchen staff
- **Production vision AI** and **CCTV spot-checks**
- **Regulator integrations**: FSSAI FoSCoS sync, plus WhatsApp and SMS outbreak alerts

---
*HygiQ — Trust on every plate.* Built for a hackathon; all data is simulated.
