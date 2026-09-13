const { apiHandler, httpError, consumeLimit } = require('../services/httpSecurity');
const { safeFetch, responseJson } = require('../services/safeFetch');
const { syncCloudConfig, checkClientAuth, getClientIp } = require('./_shared');

module.exports = apiHandler(async (req, res) => {
  const cfg = await syncCloudConfig();
  if (cfg.requireAuth !== false && !checkClientAuth(req, cfg)) throw httpError(401, 'API key diperlukan');
  if (consumeLimit('search:' + getClientIp(req), 30, 60000)) throw httpError(429, 'Batas pencarian tercapai');
  const query = (req.query.q || '').trim();
  if (!query || query.length > 1000) throw httpError(400, 'Query q wajib diisi (maksimal 1000 karakter)');
  const response = await safeFetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw httpError(502, 'Layanan pencarian sedang tidak tersedia');
  const data = await responseJson(response);
  const results = [];
  if (data.AbstractText) results.push({ title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL || '' });
  for (const topic of (data.RelatedTopics || []).flatMap(t => t.Topics || [t]).slice(0, 4)) {
    if (topic.Text) results.push({ title: topic.Text.slice(0, 60), snippet: topic.Text, url: topic.FirstURL || '' });
  }
  return res.json({ query, count: results.length, results });
}, ['GET']);
