const { getConfig, saveConfig, checkRateLimit, recordFailedAttempt, clearLoginAttempts } = require('./_shared');

function getIp(req) { return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(); }
function getToken(req) { const auth = req.headers.authorization || ''; return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''; }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const cfg = getConfig();
  const ip = getIp(req);
  const token = getToken(req);
  const isAdmin = token === cfg.adminPassword;

  const publicCfg = {
    model: cfg.model, temperature: cfg.temperature, topP: cfg.topP,
    maxTokens: cfg.maxTokens, reasoningEffort: cfg.reasoningEffort, streamEnabled: cfg.streamEnabled
  };

  if (req.method === 'POST') {
    let body = req.body;
    if (!body) {
      body = await new Promise(resolve => {
        let d = ''; req.on('data', c => { d += c; });
        req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
        req.on('error', () => resolve({}));
      });
    }
    body = body || {};

    if (body.action === 'login') {
      const rate = checkRateLimit(ip);
      if (rate.limited) return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${rate.retryAfter} detik.` });
      
      if (!isAdmin) {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: 'Password salah' });
      }
      clearLoginAttempts(ip);
      return res.json({ ok: true, message: 'Login berhasil' });
    }

    // Save config
    let updatedFields = { ...body };
    if (!isAdmin) {
      ['endpoints', 'systemPrompt', 'adminPassword'].forEach(k => delete updatedFields[k]);
    }
    
    const updated = saveConfig(updatedFields);
    return res.json({ ok: true, config: isAdmin ? updated : publicCfg }); 
  }

  // GET
  return res.json({ config: isAdmin ? cfg : publicCfg });
};
