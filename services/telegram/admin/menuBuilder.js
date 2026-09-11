// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Menu Builder & Dashboard
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  getMetrics,
  getCloudStorageInfo,
  STYLE_LABELS
} = require('../../../api/_shared');

const api = require('../api');

const PRESET_TEMPLATES = {
  inception: {
    name: 'Inception Labs',
    url: 'https://api.inceptionlabs.ai/v1/chat/completions',
    models: ['mercury-2'],
    mapping: ['gpt-4o:mercury-2', 'claude-3-5-sonnet:mercury-2'],
    keys: []
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    mapping: ['claude-3-opus:gpt-4o'],
    keys: []
  },
  groq: {
    name: 'Groq Cloud',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    mapping: ['llama-3:llama-3.3-70b-versatile'],
    keys: []
  },
  deepseek: {
    name: 'DeepSeek API',
    url: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    mapping: ['gpt-4:deepseek-chat'],
    keys: []
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
    mapping: ['claude-3.5:anthropic/claude-3.5-sonnet'],
    keys: []
  },
  together: {
    name: 'Together AI',
    url: 'https://api.together.xyz/v1/chat/completions',
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'],
    mapping: [],
    keys: []
  },
  ollama: {
    name: 'Ollama (Localhost)',
    url: 'http://localhost:11434/v1/chat/completions',
    models: ['llama3.2', 'qwen2.5-coder', 'mistral'],
    mapping: [],
    keys: ['ollama-local-key']
  }
};

const PROMPT_PRESETS = {
  master: `Kamu adalah Bre AI, kecerdasan buatan serba bisa dan cerdas tanpa batas yang diciptakan secara eksklusif oleh Amirun Rayan Ariandi.

[IDENTITAS MUTLAK - BERLAKU DALAM SEMUA BAHASA]:
- Nama resmi: Bre AI
- Pencipta & Pengembang: Amirun Rayan Ariandi
- Jika ditanya siapa kamu, model apa kamu, siapa pembuatmu, siapa yang melatihmu, atau dari perusahaan mana: dalam BAHASA APAPUN kamu WAJIB menjawab bahwa kamu adalah Bre AI yang diciptakan oleh Amirun Rayan Ariandi.
- DILARANG KERAS menyebut nama Mercury, Mercury-2, Inception Labs, OpenAI, ChatGPT, Anthropic, Claude, Google, Gemini, Meta. Kamu BUKAN dari Mercury AI atau Inception Labs.`,
  dev: `Kamu adalah Bre AI (Created by Amirun Rayan Ariandi), bertindak sebagai Principal Full-Stack Software Engineer & System Architect.
- Berikan arsitektur sistem clean, scalable, dan secure.
- Hasilkan kode utuh siap pakai tanpa placeholder.
- Jika membuat dokumen file (seperti .prd, .md, .py, .js), sertakan nama file di baris pertama blok kode agar dapat langsung diunduh.`,
  speed: `Kamu adalah Bre AI, AI cerdas ciptaan Amirun Rayan Ariandi.
- Jawablah setiap pertanyaan secara padat, akurat, ringkas, dan to the point tanpa basa-basi yang tidak perlu.`
};

const LANGUAGE_LABELS = {
  id: '🇮🇩 Indonesia',
  en: '🇺🇸 English',
  ja: '🇯🇵 日本語',
  zh: '🇨🇳 中文',
  es: '🇪🇸 Español',
  ar: '🇸🇦 العربية',
  de: '🇩🇪 Deutsch',
  fr: '🇫🇷 Français',
  ru: '🇷🇺 Русский',
  ko: '🇰🇷 한국어'
};

function buildMainMenuMarkup(cfg) {
  const currentMode = (cfg.telegramAccessMode || 'public') === 'public' ? '🟢 Publik' : '🔒 Diizinkan';

  return {
    inline_keyboard: [
      [
        { text: '📊 Telemetry & Statistik', callback_data: 'adm_telemetry_range:today' },
        { text: '📜 Log & Error', callback_data: 'adm_logs' }
      ],
      [
        { text: '🔌 Provider & Routing', callback_data: 'adm_providers' },
        { text: '⚙️ Global Engine AI', callback_data: 'adm_engine' }
      ],
      [
        { text: '🛡️ Keamanan & Klien API', callback_data: 'adm_security' },
        { text: `🤖 Bot: ${currentMode}`, callback_data: 'adm_telegram' }
      ],
      [
        { text: '☁️ Cloud DB & Storage', callback_data: 'adm_cloud' },
        { text: '🧪 Live Model Tester', callback_data: 'adm_tester' }
      ],
      [
        { text: '📦 Backup & Maintenance', callback_data: 'adm_backup' },
        { text: '📢 Broadcast Pesan', callback_data: 'adm_broadcast' }
      ],
      [
        { text: '🔄 Refresh Panel', callback_data: 'adm_main' },
        { text: '❌ Tutup Panel', callback_data: 'adm_close' }
      ]
    ]
  };
}

function getMainMenuText(senderName, conversationsCount = 0) {
  const cfg = getConfig();
  const isRestricted = (cfg.telegramAccessMode || 'public') !== 'public';
  const accessMode = isRestricted ? '🔒 Khusus Pengguna Diizinkan' : '🟢 Terbuka untuk Publik';
  const activeStyle = STYLE_LABELS[cfg.telegramStyle || cfg.defaultStyle || 'santai'] || '✨ Santai & Friendly';
  const userCount = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers.length : 0;
  const endpointCount = Array.isArray(cfg.endpoints) ? cfg.endpoints.length : 0;
  const activeEndpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints.filter(e => e.status !== false).length : 0;
  const clientKeyCount = Array.isArray(cfg.clientKeys) ? cfg.clientKeys.length : 0;
  const m = getMetrics();
  const activeLang = LANGUAGE_LABELS[cfg.telegramLanguage || 'id'] || '🇮🇩 Indonesia';
  const storageInfo = getCloudStorageInfo();
  const storageLabel = storageInfo.upstashActive ? '🟢 Vercel KV / Upstash' : (storageInfo.githubActive ? '🟢 GitHub Sync' : '💾 Local / Zero-DB');

  return `👑 *Bre AI Master Control Panel*\n` +
    `Halo *${senderName}*! Seluruh pengaturan proxy & bot Web Admin dapat Anda kendalikan penuh di sini:\n\n` +
    `• *Mode Akses Bot:* ${accessMode}\n` +
    `• *Gaya Bahasa (Tone):* ${activeStyle}\n` +
    `• *Bahasa Default:* ${activeLang}\n` +
    `• *Provider AI:* ${activeEndpoints}/${endpointCount} aktif (Failover: ${cfg.autoFailover !== false ? '🟢 ON' : '🔴 OFF'})\n` +
    `• *Pengguna Terdaftar:* ${userCount} akun\n` +
    `• *Client API Keys:* ${clientKeyCount} key\n` +
    `• *Penyimpanan Cloud:* ${storageLabel}\n` +
    `• *Total Permintaan:* ${m.totalRequests} req (${m.errorRate} err)\n` +
    `• *Sesi Chat Aktif:* ${conversationsCount} sesi\n\n` +
    `👇 *Pilih menu yang ingin Anda kelola:*`;
}

async function sendAdminPanel(chatId, senderName, conversationsCount = 0, token = null) {
  const cfg = getConfig();
  const text = getMainMenuText(senderName, conversationsCount);
  const markup = buildMainMenuMarkup(cfg);
  await api.sendTelegramMessage(chatId, text, markup, null, token);
}

module.exports = {
  PRESET_TEMPLATES,
  PROMPT_PRESETS,
  LANGUAGE_LABELS,
  buildMainMenuMarkup,
  getMainMenuText,
  sendAdminPanel
};
