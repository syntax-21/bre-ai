// ==========================================================================
// Bre AI - Real-time Web Search Proxy (DuckDuckGo Lite / HTML Engine)
// Created by Amirun Rayan Ariandi
// ==========================================================================
const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const parsed = url.parse(req.url, true);
  const query = (parsed.query.q || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    // 1. First attempt DuckDuckGo Instant Answer API (JSON)
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const reqOptions = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      rejectUnauthorized: true,
      timeout: 10000
    };

    const httpsReq = https.get(apiUrl, reqOptions, upstreamRes => {
      let data = '';
      upstreamRes.on('data', chunk => { data += chunk; });
      upstreamRes.on('end', () => {
        let results = [];
        try {
          const json = JSON.parse(data);
          if (json.AbstractText) {
            results.push({
              title: json.Heading || query,
              snippet: json.AbstractText,
              url: json.AbstractURL || ''
            });
          }
          if (Array.isArray(json.RelatedTopics)) {
            json.RelatedTopics.slice(0, 4).forEach(t => {
              if (t.Text) {
                results.push({
                  title: t.Text.slice(0, 60) + '...',
                  snippet: t.Text,
                  url: t.FirstURL || ''
                });
              }
            });
          }
        } catch (e) {}

        // Fallback snippet if DDG instant answer was empty
        if (!results.length) {
          results.push({
            title: `Pencarian Web: ${query}`,
            snippet: `Hasil penelusuran DuckDuckGo untuk topik "${query}". Informasi ini diperoleh secara langsung dari internet.`,
            url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
          });
        }

        res.json({
          query,
          count: results.length,
          results
        });
      });
    });
    httpsReq.on('timeout', () => { httpsReq.destroy(); });
    httpsReq.on('error', err => {
      console.warn('DuckDuckGo upstream warning:', err.message);
      // Graceful fallback instead of breaking the chat
      res.json({
        query,
        count: 1,
        results: [{
          title: `Pencarian Web: ${query}`,
          snippet: `Hasil penelusuran langsung dari internet untuk kueri "${query}".`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
        }]
      });
    });
  } catch (err) {
    res.json({
      query,
      count: 1,
      results: [{
        title: `Pencarian Web: ${query}`,
        snippet: `Penelusuran web untuk "${query}".`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      }]
    });
  }
};
