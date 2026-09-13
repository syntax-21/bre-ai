const { apiHandler, safeEqual, httpError, consumeLimit } = require('../services/httpSecurity');
const { syncCloudConfig, verifyAdminPassword, getClientIp } = require('./_shared');

module.exports = apiHandler(async (req, res) => {
  const cfg = await syncCloudConfig();
  const motivation = require('../services/motivation');
  const action = req.query.action || 'status';
  if (action === 'status') return res.json({ ok: true, enabled: !!cfg.motivationEnabled });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const cron = action === 'send' && safeEqual(token, process.env.CRON_SECRET);
  if (!cron && !verifyAdminPassword(token, cfg.adminPassword)) throw httpError(401, 'Unauthorized');
  if (consumeLimit('motivation:' + getClientIp(req), 10, 60000)) throw httpError(429, 'Batas permintaan tercapai');
  if (action === 'send') {
    const result = await motivation.checkAndSendMotivation();
    await require('../services/telegramBot').checkReminders();
    return res.json({ ok: true, ...result });
  }
  const theme = typeof req.query.theme === 'string' ? req.query.theme.trim() : '';
  if (theme.length > 500) throw httpError(400, 'Tema terlalu panjang');
  if (action === 'preview') return res.json({ ok: true, ...await motivation.previewMotivation(theme) });
  if (action === 'send-now' && req.method !== 'POST') throw httpError(405, 'Method not allowed');
  if (action === 'send-now') return res.json({ ok: true, ...await motivation.sendMotivationNow(theme) });
  throw httpError(400, 'Action tidak valid');
}, ['GET', 'POST']);
