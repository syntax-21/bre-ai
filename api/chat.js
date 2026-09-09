const {
  getConfig,
  syncCloudConfig,
  sanitizeOutput,
  checkRateLimit,
  recordFailedAttempt,
  logRequest,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  validateClientKey,
  getNextRoundRobinIndex,
  buildBreAISystemPrompt,
  STYLE_PROMPTS
} = require('./_shared');

const keyRotations = new Map();

module.exports = async (req, res) => {
  const reqStartTime = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-endpoint, x-custom-keys, x-custom-model, x-custom-provider, x-custom-style');

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

  // 1. IP and Rate Limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const cfg = await syncCloudConfig();

  // 2. Client Authentication Check
  const authHeader = req.headers['authorization'] || '';
  const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  const authRes = validateClientKey(apiKey, cfg);
  if (!authRes || !authRes.valid) {
    recordFailedAttempt(ip);
    logRequest({ ip, provider: 'Auth', model: 'n/a', status: 401, latencyMs: 1, error: authRes?.error || 'Unauthorized Client API Key' });
    return res.status(401).json({ error: `Akses ditolak: ${authRes?.error || 'Client API Key tidak valid atau belum diisi.'}` });
  }

  // Check Rate Limits
  if (!checkRateLimit(ip)) {
    logRequest({ ip, provider: 'RateLimiter', model: 'n/a', status: 429, latencyMs: 1, error: 'Rate limit exceeded' });
    return res.status(429).json({ error: 'Batas kuota request tercapai. Silakan coba beberapa detik lagi.' });
  }

  // 3. Extract Custom Provider and Model Routing
  const requestedProvider = (req.headers['x-custom-provider'] || body.provider || '').trim();
  const requestedModel = (req.headers['x-custom-model'] || body.model || body.customModel || cfg.model || '').trim();

  // 4. Build and check User Messages
  const userMessages = Array.isArray(body.messages) ? body.messages.filter(m => m.role !== 'system') : [];
  const allUserText = userMessages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join(' ');

  // Content Moderation & Keyword Blacklist
  if (cfg.blacklist && cfg.blacklist.length > 0) {
    const blockedWord = checkBlacklist(allUserText, cfg.blacklist);
    if (blockedWord) {
      logRequest({ ip, provider: 'Content Filter', model: requestedModel || 'n/a', status: 400, latencyMs: 2, error: `Blacklist keyword matched: "${blockedWord}"` });
      return res.status(400).json({ error: `Pesan diblokir oleh kebijakan keamanan konten (Terdeteksi kata terlarang: "${blockedWord}").` });
    }
  }

  // 5. Select Candidates for Routing & Auto-Failover
  let activeEps = (cfg.endpoints || []).filter(e => e.status !== false && e.keys?.length > 0);
  if (!activeEps.length) {
    logRequest({ ip, provider: 'None', model: requestedModel, status: 500, latencyMs: 1, error: 'No active providers with API keys' });
    return res.status(500).json({ error: 'Tidak ada Provider AI aktif yang memiliki API Key.' });
  }

  const routingMode = (cfg.routingStrategy || cfg.providerRoutingMode || 'auto').toLowerCase();
  const searchProv = requestedProvider || requestedModel;
  const isExplicitAuto = searchProv && searchProv.toLowerCase() === 'auto';
  const isAutoRouting = routingMode === 'auto' || isExplicitAuto;

  let candidates = [];
  let primaryTarget = null;
  let targetModelName = requestedModel;

  if (isAutoRouting) {
    // Mode AUTO: Rotasi bergantian secara teratur (Round-Robin Sequential) ke semua provider aktif
    const startIdx = getNextRoundRobinIndex(activeEps.length);
    for (let i = 0; i < activeEps.length; i++) {
      candidates.push(activeEps[(startIdx + i) % activeEps.length]);
    }
    primaryTarget = candidates[0];
    targetModelName = primaryTarget.models?.[0] || requestedModel || 'mercury-2';
  } else if (routingMode === 'weighted') {
    // Mode WEIGHTED: Pilih provider berdasarkan bobot (weight)
    let totalWeight = activeEps.reduce((acc, ep) => acc + (Math.max(1, parseInt(ep.weight) || 1)), 0);
    let randWeight = Math.random() * totalWeight;
    let chosenIdx = 0;
    for (let i = 0; i < activeEps.length; i++) {
      const w = Math.max(1, parseInt(activeEps[i].weight) || 1);
      if (randWeight < w) {
        chosenIdx = i;
        break;
      }
      randWeight -= w;
    }
    primaryTarget = activeEps[chosenIdx];
    targetModelName = primaryTarget.models?.[0] || requestedModel || 'mercury-2';
    candidates = [primaryTarget, ...activeEps.filter((_, idx) => idx !== chosenIdx)];
  } else {
    // Mode PRIORITY: Sesuai provider/model tertentu yang diminta, atau fallback urutan pertama
    if (searchProv && !isExplicitAuto) {
      primaryTarget = activeEps.find(e => e.name && e.name.toLowerCase() === searchProv.toLowerCase())
                   || activeEps.find(e => e.name && (e.name.toLowerCase().includes(searchProv.toLowerCase()) || searchProv.toLowerCase().includes(e.name.toLowerCase())));
      if (primaryTarget) targetModelName = primaryTarget.models?.[0] || requestedModel;
    }

    if (!primaryTarget) {
      for (const e of activeEps) {
        if (e.models && e.models.some(m => m.toLowerCase() === requestedModel.toLowerCase())) {
          primaryTarget = e;
          targetModelName = requestedModel;
          break;
        }
        if (e.mapping) {
          const mapStr = Array.isArray(e.mapping) ? e.mapping.join(',') : e.mapping;
          const pairs = mapStr.split(',').map(p => p.trim()).filter(Boolean);
          for (const p of pairs) {
            const [alias, real] = p.split(':').map(s => s.trim());
            if (alias && real && alias.toLowerCase() === requestedModel.toLowerCase()) {
              primaryTarget = e;
              targetModelName = real;
              break;
            }
          }
        }
        if (primaryTarget) break;
      }
    }

    if (!primaryTarget) {
      primaryTarget = activeEps[0];
      targetModelName = primaryTarget.models?.[0] || requestedModel || 'mercury-2';
    }

    candidates = [primaryTarget];
    if (cfg.autoFailover !== false) {
      activeEps.forEach(e => {
        if (e !== primaryTarget && !candidates.includes(e)) candidates.push(e);
      });
    }
  }

  // 6. Language & Style Resolution
  const requestedStyle = (req.headers['x-custom-style'] || body.style || cfg.defaultStyle || 'santai').trim();
  const requestedLang = (req.headers['x-custom-language'] || body.language || cfg.telegramLanguage || 'id').trim().toLowerCase();

  // 7. Response Caching check (only for non-stream requests)
  const stream = cfg.forceStream === true ? true : (cfg.forceStream === false ? false : (body.stream !== undefined ? Boolean(body.stream) : cfg.streamEnabled !== false));
  const cacheKey = `${primaryTarget.name}:${targetModelName}:${requestedLang}:${requestedStyle}:${allUserText.trim()}`;

  if (cfg.cacheEnabled && !stream && allUserText.trim()) {
    const cachedData = getCachedResponse(cacheKey);
    if (cachedData) {
      const ms = Date.now() - reqStartTime;
      logRequest({ ip, provider: primaryTarget.name, model: targetModelName, status: 200, latencyMs: ms, tokens: Math.round(allUserText.length / 4), cached: true });
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedData);
    }
  }

  // 8. Execute Request across candidate providers (Auto-Failover)
  const masterSystemContent = buildBreAISystemPrompt({
    cfg,
    style: requestedStyle,
    customSystemPrompt: body.customSystemPrompt || '',
    language: requestedLang
  });
  const formattedMessages = [{ role: 'system', content: masterSystemContent }, ...userMessages];

  const maxTokens = body.max_tokens || cfg.maxTokens || 16384;
  const temperature = body.temperature !== undefined ? body.temperature : (cfg.temperature || 0.7);

  let finalError = null;

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const currentTarget = candidates[cIdx];
    const isFailover = cIdx > 0;
    const currApiUrl = currentTarget.url;
    const currKeys = currentTarget.keys || [];
    if (!currKeys.length) continue;

    // Build ordered list of models to try for this provider
    // Primary: the resolved target model, then all others in endpoint.models[]
    const providerModels = [];
    if (targetModelName && !providerModels.includes(targetModelName)) providerModels.push(targetModelName);
    if (Array.isArray(currentTarget.models)) {
      for (const m of currentTarget.models) {
        if (m && !providerModels.includes(m)) providerModels.push(m);
      }
    }
    if (!providerModels.length) providerModels.push(targetModelName || 'mercury-2');

    for (let mIdx = 0; mIdx < providerModels.length; mIdx++) {
      const currModel = providerModels[mIdx];
      const totalKeys = currKeys.length;
      let startKeyIdx = keyRotations.get(currApiUrl) || 0;

      for (let kIdx = 0; kIdx < totalKeys; kIdx++) {
        const idx = (startKeyIdx + kIdx) % totalKeys;
        const key = currKeys[idx];
        const auth = key.startsWith('Bearer ') ? key : `Bearer ${key}`;

        const payload = { model: currModel, messages: formattedMessages, max_tokens: maxTokens, temperature, stream };
        if (cfg.topP !== undefined) payload.top_p = cfg.topP;
        if (cfg.reasoningEffort && cfg.reasoningEffort !== 'none') payload.reasoning_effort = cfg.reasoningEffort;

        try {
          const ctrl = new AbortController();
          const timeoutMs = isFailover ? 30000 : 60000;
          const timer = setTimeout(() => ctrl.abort(), timeoutMs);
          let disconnected = false;
          const onClose = () => { disconnected = true; ctrl.abort(); };
          if (typeof req.on === 'function') req.on('close', onClose);

          const upstream = await fetch(currApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: auth },
            body: JSON.stringify(payload),
            signal: ctrl.signal
          });

          clearTimeout(timer);
          if (typeof req.removeListener === 'function') {
            req.removeListener('close', onClose);
          } else if (typeof req.off === 'function') {
            req.off('close', onClose);
          }
          if (disconnected) return;

          const latencyMs = Date.now() - reqStartTime;

          if (upstream.ok) {
            keyRotations.set(currApiUrl, (idx + 1) % totalKeys);

            if (stream && upstream.body) {
              logRequest({
                ip,
                provider: currentTarget.name,
                model: currModel,
                status: 200,
                latencyMs,
                tokens: Math.round(allUserText.length / 4) + 150,
                failover: isFailover || mIdx > 0
              });

              res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'X-Provider': currentTarget.name,
                'X-Model': currModel
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
              if (data.choices?.[0]?.message) {
                data.choices[0].message.content = sanitizeOutput(data.choices[0].message.content);
              }

              const estTok = (data.usage?.total_tokens) || (Math.round((allUserText.length + (data.choices?.[0]?.message?.content?.length || 0)) / 4));

              logRequest({
                ip,
                provider: currentTarget.name,
                model: currModel,
                status: 200,
                latencyMs,
                tokens: estTok,
                failover: isFailover || mIdx > 0
              });

              if (cfg.cacheEnabled) {
                setCachedResponse(cacheKey, data, cfg.cacheTTL || 3600);
              }

              res.setHeader('X-Provider', currentTarget.name);
              res.setHeader('X-Model', currModel);
              return res.status(200).json(data);
            }
          } else {
            const errText = await upstream.text();
            finalError = `HTTP ${upstream.status} [${currentTarget.name}/${currModel}]: ${errText.slice(0, 200)}`;
          }
        } catch (e) {
          finalError = e.name === 'AbortError' ? `Timeout [${currentTarget.name}/${currModel}]` : e.message;
        }
      } // end key loop
    } // end model loop
  } // end provider loop

  // All candidates failed
  const totalMs = Date.now() - reqStartTime;
  logRequest({
    ip,
    provider: primaryTarget.name,
    model: targetModelName,
    status: 502,
    latencyMs: totalMs,
    error: finalError || 'Failed to connect to any upstream provider'
  });

  return res.status(502).json({ error: `Gagal terhubung via [${primaryTarget.name}]. Error: ${finalError || 'Upstream unavailable'}` });
};
