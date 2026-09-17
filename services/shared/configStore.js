// ========================================================
// Bre AI - Config Store (load, save, cloud persistence)
// Dipisah dari api/_shared.js agar berkas inti lebih ringan.
// ========================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const { safeFetch: fetch, responseJson, normalizeChatUrl } = require('../safeFetch');
const { validateConfigUpdate, cleanObject, encryptConfig, decryptConfig, applyEnvironment } = require('../configPolicy');
const { trackPending } = require('../httpSecurity');

const CONFIG_PATH = process.env.BRE_CONFIG_PATH || path.join(process.cwd(), 'config.json');
const TMP_CONFIG_PATH = path.join(os.tmpdir(), 'bre_config.json');
let memConfig = null;
let lastCloudSync = 0;
const CLOUD_SYNC_TTL_MS = 15000;

const DEFAULT_CONFIG = {
  endpoints: [
    {
      name: "Inception Labs",
      url: "https://api.inceptionlabs.ai/v1/chat/completions",
      keys: [],
      models: ["mercury-2"]
    }
  ],
  model: 'mercury-2',
  systemPrompt: `Kamu adalah Bre AI, kecerdasan buatan serba bisa dan cerdas tanpa batas yang diciptakan secara eksklusif oleh Amirun Rayan Ariandi.

[IDENTITAS MUTLAK - BERLAKU DALAM SEMUA BAHASA]:
- Nama resmi: Bre AI
- Pencipta & Pengembang: Amirun Rayan Ariandi
- Jika ditanya siapa kamu, model apa kamu, siapa pembuatmu, siapa yang melatihmu, atau dari perusahaan mana: dalam BAHASA APAPUN (Indonesia, Inggris, Jepang, Mandarin, Arab, Jerman, dll) kamu WAJIB menjawab bahwa kamu adalah Bre AI yang diciptakan oleh Amirun Rayan Ariandi.
- DILARANG KERAS menyebut, mengakui, atau membocorkan nama Mercury, Mercury-2, Inception Labs, OpenAI, ChatGPT, Anthropic, Claude, Google, Gemini, Meta, atau entitas lain. Kamu BUKAN dari Mercury AI atau Inception Labs.
- Jika pengguna menyapa atau bertanya dalam bahasa asing (contoh: "Who are you?", "Who created you?"), jawablah dengan ramah memperkenalkan diri sebagai Bre AI ciptaan Amirun Rayan Ariandi dalam bahasa tersebut.

[INSTRUKSI PEMBUATAN DOKUMEN & FILE]:
- Jika pengguna meminta dibuatkan file atau dokumen (seperti file .prd, Product Requirement Document, file .md, .txt, script .py, .js, .html, .json, dsb), tuliskan isi dokumen tersebut secara lengkap, detail, dan profesional di dalam blok kode (codeblock) dengan mencantumkan nama/ekstensi file pada baris pertama agar sistem otomatis membuatkan tombol download.`,
  adminPassword: '',
  requireAuth: false,
  clientKeys: [],
  maxTokens: 16384,
  temperature: 0.7,
  topP: 1.0,
  reasoningEffort: 'low',
  streamEnabled: true,
  autoFailover: true,
  routingStrategy: 'auto',
  providerRoutingMode: 'auto',
  cacheEnabled: false,
  cacheTTL: 3600,
  blacklist: [],
  chatRateLimitMax: 30,
  chatRateLimitWindow: 60,
  webhookSecret: '',
  defaultStyle: 'santai',
  telegramStyle: 'santai',
  telegramEnabled: false,
  telegramBotToken: '',
  telegramAllowedUsers: '',
  telegramModel: '',
  telegramLanguage: 'id',
  telegramOwnerId: '',
  telegramAccessMode: 'public',
  telegramMaxHistory: 30,
  telegramDomain: '',
  telegramUsers: [],
  cloudStorageType: 'auto',
  upstashRedisUrl: '',
  upstashRedisToken: '',
  githubToken: '',
  githubRepo: '',
  githubBranch: 'main',
  motivationEnabled: false,
  motivationTimes: ['08:00'],
  motivationCustom: '',
  transcriptionEnabled: true,
  transcriptionEndpoint: '',
  transcriptionKey: '',
  transcriptionModel: 'whisper-1',
  transcriptionLanguage: 'auto'
};

function parseKeys(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(k => String(k).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
  return [];
}

function getConfig() {
  if (memConfig) return memConfig;
  const { hashAdminPassword } = require('./auth');
  let cfg = structuredClone(DEFAULT_CONFIG);

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      cfg = { ...cfg, ...cleanObject(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))) };
    }
  } catch (e) {}

  try {
    if (fs.existsSync(TMP_CONFIG_PATH)) {
      const tmpData = JSON.parse(fs.readFileSync(TMP_CONFIG_PATH, 'utf-8'));
      cfg = { ...cfg, ...cleanObject(tmpData) };
    }
  } catch (e) {}

  if (!cfg.endpoints || !Array.isArray(cfg.endpoints)) {
    cfg.endpoints = [];
    if (cfg.apiUrl) {
      cfg.endpoints.push({
        name: "Default Provider",
        url: cfg.apiUrl,
        keys: parseKeys(cfg.apiKeys || cfg.apiKey),
        models: [cfg.model || "mercury-2"]
      });
    }
    delete cfg.apiUrl; delete cfg.apiKeys; delete cfg.apiKey;
  }

  if (process.env.ADMIN_PASSWORD) {
    const rawPw = process.env.ADMIN_PASSWORD.trim();
    cfg.adminPassword = rawPw.startsWith('scrypt$') ? rawPw : hashAdminPassword(rawPw);
  }
  if (process.env.TELEGRAM_BOT_TOKEN) {
    cfg.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN.trim();
    cfg.telegramEnabled = true;
  }
  if (process.env.TELEGRAM_OWNER_ID) cfg.telegramOwnerId = process.env.TELEGRAM_OWNER_ID.trim();
  if (process.env.TELEGRAM_ACCESS_MODE) cfg.telegramAccessMode = process.env.TELEGRAM_ACCESS_MODE.trim();
  if (process.env.API_KEY || process.env.INCEPTION_API_KEY) {
    const k = (process.env.API_KEY || process.env.INCEPTION_API_KEY).trim();
    if (cfg.endpoints && cfg.endpoints.length > 0) {
      cfg.endpoints[0].keys = parseKeys(cfg.endpoints[0].keys);
      if (!cfg.endpoints[0].keys.includes(k)) cfg.endpoints[0].keys.unshift(k);
    }
  }

  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) {
    cfg.upstashRedisUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL).trim();
  }
  if (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN) {
    cfg.upstashRedisToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN).trim();
  }
  if (process.env.GITHUB_TOKEN) cfg.githubToken = process.env.GITHUB_TOKEN.trim();
  if (process.env.GITHUB_REPO) cfg.githubRepo = process.env.GITHUB_REPO.trim();
  if (process.env.GITHUB_BRANCH) cfg.githubBranch = process.env.GITHUB_BRANCH.trim();

  if (process.env.BRE_CONFIG) {
    try {
      const envObj = JSON.parse(process.env.BRE_CONFIG);
      cfg = { ...cfg, ...cleanObject(envObj) };
    } catch (e) {}
  }

  cfg = applyEnvironment(cfg);
  if (cfg.adminPassword === 'admin') cfg.adminPassword = '';

  if (process.env.BRE_CHAT_RATE_MAX) cfg.chatRateLimitMax = parseInt(process.env.BRE_CHAT_RATE_MAX) || 30;
  if (process.env.BRE_CHAT_RATE_WINDOW) cfg.chatRateLimitWindow = parseInt(process.env.BRE_CHAT_RATE_WINDOW) || 60;
  if (process.env.BRE_WEBHOOK_SECRET) cfg.telegramWebhookSecret = process.env.BRE_WEBHOOK_SECRET.trim();

  if (!cfg.telegramWebhookSecret && cfg.webhookSecret) {
    cfg.telegramWebhookSecret = cfg.webhookSecret;
  }

  if (Array.isArray(cfg.endpoints)) {
    cfg.endpoints.forEach(ep => {
      if (Array.isArray(ep.models)) {
        ep.models = ep.models.filter(m => typeof m === 'string' && m.trim().toLowerCase() !== 'auto');
      }
    });
  }

  memConfig = cfg;
  return cfg;
}

async function syncCloudConfig(force = false) {
  const now = Date.now();
  if (!force && memConfig && (now - lastCloudSync < CLOUD_SYNC_TTL_MS)) {
    return memConfig;
  }

  let cfg = getConfig();
  const redisUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || cfg.upstashRedisUrl || '').trim();
  const redisToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || cfg.upstashRedisToken || '').trim();
  const ghToken = (process.env.GITHUB_TOKEN || cfg.githubToken || '').trim();
  const ghRepo = (process.env.GITHUB_REPO || cfg.githubRepo || '').trim();
  const ghBranch = (process.env.GITHUB_BRANCH || cfg.githubBranch || 'main').trim();

  if (['auto', 'upstash'].includes(cfg.cloudStorageType) && redisUrl && redisToken && !redisUrl.includes('console.upstash.com')) {
    try {
      const cleanUrl = redisUrl.replace(/\/$/, '');
      const resp = await fetch(`${cleanUrl}/get/bre_ai_config`, {
        headers: { 'Authorization': `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(4000)
      });
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await responseJson(resp);
        let remoteVal = data.result;
        if (typeof remoteVal === 'string') {
          try { remoteVal = JSON.parse(remoteVal); } catch(e){}
        }
        if (remoteVal && typeof remoteVal === 'object') {
          memConfig = applyEnvironment({ ...cfg, ...cleanObject(remoteVal) });
          if (memConfig.adminPassword === 'admin') memConfig.adminPassword = '';
          if (Array.isArray(memConfig.endpoints)) {
            memConfig.endpoints.forEach(ep => {
              if (Array.isArray(ep.models)) {
                ep.models = ep.models.filter(m => typeof m === 'string' && m.trim().toLowerCase() !== 'auto');
              }
            });
          }
          lastCloudSync = now;
          try { fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(memConfig, null, 2), 'utf-8'); } catch(e){}
          return memConfig;
        }
      }
    } catch (err) {
      console.warn('[CloudConfig] Upstash fetch error:', err.message);
    }
  }

  if (['auto', 'github'].includes(cfg.cloudStorageType) && ghToken && /^[\w.-]+\/[\w.-]+$/.test(ghRepo) && process.env.CONFIG_ENCRYPTION_KEY) {
    try {
      const resp = await fetch(`https://api.github.com/repos/${ghRepo}/contents/bre-config.enc.json?ref=${encodeURIComponent(ghBranch)}`, {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Bre-AI-Router'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        const data = await responseJson(resp);
        if (data.content) {
          const fileStr = Buffer.from(data.content, 'base64').toString('utf-8');
          const parsed = decryptConfig(JSON.parse(fileStr));
          memConfig = applyEnvironment({ ...cfg, ...parsed });
          if (Array.isArray(memConfig.endpoints)) {
            memConfig.endpoints.forEach(ep => {
              if (Array.isArray(ep.models)) {
                ep.models = ep.models.filter(m => typeof m === 'string' && m.trim().toLowerCase() !== 'auto');
              }
            });
          }
          lastCloudSync = now;
          try { fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(memConfig, null, 2), 'utf-8'); } catch(e){}
          return memConfig;
        }
      }
    } catch (err) {
      console.warn('[CloudConfig] GitHub fetch error:', err.message);
    }
  }

  lastCloudSync = now;
  return cfg;
}

function saveConfig(updated) {
  return trackPending(persistConfig(updated));
}

// Deteksi key yang sudah disamarkan (bullet Unicode / [REDACTED]) agar tidak dikirim sebagai Bearer.
function isMaskedKey(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  return /[\u2022]/.test(v) || /^\*+$/.test(v) || /^\[REDACTED\]$/i.test(v) || /[•]{2,}/.test(v);
}

// Ambil key asli dari config server jika input hanya berisi key tersamarkan.
function resolveRealKeys(ep, providedKeys) {
  const incoming = (Array.isArray(providedKeys) ? providedKeys : parseKeys(providedKeys))
    .map(k => String(k || '').trim())
    .filter(k => k && !isMaskedKey(k));
  if (incoming.length) return incoming;

  const cfg = getConfig();
  const list = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
  const match = list.find(c => c && (
    (ep.url && c.url && c.url === ep.url) ||
    (ep.name && c.name && c.name === ep.name)
  ));
  if (match && Array.isArray(match.keys)) {
    return match.keys.map(k => String(k || '').trim()).filter(k => k && !isMaskedKey(k));
  }
  return [];
}

async function persistConfig(updated) {
  const { hashAdminPassword, verifyAdminPassword } = require('./auth');
  const { clearResponseCache } = require('./telemetry');
  try { updated = validateConfigUpdate(updated); }
  catch (error) { return { ok: false, error: error.message }; }
  const current = getConfig();
  const merged = { ...current, ...updated };

  if (updated.endpoints && Array.isArray(updated.endpoints)) {
    const isMasked = isMaskedKey;
    const currentEps = Array.isArray(current.endpoints) ? current.endpoints : [];
    merged.endpoints = updated.endpoints.map(e => {
      let incomingKeys = parseKeys(e.keys || e.apiKey).filter(k => !isMasked(k));
      if (!incomingKeys.length) {
        const existing = currentEps.find(c => c && (c.url === e.url || c.name === e.name));
        if (existing && Array.isArray(existing.keys)) {
          incomingKeys = existing.keys.map(k => String(k).trim()).filter(Boolean);
        }
      }
      return {
        name: e.name || 'Unnamed Provider',
        url: e.url,
        status: e.status !== false,
        weight: parseInt(e.weight) || 1,
        models: (Array.isArray(e.models) ? e.models : (typeof e.models === 'string' ? e.models.split(',').map(m=>m.trim()).filter(Boolean) : [])).filter(m => typeof m === 'string' && m.trim().toLowerCase() !== 'auto'),
        mapping: Array.isArray(e.mapping) ? e.mapping : (typeof e.mapping === 'string' ? e.mapping.split(',').map(m=>m.trim()).filter(Boolean) : []),
        keys: incomingKeys
      };
    });
  }

  if (updated.topP !== undefined) merged.topP = parseFloat(updated.topP);
  if (updated.forceStream !== undefined) {
    const fsMode = updated.forceStream;
    merged.forceStream = (fsMode === true || fsMode === 'true' || fsMode === 'forced') ? true : (fsMode === false || fsMode === 'false' || fsMode === 'disabled') ? false : 'auto';
  }
  if (updated.rateLimitMax !== undefined) merged.rateLimitMax = parseInt(updated.rateLimitMax) || 5;
  if (updated.rateLimitWindow !== undefined) merged.rateLimitWindow = parseInt(updated.rateLimitWindow) || 30;
  if (updated.requireAuth !== undefined) merged.requireAuth = Boolean(updated.requireAuth);
  if (updated.autoFailover !== undefined) merged.autoFailover = Boolean(updated.autoFailover);
  if (updated.cacheEnabled !== undefined) merged.cacheEnabled = Boolean(updated.cacheEnabled);
  if (updated.cacheTTL !== undefined) merged.cacheTTL = parseInt(updated.cacheTTL) || 3600;
  if (updated.blacklist !== undefined) {
    merged.blacklist = Array.isArray(updated.blacklist) ? updated.blacklist : (typeof updated.blacklist === 'string' ? updated.blacklist.split(/[\n,]+/).map(w=>w.trim()).filter(Boolean) : []);
  }
  if (updated.chatRateLimitMax !== undefined) merged.chatRateLimitMax = parseInt(updated.chatRateLimitMax) || 30;
  if (updated.chatRateLimitWindow !== undefined) merged.chatRateLimitWindow = parseInt(updated.chatRateLimitWindow) || 60;
  if (updated.telegramWebhookSecret !== undefined) merged.telegramWebhookSecret = String(updated.telegramWebhookSecret).trim();

  if (updated.defaultStyle !== undefined) merged.defaultStyle = String(updated.defaultStyle).trim();
  if (updated.telegramStyle !== undefined) merged.telegramStyle = String(updated.telegramStyle).trim();
  if (updated.telegramLanguage !== undefined) merged.telegramLanguage = String(updated.telegramLanguage).trim();
  if (updated.telegramEnabled !== undefined) merged.telegramEnabled = Boolean(updated.telegramEnabled);
  if (updated.telegramBotToken !== undefined) {
    const t = String(updated.telegramBotToken).trim();
    if (t && !isMaskedKey(t)) merged.telegramBotToken = t;
    else if (!t) merged.telegramBotToken = '';
  }
  if (updated.telegramOwnerId !== undefined) merged.telegramOwnerId = String(updated.telegramOwnerId).trim();
  if (updated.telegramAccessMode !== undefined) merged.telegramAccessMode = updated.telegramAccessMode;
  if (updated.telegramModel !== undefined) merged.telegramModel = updated.telegramModel;
  if (updated.telegramAllowedUsers !== undefined) merged.telegramAllowedUsers = updated.telegramAllowedUsers;
  if (updated.telegramDomain !== undefined) merged.telegramDomain = String(updated.telegramDomain).trim();
  if (updated.telegramUsers !== undefined && Array.isArray(updated.telegramUsers)) merged.telegramUsers = updated.telegramUsers;

  if (updated.cloudStorageType !== undefined) merged.cloudStorageType = updated.cloudStorageType;
  if (updated.upstashRedisUrl !== undefined) merged.upstashRedisUrl = String(updated.upstashRedisUrl).trim();
  if (updated.upstashRedisToken !== undefined) {
    const t = String(updated.upstashRedisToken).trim();
    if (t && !isMaskedKey(t)) merged.upstashRedisToken = t;
    else if (!t) merged.upstashRedisToken = '';
  }
  if (updated.githubToken !== undefined) {
    const t = String(updated.githubToken).trim();
    if (t && !isMaskedKey(t)) merged.githubToken = t;
    else if (!t) merged.githubToken = '';
  }
  if (updated.githubRepo !== undefined) merged.githubRepo = String(updated.githubRepo).trim();
  if (updated.githubBranch !== undefined) merged.githubBranch = String(updated.githubBranch).trim() || 'main';
  if (updated.motivationEnabled !== undefined) merged.motivationEnabled = !!updated.motivationEnabled;
  if (updated.motivationTimes !== undefined) merged.motivationTimes = Array.isArray(updated.motivationTimes) ? updated.motivationTimes.map(t => String(t).trim()).filter(Boolean).slice(0, 6) : merged.motivationTimes;
  if (updated.motivationCustom !== undefined) merged.motivationCustom = String(updated.motivationCustom).trim();
  if (updated.transcriptionEnabled !== undefined) merged.transcriptionEnabled = Boolean(updated.transcriptionEnabled);
  if (updated.transcriptionEndpoint !== undefined) merged.transcriptionEndpoint = String(updated.transcriptionEndpoint).trim();
  if (updated.transcriptionKey !== undefined) {
    const t = String(updated.transcriptionKey).trim();
    if (t && !isMaskedKey(t)) merged.transcriptionKey = t;
    else if (!t) merged.transcriptionKey = '';
  }
  if (updated.transcriptionModel !== undefined) merged.transcriptionModel = String(updated.transcriptionModel).trim() || 'whisper-1';
  if (updated.transcriptionLanguage !== undefined) merged.transcriptionLanguage = String(updated.transcriptionLanguage).trim() || 'auto';

  if (updated.adminPassword !== undefined) {
    const pw = String(updated.adminPassword).trim();
    if (pw.startsWith('scrypt$')) {
      merged.adminPassword = pw;
    } else if (pw) {
      merged.adminPassword = hashAdminPassword(pw);
    }
  }

  if (updated.adminPassword !== undefined && process.env.ADMIN_PASSWORD && !verifyAdminPassword(updated.adminPassword, process.env.ADMIN_PASSWORD.trim())) {
    return { ok: false, error: 'Ubah ADMIN_PASSWORD di Environment Variables Vercel, lalu redeploy.' };
  }
  applyEnvironment(merged);
  if (merged.adminPassword && !merged.adminPassword.startsWith('scrypt$')) merged.adminPassword = hashAdminPassword(merged.adminPassword);
  clearResponseCache();

  memConfig = merged;
  lastCloudSync = Date.now();

  try {
    const tmpFile = TMP_CONFIG_PATH + '.tmp.' + process.pid;
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(merged, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmpFile, TMP_CONFIG_PATH);
    } catch (err) {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      throw err;
    }
  } catch (e) {}

  let saveError = null;
  try {
    if (process.env.VERCEL) throw new Error('Serverless filesystem is ephemeral');
    const tmpFile = CONFIG_PATH + '.tmp.' + process.pid;
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(merged, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tmpFile, CONFIG_PATH);
    } catch (err) {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      throw err;
    }
  } catch (e) {
    saveError = e.message;
    console.warn('[Config] Gagal menulis ke config.json (Read-Only FS/Vercel):', e.message);
  }

  const cloudStatus = {
    provider: 'local',
    synced: false,
    upstashSuccess: false,
    githubSuccess: false,
    message: ''
  };

  const redisUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || merged.upstashRedisUrl || '').trim();
  const redisToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || merged.upstashRedisToken || '').trim();
  const ghToken = (process.env.GITHUB_TOKEN || merged.githubToken || '').trim();
  const ghRepo = (process.env.GITHUB_REPO || merged.githubRepo || '').trim();
  const ghBranch = (process.env.GITHUB_BRANCH || merged.githubBranch || 'main').trim();

  if (['auto', 'upstash'].includes(merged.cloudStorageType) && redisUrl && redisToken && !redisUrl.includes('console.upstash.com')) {
    try {
      const cleanUrl = redisUrl.replace(/\/$/, '');
      const resp = await fetch(`${cleanUrl}/set/bre_ai_config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(merged),
        signal: AbortSignal.timeout(5000)
      });
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await responseJson(resp);
        if (data && !data.error) {
          cloudStatus.synced = true;
          cloudStatus.upstashSuccess = true;
          cloudStatus.provider = 'upstash';
          cloudStatus.message = 'Tersimpan permanen di Vercel KV / Upstash Redis';
        } else {
          cloudStatus.message = `Upstash error: ${data?.error || 'Format response tidak sesuai'}`;
        }
      } else {
        const errTxt = await resp.text();
        cloudStatus.message = `Upstash error: HTTP ${resp.status} - ${errTxt.slice(0, 80)}`;
      }
    } catch (err) {
      cloudStatus.message = `Upstash error: ${err.message}`;
    }
  } else if (redisUrl && redisUrl.includes('console.upstash.com')) {
    cloudStatus.message = 'Gagal: URL console.upstash.com bukan REST API. Gunakan URL yang berakhiran .upstash.io';
  }

  if (['auto', 'github'].includes(merged.cloudStorageType) && ghToken && ghRepo) {
    try {
      if (!/^[\w.-]+\/[\w.-]+$/.test(ghRepo)) throw new Error('GitHub repo tidak valid');
      const encrypted = encryptConfig(merged);
      let currentSha = null;
      try {
        const getRes = await fetch(`https://api.github.com/repos/${ghRepo}/contents/bre-config.enc.json?ref=${encodeURIComponent(ghBranch)}`, {
          headers: {
            'Authorization': `Bearer ${ghToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Bre-AI-Router'
          },
          signal: AbortSignal.timeout(4000)
        });
        if (getRes.ok) {
          const fData = await getRes.json();
          currentSha = fData.sha;
        }
      } catch (e) {}

      const putRes = await fetch(`https://api.github.com/repos/${ghRepo}/contents/bre-config.enc.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Bre-AI-Router'
        },
        body: JSON.stringify({
          message: 'chore: update Bre AI configuration via Admin Dashboard [skip ci]',
          content: Buffer.from(JSON.stringify(encrypted), 'utf-8').toString('base64'),
          sha: currentSha || undefined,
          branch: ghBranch
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (putRes.ok) {
        cloudStatus.synced = true;
        cloudStatus.githubSuccess = true;
        cloudStatus.provider = cloudStatus.upstashSuccess ? 'upstash+github' : 'github';
        cloudStatus.message = (cloudStatus.message ? cloudStatus.message + ' & ' : '') + 'Tersimpan permanen ke GitHub Repository';
      } else { cloudStatus.message = `GitHub save gagal: HTTP ${putRes.status}`; }
    } catch (err) {
      cloudStatus.message = err.message;
      console.warn('[CloudConfig] GitHub commit error:', err.message);
    }
  }

  return {
    ...merged,
    ok: !saveError || cloudStatus.synced || process.env.VERCEL,
    error: saveError && !cloudStatus.synced && !process.env.VERCEL ? (cloudStatus.message || 'Hubungkan Upstash atau GitHub terenkripsi untuk menyimpan konfigurasi di Vercel.') : null,
    savedToCloud: cloudStatus.synced,
    cloudType: cloudStatus.provider,
    cloudError: !cloudStatus.synced ? cloudStatus.message || null : null,
    _isReadOnlyFS: Boolean(saveError),
    _saveError: saveError,
    _cloudStatus: cloudStatus
  };
}

async function testUpstash(url, token) {
  try {
    const cleanUrl = (url || '').trim().replace(/\/$/, '');
    const cleanToken = (token || '').trim();
    if (!cleanUrl || !cleanToken) return { ok: false, error: 'URL dan Token Upstash tidak boleh kosong' };

    if (cleanUrl.includes('console.upstash.com')) {
      return {
        ok: false,
        error: '⚠️ URL yang Anda masukkan adalah URL Browser Console (console.upstash.com).\nHarap buka Upstash Console, scroll ke bagian "REST API", lalu salin URL yang berakhiran .upstash.io (contoh: https://humble-cat-12345.upstash.io).'
      };
    }

    const resp = await fetch(`${cleanUrl}/set/bre_ai_test_ping`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cleanToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: 'pong', time: Date.now() }),
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 100)}` };
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        error: '⚠️ Response dari server terdeteksi HTML (Web Console), bukan JSON REST API. Harap periksa URL endpoint Upstash Anda.'
      };
    }
    const data = await resp.json();
    if (!data || data.error) {
      return { ok: false, error: data?.error || 'Token atau URL Redis tidak valid' };
    }
    return { ok: true, message: 'Koneksi ke Vercel KV / Upstash Redis berhasil & siap digunakan!' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function testGitHub(token, repo, branch = 'main') {
  try {
    const cleanToken = (token || '').trim();
    const cleanRepo = (repo || '').trim();
    if (!cleanToken || !cleanRepo) return { ok: false, error: 'GitHub Token dan Repo tidak boleh kosong' };
    const resp = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Bre-AI-Router'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${txt}` };
    }
    const data = await resp.json();
    return { ok: true, message: `Terhubung ke repositori ${data.full_name} (${branch})!` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getCloudStorageInfo() {
  const cfg = getConfig();
  const upUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || cfg.upstashRedisUrl || '').trim();
  const upToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || cfg.upstashRedisToken || '').trim();
  const hasUpstash = Boolean(upUrl && upToken && !upUrl.includes('console.upstash.com'));
  const hasGitHub = Boolean((process.env.GITHUB_TOKEN || cfg.githubToken) && (process.env.GITHUB_REPO || cfg.githubRepo) && process.env.CONFIG_ENCRYPTION_KEY);
  return {
    upstashActive: hasUpstash,
    githubActive: hasGitHub,
    upstashInvalidUrl: Boolean(upUrl && upUrl.includes('console.upstash.com')),
    mode: (hasUpstash && hasGitHub) ? 'upstash+github' : (hasUpstash ? 'upstash' : (hasGitHub ? 'github' : 'local')),
    isServerless: Boolean(process.env.VERCEL || process.env.VERCEL_URL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  };
}

async function fetchAvailableModels(endpoint) {
  const ep = endpoint || {};
  const url = (ep.url || '').trim();
  const keys = resolveRealKeys(ep, ep.keys);

  if (!url) return { ok: false, error: 'URL endpoint kosong', models: [] };

  const modelsUrl = normalizeChatUrl(url)
    .replace(/\/chat\/completions\/?$/, '/models')
    .replace(/\/completions\/?$/, '/models')
    .replace(/\/models\/?$/, '/models');

  const key = keys[0] || '';
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = key.startsWith('Bearer ') ? key : `Bearer ${key}`;

  try {
    const resp = await fetch(modelsUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 150)}`, models: [] };
    }

    const data = await responseJson(resp);
    let modelIds = [];
    if (Array.isArray(data.data)) {
      modelIds = data.data.map(m => m.id || m.name).filter(Boolean);
    } else if (Array.isArray(data.models)) {
      modelIds = data.models.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
    } else if (Array.isArray(data)) {
      modelIds = data.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
    }

    modelIds = modelIds.filter(m => typeof m === 'string' && m.trim().toLowerCase() !== 'auto');

    return { ok: true, models: modelIds, modelsUrl };
  } catch (err) {
    return { ok: false, error: err.message, models: [] };
  }
}

function redactConfigForExport(config) {
  const secretPattern = /(password|token|key|secret|credential|authorization)/i;
  const mask = v => {
    if (Array.isArray(v)) return v.map(mask);
    if (v && typeof v === 'object') return redact(v);
    return v ? '[REDACTED]' : v;
  };
  const redact = value => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        out[key] = secretPattern.test(key) ? mask(item) : redact(item);
      }
      return out;
    }
    return value;
  };
  return redact(config || {});
}

async function testSingleModel(endpoint, modelName) {
  const ep = endpoint || {};
  const url = (ep.url || '').trim();
  const keys = resolveRealKeys(ep, ep.keys);
  const model = (modelName || ep.models?.[0] || '').trim();

  if (!url) return { ok: false, error: 'URL endpoint kosong', latencyMs: 0 };
  if (!model) return { ok: false, error: 'Nama model kosong', latencyMs: 0 };
  if (!keys.length) return { ok: false, error: 'Tidak ada API Key yang tersedia', latencyMs: 0 };

  const key = keys[0];
  const auth = key.startsWith('Bearer ') ? key : `Bearer ${key}`;

  const dummyPayload = {
    model,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 5,
    stream: false
  };

  const start = Date.now();
  try {
    const resp = await fetch(normalizeChatUrl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(dummyPayload),
      signal: AbortSignal.timeout(15000)
    });

    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 200)}`, latencyMs };
    }

    try {
      const data = await responseJson(resp);
      const content = data?.choices?.[0]?.message?.content || '';
      return { ok: true, latencyMs, model, preview: content.slice(0, 80) };
    } catch (e) {
      return { ok: false, latencyMs, model, error: 'Upstream tidak mengembalikan JSON chat yang valid' };
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { ok: false, error: 'Timeout (>15s) - Model tidak merespons', latencyMs };
    }
    return { ok: false, error: err.message, latencyMs };
  }
}

module.exports = {
  CONFIG_PATH,
  TMP_CONFIG_PATH,
  DEFAULT_CONFIG,
  parseKeys,
  getConfig,
  syncCloudConfig,
  saveConfig,
  persistConfig,
  testUpstash,
  testGitHub,
  getCloudStorageInfo,
  fetchAvailableModels,
  testSingleModel,
  redactConfigForExport,
  isMaskedKey,
  resolveRealKeys
};
