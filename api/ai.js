/**
 * HygiQ live AI endpoint.
 *   GET  /api/ai  -> { ok, provider, model }   (health check the app calls on load)
 *   POST /api/ai  -> { text }
 *        body: { system?, messages: [{role:'user'|'assistant', content}], images?: [{type, data(base64)}], json?: bool }
 *
 * Works as a Vercel serverless function and with the local server (server.js).
 * Set ONE key in the environment (never in the browser):
 *   ANTHROPIC_API_KEY  -> Claude (default model claude-haiku-5-5)
 *   GEMINI_API_KEY     -> Gemini (default model gemini-3.6-flash, has a free tier)
 * Optional: AI_MODEL to override the model, AI_PROVIDER=anthropic|gemini when both keys are set.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const LIMIT = { messages: 30, chars: 200000, images: 4, imageB64: 5500000, perWindow: 40, windowMs: 10 * 60 * 1000 };
const hits = new Map(); // best-effort per-IP rate limit (per server instance)

function reply(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function pickProvider() {
  const want = (process.env.AI_PROVIDER || '').toLowerCase();
  if (want === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (want === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

function defaultModel(p) { return process.env.AI_MODEL || (p === 'anthropic' ? 'claude-haiku-5-5' : 'gemini-3.6-flash'); }

/* Merge consecutive turns with the same role, and make sure the list starts and ends with the user. */
function normalise(messages) {
  const out = [];
  for (const m of messages) {
    const role = m && m.role === 'assistant' ? 'assistant' : 'user';
    const content = String((m && m.content) || '').trim();
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

async function callAnthropic(model, system, msgs, images) {
  const messages = msgs.map((m, i) => ({
    role: m.role,
    content: i === msgs.length - 1 && images.length
      ? [...images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.type, data: im.data } })), { type: 'text', text: m.content }]
      : m.content,
  }));
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 2000, ...(system ? { system } : {}), messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data.error && data.error.message) || 'Claude API error ' + r.status), { status: r.status });
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function callGemini(model, system, msgs, images, json) {
  const contents = msgs.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [
      ...(i === msgs.length - 1 ? images.map((im) => ({ inline_data: { mime_type: im.type, data: im.data } })) : []),
      { text: m.content },
    ],
  }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { maxOutputTokens: 2000, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data.error && data.error.message) || 'Gemini API error ' + r.status), { status: r.status });
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map((p) => p.text || '').join('');
}

module.exports = async function handler(req, res) {
  const provider = pickProvider();
  const model = defaultModel(provider);

  if (req.method === 'GET') {
    return provider
      ? reply(res, 200, { ok: true, provider, model })
      : reply(res, 503, { ok: false, error: 'No AI key set. Add ANTHROPIC_API_KEY or GEMINI_API_KEY.' });
  }
  if (req.method !== 'POST') return reply(res, 405, { error: 'Use POST.' });
  if (!provider) return reply(res, 503, { error: 'No AI key set on the server. Add ANTHROPIC_API_KEY or GEMINI_API_KEY.' });

  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < LIMIT.windowMs);
  if (recent.length >= LIMIT.perWindow) return reply(res, 429, { error: 'Too many AI requests. Wait a few minutes and try again.' });
  recent.push(now); hits.set(ip, recent);

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return reply(res, 400, { error: 'Send a JSON body.' });

  const msgs = normalise(Array.isArray(body.messages) ? body.messages.slice(-LIMIT.messages) : []);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return reply(res, 400, { error: 'messages must end with a user turn.' });
  if (msgs.reduce((n, m) => n + m.content.length, 0) + String(body.system || '').length > LIMIT.chars) return reply(res, 413, { error: 'The request is too long.' });

  const images = (Array.isArray(body.images) ? body.images : []).slice(0, LIMIT.images)
    .filter((im) => im && IMAGE_TYPES.includes(im.type) && typeof im.data === 'string' && im.data.length < LIMIT.imageB64);
  if (body.json) msgs[msgs.length - 1].content += '\n\nReply with only valid JSON and no other text.';

  try {
    const text = provider === 'anthropic'
      ? await callAnthropic(model, body.system, msgs, images)
      : await callGemini(model, body.system, msgs, images, !!body.json);
    if (!text.trim()) return reply(res, 502, { error: 'The AI returned an empty answer. Try again.' });
    return reply(res, 200, { text, provider, model });
  } catch (e) {
    const status = e.status === 429 ? 429 : e.status === 401 || e.status === 403 ? 401 : 502;
    const msg = status === 429 ? 'The AI provider is rate-limiting this key. Wait a minute and try again.'
      : status === 401 ? 'The AI key was rejected. Check the key in your environment settings.'
      : 'The AI provider returned an error: ' + e.message;
    return reply(res, status, { error: msg });
  }
};
