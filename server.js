/**
 * Local server for HygiQ with live AI.
 *   1. Copy .env.example to .env and put your key in it.
 *   2. Run:  node server.js        (Node 18 or newer, no npm install needed)
 *   3. Open: http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch { /* no .env file: the app runs in demo mode */ }

const ai = require('./api/ai.js');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/ai') {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 8e6) { res.statusCode = 413; return res.end('{"error":"Too large"}'); } }
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = null; }
    return ai(req, res);
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT) || /[\\/]\.env/.test(file) || /[\\/](api|server\.js)/.test(file.slice(ROOT.length))) { res.statusCode = 403; return res.end('Forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) file = path.join(ROOT, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  const p = process.env.ANTHROPIC_API_KEY ? 'Claude' : process.env.GEMINI_API_KEY ? 'Gemini' : null;
  console.log(`HygiQ running at http://localhost:${PORT}`);
  console.log(p ? `Live AI: ${p}` : 'No AI key found in .env, so the app runs in demo mode. See .env.example.');
});
