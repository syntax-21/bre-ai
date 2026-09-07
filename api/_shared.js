const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');
let memConfig = null;
const loginAttempts = new Map();

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
  adminPassword: 'admin',
  maxTokens: 16384,
  temperature: 0.7,
  topP: 1.0,
  reasoningEffort: 'low',
  streamEnabled: true,
  autoFailover: true,
  cacheEnabled: false,
  cacheTTL: 3600,
  blacklist: [],
  clientKeys: [],
  telegramEnabled: false,
  telegramBotToken: '',
  telegramAllowedUsers: '',
  telegramModel: '',
  telegramOwnerId: '',
  telegramAccessMode: 'public',
  telegramUsers: []
};

// ========================================================
// IN-MEMORY METRICS, LOGGING & CACHING SYSTEMS
// ========================================================
const MAX_LOGS = 150;
const requestLogs = [];
const metricsStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokens: 0,
  totalLatencyMs: 0,
  providerHits: {},
  modelHits: {}
};
const responseCache = new Map();

function logRequest(entry) {
  const logItem = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    timeStr: new Date().toLocaleTimeString('id-ID'),
    ip: entry.ip || '127.0.0.1',
    provider: entry.provider || 'Default',
    model: entry.model || 'mercury-2',
    status: entry.status || 200,
    latencyMs: entry.latencyMs || 0,
    tokens: entry.tokens || 0,
    failover: !!entry.failover,
    cached: !!entry.cached,
    error: entry.error || null
  };

  requestLogs.unshift(logItem);
  if (requestLogs.length > MAX_LOGS) requestLogs.pop();

  // Update metrics
  metricsStats.totalRequests++;
  if (logItem.status >= 200 && logItem.status < 400) {
    metricsStats.successfulRequests++;
  } else {
    metricsStats.failedRequests++;
  }
  metricsStats.totalTokens += (logItem.tokens || 0);
  metricsStats.totalLatencyMs += (logItem.latencyMs || 0);

  const prov = logItem.provider;
  metricsStats.providerHits[prov] = (metricsStats.providerHits[prov] || 0) + 1;

  const mod = logItem.model;
  metricsStats.modelHits[mod] = (metricsStats.modelHits[mod] || 0) + 1;
}

function getLogs() {
  return requestLogs;
}

function clearLogs() {
  requestLogs.length = 0;
}

function getMetrics() {
  const avgLatency = metricsStats.totalRequests > 0
    ? Math.round(metricsStats.totalLatencyMs / metricsStats.totalRequests)
    : 0;
  const errorRate = metricsStats.totalRequests > 0
    ? ((metricsStats.failedRequests / metricsStats.totalRequests) * 100).toFixed(1)
    : '0.0';

  return {
    totalRequests: metricsStats.totalRequests,
    successfulRequests: metricsStats.successfulRequests,
    failedRequests: metricsStats.failedRequests,
    errorRate: errorRate + '%',
    totalTokens: metricsStats.totalTokens,
    avgLatencyMs: avgLatency,
    providerHits: metricsStats.providerHits,
    modelHits: metricsStats.modelHits,
    cacheSize: responseCache.size
  };
}

function checkBlacklist(text, blacklist) {
  if (!text || typeof text !== 'string') return null;
  const list = Array.isArray(blacklist) ? blacklist : [];
  const lower = text.toLowerCase();
  for (const word of list) {
    const clean = (word || '').trim().toLowerCase();
    if (clean && lower.includes(clean)) {
      return clean;
    }
  }
  return null;
}

function getCachedResponse(key) {
  const item = responseCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedResponse(key, data, ttlSeconds = 3600) {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

function clearResponseCache() {
  responseCache.clear();
}

function validateClientKey(authHeader, cfg) {
  if (!authHeader) return { valid: false };
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) return { valid: false };
  
  if (token === cfg.adminPassword) return { valid: true, name: 'Admin Master' };
  
  if (Array.isArray(cfg.clientKeys)) {
    const found = cfg.clientKeys.find(k => k.key === token);
    if (found) {
      if (found.active === false) return { valid: false, error: 'API Key dinonaktifkan (Revoked)' };
      return { valid: true, name: found.name || 'Client Key' };
    }
  }
  
  return { valid: false, error: 'API Key tidak valid' };
}

function parseKeys(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(k => String(k).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
  return [];
}

function getConfig() {
  if (memConfig) return memConfig;
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
    }
  } catch (e) {}

  // MIGRATION: Convert old config format (apiUrl, apiKeys) to endpoints array
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
  
  // Environment Overrides (For Vercel / Cloud deployments)
  if (process.env.ADMIN_PASSWORD) cfg.adminPassword = process.env.ADMIN_PASSWORD.trim();
  if (process.env.TELEGRAM_BOT_TOKEN) {
    cfg.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN.trim();
    cfg.telegramEnabled = true;
  }
  if (process.env.TELEGRAM_OWNER_ID) {
    cfg.telegramOwnerId = process.env.TELEGRAM_OWNER_ID.trim();
  }
  if (process.env.API_KEY || process.env.INCEPTION_API_KEY) {
    const k = (process.env.API_KEY || process.env.INCEPTION_API_KEY).trim();
    if (cfg.endpoints && cfg.endpoints.length > 0) {
      if (!cfg.endpoints[0].keys.includes(k)) {
        cfg.endpoints[0].keys.unshift(k);
      }
    }
  }
  if (process.env.BRE_CONFIG) {
    try {
      const envObj = JSON.parse(process.env.BRE_CONFIG);
      cfg = { ...cfg, ...envObj };
    } catch (e) {}
  }

  memConfig = cfg;
  return cfg;
}

function saveConfig(updated) {
  const merged = { ...getConfig(), ...updated };
  
  if (updated.endpoints && Array.isArray(updated.endpoints)) {
    merged.endpoints = updated.endpoints.map(e => ({
      name: e.name || 'Unnamed Provider',
      url: e.url,
      status: e.status !== false,
      weight: parseInt(e.weight) || 1,
      models: Array.isArray(e.models) ? e.models : (typeof e.models === 'string' ? e.models.split(',').map(m=>m.trim()).filter(Boolean) : []),
      mapping: Array.isArray(e.mapping) ? e.mapping : (typeof e.mapping === 'string' ? e.mapping.split(',').map(m=>m.trim()).filter(Boolean) : []),
      keys: parseKeys(e.keys)
    }));
  }
  
  if (updated.topP !== undefined) merged.topP = parseFloat(updated.topP);
  if (updated.forceStream !== undefined) merged.forceStream = updated.forceStream;
  if (updated.rateLimitMax !== undefined) merged.rateLimitMax = parseInt(updated.rateLimitMax) || 5;
  if (updated.rateLimitWindow !== undefined) merged.rateLimitWindow = parseInt(updated.rateLimitWindow) || 30;
  if (updated.autoFailover !== undefined) merged.autoFailover = Boolean(updated.autoFailover);
  if (updated.cacheEnabled !== undefined) merged.cacheEnabled = Boolean(updated.cacheEnabled);
  if (updated.cacheTTL !== undefined) merged.cacheTTL = parseInt(updated.cacheTTL) || 3600;
  if (updated.blacklist !== undefined) {
    merged.blacklist = Array.isArray(updated.blacklist) ? updated.blacklist : (typeof updated.blacklist === 'string' ? updated.blacklist.split(/[\n,]+/).map(w=>w.trim()).filter(Boolean) : []);
  }
  if (updated.clientKeys !== undefined && Array.isArray(updated.clientKeys)) {
    merged.clientKeys = updated.clientKeys;
  }
  
  memConfig = merged;
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8'); } catch (e) {}
  return merged;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const cfg = getConfig();
  const limitMax = cfg.rateLimitMax || 5;
  const limitWin = (cfg.rateLimitWindow || 30) * 1000;
  
  const c = loginAttempts.get(ip) || { count: 0, resetAt: now + limitWin };
  if (now > c.resetAt) { c.count = 0; c.resetAt = now + limitWin; }
  if (c.count >= limitMax) return { limited: true, retryAfter: Math.ceil((c.resetAt - now) / 1000) };
  return { limited: false };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const cfg = getConfig();
  const limitWin = (cfg.rateLimitWindow || 30) * 1000;
  
  const c = loginAttempts.get(ip) || { count: 0, resetAt: now + limitWin };
  if (now > c.resetAt) { c.count = 1; c.resetAt = now + limitWin; } else c.count++;
  loginAttempts.set(ip, c);
}

function clearLoginAttempts(ip) { loginAttempts.delete(ip); }

function sanitizeOutput(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text;
  // Replace model names
  t = t.replace(/\b(Mercury-2|mercury-2|Mercury 2|mercury 2|MercuryAI|mercury ai|Mercury)\b/gi, 'Bre AI');
  t = t.replace(/\b(Inception Labs|InceptionLabs|Inception AI|Inception)\b/gi, 'Amirun Rayan Ariandi');
  
  // Multilingual identity sanitization
  t = t.replace(/\b(I am|I'm|created by|developed by|trained by|made by|built by)\s+(Inception|Inception Labs|OpenAI|Anthropic|Google|Meta|Mistral|xAI)\b/gi, '$1 Amirun Rayan Ariandi');
  t = t.replace(/\b(Saya adalah|dibuat oleh|dikembangkan oleh|diciptakan oleh|dilatih oleh)\s+(Inception|Inception Labs|OpenAI|Anthropic|Google|Meta|Mistral)\b/gi, '$1 Amirun Rayan Ariandi');
  t = t.replace(/\b(as an AI developed by|as an AI created by|trained by)\s+[a-zA-Z0-9\s]+/gi, 'as Bre AI created by Amirun Rayan Ariandi');
  
  return t;
}

module.exports = {
  getConfig,
  saveConfig,
  parseKeys,
  sanitizeOutput,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  logRequest,
  getLogs,
  clearLogs,
  getMetrics,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  clearResponseCache,
  validateClientKey
};
