const { apiHandler, safeEqual, httpError } = require('../services/httpSecurity');
const { syncCloudConfig } = require('./_shared');
const processedUpdates = new Map();

module.exports = apiHandler(async (req, res) => {
  if (req.method === 'GET') return res.json({ ok: true });
  const cfg = await syncCloudConfig();
  const secret = cfg.telegramWebhookSecret || cfg.webhookSecret;
  if (!secret || !safeEqual(req.headers['x-telegram-bot-api-secret-token'], secret)) throw httpError(403, 'Invalid webhook secret');
  if (!cfg.telegramEnabled || !cfg.telegramBotToken) return res.json({ ok: true, note: 'disabled' });
  const update = req.body || {};
  if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) throw httpError(400, 'Invalid Telegram update');
  // Authentication MUST precede deduplication. Failures may be retried by Telegram.
  const key = update.update_id;
  const existing = processedUpdates.get(key);
  if (existing) { await existing; return res.json({ ok: true, note: 'duplicate dropped' }); }
  const task = Promise.race([
    require('../services/telegramBot').handleUpdate(update),
    new Promise((_, r) => setTimeout(() => r(new Error('Timeout processing update')), 28000))
  ]);
  processedUpdates.set(key, task);
  try { await task; }
  catch (error) { processedUpdates.delete(key); console.warn('[Telegram] Update processing error:', error.message); }
  if (processedUpdates.size > 2000) processedUpdates.delete(processedUpdates.keys().next().value);
  return res.json({ ok: true });
}, ['GET', 'POST']);
