const {
  getConfig,
  syncCloudConfig,
  saveConfig,
  testUpstash,
  testGitHub,
  getCloudStorageInfo,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  getMetrics,
  getLogs,
  clearLogs,
  fetchAvailableModels,
  testSingleModel
} = require('./_shared');

function getIp(req) { return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(); }
function getToken(req) { const auth = req.headers.authorization || ''; return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''; }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // Sinkronisasi cloud agar konfigurasi selalu mutakhir di Vercel Serverless
  const cfg = await syncCloudConfig();
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
      if (testRes.ok && body.chatId) {
        try {
          await telegramBot.apiCall('sendMessage', {
            chat_id: body.chatId,
            text: `⚡ *Tes Bot Berhasil!*\n\nHalo Admin! Bot Bre AI (@${testRes.bot?.username || 'bot'}) berhasil terhubung dan siap melayani percakapan 24/7.`,
            parse_mode: 'Markdown'
          }, body.token);
          testRes.messageSent = true;
        } catch (mErr) {
          testRes.messageError = mErr.message;
        }
      }
      return res.json(testRes);
    }

    if (body.action === 'get_telegram_status') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const status = telegramBot ? await telegramBot.getDetailedStatus(host) : { running: false };
      return res.json({ ok: true, status });
    }

    if (body.action === 'setup_webhook') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      if (!telegramBot) return res.status(500).json({ ok: false, error: 'Telegram service unavailable' });
      const host = body.host || req.headers['x-forwarded-host'] || req.headers.host || '';
      const webhookUrl = body.url || (host ? `https://${host}/api/telegram` : '');
      if (!webhookUrl) return res.status(400).json({ ok: false, error: 'URL Webhook tidak valid' });

      try {
        const tokenToUse = body.token || cfg.telegramBotToken;
        await telegramBot.apiCall('setWebhook', { url: webhookUrl }, tokenToUse);
        const status = await telegramBot.getDetailedStatus(host, tokenToUse);
        return res.json({ ok: true, webhookUrl, status });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    if (body.action === 'delete_webhook') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      if (!telegramBot) return res.status(500).json({ ok: false, error: 'Telegram service unavailable' });
      try {
        await telegramBot.apiCall('deleteWebhook', { drop_pending_updates: false });
        const status = await telegramBot.getDetailedStatus();
        return res.json({ ok: true, status });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // Cloud Persistence Actions
    if (body.action === 'test_upstash') {
      const resTest = await testUpstash(body.url, body.token);
      return res.json(resTest);
    }

    if (body.action === 'test_github') {
      const resTest = await testGitHub(body.token, body.repo, body.branch);
      return res.json(resTest);
    }

    if (body.action === 'get_cloud_status') {
      return res.json({ ok: true, status: getCloudStorageInfo() });
    }

    // Auto-Detect Models from /v1/models endpoint
    if (body.action === 'detect_models') {
      const currentCfg = getConfig();
      const endpoints = currentCfg.endpoints || [];
      const targetName = body.providerName || null;

      // If a specific provider is targeted, only detect for that one
      const targets = targetName
        ? endpoints.filter(e => e.name === targetName || e.url === targetName)
        : endpoints.filter(e => e.status !== false && e.keys?.length > 0);

      if (!targets.length) {
        return res.json({ ok: false, error: 'Tidak ada provider yang cocok atau tidak ada API Key.' });
      }

      const results = await Promise.all(
        targets.map(async ep => {
          const result = await fetchAvailableModels(ep);
          return { provider: ep.name, url: ep.url, ...result };
        })
      );

      return res.json({ ok: true, results });
    }

    // Test a specific model on a specific provider
    if (body.action === 'test_model') {
      const cfg = getConfig();
      const endpoints = cfg.endpoints || [];
      const providerName = body.providerName || null;
      const modelName = body.model || null;

      if (!modelName) {
        return res.status(400).json({ ok: false, error: 'Parameter model wajib diisi.' });
      }

      // Find target endpoint
      let targetEp = null;
      if (providerName) {
        targetEp = endpoints.find(e => e.name === providerName || e.url === providerName);
      }
      // Fallback: find first endpoint that has this model listed
      if (!targetEp) {
        targetEp = endpoints.find(e =>
          Array.isArray(e.models) && e.models.includes(modelName) && e.keys?.length > 0
        );
      }
      // Fallback: use body.url + body.keys if provided (for dynamic testing)
      if (!targetEp && body.url) {
        const { parseKeys } = require('./_shared');
        targetEp = { url: body.url, keys: parseKeys(body.keys || body.apiKey || '') };
      }

      if (!targetEp) {
        return res.status(400).json({ ok: false, error: `Tidak ada provider yang memiliki model "${modelName}" atau URL tidak ditemukan.` });
      }

      const result = await testSingleModel(targetEp, modelName);
      return res.json({ ok: result.ok, ...result, provider: targetEp.name || 'Manual' });
    }

    if (body.action === 'restart_telegram') {
      let telegramBot;
      try { telegramBot = require('../services/telegramBot'); } catch(e){}
      if (!telegramBot) return res.status(500).json({ ok: false, error: 'Telegram service unavailable' });
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const started = await telegramBot.restart(host);
      const status = await telegramBot.getDetailedStatus(host);
      return res.json({ ok: true, running: started, status });
    }

    // Save config
    let updatedFields = { ...body };
    delete updatedFields.action;
    
    const updated = await saveConfig(updatedFields);

    // Auto-restart telegram bot if telegram settings changed
    if (updatedFields.telegramEnabled !== undefined || updatedFields.telegramBotToken !== undefined || updatedFields.telegramAllowedUsers !== undefined) {
      try {
        const telegramBot = require('../services/telegramBot');
        const host = req.headers['x-forwarded-host'] || req.headers.host || '';
        telegramBot.restart(host).catch(() => {});
      } catch(e){}
    }

    return res.json({ 
      ok: true, 
      config: updated, 
      isReadOnlyFS: !!updated._isReadOnlyFS,
      cloudStatus: updated._cloudStatus || null,
      cloudStorageInfo: getCloudStorageInfo()
    }); 
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

  return res.json({ 
    config: isAdmin ? cfg : publicCfg,
    cloudStorageInfo: getCloudStorageInfo()
  });
};
