const { getConfig } = require('./_shared');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const cfg = getConfig();
  
  let allModels = [];
  if (cfg.endpoints) {
    cfg.endpoints.forEach(e => {
      if (e.status !== false) {
        if (e.models) allModels.push(...e.models);
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
    models: [...new Set(allModels)],
    streamEnabled: cfg.streamEnabled !== false,
    status: 'online'
  });
};
