// ========================================================
// Bre AI v3.0 - Telegram Webhook Serverless Endpoint
// Created by Amirun Rayan Ariandi
// ========================================================
const telegramBot = require('../services/telegramBot');
const { syncCloudConfig } = require('./_shared');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    let body = req.body;
    if (!body) {
      body = await new Promise(resolve => {
        let d = ''; req.on('data', c => { d += c; });
        req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
        req.on('error', () => resolve({}));
      });
    }

    try {
      // Pastikan konfigurasi terbaru (whitelist, role pengguna, model) tersinkronisasi dari Cloud
      await syncCloudConfig();

      if (body.message) {
        await telegramBot.handleMessage(body.message);
      } else if (body.callback_query) {
        await telegramBot.handleCallbackQuery(body.callback_query);
      }
    } catch (err) {
      console.error('[TelegramWebhook] Error:', err);
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({
    ok: true,
    service: 'Bre AI Telegram Bot Endpoint',
    status: telegramBot.getStatus()
  });
};
