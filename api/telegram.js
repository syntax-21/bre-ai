// ========================================================
// Bre AI v3.0 - Telegram Webhook Serverless Endpoint
// Self-Contained Webhook Architecture (Zero Cloud Storage)
// Created by Amirun Rayan Ariandi
// ========================================================
const telegramBot = require('../services/telegramBot');
const { syncCloudConfig } = require('./_shared');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // 1. Ekstrak kredensial bot langsung dari URL query (Sistem Self-Contained seperti temp-email)
  let queryToken = req.query?.token || req.query?.t;
  let queryOwner = req.query?.owner || req.query?.o;
  let queryMode = req.query?.mode || req.query?.m;

  if (!queryToken && req.url && req.url.includes('?')) {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      queryToken = urlObj.searchParams.get('token') || urlObj.searchParams.get('t');
      queryOwner = urlObj.searchParams.get('owner') || urlObj.searchParams.get('o');
      queryMode = urlObj.searchParams.get('mode') || urlObj.searchParams.get('m');
    } catch (e) {}
  }

  const webhookCtx = {
    token: queryToken ? decodeURIComponent(queryToken) : null,
    ownerId: queryOwner ? decodeURIComponent(queryOwner) : null,
    accessMode: queryMode ? decodeURIComponent(queryMode) : null
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

    try {
      // Sinkronisasi cloud opsional jika tersedia (tidak wajib)
      try { await syncCloudConfig(); } catch (e) {}

      if (body.message) {
        await telegramBot.handleMessage(body.message, webhookCtx);
      } else if (body.callback_query) {
        await telegramBot.handleCallbackQuery(body.callback_query, webhookCtx);
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
