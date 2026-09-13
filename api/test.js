const { syncCloudConfig, parseKeys, verifyAdminPassword, testSingleModel, checkRateLimit, recordFailedAttempt, getClientIp } = require('./_shared');
const { apiHandler, httpError, consumeLimit } = require('../services/httpSecurity');

module.exports = apiHandler(async (req, res) => {
  const cfg = await syncCloudConfig();
  const ip = getClientIp(req);
  if (checkRateLimit(ip).limited || consumeLimit('test:' + ip, 60, 60000)) throw httpError(429, 'Terlalu banyak pengujian');
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!verifyAdminPassword(token, cfg.adminPassword)) { recordFailedAttempt(ip); throw httpError(401, 'Admin authentication required'); }
  const body = req.body || {};
  let endpoints;
  if (body.testAll) endpoints = body.endpoints || cfg.endpoints;
  else {
    const url = body.customEndpoint || cfg.endpoints?.[0]?.url;
    // Never attach a configured provider's key to a different user-supplied URL.
    const configured = cfg.endpoints.find(ep => ep.url === url);
    const keys = parseKeys(body.customKeys || body.keys || body.key || configured?.keys || '');
    endpoints = keys.map(key => ({ url, keys: [key], models: [body.customModel || cfg.model] }));
  }
  if (!Array.isArray(endpoints) || endpoints.length > 30 || endpoints.some(ep => !ep || typeof ep !== 'object')) throw httpError(400, 'Daftar endpoint tidak valid (maksimal 30)');
  const results = [];
  // Bounded parallelism and timeouts keep probes within the serverless budget.
  for (let i = 0; i < endpoints.length; i += 10) {
    results.push(...await Promise.all(endpoints.slice(i, i + 10).map(async (ep, idx) => {
      const result = await testSingleModel(ep, ep.models?.[0] || cfg.model);
      return { ...result, name: ep.name || 'Provider', provider: ep.name || 'Provider', url: ep.url,
        model: ep.models?.[0] || cfg.model, keyIndex: i + idx + 1, keyMasked: '••••••••',
        status: result.ok ? 'OK' : 'FAIL', httpStatus: result.ok ? 200 : 502 };
    })));
  }
  if (body.testAll) results.sort((a, b) => a.latencyMs - b.latencyMs);
  return res.json({ testAll: !!body.testAll, results, totalKeys: endpoints.length });
}, ['POST'], { admin: true });
