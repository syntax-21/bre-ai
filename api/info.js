const { getConfig } = require('./_shared');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const cfg = getConfig();
  
  let allModels = [];
  let providers = [];
  if (cfg.endpoints && Array.isArray(cfg.endpoints)) {
    cfg.endpoints.forEach(e => {
      const isStatusActive = e.status !== false && e.enabled !== false;
      const hasKeys = (Array.isArray(e.keys) && e.keys.some(k => k && String(k).trim())) || (e.apiKey && String(e.apiKey).trim());
      if (isStatusActive && hasKeys) {
        const provModels = Array.isArray(e.models) && e.models.length > 0 ? e.models : (e.model ? [e.model] : ['mercury-2']);
        providers.push({
          name: e.name || 'Unnamed Provider',
          defaultModel: provModels[0] || e.model || 'mercury-2',
          models: provModels,
          weight: e.weight || 1
        });
        allModels.push(...provModels);
        if (e.mapping) {
          const mapStr = Array.isArray(e.mapping) ? e.mapping.join(',') : e.mapping;
          const pairs = mapStr.split(',').map(p => p.trim()).filter(Boolean);
          pairs.forEach(p => {
            const [reqMod] = p.split(':').map(s=>s.trim());
            if (reqMod) allModels.push(reqMod);
          });
        }
      }
    });
  }
  
  res.json({
    name: 'Bre AI',
    version: '4.0 Proxy Router',
    creator: 'Amirun Rayan Ariandi',
    providers: providers,
    models: [...new Set(allModels)],
    streamEnabled: cfg.streamEnabled !== false,
    status: 'online'
  });
};

