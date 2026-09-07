const {
  getConfig,
  saveConfig,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  getMetrics,
  getLogs,
  clearLogs
} = require('./_shared');

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

    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
    }

    if (body.action === 'get_metrics') {
      return res.json({ ok: true, metrics: getMetrics() });
    }

    if (body.action === 'get_logs') {
      return res.json({ ok: true, logs: getLogs() });
    }

    if (body.action === 'clear_logs') {
      clearLogs();
      return res.json({ ok: true, message: 'Logs cleared' });
    }

    // Telegram Bot Actions
    if (body.action === 'test_telegram') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      if (!telegramBot) return res.status(500).json({ ok: false, error: 'Telegram service unavailable' });
      const testRes = await telegramBot.testToken(body.token);
      return res.json(testRes);
    }

    if (body.action === 'get_telegram_status') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      const status = telegramBot ? telegramBot.getStatus() : { running: false };
      return res.json({ ok: true, status });
    }

    if (body.action === 'restart_telegram') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      if (!telegramBot) return res.status(500).json({ ok: false, error: 'Telegram service unavailable' });
      const started = await telegramBot.restart();
      return res.json({ ok: true, running: started, status: telegramBot.getStatus() });
    }

    // Save config
    let updatedFields = { ...body };
    delete updatedFields.action;
    
    const updated = saveConfig(updatedFields);

    // Auto-restart telegram bot if telegram settings changed
    if (updatedFields.telegramEnabled !== undefined || updatedFields.telegramBotToken !== undefined || updatedFields.telegramAllowedUsers !== undefined) {
      try {
        const telegramBot = require('../services/telegramBot');
        telegramBot.restart().catch(() => {});
      } catch(e){}
    }

    return res.json({ ok: true, config: updated }); 
  }

  // GET
  if (req.query?.action === 'metrics' || req.url?.includes('action=metrics')) {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ ok: true, metrics: getMetrics() });
  }

  if (req.query?.action === 'logs' || req.url?.includes('action=logs')) {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ ok: true, logs: getLogs() });
  }

  return res.json({ config: isAdmin ? cfg : publicCfg });
};
