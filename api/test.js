const { getConfig, parseKeys } = require('./_shared');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  let body = req.body;
  if (!body) {
    body = await new Promise(resolve => {
      let d = '';
      req.on('data', c => { d += c; });
      req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
      req.on('error', () => resolve({}));
    });
  }
  body = body || {};

  const cfg = getConfig();

  // BATCH TEST ALL PROVIDERS
  if (body.testAll) {
    const endpoints = cfg.endpoints || [];
    const probes = endpoints.map(async ep => {
      const firstKey = ep.keys?.[0] || '';
      if (!firstKey) {
        return {
          provider: ep.name,
          url: ep.url,
          status: 'NO_KEY',
          latencyMs: 9999,
          error: 'No API Key configured'
        };
      }

      const testModel = ep.models?.[0] || 'mercury-2';
      const start = Date.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const auth = firstKey.startsWith('Bearer ') ? firstKey : `Bearer ${firstKey}`;

        const r = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({
            model: testModel,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 3,
            stream: false
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        const ms = Date.now() - start;

        if (r.ok) {
          return {
            provider: ep.name,
            url: ep.url,
            model: testModel,
            status: 'OK',
            latencyMs: ms,
            httpStatus: r.status
          };
        } else {
          const errText = await r.text().then(t => t.slice(0, 100));
          return {
            provider: ep.name,
            url: ep.url,
            model: testModel,
            status: 'FAIL',
            latencyMs: ms,
            httpStatus: r.status,
            error: errText
          };
        }
      } catch (err) {
        return {
          provider: ep.name,
          url: ep.url,
          model: testModel,
          status: 'FAIL',
          latencyMs: Date.now() - start,
          error: err.message
        };
      }
    });

    const results = await Promise.all(probes);
    results.sort((a, b) => a.latencyMs - b.latencyMs);
    return res.json({ testAll: true, results });
  }

  // SINGLE PROVIDER TEST
  const apiUrl = (body.customEndpoint || cfg.apiUrl || 'https://api.inceptionlabs.ai/v1/chat/completions').trim();
  const model = (body.customModel || cfg.model || 'mercury-2').trim();
  let keys = parseKeys(body.customKeys || '');
  if (!keys.length) keys = cfg.apiKeys || [];

  const results = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const masked = key.length > 8 ? key.slice(0, 4) + '...' + key.slice(-4) : '****';
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5, stream: false }),
        signal: ctrl.signal
      });
      const ms = Date.now() - start;
      if (r.ok) results.push({ keyIndex: i + 1, keyMasked: masked, status: 'OK', latencyMs: ms, httpStatus: r.status });
      else results.push({ keyIndex: i + 1, keyMasked: masked, status: 'FAIL', latencyMs: ms, httpStatus: r.status, error: await r.text().then(t => t.slice(0, 100)) });
    } catch (e) {
      results.push({ keyIndex: i + 1, keyMasked: masked, status: 'FAIL', latencyMs: Date.now() - start, error: e.message });
    }
  }

  return res.json({ results, apiUrl, model, totalKeys: keys.length });
};