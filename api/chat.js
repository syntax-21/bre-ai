const { getConfig, sanitizeOutput, checkRateLimit, recordFailedAttempt } = require('./_shared');

const keyRotations = new Map();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-endpoint, x-custom-keys, x-custom-model');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (!body) {
    body = await new Promise(resolve => {
      let d = ''; req.on('data', c => { d += c; });
      req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
      req.on('error', () => resolve({}));
    });
  } else if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const cfg = getConfig();
  const requestedModel = (req.headers['x-custom-model'] || body.model || body.customModel || cfg.model || '').trim();

  // ADVANCED ROUTER LOGIC: Match model and apply Mapping
  let target = null;
  let targetModelName = requestedModel;

  if (cfg.endpoints && cfg.endpoints.length > 0) {
    const activeEps = cfg.endpoints.filter(e => e.status !== false);
    
    for (const e of activeEps) {
      // 1. Check Direct Model
      if (e.models && e.models.some(m => m.toLowerCase() === requestedModel.toLowerCase())) {
        target = e;
        targetModelName = requestedModel;
        break;
      }
      
      // 2. Check Alias Mapping (e.g. gpt-4o:mercury-2)
      if (e.mapping) {
        const mapStr = Array.isArray(e.mapping) ? e.mapping.join(',') : e.mapping;
        const pairs = mapStr.split(',').map(p => p.trim()).filter(Boolean);
        for (const p of pairs) {
          const [alias, real] = p.split(':').map(s => s.trim());
          if (alias && real && alias.toLowerCase() === requestedModel.toLowerCase()) {
            target = e;
            targetModelName = real; // Translate model payload for upstream
            break;
          }
        }
      }
      if (target) break;
    }
    
    // Fallback if no specific model matches
    if (!target && activeEps.length > 0) {
      target = activeEps[0];
      targetModelName = target.models?.[0] || requestedModel;
    }
  }

  if (!target) return res.status(500).json({ error: 'Tidak ada Provider AI aktif yang dikonfigurasi.' });

  const apiUrl = target.url;
  const keys = target.keys || [];
  if (!keys.length) return res.status(400).json({ error: `Provider [${target.name}] tidak memiliki API Key.` });

  // Build messages
  const userMessages = Array.isArray(body.messages) ? body.messages.filter(m => m.role !== 'system') : [];
  const basePrompt = cfg.systemPrompt || '';
  const extraPrompt = body.customSystemPrompt ? `\n\n[INSTRUKSI AKTIF]:\n${body.customSystemPrompt}` : '';
  const formattedMessages = [{ role: 'system', content: basePrompt + extraPrompt }, ...userMessages];

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const rate = checkRateLimit(ip);
  if (rate.limited) return res.status(429).json({ error: `Rate limit API. Coba lagi dalam ${rate.retryAfter} detik.` });
  
  // Catat request (kita gunakan recordFailedAttempt sebagai hit counter yang reset per rentang waktu)
  recordFailedAttempt(ip);

  const stream = cfg.forceStream === true ? true : (cfg.forceStream === false ? false : (body.stream !== undefined ? Boolean(body.stream) : cfg.streamEnabled !== false));
  const maxTokens = body.max_tokens || cfg.maxTokens || 16384;
  const temperature = body.temperature !== undefined ? body.temperature : (cfg.temperature || 0.7);

  const total = keys.length;
  let start = keyRotations.get(apiUrl) || 0;
  let lastError = null;

  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total;
    const key = keys[idx];
    const auth = key.startsWith('Bearer ') ? key : `Bearer ${key}`;

    const payload = { model: targetModelName, messages: formattedMessages, max_tokens: maxTokens, temperature, stream };
    if (cfg.topP !== undefined) payload.top_p = cfg.topP;
    if (cfg.reasoningEffort && cfg.reasoningEffort !== 'none') payload.reasoning_effort = cfg.reasoningEffort;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      let disconnected = false;
      const onClose = () => { disconnected = true; ctrl.abort(); };
      req.on('close', onClose);

      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });

      clearTimeout(timer);
      req.removeListener('close', onClose);
      if (disconnected) return;

      if (upstream.ok) {
        keyRotations.set(apiUrl, (idx + 1) % total);

        if (stream && upstream.body) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });

          const reader = upstream.body.getReader();
          const dec = new TextDecoder('utf-8');
          let buf = '';
          let closed = false;
          req.on('close', () => { closed = true; try { reader.cancel(); } catch {} });

          try {
            while (!closed) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split('\n'); buf = lines.pop();
              for (const line of lines) res.write(sanitizeOutput(line) + '\n');
            }
            if (buf) res.write(sanitizeOutput(buf) + '\n');
          } catch (e) {}
          return res.end();
        } else {
          const data = await upstream.json();
          if (data.choices?.[0]?.message) data.choices[0].message.content = sanitizeOutput(data.choices[0].message.content);
          return res.status(200).json(data);
        }
      } else {
        const err = await upstream.text();
        lastError = `HTTP ${upstream.status}: ${err.slice(0, 200)}`;
      }
    } catch (e) {
      lastError = e.name === 'AbortError' ? 'Request timeout' : e.message;
    }
  }

  return res.status(502).json({ error: `Gagal terhubung via [${target.name}]. Error: ${lastError}` });
};
