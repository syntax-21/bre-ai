const crypto = require('crypto');
const { validateUrl } = require('./safeFetch');

function cleanObject(value, depth = 0) {
  if (depth > 15) throw new Error('Konfigurasi terlalu dalam');
  if (Array.isArray(value)) return value.map(v => cleanObject(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Nama properti terlarang');
      out[key] = cleanObject(val, depth + 1);
    }
    return out;
  }
  return value;
}

function validateConfigUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Konfigurasi harus berupa objek');
  const update = cleanObject(input);
  for (const field of ['action', 'password', 'ok', 'isAdmin', 'telegramStatus', 'cloudStorageInfo', '_isReadOnlyFS', '_saveError', '_cloudStatus']) delete update[field];
  if (update.adminPassword === '••••••••') delete update.adminPassword;
  if (update.adminPassword !== undefined && (typeof update.adminPassword !== 'string' || update.adminPassword.trim().length < 12 || update.adminPassword.length > 256)) throw new Error('Password admin minimal 12 dan maksimal 256 karakter');
  const numbers = { temperature: [0, 2], topP: [0, 1], maxTokens: [1, 131072], frequencyPenalty: [-2, 2], presencePenalty: [-2, 2], rateLimitMax: [1, 100], rateLimitWindow: [1, 3600], chatRateLimitMax: [1, 1000], chatRateLimitWindow: [1, 3600], cacheTTL: [1, 86400], telegramMaxHistory: [4, 100] };
  for (const [key, [min, max]] of Object.entries(numbers)) {
    if (update[key] === undefined) continue;
    if (update[key] === '' || !Number.isFinite(Number(update[key])) || Number(update[key]) < min || Number(update[key]) > max) throw new Error(`${key} harus antara ${min} dan ${max}`);
    update[key] = Number(update[key]);
  }
  for (const key of ['autoFailover', 'cacheEnabled', 'requireAuth', 'streamEnabled', 'telegramEnabled', 'motivationEnabled', 'transcriptionEnabled']) {
    if (update[key] !== undefined && typeof update[key] !== 'boolean') throw new Error(`${key} harus boolean`);
  }
  for (const key of ['model', 'systemPrompt', 'defaultStyle', 'telegramStyle', 'telegramLanguage', 'telegramModel', 'telegramBotToken', 'telegramOwnerId', 'telegramAllowedUsers', 'telegramDomain', 'upstashRedisUrl', 'upstashRedisToken', 'githubToken', 'githubRepo', 'githubBranch', 'transcriptionEndpoint', 'transcriptionKey', 'transcriptionModel', 'transcriptionLanguage', 'motivationCustom', 'webhookSecret', 'telegramWebhookSecret']) {
    if (update[key] !== undefined && (typeof update[key] !== 'string' || update[key].length > (key === 'systemPrompt' ? 30000 : 10000))) throw new Error(`${key} harus berupa teks dengan panjang terbatas`);
  }
  for (const [key, values] of Object.entries({ routingStrategy: ['auto', 'priority', 'weighted'], providerRoutingMode: ['auto', 'priority', 'weighted'], cloudStorageType: ['auto', 'none', 'upstash', 'github'], telegramAccessMode: ['public', 'diizinkan', 'whitelist'] })) {
    if (update[key] !== undefined && !values.includes(update[key])) throw new Error(`${key} tidak valid`);
  }
  if (update.endpoints !== undefined) {
    if (!Array.isArray(update.endpoints) || update.endpoints.length > 30) throw new Error('Maksimal 30 endpoint');
    for (const ep of update.endpoints) {
      if (!ep || typeof ep !== 'object' || Array.isArray(ep)) throw new Error('Endpoint tidak valid');
      if (ep.url) validateUrl(ep.url);
      for (const key of ['name', 'url']) if (ep[key] !== undefined && (typeof ep[key] !== 'string' || /[\r\n\x00]/.test(ep[key]))) throw new Error(`${key} endpoint tidak valid`);
      if (ep.name?.length > 120) throw new Error('Nama endpoint terlalu panjang');
      for (const key of ['models', 'mapping', 'keys']) {
        if (ep[key] !== undefined && !Array.isArray(ep[key]) && typeof ep[key] !== 'string') throw new Error(`${key} endpoint tidak valid`);
        if (Array.isArray(ep[key]) && (ep[key].length > (key === 'keys' ? 30 : 500) || ep[key].some(v => typeof v !== 'string' || v.length > 2048 || /[\r\n\x00]/.test(v)))) throw new Error(`${key} endpoint tidak valid`);
      }
      if (Array.isArray(ep.models)) {
        ep.models = ep.models.filter(m => typeof m === 'string' && m.trim().toLowerCase() !== 'auto');
      }
      if (ep.weight !== undefined && (!Number.isFinite(Number(ep.weight)) || ep.weight < 1 || ep.weight > 100)) throw new Error('Bobot endpoint harus 1–100');
    }
  }
  if (update.clientKeys !== undefined && (!Array.isArray(update.clientKeys) || update.clientKeys.length > 100 || update.clientKeys.some(k => typeof k !== 'string' || k.length < 16 || k.length > 256))) throw new Error('Client keys harus array, panjang kunci minimal 16 karakter');
  if (update.blacklist !== undefined && (!Array.isArray(update.blacklist) || update.blacklist.length > 1000 || update.blacklist.some(k => typeof k !== 'string' || k.length > 200))) throw new Error('Blacklist tidak valid');
  if (update.telegramUsers !== undefined && (!Array.isArray(update.telegramUsers) || update.telegramUsers.length > 10000 || update.telegramUsers.some(u => !u || typeof u !== 'object' || !u.id || !['user', 'owner', 'diizinkan', 'whitelist', 'blocked'].includes(u.role || 'user')))) throw new Error('Daftar pengguna tidak valid');
  if (update.motivationTimes !== undefined && (!Array.isArray(update.motivationTimes) || update.motivationTimes.length > 6 || update.motivationTimes.some(t => typeof t !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))) throw new Error('Jadwal wajib HH:MM (00:00–23:59)');
  for (const field of ['upstashRedisUrl', 'transcriptionEndpoint', 'ttsEndpoint', 'imageEndpoint']) if (update[field]) validateUrl(update[field]);
  if (update.githubRepo && !/^[\w.-]+\/[\w.-]+$/.test(update.githubRepo)) throw new Error('GitHub repo wajib owner/repo');
  return update;
}

function encryptionKey() {
  const raw = process.env.CONFIG_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('GitHub sync membutuhkan CONFIG_ENCRYPTION_KEY (64 digit hex)');
  return Buffer.from(raw, 'hex');
}
function encryptConfig(config) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decryptConfig(envelope) {
  if (envelope?.version !== 1) throw new Error('Format konfigurasi terenkripsi tidak valid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return cleanObject(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8')));
}

function applyEnvironment(cfg) {
  const mapping = { ADMIN_PASSWORD: 'adminPassword', TELEGRAM_BOT_TOKEN: 'telegramBotToken', TELEGRAM_OWNER_ID: 'telegramOwnerId', TELEGRAM_ACCESS_MODE: 'telegramAccessMode', BRE_WEBHOOK_SECRET: 'telegramWebhookSecret', GITHUB_TOKEN: 'githubToken', GITHUB_REPO: 'githubRepo', GITHUB_BRANCH: 'githubBranch' };
  for (const [key, field] of Object.entries(mapping)) if (process.env[key]) cfg[field] = process.env[key].trim();
  if (process.env.TELEGRAM_BOT_TOKEN && cfg.telegramEnabled === undefined) cfg.telegramEnabled = true;
  if (process.env.BRE_REQUIRE_AUTH !== undefined) cfg.requireAuth = process.env.BRE_REQUIRE_AUTH !== 'false';
  if (process.env.BRE_CLIENT_KEYS) cfg.clientKeys = process.env.BRE_CLIENT_KEYS.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) cfg.upstashRedisUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL).trim();
  if (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN) cfg.upstashRedisToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN).trim();
  return cfg;
}

module.exports = { cleanObject, validateConfigUpdate, encryptConfig, decryptConfig, applyEnvironment };
