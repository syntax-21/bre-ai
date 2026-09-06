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
  streamEnabled: true
};

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

module.exports = { getConfig, saveConfig, parseKeys, sanitizeOutput, checkRateLimit, recordFailedAttempt, clearLoginAttempts };
