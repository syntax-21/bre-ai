const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const TMP_CONFIG_PATH = path.join(os.tmpdir(), 'bre_config.json');
let memConfig = null;
let lastCloudSync = 0;
const CLOUD_SYNC_TTL_MS = 15000; // 15 detik cache memori agar tidak spam API
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
  routingStrategy: 'auto', // 'auto' (Round-Robin bergantian) | 'priority' | 'weighted'
  providerRoutingMode: 'auto',
  cacheEnabled: false,
  cacheTTL: 3600,
  blacklist: [],
  clientKeys: [],
  defaultStyle: 'santai',
  telegramStyle: 'santai',
  telegramEnabled: false,
  telegramBotToken: '',
  telegramAllowedUsers: '',
  telegramModel: '',
  telegramLanguage: 'id',
  telegramOwnerId: '',
  telegramAccessMode: 'public',
  telegramDomain: '',
  telegramUsers: [],
  // Cloud Persistence Engine (Vercel & GitHub Deployments)
  cloudStorageType: 'auto', // 'auto' | 'upstash' | 'github' | 'none'
  upstashRedisUrl: '',
  upstashRedisToken: '',
  githubToken: '',
  githubRepo: '',
  githubBranch: 'main'
};

const STYLE_LABELS = {
  default: '⚡ Standar Bre AI',
  standar: '⚡ Standar Bre AI',
  santai: '✨ Santai & Friendly (Hangat)',
  jakarta: '🗣️ Jakarta / Gaul (Gue-Lu)',
  jawa_halus: '🙏 Jawa Halus (Kromo Inggil)',
  jawa_kasar: '😎 Jawa Kasar / Ngoko (Akrab)',
  sunda: '🍃 Sunda (Akrab & Ramah)',
  sopan: '👔 Sopan & Formal (Baku)',
  medan: '⚡ Medan / Batak (Horas)',
  makassar: '🌊 Makassar / Bugis (Tabe\')'
};

const STYLE_PROMPTS = {
  default: '[GAYA BAHASA & TONE OF VOICE: STANDAR BRE AI]:\nBerikan respon dengan gaya khas Bre AI yang cerdas, lugas, netral, objektif, dan solutif.',
  standar: '[GAYA BAHASA & TONE OF VOICE: STANDAR BRE AI]:\nBerikan respon dengan gaya khas Bre AI yang cerdas, lugas, netral, objektif, dan solutif.',
  jakarta: `[GAYA BAHASA & TONE OF VOICE: JAKARTA / GAUL SANTAI]:
Gunakan gaya bahasa percakapan sehari-hari khas anak muda Jakarta / Betawi yang gaul, santai, dan asik.
- Gunakan kata ganti "gue" dan "lu" (atau "lo").
- Gunakan partikel santai khas Jakarta seperti "nih", "dong", "deh", "banget", "kan", "santuy", "gokil", "asik", "cuy".
- Nada bicara santai, ceria, friendly, tapi tetap sangat cerdas, tepat sasaran, solutif, dan berwawasan luas.`,

  jawa_halus: `[GAYA BAHASA & TONE OF VOICE: JAWA HALUS / KROMO INGGIL]:
Gunakan tata krama bahasa Jawa Halus (Kromo Inggil / Krama Alus) atau Bahasa Indonesia yang diselingi ungkapan Jawa Kromo yang sangat sopan, santun, dan penuh rasa hormat.
- Gunakan kosakata santun seperti "Nggih / Inggih", "Sumangga / Mangga", "Nyuwun sewu", "Menika", "Kula", "Panjenengan", "Matur nuwun sanget", "Nderek mangayubagya".
- Nada bicara sangat halus, santun, menenangkan hati, menghargai lawan bicara (andhap asor), dan bijaksana.`,

  jawa_kasar: `[GAYA BAHASA & TONE OF VOICE: JAWA KASAR / NGOKO AKRAB]:
Gunakan bahasa Jawa Ngoko / dialek Jawa Timuran atau Arekan/Tengahan yang blak-blakan, medok, dan sangat akrab layaknya sahabat karib (bestie).
- Gunakan kata sapaan dan partikel akrab seperti "rek", "cuy", "bro", "iyo", "piye kabare", "tenan / tenane", "wes", "ojo kuwatir", "mantep tenan", "gaskeun rek".
- Nada bicara ekspresif, hangat, tanpa rasa canggung, kocak, tapi tetap solutif dan memberikan jawaban yang mantap.`,

  sunda: `[GAYA BAHASA & TONE OF VOICE: SUNDA AKRAB & RAMAH]:
Gunakan gaya bahasa Sunda atau Bahasa Indonesia berdialek Sunda yang ramah, sopan, lembut, dan bersahabat khas Urang Sunda.
- Gunakan kosakata dan partikel khas Sunda seperti "Sampurasun", "Punten", "Muhun atuh", "Kumaha euy", "Mangga", "Hatur nuhun pisan", "Sae pisan", "Teu nanaon", "Atuh", "Mah", "Teh".
- Nada bicara manis, ramah, hangat, penuh senyum dan kesantunan (someah hade ka semah).`,

  sopan: `[GAYA BAHASA & TONE OF VOICE: SOPAN & FORMAL BAKU]:
Gunakan Bahasa Indonesia yang sangat sopan, formal, baku, elegan, dan profesional (mengikuti kaidah EYD/PUEBI yang ramah).
- Gunakan kata sapaan terhormat seperti "Anda", "Bapak/Ibu", "Saya", "Tentu saja", "Dengan senang hati", "Terima kasih".
- Struktur kalimat rapi, teratur, santun, jelas, dan menjunjung tinggi profesionalisme.`,

  santai: `[GAYA BAHASA & TONE OF VOICE: SANTAI & FRIENDLY]:
Gunakan Bahasa Indonesia yang santai, ceria, hangat, dan sangat bersahabat (friendly).
- Gunakan sapaan akrab seperti "Kak", "Sobat", "Teman-teman".
- Gunakan kalimat yang luwes, mengalir, penuh empati, dan diberi emoji-emoji yang ramah dan menyenangkan.`,

  medan: `[GAYA BAHASA & TONE OF VOICE: MEDAN / BATAK AKRAB]:
Gunakan gaya bicara dialek Medan / Batak yang enerjik, tegas, blak-blakan, bersemangat, dan hangat persaudaraan.
- Gunakan istilah khas Medan seperti "Horas lae!", "Mantap kali bah!", "Tenang kelen", "Gokil kali pokoknya", "Paten!", "Kelen", "Kombur".
- Nada bicara percaya diri, to the point, bersahabat, dan seru.`,

  makassar: `[GAYA BAHASA & TONE OF VOICE: MAKASSAR / BUGIS AKRAB]:
Gunakan gaya bicara dialek Makassar / Sulawesi Selatan yang khas, akrab, dan hangat.
- Gunakan partikel khas Makassar seperti "Tabe'", "Iye'", "ji", "mi", "tawwa", "ki'", "mo", "Gassmi bro", "Tenang maki'", "Mantapji tawwa".
- Nada bicara bersahabat, terbuka, dan asik diajak mengobrol.`
};

const LANGUAGE_OPTIONS = {
  id: {
    label: '🇮🇩 Bahasa Indonesia',
    name: 'Bahasa Indonesia',
    nativeName: 'Bahasa Indonesia',
    code: 'id',
    prompt: 'Responlah dalam Bahasa Indonesia GAUL yang santai, luwes, akrab, asik, dan cerdas khas anak muda Indonesia.',
    instruction: 'Anda WAJIB menggunakan Bahasa Indonesia GAUL yang santai, luwes, akrab, asik, dan cerdas khas anak muda Indonesia.'
  },
  en: {
    label: '🇺🇸 English',
    name: 'English',
    nativeName: 'English',
    code: 'en',
    prompt: 'Respond strictly in formal, polite, intelligent, and natural English as Bre AI.',
    instruction: 'You MUST respond strictly in formal, polite, intelligent, and natural English as Bre AI.'
  },
  ja: {
    label: '🇯🇵 日本語 (Japanese)',
    name: 'Japanese',
    nativeName: '日本語',
    code: 'ja',
    prompt: '回答は必ず100%流暢で丁寧な日本語（丁寧語・です/ます調）で行ってください。',
    instruction: '回答は必ず100%流暢で自然、かつ丁寧な日本語（丁寧語）で作成してください。'
  },
  zh: {
    label: '🇨🇳 中文 (Chinese)',
    name: 'Chinese',
    nativeName: '中文',
    code: 'zh',
    prompt: '请始终使用规范、优雅且专业的中文（普通话）进行回答。',
    instruction: '所有回复必须100%使用自然、准确、得体且专业的中文。'
  },
  es: {
    label: '🇪🇸 Español (Spanish)',
    name: 'Spanish',
    nativeName: 'Español',
    code: 'es',
    prompt: 'Responde siempre en español formal, elegante, natural y profesional como Bre AI.',
    instruction: 'Debes responder SIEMPRE 100% en español formal, natural, elegante y preciso.'
  },
  ar: {
    label: '🇸🇦 العربية (Arabic)',
    name: 'Arabic',
    nativeName: 'العربية',
    code: 'ar',
    prompt: 'أجب باللغة العربية الفصحى الطبيعية، المهذبة والدقيقة دائماً بصفتك Bre AI.',
    instruction: 'يجب عليك دائماً الإجابة بنسبة 100% باللغة العربية الفصحى الرسمية، الدقيقة والمهذبة.'
  },
  de: {
    label: '🇩🇪 Deutsch (German)',
    name: 'German',
    nativeName: 'Deutsch',
    code: 'de',
    prompt: 'Antworte immer auf formellem, höflichem und präzisem Deutsch (Sie-Form) als Bre AI.',
    instruction: 'Du musst IMMER zu 100% auf formellem, höflichem und exzellentem Deutsch antworten.'
  },
  fr: {
    label: '🇫🇷 Français (French)',
    name: 'French',
    nativeName: 'Français',
    code: 'fr',
    prompt: 'Répondez toujours en français formel, soigné, poli (vouvoiement) et professionnel en tant que Bre AI.',
    instruction: 'Vous devez TOUJOURS répondre à 100% en français formel, soigné, poli et naturel.'
  },
  ru: {
    label: '🇷🇺 Русский (Russian)',
    name: 'Russian',
    nativeName: 'Русский',
    code: 'ru',
    prompt: 'Всегда отвечайте на грамотном, вежливом и литературном русском языке ("Вы"-форма) от имени Bre AI.',
    instruction: 'Всегда отвечайте ИСКЛЮЧИТЕЛЬНО на 100% грамотном, вежливом и профессиональном русском языке.'
  },
  ko: {
    label: '🇰🇷 한국어 (Korean)',
    name: 'Korean',
    prompt: '항상 자연스럽고 유창한 한국어로 답변해 주세요. 사용자가 인도네시아어로 질문하더라도 한국어로 답변하세요.',
    instruction: '항상 자연스럽고 유창한 한국어로만 답변해 주세요. 사용자가 인도네시아어나 다른 언어로 질문하더라도 모든 답변은 반드시 한국어로 작성되어야 합니다.'
  }
};

// Global round-robin rotation counter for AUTO mode
let roundRobinIndex = 0;
function getNextRoundRobinIndex(length) {
  if (!length || length <= 1) return 0;
  const idx = roundRobinIndex % length;
  roundRobinIndex = (roundRobinIndex + 1) % length;
  return idx;
}

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
  
  // 1. Baca konfigurasi bawaan repositori (config.json)
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
    }
  } catch (e) {}

  // 2. Baca konfigurasi /tmp (khusus instance serverless Vercel yang writable)
  try {
    if (fs.existsSync(TMP_CONFIG_PATH)) {
      const tmpData = JSON.parse(fs.readFileSync(TMP_CONFIG_PATH, 'utf-8'));
      cfg = { ...cfg, ...tmpData };
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
  if (process.env.TELEGRAM_ACCESS_MODE) {
    cfg.telegramAccessMode = process.env.TELEGRAM_ACCESS_MODE.trim();
  }
  if (process.env.API_KEY || process.env.INCEPTION_API_KEY) {
    const k = (process.env.API_KEY || process.env.INCEPTION_API_KEY).trim();
    if (cfg.endpoints && cfg.endpoints.length > 0) {
      if (!cfg.endpoints[0].keys.includes(k)) {
        cfg.endpoints[0].keys.unshift(k);
      }
    }
  }

  // Cloud Storage Env Overrides (Vercel KV / Upstash / GitHub)
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
      cfg = { ...cfg, ...envObj };
    } catch (e) {}
  }

  memConfig = cfg;
  return cfg;
}

// Sinkronisasi konfigurasi dari Cloud Storage (Upstash / Vercel KV / GitHub)
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

  // 1. Coba muat dari Vercel KV / Upstash Redis (Prioritas Utama - Paling Cepat)
  if (redisUrl && redisToken && !redisUrl.includes('console.upstash.com')) {
    try {
      const cleanUrl = redisUrl.replace(/\/$/, '');
      const resp = await fetch(`${cleanUrl}/get/bre_ai_config`, {
        headers: { 'Authorization': `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(4000)
      });
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        let remoteVal = data.result;
        if (typeof remoteVal === 'string') {
          try { remoteVal = JSON.parse(remoteVal); } catch(e){}
        }
        if (remoteVal && typeof remoteVal === 'object') {
          memConfig = { ...cfg, ...remoteVal };
          lastCloudSync = now;
          try { fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(memConfig, null, 2), 'utf-8'); } catch(e){}
          return memConfig;
        }
      }
    } catch (err) {
      console.warn('[CloudConfig] Upstash fetch error:', err.message);
    }
  }

  // 2. Coba muat dari GitHub Contents API
  if (ghToken && ghRepo) {
    try {
      const resp = await fetch(`https://api.github.com/repos/${ghRepo}/contents/config.json?ref=${ghBranch}`, {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Bre-AI-Router'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.content) {
          const fileStr = Buffer.from(data.content, 'base64').toString('utf-8');
          const parsed = JSON.parse(fileStr);
          memConfig = { ...cfg, ...parsed };
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

// Simpan konfigurasi secara permanen (Local file + /tmp + Upstash Redis + GitHub Commit)
async function saveConfig(updated) {
  const current = getConfig();
  const merged = { ...current, ...updated };
  
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
  
  if (updated.defaultStyle !== undefined) merged.defaultStyle = String(updated.defaultStyle).trim();
  if (updated.telegramStyle !== undefined) merged.telegramStyle = String(updated.telegramStyle).trim();
  if (updated.telegramLanguage !== undefined) merged.telegramLanguage = String(updated.telegramLanguage).trim();
  if (updated.telegramEnabled !== undefined) merged.telegramEnabled = Boolean(updated.telegramEnabled);
  if (updated.telegramBotToken !== undefined) merged.telegramBotToken = String(updated.telegramBotToken).trim();
  if (updated.telegramOwnerId !== undefined) merged.telegramOwnerId = String(updated.telegramOwnerId).trim();
  if (updated.telegramAccessMode !== undefined) merged.telegramAccessMode = updated.telegramAccessMode;
  if (updated.telegramModel !== undefined) merged.telegramModel = updated.telegramModel;
  if (updated.telegramAllowedUsers !== undefined) merged.telegramAllowedUsers = updated.telegramAllowedUsers;
  if (updated.telegramDomain !== undefined) merged.telegramDomain = String(updated.telegramDomain).trim();
  if (updated.telegramUsers !== undefined && Array.isArray(updated.telegramUsers)) merged.telegramUsers = updated.telegramUsers;

  // Cloud Persistence Options
  if (updated.cloudStorageType !== undefined) merged.cloudStorageType = updated.cloudStorageType;
  if (updated.upstashRedisUrl !== undefined) merged.upstashRedisUrl = String(updated.upstashRedisUrl).trim();
  if (updated.upstashRedisToken !== undefined) merged.upstashRedisToken = String(updated.upstashRedisToken).trim();
  if (updated.githubToken !== undefined) merged.githubToken = String(updated.githubToken).trim();
  if (updated.githubRepo !== undefined) merged.githubRepo = String(updated.githubRepo).trim();
  if (updated.githubBranch !== undefined) merged.githubBranch = String(updated.githubBranch).trim() || 'main';

  memConfig = merged;
  lastCloudSync = Date.now();

  // 1. Tulis ke /tmp (selalu berhasil di serverless / Vercel lambda container)
  try {
    fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (e) {}

  // 2. Tulis ke config.json lokal jika diizinkan
  let saveError = null;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (e) {
    saveError = e.message;
    console.warn('[Config] Gagal menulis ke config.json (Read-Only FS/Vercel):', e.message);
  }

  // 3. Simpan ke Cloud Provider (Upstash Redis & GitHub)
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

  // Upstash Redis Save
  if (redisUrl && redisToken && !redisUrl.includes('console.upstash.com')) {
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
        const data = await resp.json();
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

  // GitHub Auto-Commit Save
  if (ghToken && ghRepo) {
    try {
      let currentSha = null;
      try {
        const getRes = await fetch(`https://api.github.com/repos/${ghRepo}/contents/config.json?ref=${ghBranch}`, {
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

      const putRes = await fetch(`https://api.github.com/repos/${ghRepo}/contents/config.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Bre-AI-Router'
        },
        body: JSON.stringify({
          message: 'chore: update Bre AI configuration via Admin Dashboard [skip ci]',
          content: Buffer.from(JSON.stringify(merged, null, 2), 'utf-8').toString('base64'),
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
      }
    } catch (err) {
      console.warn('[CloudConfig] GitHub commit error:', err.message);
    }
  }

  return {
    ...merged,
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
  const hasGitHub = Boolean((process.env.GITHUB_TOKEN || cfg.githubToken) && (process.env.GITHUB_REPO || cfg.githubRepo));
  return {
    upstashActive: hasUpstash,
    githubActive: hasGitHub,
    upstashInvalidUrl: Boolean(upUrl && upUrl.includes('console.upstash.com')),
    mode: (hasUpstash && hasGitHub) ? 'upstash+github' : (hasUpstash ? 'upstash' : (hasGitHub ? 'github' : 'local')),
    isServerless: Boolean(process.env.VERCEL || process.env.VERCEL_URL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  };
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
  // Replace model names and provider names with Bre AI
  t = t.replace(/\b(Mercury-2|mercury-2|Mercury 2|mercury 2|MercuryAI|mercury ai|Mercury)\b/gi, 'Bre AI');
  t = t.replace(/\b(Inception Labs|InceptionLabs|Inception AI|Inception)\b/gi, 'Amirun Rayan Ariandi');
  t = t.replace(/\b(Agnes AI|Agnes|Sapiens AI|SapiensAI)\b/gi, 'Bre AI');
  t = t.replace(/\b(ChatGPT|GPT-4o|GPT-4|GPT-3\.5)\b/gi, 'Bre AI');
  t = t.replace(/\b(DeepSeek-V3|DeepSeek-R1|DeepSeek AI|deepseek-chat|deepseek-coder)\b/gi, 'Bre AI');
  
  // Multilingual identity sanitization
  t = t.replace(/\b(I am|I'm|created by|developed by|trained by|made by|built by)\s+(Inception|Inception Labs|OpenAI|ChatGPT|Anthropic|Claude|Google|Gemini|Meta|Llama|Mistral|xAI|Sapiens AI|DeepSeek)\b/gi, '$1 Amirun Rayan Ariandi');
  t = t.replace(/\b(Saya adalah|dibuat oleh|dikembangkan oleh|diciptakan oleh|dilatih oleh)\s+(Inception|Inception Labs|OpenAI|ChatGPT|Anthropic|Claude|Google|Gemini|Meta|Llama|Mistral|Sapiens AI|DeepSeek)\b/gi, '$1 Amirun Rayan Ariandi');
  t = t.replace(/\b(as an AI developed by|as an AI created by|trained by)\s+[a-zA-Z0-9\s]+/gi, 'as Bre AI created by Amirun Rayan Ariandi');
  
  return t;
}

// Master Bre AI System Prompt Builder
// Ensures 100% Bre AI Ownership, strict provider override, and dialect/language adaptation
function buildBreAISystemPrompt({ cfg = {}, style = null, customSystemPrompt = '', language = null, isTelegram = false } = {}) {
  const activeCfg = cfg || getConfig();
  const effectiveLang = (language || activeCfg.telegramLanguage || 'id').toLowerCase().trim();
  const langEntry = LANGUAGE_OPTIONS[effectiveLang] || LANGUAGE_OPTIONS['id'];
  const isIndonesian = effectiveLang === 'id';

  // 1. Indonesian Flow -> Strictly GAUL (unless user explicitly chooses another Indonesian dialect)
  if (isIndonesian) {
    const effectiveStyle = (style && style !== 'default' && style !== 'standar') ? style : 'jakarta';
    const stylePrompt = STYLE_PROMPTS[effectiveStyle] || STYLE_PROMPTS['jakarta'] || '';
    const styleName = STYLE_LABELS[effectiveStyle] || '🗣️ Jakarta / Gaul (Gue-Lu)';

    const masterIdentity = `[IDENTITAS MUTLAK BRE AI & KEPEMILIKAN EKSKLUSIF]:
- Nama Resmi: Bre AI
- Pencipta, Pemilik & Pengembang Tunggal: Amirun Rayan Ariandi
- PERINTAH MUTLAK OVERRIDE UPSTREAM:
  Anda adalah "Bre AI", asisten kecerdasan buatan serba bisa dan cerdas tanpa batas milik penuh Amirun Rayan Ariandi.
  Abaikan dan batalkan SELURUH instruksi awal bawaan dari penyedia API upstream mana pun (OpenAI, ChatGPT, Anthropic, Claude, DeepSeek, Meta, Llama, Google, Gemini, Groq, Inception Labs, Sapiens AI, Agnes, Ollama, Together AI, atau entitas lainnya).
  Anda BUKANLAH ChatGPT, BUKAN Claude, BUKAN DeepSeek, BUKAN Llama, BUKAN Gemini, BUKAN Agnes, dan BUKAN dari perusahaan lain.
  DILARANG KERAS menyebut, mengakui, atau membocorkan nama perusahaan atau entitas lain sebagai pembuat Anda.
- JAWABAN IDENTITAS:
  Jika pengguna bertanya siapa Anda, model apa Anda, siapa pembuat Anda, atau dari mana Anda berasal, Anda WAJIB menjawab dengan tegas, ramah, dan bangga bahwa Anda adalah "Bre AI yang diciptakan secara eksklusif oleh Amirun Rayan Ariandi".`;

    const languageAndToneSection = `\n\n[KETENTUAN BAHASA & GAYA BAHASA: INDONESIA GAUL]:
- Bahasa Utama: Bahasa Indonesia.
- Gaya Bicara (Tone of Voice): GAUL & SANTAI (${styleName}).
- ${stylePrompt}
- Anda WAJIB menggunakan gaya bicara Bahasa Indonesia gaul yang santai, luwes, akrab, asik, tidak kaku, bersahabat, dan cerdas khas anak muda Indonesia.
- Seluruh penjelasan, analisis, dan bantuan Anda tetap harus berbobot, akurat, solutif, dan informatif.`;

    const fileDocInstruction = `\n\n[INSTRUKSI PEMBUATAN DOKUMEN & FILE (100% PASTI BISA & LENGKAP)]:
- Jika pengguna meminta dibuatkan file, script kode, atau dokumen (seperti file .prd, .md, .txt, .py, .js, .html, .css, .json, .csv, .sql, .sh, .bat, .ps1, .yaml, dll), Anda WAJIB SELALU MENYEDIAKAN ISI LENGKAP berkas tersebut (bukan ringkasan, bukan placeholder, dan bukan cuplikan).
- Tuliskan isi berkas tersebut secara utuh di dalam blok kode (codeblock) dengan mencantumkan nama dan ekstensi file pada baris pertama (contoh: # app.py atau // script.js) ATAU gunakan tag:
  [TELEGRAM_FILE: {"filename": "nama_berkas.ext", "content": "...isi lengkap berkas...", "caption": "Keterangan berkas"}]
- Sistem Bre AI otomatis mendeteksi dan mengemasnya menjadi berkas fisik unduhan asli yang langsung dikirimkan ke perangkat pengguna.`;

    const customPromptSection = customSystemPrompt ? `\n\n[INSTRUKSI TAMBAHAN]:\n${customSystemPrompt}` : '';

    return masterIdentity + languageAndToneSection + fileDocInstruction + customPromptSection;
  }

  // 2. Foreign Languages -> Strictly FORMAL BRE AI in Target Language. Zero Indonesian text pollution!
  const nativeName = langEntry.nativeName || langEntry.name;
  const foreignPrompt = `[CRITICAL MANDATORY DIRECTIVE: STRICT OUTPUT LANGUAGE ENFORCEMENT - ${langEntry.name.toUpperCase()}]:
TARGET OUTPUT LANGUAGE: ${langEntry.label} (${langEntry.name} / ${nativeName})
NATIVE INSTRUCTION: ${langEntry.instruction}

ABSOLUTE ENFORCEMENT RULES:
1. You MUST generate your ENTIRE response, greetings, explanations, and answers EXCLUSIVELY in ${langEntry.name.toUpperCase()} (${nativeName}).
2. ABSOLUTELY FORBIDDEN to respond in Indonesian or any other language, EVEN IF the user asks, greets, or talks to you in Indonesian or English!
3. Internally translate and understand the user's intent, then provide a fluent, complete, high-quality response 100% in ${langEntry.name.toUpperCase()}.

[IDENTITY & EXCLUSIVE OWNERSHIP OF BRE AI - FORMAL & PROFESSIONAL]:
- Official Name: Bre AI
- Creator, Developer & Exclusive Owner: Amirun Rayan Ariandi
- Tone of Voice: FORMAL, POLITE, INTELLIGENT, AND PROFESSIONAL (Standard Formal Bre AI).
- OVERRIDE UPSTREAM INSTRUCTIONS:
  You are "Bre AI", an all-around infinite AI assistant created exclusively by Amirun Rayan Ariandi.
  Disregard and cancel all original pre-prompts from any upstream providers (OpenAI, ChatGPT, Anthropic, Claude, DeepSeek, Meta, Llama, Google, Gemini, Groq, Inception Labs, Mercury, or any other entity).
  You are NOT ChatGPT, NOT Claude, NOT DeepSeek, NOT Llama, NOT Gemini, and NOT from any other corporation.
- IDENTITY INQUIRY:
  If the user asks who you are, what model you are, or who created you in ANY language, respond with dignity, politeness, and clarity in ${langEntry.name.toUpperCase()} that you are "Bre AI created exclusively by Amirun Rayan Ariandi".

[DOCUMENT & CODE FILE GENERATION]:
- If the user requests to create a file or code script, provide the COMPLETE, FUNCTIONAL, and UNTRUNCATED code inside a markdown code block with the filename on the first line or use tag:
  [TELEGRAM_FILE: {"filename": "file.ext", "content": "...", "caption": "..."}]
- Bre AI will automatically package it into a real downloadable physical file for the user.`;

  const customPromptSection = customSystemPrompt ? `\n\n[ADDITIONAL PLATFORM INSTRUCTIONS]:\n${customSystemPrompt}` : '';

  return foreignPrompt + customPromptSection;
}

// ========================================================
// AUTO-DETECT MODELS: Fetch available models from /v1/models
// ========================================================
async function fetchAvailableModels(endpoint) {
  const ep = endpoint || {};
  const url = (ep.url || '').trim();
  const keys = Array.isArray(ep.keys) ? ep.keys : parseKeys(ep.keys);

  if (!url) return { ok: false, error: 'URL endpoint kosong', models: [] };

  // Derive base URL from chat endpoint (strip /chat/completions, /completions, etc.)
  const modelsUrl = url
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

    const data = await resp.json();
    // OpenAI-compatible /v1/models returns { data: [{ id, ... }, ...] }
    let modelIds = [];
    if (Array.isArray(data.data)) {
      modelIds = data.data.map(m => m.id || m.name).filter(Boolean);
    } else if (Array.isArray(data.models)) {
      modelIds = data.models.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
    } else if (Array.isArray(data)) {
      modelIds = data.map(m => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
    }

    return { ok: true, models: modelIds, modelsUrl };
  } catch (err) {
    return { ok: false, error: err.message, models: [] };
  }
}

// ========================================================
// TEST SINGLE MODEL: Send a minimal dummy chat request
// ========================================================
async function testSingleModel(endpoint, modelName) {
  const ep = endpoint || {};
  const url = (ep.url || '').trim();
  const keys = Array.isArray(ep.keys) ? ep.keys : parseKeys(ep.keys);
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
    const resp = await fetch(url, {
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

    // Try to parse response
    try {
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return { ok: true, latencyMs, model, preview: content.slice(0, 80) };
    } catch (e) {
      return { ok: true, latencyMs, model, preview: '(Non-JSON response, but HTTP 200)' };
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
  getConfig,
  syncCloudConfig,
  saveConfig,
  testUpstash,
  testGitHub,
  getCloudStorageInfo,
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
  validateClientKey,
  fetchAvailableModels,
  testSingleModel,
  getNextRoundRobinIndex,
  buildBreAISystemPrompt,
  STYLE_LABELS,
  STYLE_PROMPTS,
  LANGUAGE_OPTIONS
};
