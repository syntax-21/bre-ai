const crypto = require('crypto');
const shared = require('./_shared');
const { apiHandler, httpError, consumeLimit, safeEqual } = require('../services/httpSecurity');
const { validateUrl } = require('../services/safeFetch');

function getToken(req) {
  const auth = req.headers?.authorization || '';
  return typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : '';
}

async function telegramStatus(cfg) {
  const bot = require('../services/telegramBot');
  const status = bot.getStatus();
  if (!cfg.telegramBotToken) return status;
  const api = require('../services/telegram/api');
  const [me, webhook] = await Promise.all([
    api.testToken(cfg.telegramBotToken),
    api.apiCall('getWebhookInfo', {}, cfg.telegramBotToken).catch(() => ({}))
  ]);
  let cleanUrl = '';
  try { const url = new URL(webhook.url); url.search = ''; cleanUrl = url.href; } catch {}
  return { ...status, botInfo: me.ok ? me.bot : null, isWebhookActive: !!webhook.url,
    webhookUrl: cleanUrl, pendingUpdates: webhook.pending_update_count || 0,
    ownerId: cfg.telegramOwnerId, accessMode: cfg.telegramAccessMode,
    userCount: cfg.telegramUsers?.length || 0, activeConversations: status.activeSessions };
}

module.exports = apiHandler(async (req, res) => {
  const cfg = await shared.syncCloudConfig();
  const body = req.body || {};
  const token = getToken(req) || (body.action === 'login' && typeof body.password === 'string' ? body.password : '');
  const ip = shared.getClientIp(req);
  // Apply failed-password throttling to EVERY admin action, including authenticated GET.
  const rate = shared.checkRateLimit(ip);
  if (rate.limited) { res.setHeader('Retry-After', String(rate.retryAfter)); throw httpError(429, 'Terlalu banyak percobaan login. Coba lagi nanti.'); }
  const isAdmin = shared.verifyAdminPassword(token, cfg.adminPassword);
  if (!isAdmin && (req.method === 'POST' || token)) {
    shared.recordFailedAttempt(ip);
    throw httpError(401, cfg.adminPassword ? 'Unauthorized: Password admin diperlukan' : 'Admin belum dikonfigurasi. Atur ADMIN_PASSWORD di environment.');
  }
  if (req.method === 'GET') {
    const maskKeys = (eps) => (eps || []).map(e => ({
      ...e,
      keys: (e.keys || []).map(k => k ? ('••••' + String(k).slice(-4)) : ''),
      apiKey: e.apiKey ? ('••••' + String(e.apiKey).slice(-4)) : undefined
    }));
    const config = isAdmin ? {
      ...cfg,
      adminPassword: cfg.adminPassword ? '••••••••' : '',
      endpoints: maskKeys(cfg.endpoints),
      upstashRedisToken: cfg.upstashRedisToken ? '••••••••' : '',
      githubToken: cfg.githubToken ? '••••••••' : '',
      transcriptionKey: cfg.transcriptionKey ? '••••••••' : '',
      telegramBotToken: cfg.telegramBotToken ? ('••••' + String(cfg.telegramBotToken).slice(-6)) : ''
    } : {
      model: cfg.model, temperature: cfg.temperature, topP: cfg.topP, maxTokens: cfg.maxTokens,
      reasoningEffort: cfg.reasoningEffort, streamEnabled: cfg.streamEnabled, requireAuth: cfg.requireAuth,
      endpoints: (cfg.endpoints || []).filter(e => e.status !== false && e.enabled !== false).map(e => ({
        name: e.name || 'Provider',
        models: e.models || [],
        mapping: e.mapping || []
      }))
    };
    return res.json({ ok: true, isAdmin, config, serverTime: Date.now(), ...(isAdmin ? { cloudStorageInfo: shared.getCloudStorageInfo() } : {}) });
  }
  if (body.action === 'login') { shared.clearLoginAttempts(ip); return res.json({ ok: true }); }

  const action = body.action || 'save_full_config';
  if (['test_model', 'detect_models', 'fetch_models', 'preview_motivation', 'send_motivation_now', 'test_telegram', 'setup_webhook'].includes(action)) {
    if (consumeLimit('probe:' + ip, 60, 60000)) throw httpError(429, 'Batas pengujian tercapai');
  }
  if (action === 'get_metrics') return res.json({ ok: true, metrics: shared.getMetrics() });
  if (action === 'get_logs') return res.json({ ok: true, logs: shared.getLogs() });
  if (action === 'clear_logs') { shared.clearLogs(); return res.json({ ok: true }); }
  if (action === 'get_router_overview') return res.json({ ok: true, overview: shared.getRouterOverview(body) });
  if (action === 'get_router_details') return res.json({ ok: true, details: shared.getRouterDetails(body) });
  if (action === 'get_cloud_status') return res.json({ ok: true, cloudStorageInfo: shared.getCloudStorageInfo() });
  if (action === 'test_upstash') return res.json(await shared.testUpstash(body.url ?? cfg.upstashRedisUrl, body.token ?? cfg.upstashRedisToken));
  if (action === 'test_github') return res.json(await shared.testGitHub(body.token ?? cfg.githubToken, body.repo ?? cfg.githubRepo, body.branch ?? cfg.githubBranch));
  if (['detect_models', 'fetch_models', 'test_model'].includes(action)) {
    const endpoint = typeof body.endpoint === 'object' ? body.endpoint : {
      url: body.url || body.endpoint, keys: body.keys || [body.key].filter(Boolean), name: body.providerName || body.provider
    };
    if (action === 'test_model') return res.json(await shared.testSingleModel(endpoint, body.model));
    const result = await shared.fetchAvailableModels(endpoint);
    return res.json({ ...result, results: [{ provider: endpoint.name, ...result }] });
  }

  if (action === 'get_telegram_status') return res.json({ ok: true, status: await telegramStatus(cfg) });
  if (['test_telegram', 'test_telegram_token'].includes(action)) {
    const api = require('../services/telegram/api');
    const botToken = cfg.telegramBotToken;
    const result = await api.testToken(botToken);
    if (!result.ok) return res.status(400).json(result);
    let messageSent = false;
    if (body.chatId && /^\d+$/.test(String(body.chatId))) {
      await api.apiCall('sendMessage', { chat_id: body.chatId, text: `✅ Koneksi Bre AI berhasil. Bot: @${result.bot.username}` }, botToken);
      messageSent = true;
    }
    return res.json({ ...result, botUsername: result.bot.username, botName: result.bot.first_name, messageSent });
  }
  if (action === 'setup_webhook') {
    const url = validateUrl(body.url);
    if (url.protocol !== 'https:' || url.search || url.pathname !== '/api/telegram') throw httpError(400, 'Gunakan URL HTTPS /api/telegram tanpa query');
    const botToken = cfg.telegramBotToken;
    const api = require('../services/telegram/api');
    const result = await api.testToken(botToken);
    if (!result.ok) return res.status(400).json(result);
    const secret = cfg.telegramWebhookSecret || cfg.webhookSecret || crypto.randomBytes(32).toString('hex');
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw httpError(400, 'Secret webhook tidak valid');
    const saved = await shared.saveConfig({ telegramWebhookSecret: secret, telegramDomain: url.host, telegramEnabled: true });
    if (!saved.ok) throw httpError(503, saved.error);
    await api.apiCall('setWebhook', { url: url.href, secret_token: secret, allowed_updates: ['message', 'callback_query'] }, botToken);
    return res.json({ ok: true, bot: result.bot, botUsername: result.bot.username, botName: result.bot.first_name, status: await telegramStatus(shared.getConfig()) });
  }
  if (action === 'restart_bot' || action === 'stop_bot') {
    const enabled = action === 'restart_bot';
    const saved = await shared.saveConfig({ telegramEnabled: enabled });
    if (!saved.ok) throw httpError(503, saved.error);
    const bot = require('../services/telegramBot');
    if (enabled) return res.json(await bot.init());
    bot.stop();
    return res.json({ ok: true, message: 'Bot dihentikan' });
  }
  if (['get_motivation', 'preview_motivation', 'send_motivation_now'].includes(action)) {
    const motivation = require('../services/motivation');
    if (action === 'get_motivation') return res.json({ ok: true, enabled: cfg.motivationEnabled, times: cfg.motivationTimes, lastSent: motivation.getLastMotivation(), recipients: motivation.collectRecipients().length });
    const result = action === 'preview_motivation' ? await motivation.previewMotivation(body.customText) : await motivation.sendMotivationNow(body.customText);
    return res.json({ ok: true, ...result });
  }
  if (['save_full_config', 'save_admin_password', 'save_router', 'save_telegram', 'save_cloud'].includes(action)) {
    const updates = action === 'save_admin_password' ? { adminPassword: body.newPassword } : (body.config || body);
    const result = await shared.saveConfig(updates);
    if (!result.ok) throw httpError(400, result.error || 'Gagal menyimpan konfigurasi');
    return res.json({ ok: true, savedToCloud: result.savedToCloud, cloudType: result.cloudType, cloudError: result.cloudError,
      cloudStatus: result._cloudStatus, isReadOnlyFS: result._isReadOnlyFS, cloudStorageInfo: shared.getCloudStorageInfo() });
  }
  throw httpError(400, 'Action tidak dikenali');
}, ['GET', 'POST'], { admin: true });
