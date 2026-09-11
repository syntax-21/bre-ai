// ========================================================
// Bre AI - /v1/models Endpoint (OpenAI-Compatible)
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig, syncCloudConfig } = require('./_shared');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-endpoint, x-custom-keys, x-custom-model, x-custom-provider');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const cfg = await syncCloudConfig();

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
};
