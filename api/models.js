// ========================================================
// Bre AI - /v1/models Endpoint (OpenAI-Compatible)
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig, syncCloudConfig, checkClientAuth } = require('./_shared');
const { apiHandler, httpError } = require('../services/httpSecurity');

module.exports = apiHandler(async (req, res) => {
  const cfg = await syncCloudConfig();
  if (cfg.requireAuth !== false && !checkClientAuth(req, cfg)) throw httpError(401, 'API key diperlukan');

  // Collect all active models from providers and mapping aliases
  const modelSet = new Set(['bre-ai']); // Master unified model ID
  const modelDetails = [
    {
      id: 'bre-ai',
      object: 'model',
      created: 1700000000,
      owned_by: 'bre-ai',
      permission: [],
      root: 'bre-ai',
      parent: null,
      description: 'Bre AI Smart Unified Router (Auto-Rotation & Failover)'
    }
  ];

  if (Array.isArray(cfg.endpoints)) {
    cfg.endpoints.forEach(ep => {
      const isStatusActive = ep.status !== false && ep.enabled !== false;
      const hasKeys = (Array.isArray(ep.keys) && ep.keys.some(k => k && String(k).trim())) || (ep.apiKey && String(ep.apiKey).trim());
      if (isStatusActive && hasKeys) {
        const owner = (ep.name || 'custom').toLowerCase().replace(/\s+/g, '-');
        
        // Models in endpoint.models array
        if (Array.isArray(ep.models)) {
          ep.models.forEach(m => {
            const mClean = (m || '').trim();
            if (mClean && !modelSet.has(mClean)) {
              modelSet.add(mClean);
              modelDetails.push({
                id: mClean,
                object: 'model',
                created: 1700000000,
                owned_by: owner,
                permission: [],
                root: mClean,
                parent: null
              });
            }
          });
        }

        // Model aliases from endpoint.mapping
        if (ep.mapping) {
          const mapStr = Array.isArray(ep.mapping) ? ep.mapping.join(',') : ep.mapping;
          const pairs = mapStr.split(',').map(p => p.trim()).filter(Boolean);
          pairs.forEach(p => {
            const [alias] = p.split(':').map(s => s.trim());
            if (alias && !modelSet.has(alias)) {
              modelSet.add(alias);
              modelDetails.push({
                id: alias,
                object: 'model',
                created: 1700000000,
                owned_by: owner,
                permission: [],
                root: alias,
                parent: null
              });
            }
          });
        }
      }
    });
  }

  return res.status(200).json({
    object: 'list',
    data: modelDetails
  });
}, ['GET']);
