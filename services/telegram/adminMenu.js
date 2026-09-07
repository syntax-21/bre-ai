// ========================================================
// Bre AI v3.0 - Comprehensive Telegram Bot Admin Control Panel
// Full 1-to-1 Web Admin functionality ported to Telegram
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  getMetrics,
  getLogs,
  clearLogs,
  clearResponseCache,
  testUpstash,
  testGitHub,
  getCloudStorageInfo,
  fetchAvailableModels,
  testSingleModel
} = require('../../api/_shared');

const {
  apiCall,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallback,
  sendTelegramDocument
} = require('./api');

const {
  recentUsers,
  getRecentUsersList,
  isOwner,
  setUserRole,
  removeUserRole
} = require('./accessControl');

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

// 1. Build Main Menu Markup
function buildMainMenuMarkup(cfg) {
  const currentMode = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Whitelist' : '🟢 Publik';
  const currentLang = cfg.telegramLanguage || 'id';
  const langLabel = LANGUAGE_LABELS[currentLang] || '🇮🇩 ID';

  return {
    inline_keyboard: [
      [
        { text: '📊 Status & Metrik', callback_data: 'adm_metrics' },
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

// 2. Main Menu Dashboard Text
function getMainMenuText(senderName, conversationsCount = 0) {
  const cfg = getConfig();
  const activeModel = cfg.telegramModel || cfg.model || 'mercury-2';
  const accessMode = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Khusus Whitelist' : '🟢 Terbuka untuk Publik';
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
    `• *Model Aktif:* \`${activeModel}\`\n` +
    `• *Bahasa Default:* ${activeLang}\n` +
    `• *Mode Akses Bot:* ${accessMode}\n` +
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
  await sendTelegramMessage(chatId, text, markup, null, token);
}

// Master Callback Query Router
async function handleAdminCallback(cq, botService) {
  if (!cq || !cq.from) return;
  const fromUser = cq.from;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const data = cq.data || '';
  const token = botService.activeToken || null;

  // Verify Owner authorization
  if (!isOwner(fromUser, botService.activeOwnerId)) {
    await answerCallback(cq.id, '⛔ Akses Ditolak: Khusus Pemilik Bot (Owner)', true, token);
    return;
  }

  const cfg = getConfig();
  const senderName = fromUser.first_name || 'Owner';

  // ----------------------------------------------------
  // 1. MAIN MENU & CLOSE
  // ----------------------------------------------------
  if (data === 'adm_main') {
    await answerCallback(cq.id, 'Panel diperbarui', false, token);
    const text = getMainMenuText(senderName, botService.conversations.size);
    const markup = buildMainMenuMarkup(cfg);
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_close') {
    await answerCallback(cq.id, 'Panel ditutup', false, token);
    try {
      await apiCall('deleteMessage', { chat_id: chatId, message_id: messageId }, token);
    } catch (e) {
      await editTelegramMessage(chatId, messageId, '🔒 *Panel admin ditutup.* Ketik `/admin` untuk membuka kembali.', null, token);
    }
    return;
  }

  // ----------------------------------------------------
  // 2. METRICS & ANALYTICS
  // ----------------------------------------------------
  if (data === 'adm_metrics') {
    await answerCallback(cq.id, null, false, token);
    const m = getMetrics();
    let text = `📊 *Real-Time Proxy Analytics & Performance*\n\n` +
      `• *Total Permintaan:* ${m.totalRequests.toLocaleString()} (${m.successfulRequests} sukses · ${m.failedRequests} gagal)\n` +
      `• *Total Token Diproses:* ${m.totalTokens.toLocaleString()} token\n` +
      `• *Tingkat Kegagalan (Error Rate):* ${m.errorRate}\n` +
      `• *Rata-Rata Latensi:* ${m.avgLatencyMs} ms\n` +
      `• *In-Memory Response Cache:* ${m.cacheSize} item\n` +
      `• *Sesi Chat Telegram:* ${botService.conversations.size} percakapan\n\n`;

    const pHits = Object.entries(m.providerHits || {});
    if (pHits.length > 0) {
      text += `*Distribusi Trafik Upstream:*\n`;
      pHits.forEach(([prov, cnt]) => {
        const pct = m.totalRequests > 0 ? Math.round((cnt / m.totalRequests) * 100) : 0;
        text += `• ${prov}: *${cnt} req* (${pct}%)\n`;
      });
      text += '\n';
    }

    const mHits = Object.entries(m.modelHits || {});
    if (mHits.length > 0) {
      text += `*Model Paling Sering Digunakan:*\n`;
      mHits.slice(0, 5).forEach(([mod, cnt]) => {
        text += `• \`${mod}\`: *${cnt} query*\n`;
      });
    }

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Metrik', callback_data: 'adm_metrics' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // ----------------------------------------------------
  // 3. LOGS VIEWER & MANAGEMENT
  // ----------------------------------------------------
  if (data === 'adm_logs' || data === 'adm_logs_err') {
    await answerCallback(cq.id, null, false, token);
    const isErrorOnly = (data === 'adm_logs_err');
    let logs = getLogs();
    if (isErrorOnly) logs = logs.filter(l => l.status >= 400);
    logs = logs.slice(0, 6);

    let text = `📜 *${isErrorOnly ? 'Error Logs Server (Status >= 400)' : 'Log Permintaan Terbaru'}*\n\n`;
    if (!logs.length) {
      text += `_Belum ada ${isErrorOnly ? 'error' : 'log aktivitas'} yang terekam di memori server._\n`;
    } else {
      logs.forEach((l, i) => {
        const time = l.timeStr || (l.timestamp ? new Date(l.timestamp).toLocaleTimeString('id-ID') : '-');
        const st = l.status >= 400 ? `🔴 ${l.status}` : `🟢 ${l.status}`;
        const cacheTag = l.cached ? ' [⚡RAM]' : '';
        text += `${i+1}. [${time}] *${l.provider || 'API'}* (${l.model || '-'})${cacheTag}\n   Status: ${st} | ${l.latencyMs || 0}ms | ${l.tokens || 0} tok\n`;
        if (l.error) text += `   ⚠️ _${l.error.slice(0, 60)}_\n`;
      });
    }

    const markup = {
      inline_keyboard: [
        [
          { text: isErrorOnly ? '📋 Tampilkan Semua Log' : '⚠️ Filter Error Saja', callback_data: isErrorOnly ? 'adm_logs' : 'adm_logs_err' },
          { text: '🔄 Refresh', callback_data: data }
        ],
        [
          { text: '🗑️ Bersihkan Semua Log', callback_data: 'adm_clear_logs' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_clear_logs') {
    clearLogs();
    await answerCallback(cq.id, '🗑️ Seluruh log server berhasil dibersihkan!', true, token);
    cq.data = 'adm_logs';
    return handleAdminCallback(cq, botService);
  }

  // ----------------------------------------------------
  // 4. PROVIDER & ROUTING MANAGEMENT
  // ----------------------------------------------------
  if (data === 'adm_providers') {
    await answerCallback(cq.id, null, false, token);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const autoFailover = cfg.autoFailover !== false;
    const routingMode = (cfg.routingStrategy || cfg.providerRoutingMode || 'auto').toLowerCase();
    
    let routingLabel = '🔄 AUTO (Bergantian Semua Provider)';
    let routingShort = '🔄 AUTO (Bergantian)';
    if (routingMode === 'priority') {
      routingLabel = '🥇 Prioritas Tunggal';
      routingShort = '🥇 Prioritas';
    } else if (routingMode === 'weighted') {
      routingLabel = '⚖️ Berdasarkan Bobot (Weight)';
      routingShort = '⚖️ Bobot';
    }

    let text = `🔌 *Daftar Endpoint AI (Multi-Provider Router)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Mode Routing:* *${routingLabel}*\n` +
      `• *Auto-Failover:* *${autoFailover ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `• *Total Provider:* *${endpoints.length} endpoint*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Klik nama provider di bawah untuk kelola, atau klik tombol Mode Routing untuk mengganti rotasi:_\n`;

    const rows = [];
    endpoints.forEach((ep, i) => {
      const st = ep.status !== false ? '🟢' : '🔴';
      const keyCount = Array.isArray(ep.keys) ? ep.keys.length : (ep.keys ? 1 : 0);
      rows.push([{
        text: `${st} #${i+1} ${ep.name || 'Provider'} (${keyCount} keys)`,
        callback_data: `adm_prov_det:${i}`
      }]);
    });

    rows.push([
      { text: `🔀 Mode: ${routingShort}`, callback_data: 'adm_cycle_routing' }
    ]);
    rows.push([
      { text: `🔄 Failover: ${autoFailover ? '🟢 ON' : '🔴 OFF'}`, callback_data: 'adm_toggle_af' },
      { text: '🏆 Benchmark Leaderboard', callback_data: 'adm_benchmark' }
    ]);
    rows.push([
      { text: '➕ Tambah dari Preset', callback_data: 'adm_prov_presets' },
      { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 4a. Cycle Routing Strategy (AUTO -> Priority -> Weighted -> AUTO)
  if (data === 'adm_cycle_routing') {
    const current = (cfg.routingStrategy || cfg.providerRoutingMode || 'auto').toLowerCase();
    let nextMode = 'auto';
    let label = '🔄 AUTO (Rotasi Bergantian Seluruh Provider)';
    if (current === 'auto') {
      nextMode = 'priority';
      label = '🥇 Prioritas Tunggal';
    } else if (current === 'priority') {
      nextMode = 'weighted';
      label = '⚖️ Berdasarkan Bobot (Weight)';
    } else {
      nextMode = 'auto';
      label = '🔄 AUTO (Rotasi Bergantian Seluruh Provider)';
    }

    saveConfig({ routingStrategy: nextMode, providerRoutingMode: nextMode });
    await answerCallback(cq.id, `Mode Routing diubah ke: ${label}`, false, token);
    cq.data = 'adm_providers';
    return handleAdminCallback(cq, botService);
  }

  // 4b. Toggle Auto Failover
  if (data === 'adm_toggle_af') {
    const current = cfg.autoFailover !== false;
    const nextVal = !current;
    saveConfig({ autoFailover: nextVal });
    await answerCallback(cq.id, `Auto-Failover ${nextVal ? 'Diaktifkan 🟢' : 'Dinonaktifkan 🔴'}`, false, token);
    cq.data = 'adm_providers';
    return handleAdminCallback(cq, botService);
  }

  // 4c. Provider Detail Card
  if (data.startsWith('adm_prov_det:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      await answerCallback(cq.id, 'Provider tidak ditemukan', false, token);
      cq.data = 'adm_providers';
      return handleAdminCallback(cq, botService);
    }

    const isActive = ep.status !== false;
    const keysCount = Array.isArray(ep.keys) ? ep.keys.length : (ep.keys ? 1 : 0);
    const modelsList = (ep.models || []).join(', ') || '(belum ada model)';
    const mappingList = (ep.mapping || []).join(', ') || '(tidak ada)';

    const text = `⚡ *Detail Provider #${idx+1}: ${ep.name || 'Unnamed'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Status:* ${isActive ? '🟢 Aktif (Melayani Trafik)' : '🔴 Nonaktif'}\n` +
      `• *Weight / Priority:* ${ep.weight || 1}\n` +
      `• *Base URL:* \`${ep.url || '-'}\`\n` +
      `• *API Keys Terpasang:* ${keysCount} key (Rotasi Round-Robin)\n` +
      `• *Model Asli:* \`${modelsList}\`\n` +
      `• *Model Alias Mapping:* \`${mappingList}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih aksi operasi untuk provider ini:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: isActive ? '🔴 Nonaktifkan Provider' : '🟢 Aktifkan Provider', callback_data: `adm_prov_toggle:${idx}` },
          { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${idx}` }
        ],
        [
          { text: '🔍 Detect Model (/v1/models)', callback_data: `adm_prov_detect:${idx}` },
          { text: '🧪 Test Model Live', callback_data: `adm_prov_test:${idx}` }
        ],
        [
          { text: '🗑️ Hapus Provider', callback_data: `adm_prov_del:${idx}` },
          { text: '⬅️ Daftar Provider', callback_data: 'adm_providers' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4d. Toggle Provider Status
  if (data.startsWith('adm_prov_toggle:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    if (endpoints[idx]) {
      endpoints[idx].status = endpoints[idx].status === false ? true : false;
      saveConfig({ endpoints });
      await answerCallback(cq.id, `Status [${endpoints[idx].name}] diubah ke: ${endpoints[idx].status ? 'Aktif 🟢' : 'Nonaktif 🔴'}`, false, token);
    }
    cq.data = `adm_prov_det:${idx}`;
    return handleAdminCallback(cq, botService);
  }

  // 4e. Test Ping Provider
  if (data.startsWith('adm_prov_ping:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep || !ep.url) return answerCallback(cq.id, 'URL provider tidak valid', true, token);

    await answerCallback(cq.id, '⏳ Menguji ping endpoint...', false, token);
    const testResult = await testSingleModel(ep, ep.models?.[0] || 'mercury-2');

    let msg = '';
    if (testResult.ok) {
      msg = `✅ [${ep.name}] Online!\nLatensi: ${testResult.latencyMs}ms\nStatus: HTTP 200 OK`;
    } else {
      msg = `❌ [${ep.name}] Gagal: ${testResult.error || 'Timeout/Error'} (${testResult.latencyMs}ms)`;
    }
    await answerCallback(cq.id, msg, true, token);
    return;
  }

  // 4f. Auto Detect Models for Provider
  if (data.startsWith('adm_prov_detect:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const ep = endpoints[idx];
    if (!ep) return;

    await answerCallback(cq.id, '🔍 Mendeteksi model dari /v1/models...', false, token);
    const res = await fetchAvailableModels(ep);
    if (res.ok && res.models && res.models.length > 0) {
      endpoints[idx].models = res.models;
      saveConfig({ endpoints });
      await answerCallback(cq.id, `✅ Terdeteksi ${res.models.length} model: ${res.models.slice(0, 3).join(', ')}...`, true, token);
    } else {
      await answerCallback(cq.id, `❌ Gagal: ${res.error || 'Endpoint tidak mengembalikan daftar model'}`, true, token);
    }
    cq.data = `adm_prov_det:${idx}`;
    return handleAdminCallback(cq, botService);
  }

  // 4g. Delete Provider
  if (data.startsWith('adm_prov_del:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    if (endpoints[idx]) {
      const removedName = endpoints[idx].name;
      endpoints.splice(idx, 1);
      saveConfig({ endpoints });
      await answerCallback(cq.id, `🗑️ Provider [${removedName}] telah dihapus`, true, token);
    }
    cq.data = 'adm_providers';
    return handleAdminCallback(cq, botService);
  }

  // 4h. Presets Menu
  if (data === 'adm_prov_presets') {
    await answerCallback(cq.id, null, false, token);
    const text = `➕ *Tambah Provider AI dari Template Cepat:*\n\n` +
      `Pilih template layanan AI di bawah untuk ditambahkan otomatis ke konfigurasi routing Anda:`;

    const rows = [
      [
        { text: '⚡ Inception Labs', callback_data: 'adm_add_preset:inception' },
        { text: '🟢 OpenAI', callback_data: 'adm_add_preset:openai' }
      ],
      [
        { text: '⚡ Groq Cloud', callback_data: 'adm_add_preset:groq' },
        { text: '🔵 DeepSeek API', callback_data: 'adm_add_preset:deepseek' }
      ],
      [
        { text: '🌐 OpenRouter', callback_data: 'adm_add_preset:openrouter' },
        { text: '🤝 Together AI', callback_data: 'adm_add_preset:together' }
      ],
      [
        { text: '💻 Ollama (Localhost)', callback_data: 'adm_add_preset:ollama' }
      ],
      [
        { text: '⬅️ Kembali ke Provider', callback_data: 'adm_providers' }
      ]
    ];
    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 4i. Add Preset Action
  if (data.startsWith('adm_add_preset:')) {
    const pKey = data.split(':')[1];
    const template = PRESET_TEMPLATES[pKey];
    if (template) {
      const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
      endpoints.push({ ...template, status: true, weight: 1 });
      saveConfig({ endpoints });
      await answerCallback(cq.id, `✅ Template [${template.name}] berhasil ditambahkan!`, true, token);
    }
    cq.data = 'adm_providers';
    return handleAdminCallback(cq, botService);
  }

  // ----------------------------------------------------
  // 5. GLOBAL ENGINE AI
  // ----------------------------------------------------
  if (data === 'adm_engine') {
    await answerCallback(cq.id, null, false, token);
    const temp = cfg.temperature ?? 0.7;
    const topP = cfg.topP ?? 1.0;
    const freq = cfg.frequencyPenalty ?? 0.0;
    const pres = cfg.presencePenalty ?? 0.0;
    const maxTok = cfg.maxTokens || 16384;
    const stream = cfg.forceStream === true ? 'Paksa Aktif' : (cfg.forceStream === false ? 'Paksa Mati' : 'Auto');
    const cache = cfg.cacheEnabled ? `🟢 Aktif (${cfg.cacheTTL || 3600}s)` : '🔴 Nonaktif';

    const text = `⚙️ *Konfigurasi Global Engine & Parameter AI*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Temperature (Kreativitas):* \`${temp}\`\n` +
      `• *Top-P Sampling:* \`${topP}\`\n` +
      `• *Frequency / Presence Penalty:* \`${freq} / ${pres}\`\n` +
      `• *Max Output Tokens:* \`${maxTok}\`\n` +
      `• *Mode Streaming:* \`${stream}\`\n` +
      `• *In-Memory Cache (RAM):* ${cache}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih parameter yang ingin diubah:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🎭 Master System Prompt', callback_data: 'adm_prompt_menu' },
          { text: `🌡️ Suhu: ${temp}`, callback_data: 'adm_params' }
        ],
        [
          { text: `🎛️ Top-P: ${topP}`, callback_data: 'adm_topp_menu' },
          { text: `🎚️ Penalties (${freq}/${pres})`, callback_data: 'adm_penalty_menu' }
        ],
        [
          { text: `🔢 Max Tokens: ${maxTok}`, callback_data: 'adm_tokens_menu' },
          { text: `🌊 Stream: ${stream}`, callback_data: 'adm_stream_menu' }
        ],
        [
          { text: `⚡ Cache RAM: ${cfg.cacheEnabled ? 'ON' : 'OFF'}`, callback_data: 'adm_cache_menu' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 5a. System Prompt Presets
  if (data === 'adm_prompt_menu') {
    await answerCallback(cq.id, null, false, token);
    const currentSnippet = (cfg.systemPrompt || '').slice(0, 150) + '...';
    const text = `🎭 *Master System Prompt Persona*\n\n` +
      `*Cuplikan System Prompt Saat Ini:*\n` +
      `_${currentSnippet}_\n\n` +
      `Pilih preset siap pakai di bawah, atau gunakan perintah \`/setprompt [teks]\` untuk instruksi khusus:`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Persona Standar Bre AI', callback_data: 'adm_setprompt:master' }
        ],
        [
          { text: '💻 Developer & Software Architect', callback_data: 'adm_setprompt:dev' }
        ],
        [
          { text: '🚀 Ringkas, Padat & To-The-Point', callback_data: 'adm_setprompt:speed' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setprompt:')) {
    const pType = data.split(':')[1];
    const promptText = PROMPT_PRESETS[pType];
    if (promptText) {
      saveConfig({ systemPrompt: promptText });
      await answerCallback(cq.id, `✅ Preset Prompt [${pType}] diterapkan!`, true, token);
    }
    cq.data = 'adm_prompt_menu';
    return handleAdminCallback(cq, botService);
  }

  // 5b. Temperature Selector
  if (data === 'adm_params') {
    await answerCallback(cq.id, null, false, token);
    const temp = cfg.temperature ?? 0.7;
    const text = `🌡️ *Pilih Tingkat Suhu Kreativitas (Temperature)*\n\n` +
      `Suhu saat ini: *${temp}*\n\n` +
      `• *0.2 Presisi:* Sangat konsisten, koding, matematika.\n` +
      `• *0.7 Seimbang:* Alami, responsif, percakapan umum.\n` +
      `• *1.0 Kreatif:* Penulisan kreatif, brainstorming ide.\n` +
      `• *1.5 Liar / Ekstrem:* Sangat variatif dan eksperimental.`;

    const markup = {
      inline_keyboard: [
        [
          { text: temp === 0.2 ? '✅ 🎯 0.2 (Presisi)' : '🎯 0.2 (Presisi)', callback_data: 'adm_settemp:0.2' },
          { text: temp === 0.7 ? '✅ ⚖️ 0.7 (Seimbang)' : '⚖️ 0.7 (Seimbang)', callback_data: 'adm_settemp:0.7' }
        ],
        [
          { text: temp === 1.0 ? '✅ 🎨 1.0 (Kreatif)' : '🎨 1.0 (Kreatif)', callback_data: 'adm_settemp:1.0' },
          { text: temp === 1.5 ? '✅ 🚀 1.5 (Liar)' : '🚀 1.5 (Liar)', callback_data: 'adm_settemp:1.5' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_settemp:')) {
    const newTemp = parseFloat(data.split(':')[1]);
    saveConfig({ temperature: newTemp });
    await answerCallback(cq.id, `✅ Suhu diubah ke: ${newTemp}`, false, token);
    cq.data = 'adm_params';
    return handleAdminCallback(cq, botService);
  }

  // 5c. Top-P Menu
  if (data === 'adm_topp_menu') {
    await answerCallback(cq.id, null, false, token);
    const topP = cfg.topP ?? 1.0;
    const text = `🎛️ *Pilih Top-P Nucleus Sampling*\n\n` +
      `Top-P saat ini: *${topP}*\n` +
      `Top-P membatasi distribusi probabilitas token untuk mengontrol keanekaragaman kata.`;

    const markup = {
      inline_keyboard: [
        [
          { text: topP === 0.5 ? '✅ 0.5' : '0.5', callback_data: 'adm_settopp:0.5' },
          { text: topP === 0.8 ? '✅ 0.8' : '0.8', callback_data: 'adm_settopp:0.8' }
        ],
        [
          { text: topP === 0.9 ? '✅ 0.9' : '0.9', callback_data: 'adm_settopp:0.9' },
          { text: topP === 1.0 ? '✅ 1.0 (Default)' : '1.0 (Default)', callback_data: 'adm_settopp:1.0' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_settopp:')) {
    const val = parseFloat(data.split(':')[1]);
    saveConfig({ topP: val });
    await answerCallback(cq.id, `✅ Top-P diubah ke: ${val}`, false, token);
    cq.data = 'adm_topp_menu';
    return handleAdminCallback(cq, botService);
  }

  // 5d. Penalties Menu
  if (data === 'adm_penalty_menu') {
    await answerCallback(cq.id, null, false, token);
    const freq = cfg.frequencyPenalty ?? 0.0;
    const pres = cfg.presencePenalty ?? 0.0;
    const text = `🎚️ *Pengaturan Frequency & Presence Penalty*\n\n` +
      `Saat ini: Frequency Penalty = \`${freq}\`, Presence Penalty = \`${pres}\`\n\n` +
      `• *Frequency Penalty:* Mencegah pengulangan kata yang sama.\n` +
      `• *Presence Penalty:* Mendorong model membahas topik-topik baru.`;

    const markup = {
      inline_keyboard: [
        [
          { text: (freq === 0.0 && pres === 0.0) ? '✅ Standar (0.0 / 0.0)' : 'Standar (0.0 / 0.0)', callback_data: 'adm_setpenalty:0.0:0.0' }
        ],
        [
          { text: (freq === 0.5 && pres === 0.5) ? '✅ Moderat (0.5 / 0.5)' : 'Moderat (0.5 / 0.5)', callback_data: 'adm_setpenalty:0.5:0.5' }
        ],
        [
          { text: (freq === 1.0 && pres === 1.0) ? '✅ Anti-Repetisi Kuat (1.0 / 1.0)' : 'Anti-Repetisi Kuat (1.0 / 1.0)', callback_data: 'adm_setpenalty:1.0:1.0' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setpenalty:')) {
    const parts = data.split(':');
    const freq = parseFloat(parts[1]);
    const pres = parseFloat(parts[2]);
    saveConfig({ frequencyPenalty: freq, presencePenalty: pres });
    await answerCallback(cq.id, `✅ Penalties diubah ke ${freq} / ${pres}`, false, token);
    cq.data = 'adm_penalty_menu';
    return handleAdminCallback(cq, botService);
  }

  // 5e. Max Output Tokens Menu
  if (data === 'adm_tokens_menu') {
    await answerCallback(cq.id, null, false, token);
    const maxTok = cfg.maxTokens || 16384;
    const text = `🔢 *Pilih Batas Maksimal Token Output (Max Tokens)*\n\n` +
      `Batas saat ini: *${maxTok} tokens*`;

    const markup = {
      inline_keyboard: [
        [
          { text: maxTok === 4096 ? '✅ 4,096' : '4,096', callback_data: 'adm_settokens:4096' },
          { text: maxTok === 8192 ? '✅ 8,192' : '8,192', callback_data: 'adm_settokens:8192' }
        ],
        [
          { text: maxTok === 16384 ? '✅ 16,384 (Default)' : '16,384 (Default)', callback_data: 'adm_settokens:16384' },
          { text: maxTok === 32768 ? '✅ 32,768 (Max)' : '32,768 (Max)', callback_data: 'adm_settokens:32768' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_settokens:')) {
    const val = parseInt(data.split(':')[1]);
    saveConfig({ maxTokens: val });
    await answerCallback(cq.id, `✅ Max Tokens diubah ke: ${val}`, false, token);
    cq.data = 'adm_tokens_menu';
    return handleAdminCallback(cq, botService);
  }

  // 5f. Streaming Mode Menu
  if (data === 'adm_stream_menu') {
    await answerCallback(cq.id, null, false, token);
    const st = cfg.forceStream === true ? 'true' : (cfg.forceStream === false ? 'false' : 'auto');
    const text = `🌊 *Pengaturan Mode Streaming Respon*\n\n` +
      `Mode saat ini: *${st === 'true' ? 'Paksa Streaming' : (st === 'false' ? 'Paksa Non-Streaming' : 'Auto (Ikuti Klien)')}*`;

    const markup = {
      inline_keyboard: [
        [
          { text: st === 'auto' ? '✅ 🌐 Auto (Ikuti Klien)' : '🌐 Auto (Ikuti Klien)', callback_data: 'adm_setstream:auto' }
        ],
        [
          { text: st === 'true' ? '✅ ⚡ Paksa Streaming Aktif' : '⚡ Paksa Streaming Aktif', callback_data: 'adm_setstream:true' }
        ],
        [
          { text: st === 'false' ? '✅ ⚪ Paksa Non-Streaming' : '⚪ Paksa Non-Streaming', callback_data: 'adm_setstream:false' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setstream:')) {
    const val = data.split(':')[1];
    const streamVal = val === 'true' ? true : (val === 'false' ? false : 'auto');
    saveConfig({ forceStream: streamVal });
    await answerCallback(cq.id, `✅ Mode stream diubah ke: ${val}`, false, token);
    cq.data = 'adm_stream_menu';
    return handleAdminCallback(cq, botService);
  }

  // 5g. Response Cache Menu
  if (data === 'adm_cache_menu') {
    await answerCallback(cq.id, null, false, token);
    const isCache = !!cfg.cacheEnabled;
    const ttl = cfg.cacheTTL || 3600;
    const text = `⚡ *In-Memory Response Caching (RAM)*\n\n` +
      `Status Cache: *${isCache ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `Masa Berlaku (TTL): *${ttl} detik* (${Math.round(ttl/60)} menit)\n\n` +
      `_Respon prompt identik non-streaming akan dijawab instan (0ms) dari RAM server._`;

    const markup = {
      inline_keyboard: [
        [
          { text: isCache ? '🔴 Matikan Cache' : '🟢 Aktifkan Cache', callback_data: 'adm_cache_toggle' }
        ],
        [
          { text: ttl === 900 ? '✅ 15 Menit' : '15 Menit', callback_data: 'adm_setcachettl:900' },
          { text: ttl === 3600 ? '✅ 1 Jam (Default)' : '1 Jam (Default)', callback_data: 'adm_setcachettl:3600' }
        ],
        [
          { text: ttl === 21600 ? '✅ 6 Jam' : '6 Jam', callback_data: 'adm_setcachettl:21600' },
          { text: ttl === 86400 ? '✅ 24 Jam' : '24 Jam', callback_data: 'adm_setcachettl:86400' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_cache_toggle') {
    const next = !cfg.cacheEnabled;
    saveConfig({ cacheEnabled: next });
    await answerCallback(cq.id, `Cache RAM ${next ? 'Diaktifkan 🟢' : 'Dinonaktifkan 🔴'}`, false, token);
    cq.data = 'adm_cache_menu';
    return handleAdminCallback(cq, botService);
  }

  if (data.startsWith('adm_setcachettl:')) {
    const ttl = parseInt(data.split(':')[1]);
    saveConfig({ cacheTTL: ttl });
    await answerCallback(cq.id, `✅ Cache TTL diubah ke: ${ttl}s`, false, token);
    cq.data = 'adm_cache_menu';
    return handleAdminCallback(cq, botService);
  }

  // ----------------------------------------------------
  // 6. SECURITY & CLIENT KEYS
  // ----------------------------------------------------
  if (data === 'adm_security') {
    await answerCallback(cq.id, null, false, token);
    const clientKeys = Array.isArray(cfg.clientKeys) ? cfg.clientKeys : [];
    const blacklist = Array.isArray(cfg.blacklist) ? cfg.blacklist : [];
    const rateMax = cfg.rateLimitMax || 5;
    const rateWin = cfg.rateLimitWindow || 30;

    const text = `🛡️ *Keamanan, Klien API & Kontrol Moderasi*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Client API Keys Terdaftar:* ${clientKeys.length} key\n` +
      `• *Rate Limit Anti-Spam:* Maks \`${rateMax} req\` per \`${rateWin} detik\`\n` +
      `• *Kata Terlarang (Blacklist):* ${blacklist.length} kata aktif\n` +
      `• *Master Client Key:* \`${cfg.clientApiKey ? cfg.clientApiKey.slice(0, 10) + '••••' : '(belum dibuat)'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih menu di bawah untuk mengelola:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔑 Multi-Client API Keys', callback_data: 'adm_clientkeys' },
          { text: '🎲 Master Client Key', callback_data: 'adm_masterkey' }
        ],
        [
          { text: `⏱️ Rate Limit (${rateMax}r/${rateWin}s)`, callback_data: 'adm_ratelimit_menu' },
          { text: `🚫 Blacklist (${blacklist.length})`, callback_data: 'adm_blacklist_menu' }
        ],
        [
          { text: '🔐 Ganti Password Admin', callback_data: 'adm_chpass_info' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 6a. Master Client Key Menu
  if (data === 'adm_masterkey') {
    await answerCallback(cq.id, null, false, token);
    const mKey = cfg.clientApiKey || '(belum dibuat)';
    const text = `🔑 *Master Client API Key*\n\n` +
      `Key ini dapat digunakan oleh aplikasi desktop/web eksternal (NextChat, Cherry Studio, Cline, dll) untuk mengakses endpoint proxy Bre AI.\n\n` +
      `• *Key Saat Ini:* \`${mKey}\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🎲 Generate Master Key Baru', callback_data: 'adm_gen_masterkey' }
        ],
        [
          { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_gen_masterkey') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let rand = 'sk-bre-';
    for (let i = 0; i < 32; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    saveConfig({ clientApiKey: rand });
    await answerCallback(cq.id, '✅ Master API Key baru berhasil dibuat!', true, token);
    cq.data = 'adm_masterkey';
    return handleAdminCallback(cq, botService);
  }

  // 6b. Multi-Client Keys Menu
  if (data === 'adm_clientkeys') {
    await answerCallback(cq.id, null, false, token);
    const clientKeys = Array.isArray(cfg.clientKeys) ? cfg.clientKeys : [];
    let text = `👥 *Manajemen Multi-Client API Keys*\n` +
      `Total Terdaftar: *${clientKeys.length} key*\n\n`;

    if (!clientKeys.length) {
      text += `_Belum ada Client API Key khusus. Buat di bawah:_\n`;
    } else {
      clientKeys.forEach((k, i) => {
        const masked = k.key ? (k.key.slice(0, 8) + '••••' + k.key.slice(-4)) : '-';
        const st = k.enabled !== false ? '🟢 Aktif' : '🔴 Revoked';
        text += `${i+1}. *${k.label || 'Klien'}* [${st}]\n   \`${masked}\`\n`;
      });
    }

    const rows = [];
    clientKeys.slice(0, 4).forEach((k, i) => {
      const isAct = k.enabled !== false;
      rows.push([
        { text: `${isAct ? '🔴 Cabut' : '🟢 Aktifkan'}: ${k.label || '#' + (i+1)}`, callback_data: `adm_ck_toggle:${i}` },
        { text: `🗑️ Hapus`, callback_data: `adm_ck_del:${i}` }
      ]);
    });

    rows.push([
      { text: '➕ Buat Key: Cherry Studio', callback_data: 'adm_ck_create:Cherry Studio' },
      { text: '➕ Buat Key: NextChat', callback_data: 'adm_ck_create:NextChat' }
    ]);
    rows.push([
      { text: '➕ Buat Key: Cline / VSCode', callback_data: 'adm_ck_create:Cline IDE' },
      { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  if (data.startsWith('adm_ck_toggle:')) {
    const idx = parseInt(data.split(':')[1]);
    const clientKeys = Array.isArray(cfg.clientKeys) ? [...cfg.clientKeys] : [];
    if (clientKeys[idx]) {
      clientKeys[idx].enabled = clientKeys[idx].enabled === false ? true : false;
      saveConfig({ clientKeys });
      await answerCallback(cq.id, `Status key [${clientKeys[idx].label}] diperbarui`, false, token);
    }
    cq.data = 'adm_clientkeys';
    return handleAdminCallback(cq, botService);
  }

  if (data.startsWith('adm_ck_del:')) {
    const idx = parseInt(data.split(':')[1]);
    const clientKeys = Array.isArray(cfg.clientKeys) ? [...cfg.clientKeys] : [];
    if (clientKeys[idx]) {
      const lbl = clientKeys[idx].label;
      clientKeys.splice(idx, 1);
      saveConfig({ clientKeys });
      await answerCallback(cq.id, `🗑️ Key [${lbl}] dihapus`, true, token);
    }
    cq.data = 'adm_clientkeys';
    return handleAdminCallback(cq, botService);
  }

  if (data.startsWith('adm_ck_create:')) {
    const label = data.split(':')[1] || 'Client App';
    const clientKeys = Array.isArray(cfg.clientKeys) ? [...cfg.clientKeys] : [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let rand = 'sk-bre-';
    for (let i = 0; i < 32; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));

    clientKeys.unshift({
      id: 'ck_' + Date.now(),
      label: label,
      key: rand,
      enabled: true,
      createdAt: new Date().toISOString()
    });
    saveConfig({ clientKeys });
    await answerCallback(cq.id, `✅ API Key baru untuk [${label}] dibuat!`, true, token);
    cq.data = 'adm_clientkeys';
    return handleAdminCallback(cq, botService);
  }

  // 6c. Rate Limiter Menu
  if (data === 'adm_ratelimit_menu') {
    await answerCallback(cq.id, null, false, token);
    const rMax = cfg.rateLimitMax || 5;
    const rWin = cfg.rateLimitWindow || 30;
    const text = `⏱️ *Pengaturan Batas Request Per IP (Rate Limiter)*\n\n` +
      `Batas saat ini: *${rMax} request* per *${rWin} detik*\n\n` +
      `Mencegah spam & penyalahgunaan endpoint API oleh pihak tidak berizin.`;

    const markup = {
      inline_keyboard: [
        [
          { text: (rMax === 3 && rWin === 30) ? '✅ Ketat (3 req / 30s)' : 'Ketat (3 req / 30s)', callback_data: 'adm_setratelimit:3:30' }
        ],
        [
          { text: (rMax === 5 && rWin === 30) ? '✅ Standar (5 req / 30s)' : 'Standar (5 req / 30s)', callback_data: 'adm_setratelimit:5:30' }
        ],
        [
          { text: (rMax === 15 && rWin === 30) ? '✅ Santai (15 req / 30s)' : 'Santai (15 req / 30s)', callback_data: 'adm_setratelimit:15:30' }
        ],
        [
          { text: (rMax === 50 && rWin === 60) ? '✅ Tinggi (50 req / 60s)' : 'Tinggi (50 req / 60s)', callback_data: 'adm_setratelimit:50:60' }
        ],
        [
          { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setratelimit:')) {
    const parts = data.split(':');
    const rMax = parseInt(parts[1]);
    const rWin = parseInt(parts[2]);
    saveConfig({ rateLimitMax: rMax, rateLimitWindow: rWin });
    await answerCallback(cq.id, `✅ Rate limit diubah ke ${rMax} req / ${rWin}s`, false, token);
    cq.data = 'adm_ratelimit_menu';
    return handleAdminCallback(cq, botService);
  }

  // 6d. Blacklist Moderation Menu
  if (data === 'adm_blacklist_menu') {
    await answerCallback(cq.id, null, false, token);
    const list = Array.isArray(cfg.blacklist) ? cfg.blacklist : [];
    let text = `🛡️ *Daftar Kata Terlarang (Content Moderation)*\n\n` +
      `Total kata terlarang: *${list.length} kata*\n\n`;

    if (list.length > 0) {
      text += `*Daftar Kata Terlarang:*\n` + list.map(w => `• \`${w}\``).join('\n') + `\n\n`;
    } else {
      text += `_Belum ada kata terlarang yang didaftarkan._\n\n`;
    }

    text += `💡 *Cara Menambah Kata:*\nKetik perintah: \`/blacklist add [kata]\`\n_Contoh:_ \`/blacklist add spam_phrase\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🗑️ Kosongkan Semua Blacklist', callback_data: 'adm_clear_blacklist' }
        ],
        [
          { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_clear_blacklist') {
    saveConfig({ blacklist: [] });
    await answerCallback(cq.id, '🗑️ Blacklist kata berhasil dikosongkan!', true, token);
    cq.data = 'adm_blacklist_menu';
    return handleAdminCallback(cq, botService);
  }

  // 6e. Change Password Info
  if (data === 'adm_chpass_info') {
    await answerCallback(cq.id, null, false, token);
    const text = `🔐 *Ganti Password Login Web Admin*\n\n` +
      `Untuk mengganti password login Web Admin panel Anda secara langsung dari Telegram, gunakan format perintah:\n\n` +
      `\`/setpassword [password_baru_anda]\`\n\n` +
      `_Contoh:_\n\`/setpassword rahasia12345\`\n\n` +
      `Perubahan password akan langsung berlaku untuk Web Admin Dashboard.`;

    const markup = {
      inline_keyboard: [
        [{ text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // ----------------------------------------------------
  // 7. TELEGRAM BOT SETTINGS & WEBHOOK
  // ----------------------------------------------------
  if (data === 'adm_telegram') {
    await answerCallback(cq.id, null, false, token);
    const accessMode = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Whitelist' : '🟢 Publik';
    const activeModel = cfg.telegramModel || cfg.model || 'mercury-2';
    const activeLang = LANGUAGE_LABELS[cfg.telegramLanguage || 'id'] || '🇮🇩 Indonesia';
    const usersCount = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers.length : 0;

    const text = `🤖 *Pengaturan Bot Telegram & Akses Serverless*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Mode Akses:* ${accessMode}\n` +
      `• *Model AI Default:* \`${activeModel}\`\n` +
      `• *Bahasa Default:* ${activeLang}\n` +
      `• *Pengguna Terdaftar:* ${usersCount} akun\n` +
      `• *Admin Chat ID:* \`${cfg.telegramOwnerId || '-'}\`\n` +
      `• *Domain Webhook:* \`${cfg.telegramDomain || '(auto)'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih menu pengaturan bot:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: `🛡️ Mode: ${accessMode}`, callback_data: 'adm_mode' },
          { text: '🔄 Ganti Model AI', callback_data: 'adm_models' }
        ],
        [
          { text: `🌐 Bahasa: ${activeLang}`, callback_data: 'adm_language' },
          { text: `👥 Kelola Pengguna (${usersCount})`, callback_data: 'adm_users' }
        ],
        [
          { text: '🩺 Diagnostik Webhook 24/7', callback_data: 'adm_diag' },
          { text: '🔄 Set Webhook', callback_data: 'adm_setup_webhook' }
        ],
        [
          { text: '♻️ Restart Service Bot', callback_data: 'adm_restart_bot' },
          { text: '🛑 Stop Service Bot', callback_data: 'adm_stop_bot' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 7a. Webhook Actions
  if (data === 'adm_setup_webhook') {
    const domain = (cfg.telegramDomain || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!domain) {
      await answerCallback(cq.id, 'Domain bot belum disetel di config. Buka Web Admin untuk set domain.', true, token);
      return;
    }
    const webhookUrl = `https://${domain}/api/telegram?t=${encodeURIComponent(cfg.telegramBotToken || '')}&o=${encodeURIComponent(cfg.telegramOwnerId || '')}`;
    try {
      await apiCall('setWebhook', { url: webhookUrl }, token);
      await answerCallback(cq.id, `✅ Webhook 24/7 berhasil dipasang ke https://${domain}/api/telegram`, true, token);
    } catch (e) {
      await answerCallback(cq.id, `❌ Gagal pasang webhook: ${e.message}`, true, token);
    }
    cq.data = 'adm_diag';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_del_webhook') {
    try {
      await apiCall('deleteWebhook', { drop_pending_updates: false }, token);
      await answerCallback(cq.id, '✅ Webhook dihapus (Mode Polling Aktif)', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Gagal hapus webhook: ${e.message}`, true, token);
    }
    cq.data = 'adm_diag';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_restart_bot') {
    try {
      await botService.restart();
      await answerCallback(cq.id, '♻️ Bot service berhasil direstart!', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Error restart: ${e.message}`, true, token);
    }
    cq.data = 'adm_telegram';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_stop_bot') {
    try {
      botService.stop();
      await answerCallback(cq.id, '🛑 Bot service dihentikan', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Error stop: ${e.message}`, true, token);
    }
    cq.data = 'adm_telegram';
    return handleAdminCallback(cq, botService);
  }

  // ----------------------------------------------------
  // 8. CLOUD STORAGE & PERSISTENCE
  // ----------------------------------------------------
  if (data === 'adm_cloud') {
    await answerCallback(cq.id, null, false, token);
    const st = getCloudStorageInfo();
    let modeText = '💾 File Lokal / Zero-DB';
    if (st.upstashActive) modeText = '🟢 Vercel KV / Upstash Redis Aktif';
    else if (st.githubActive) modeText = '🟢 GitHub Auto-Commit Aktif';

    const text = `☁️ *Status Penyimpanan Cloud & Persistensi*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Mode Penyimpanan:* ${modeText}\n` +
      `• *Vercel KV / Upstash:* ${st.upstashActive ? '🟢 Terhubung' : '⚪ Belum disetel'}\n` +
      `• *GitHub Auto-Commit:* ${st.githubActive ? '🟢 Terhubung' : '⚪ Belum disetel'}\n` +
      `• *Serverless Ready:* ${st.isServerless ? '🟢 Vercel Cloud' : '💻 Local/VPS'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih opsi pengujian koneksi cloud di bawah:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Test Upstash / Vercel KV', callback_data: 'adm_test_upstash' }
        ],
        [
          { text: '🐙 Test GitHub Sync', callback_data: 'adm_test_github' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_test_upstash') {
    await answerCallback(cq.id, '⏳ Menguji koneksi Upstash Redis...', false, token);
    const res = await testUpstash(cfg.upstashRedisUrl, cfg.upstashRedisToken);
    await answerCallback(cq.id, res.ok ? `✅ ${res.message}` : `❌ ${res.error}`, true, token);
    return;
  }

  if (data === 'adm_test_github') {
    await answerCallback(cq.id, '⏳ Menguji koneksi GitHub API...', false, token);
    const res = await testGitHub(cfg.githubToken, cfg.githubRepo, cfg.githubBranch);
    await answerCallback(cq.id, res.ok ? `✅ ${res.message}` : `❌ ${res.error}`, true, token);
    return;
  }

  // ----------------------------------------------------
  // 9. LIVE MODEL TESTER
  // ----------------------------------------------------
  if (data === 'adm_tester') {
    await answerCallback(cq.id, null, false, token);
    const currentModel = cfg.telegramModel || cfg.model || 'mercury-2';

    const text = `🧪 *Live Model Query & Latency Tester*\n\n` +
      `Uji kecepatan dan responsivitas model AI upstream langsung dari Telegram tanpa perlu membuka Web Admin:\n\n` +
      `• *Model Uji Default:* \`${currentModel}\``;

    const markup = {
      inline_keyboard: [
        [
          { text: `⚡ Tes Model: ${currentModel}`, callback_data: `adm_run_test:${currentModel}` }
        ],
        [
          { text: '🔄 Ganti Model Uji', callback_data: 'adm_models' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_run_test:')) {
    const targetModel = data.split(':')[1] || 'mercury-2';
    await answerCallback(cq.id, `⏳ Menguji model ${targetModel}...`, false, token);
    await editTelegramMessage(chatId, messageId, `⏳ *Sedang Mengirim Test Query ke [${targetModel}]...*\nMohon tunggu beberapa detik...`, null, token);

    const startTime = Date.now();
    try {
      const probePrompt = 'Hai Bre AI, perkenalkan dirimu secara singkat.';
      const answer = await botService.queryBreAIRouter(probePrompt, [{ role: 'user', content: probePrompt }]);
      const elapsed = Date.now() - startTime;

      const resultText = `✅ *Hasil Live Test Model:*\n\n` +
        `• *Model:* \`${targetModel}\`\n` +
        `• *Latensi:* \`${elapsed} ms\`\n` +
        `• *Status HTTP:* 200 OK\n\n` +
        `*Cuplikan Respon:*\n"${answer.slice(0, 180)}..."`;

      const markup = {
        inline_keyboard: [
          [
            { text: '⚡ Uji Ulang', callback_data: `adm_run_test:${targetModel}` },
            { text: '⬅️ Menu Tester', callback_data: 'adm_tester' }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, resultText, markup, token);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const failText = `❌ *Live Test Gagal:*\n\n` +
        `• *Model:* \`${targetModel}\`\n` +
        `• *Latensi:* \`${elapsed} ms\`\n` +
        `• *Error:* \`${err.message}\``;

      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Coba Lagi', callback_data: `adm_run_test:${targetModel}` },
            { text: '⬅️ Menu Tester', callback_data: 'adm_tester' }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, failText, markup, token);
    }
    return;
  }

  // ----------------------------------------------------
  // 10. BACKUP & MAINTENANCE
  // ----------------------------------------------------
  if (data === 'adm_backup') {
    await answerCallback(cq.id, null, false, token);
    const text = `📦 *Backup, Export & Maintenance Sistem*\n\n` +
      `• *Export Backup:* Unduh seluruh isi file \`config.json\` langsung ke chat Telegram Anda.\n` +
      `• *Bersihkan Cache RAM:* Kosongkan respon cache instan dan hapus sesi chat yang sedang berjalan.\n` +
      `• *Reset Pabrik:* Kembalikan seluruh pengaturan proxy router ke default awal.`;

    const markup = {
      inline_keyboard: [
        [
          { text: '📥 Export config.json ke Telegram', callback_data: 'adm_export_config' }
        ],
        [
          { text: '🗑️ Bersihkan Cache RAM & Sesi', callback_data: 'adm_flush_confirm' }
        ],
        [
          { text: '⚠️ Reset ke Default Pabrik', callback_data: 'adm_reset_confirm' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 10a. Export config.json directly to chat
  if (data === 'adm_export_config') {
    await answerCallback(cq.id, '📦 Menyiapkan berkas backup config.json...', false, token);
    const fullConfig = getConfig();
    const configStr = JSON.stringify(fullConfig, null, 2);
    const fileName = `bre_ai_config_${new Date().toISOString().slice(0, 10)}.json`;
    const caption = `📦 *Backup Konfigurasi Bre AI*\nTanggal: ${new Date().toLocaleString('id-ID')}\n_Simpan berkas ini untuk pemulihan konfigurasi di masa mendatang._`;

    try {
      await sendTelegramDocument(chatId, fileName, configStr, caption, token);
      await answerCallback(cq.id, '✅ Berkas config.json berhasil dikirim!', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Gagal kirim berkas: ${e.message}`, true, token);
    }
    return;
  }

  // 10b. Reset to Factory Default
  if (data === 'adm_reset_confirm') {
    await answerCallback(cq.id, null, false, token);
    const text = `⚠️ *KONFIRMASI RESET PENGATURAN AWAL*\n\n` +
      `Apakah Anda yakin ingin mengembalikan SELURUH konfigurasi proxy router ke pengaturan bawaan pabrik?\n\n` +
      `Seluruh endpoint kustom dan API key klien akan direset.`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚠️ Ya, Reset ke Default', callback_data: 'adm_reset_exec' }
        ],
        [
          { text: '❌ Batalkan', callback_data: 'adm_backup' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_reset_exec') {
    const defConfig = {
      endpoints: [{
        name: "Inception Labs",
        url: "https://api.inceptionlabs.ai/v1/chat/completions",
        keys: [],
        models: ["mercury-2"]
      }],
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 16384,
      autoFailover: true,
      cacheEnabled: false,
      blacklist: [],
      clientKeys: []
    };
    saveConfig(defConfig);
    await answerCallback(cq.id, '🔄 Pengaturan berhasil direset ke Default Pabrik!', true, token);
    cq.data = 'adm_backup';
    return handleAdminCallback(cq, botService);
  }

  // ----------------------------------------------------
  // 11. NEW USER APPROVAL ACTIONS
  // ----------------------------------------------------
  if (data.startsWith('adm_appr_wl:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    const uName = recentObj?.username || '';
    const uFullName = recentObj?.name || `User ${targetId}`;

    setUserRole(targetId, uName, uFullName, 'whitelist');
    await answerCallback(cq.id, `✅ User ${uFullName} (@${uName || targetId}) berhasil diizinkan (Whitelist)!`, true, token);

    // Notify the user that their access was approved
    try {
      const greetText = `🎉 *Akses Bre AI Disetujui!*\n\nHalo ${uFullName}! Permintaan akses Anda telah disetujui oleh Owner. Sekarang Anda dapat menggunakan seluruh fitur kecerdasan Bre AI secara leluasa.\n\n_Kirim pesan atau pertanyaan apa pun untuk mulai berdiskusi!_ 🚀`;
      await sendTelegramMessage(targetId, greetText, null, null, token);
    } catch (e) {}

    // Update the notification message in Owner's chat
    const updatedAlert = (cq.message?.text || '') + `\n\n✅ *STATUS: Disetujui (Whitelist) oleh Owner pada ${new Date().toLocaleTimeString('id-ID')}*`;
    await editTelegramMessage(chatId, messageId, updatedAlert, null, token);
    return;
  }

  if (data.startsWith('adm_appr_bl:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    const uName = recentObj?.username || '';
    const uFullName = recentObj?.name || `User ${targetId}`;

    setUserRole(targetId, uName, uFullName, 'blocked');
    await answerCallback(cq.id, `🔴 User ${uFullName} (@${uName || targetId}) telah diblokir!`, true, token);

    const updatedAlert = (cq.message?.text || '') + `\n\n🔴 *STATUS: Ditolak & Diblokir oleh Owner pada ${new Date().toLocaleTimeString('id-ID')}*`;
    await editTelegramMessage(chatId, messageId, updatedAlert, null, token);
    return;
  }

  if (data.startsWith('adm_appr_ign:')) {
    await answerCallback(cq.id, 'Notifikasi diabaikan', false, token);
    const updatedAlert = (cq.message?.text || '') + `\n\n⚪ *STATUS: Diabaikan oleh Owner.*`;
    await editTelegramMessage(chatId, messageId, updatedAlert, null, token);
    return;
  }

  // ----------------------------------------------------
  // 12. EXISTING HANDLERS (Models, Language, Mode, Benchmark, Users)
  // ----------------------------------------------------
  if (data === 'adm_models') {
    await answerCallback(cq.id, null, false, token);
    const currentModel = cfg.telegramModel || cfg.model || 'mercury-2';
    const allModels = new Set();
    allModels.add(currentModel);

    if (Array.isArray(cfg.endpoints)) {
      cfg.endpoints.forEach(ep => {
        if (ep.name) allModels.add(ep.name.trim());
        (ep.models || []).forEach(m => allModels.add(m));
      });
    }
    allModels.delete('auto');

    const rows = [];
    Array.from(allModels).slice(0, 30).forEach(m => {
      const isSelected = (m === currentModel);
      rows.push([{
        text: isSelected ? `✅ ${m}` : m,
        callback_data: `adm_setmodel:${m}`
      }]);
    });

    rows.push([
      { text: currentModel === 'auto' ? '✅ 🌐 Auto Router' : '🌐 Ikuti Auto Router', callback_data: 'adm_setmodel:auto' }
    ]);
    rows.push([{ text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }]);

    const text = `🔄 *Pilih Model AI untuk Telegram:*\n` +
      `Model aktif saat ini: \`${currentModel || 'Auto Router'}\`\n\n` +
      `_Pilih model di bawah untuk mengganti model secara instan:_`;
    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  if (data.startsWith('adm_setmodel:')) {
    const selected = data.split(':')[1];
    const targetModel = selected === 'auto' ? 'auto' : selected;
    saveConfig({ telegramModel: targetModel });
    await answerCallback(cq.id, `✅ Model diubah ke: ${targetModel || 'Auto Router'}`, false, token);

    cq.data = 'adm_models';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_mode') {
    await answerCallback(cq.id, null, false, token);
    const currentMode = cfg.telegramAccessMode || 'public';
    const text = `🛡️ *Pengaturan Mode Akses Bot:*\n` +
      `Mode saat ini: *${currentMode === 'whitelist' ? '🔒 Khusus Whitelist' : '🟢 Terbuka untuk Publik'}*\n\n` +
      `• *Mode Publik:* Siapa saja di Telegram dapat mengobrol dengan bot (kecuali yang diblokir).\n` +
      `• *Mode Whitelist:* Hanya akun Owner dan user yang telah terdaftar di Whitelist yang dapat mengobrol.\n\n` +
      `Klik tombol di bawah untuk mengganti mode:`;
    const markup = {
      inline_keyboard: [
        [
          { text: currentMode === 'public' ? '✅ 🟢 Buka untuk Publik' : '🟢 Buka untuk Publik', callback_data: 'adm_setmode:public' }
        ],
        [
          { text: currentMode === 'whitelist' ? '✅ 🔒 Khusus Whitelist' : '🔒 Khusus Whitelist', callback_data: 'adm_setmode:whitelist' }
        ],
        [
          { text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setmode:')) {
    const newMode = data.split(':')[1];
    saveConfig({ telegramAccessMode: newMode });
    botService.activeAccessMode = newMode;
    await answerCallback(cq.id, `✅ Mode bot diubah ke: ${newMode === 'whitelist' ? '🔒 Khusus Whitelist' : '🟢 Publik'}`, false, token);

    cq.data = 'adm_mode';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_language') {
    await answerCallback(cq.id, null, false, token);
    const currentLang = cfg.telegramLanguage || 'id';
    const langText = `🌐 *Pengaturan Bahasa Default Bot:*\n` +
      `Bahasa aktif: *${LANGUAGE_LABELS[currentLang] || 'Bahasa Indonesia'}*\n\n` +
      `Pilih bahasa default respons Bre AI untuk semua pengguna bot:\n` +
      `_(Pengguna individual dapat mengubah bahasa mereka sendiri dengan perintah /language)_`;

    const langRows = Object.entries(LANGUAGE_LABELS).map(([code, label]) => ([
      {
        text: (code === currentLang ? '✅ ' : '') + label,
        callback_data: `adm_setlang:${code}`
      }
    ]));
    langRows.push([{ text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }]);

    await editTelegramMessage(chatId, messageId, langText, { inline_keyboard: langRows }, token);
    return;
  }

  if (data.startsWith('adm_setlang:')) {
    const newLang = data.split(':')[1];
    const langLabel = LANGUAGE_LABELS[newLang] || newLang;
    saveConfig({ telegramLanguage: newLang });
    await answerCallback(cq.id, `✅ Bahasa default diubah ke: ${langLabel}`, true, token);

    cq.data = 'adm_language';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_users') {
    await answerCallback(cq.id, null, false, token);
    const users = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers : [];
    const recent = getRecentUsersList();

    let text = `👥 *Manajemen Pengguna Telegram*\n` +
      `• Terdaftar di Database: ${users.length} user\n` +
      `• Pengguna Terlihat Baru: ${recent.length} user\n\n`;

    if (users.length > 0) {
      text += `*Daftar User Terdaftar (10 Teratas):*\n`;
      users.slice(0, 10).forEach((u, i) => {
        const badge = u.role === 'owner' ? '👑 Owner' : (u.role === 'blocked' ? '🔴 Blocked' : '🟢 Whitelist');
        text += `${i+1}. *${u.name || u.username || u.id}* [${badge}]\n   \`${u.username ? '@' + u.username : u.id}\`\n`;
      });
    } else {
      text += `_Belum ada user khusus terdaftar._\n`;
    }

    const rows = [];
    const unregisteredRecent = recent.filter(r => !users.some(u => String(u.id) === String(r.id))).slice(0, 3);
    if (unregisteredRecent.length > 0) {
      unregisteredRecent.forEach(r => {
        rows.push([{
          text: `🟢 Izinkan Baru: @${r.username || r.name} (${r.id})`,
          callback_data: `adm_addrecent:${r.id}`
        }]);
      });
    }

    rows.push([
      { text: '🔄 Refresh Pengguna', callback_data: 'adm_users' },
      { text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  if (data.startsWith('adm_addrecent:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    if (recentObj) {
      setUserRole(targetId, recentObj.username, recentObj.name, 'whitelist');
      await answerCallback(cq.id, `✅ User @${recentObj.username || recentObj.name} ditambahkan ke Whitelist!`, true, token);
    } else {
      await answerCallback(cq.id, 'User tidak ditemukan dalam sesi aktif', false, token);
    }
    cq.data = 'adm_users';
    return handleAdminCallback(cq, botService);
  }

  if (data === 'adm_benchmark') {
    await answerCallback(cq.id, '⏳ Menguji kecepatan seluruh provider...', false, token);
    await editTelegramMessage(chatId, messageId, `⏳ *Sedang Menjalankan Parallel Latency Probe Benchmark...*\nMohon tunggu beberapa detik...`, null, token);

    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!endpoints.length) {
      await editTelegramMessage(chatId, messageId, '⚠️ Tidak ada endpoint provider yang terkonfigurasi.', {
        inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'adm_providers' }]]
      }, token);
      return;
    }

    const results = await Promise.all(
      endpoints.map(async (ep, idx) => {
        const start = Date.now();
        const testRes = await testSingleModel(ep, ep.models?.[0] || 'mercury-2');
        return {
          name: ep.name || `Provider #${idx+1}`,
          model: ep.models?.[0] || 'mercury-2',
          ok: testRes.ok,
          latencyMs: testRes.latencyMs || (Date.now() - start),
          error: testRes.error || null
        };
      })
    );

    results.sort((a, b) => {
      if (a.ok && !b.ok) return -1;
      if (!a.ok && b.ok) return 1;
      return a.latencyMs - b.latencyMs;
    });

    let text = `🏆 *Leaderboard Kecepatan Upstream Provider*\n\n`;
    results.forEach((item, i) => {
      const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}.`));
      const st = item.ok ? `🟢 ${item.latencyMs}ms` : `🔴 Gagal (${item.error?.slice(0, 30) || 'Error'})`;
      text += `${medal} *${item.name}* (\`${item.model}\`)\n   Kecepatan: ${st}\n\n`;
    });

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Uji Ulang Benchmark', callback_data: 'adm_benchmark' },
          { text: '⬅️ Daftar Provider', callback_data: 'adm_providers' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_diag') {
    await answerCallback(cq.id, 'Memeriksa status webhook...', false, token);
    let webhookInfo = {};
    try {
      webhookInfo = await apiCall('getWebhookInfo', {}, token);
    } catch(e) {
      webhookInfo = { error: e.message };
    }

    const text = `🩺 *Diagnostik Serverless Webhook Telegram:*\n\n` +
      `• *URL Webhook:* \`${webhookInfo.url || '(Belum disetel / Polling)'}\`\n` +
      `• *Antrean Pesan Pending:* \`${webhookInfo.pending_update_count || 0} pesan\`\n` +
      `• *Koneksi Terakhir:* ${webhookInfo.last_error_date ? '⚠️ Ada Error' : '🟢 Normal'}\n` +
      (webhookInfo.last_error_message ? `• *Pesan Error:* \`${webhookInfo.last_error_message}\`\n` : '') +
      `• *Node.js Runtime:* \`${process.version}\`\n` +
      `• *Platform Server:* \`${process.env.VERCEL ? 'Vercel Lambda' : 'Local Server'}\`\n` +
      `• *Uptime Server:* \`${Math.round(process.uptime())} detik\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Cek Ulang Diagnostik', callback_data: 'adm_diag' },
          { text: '⬅️ Pengaturan Bot', callback_data: 'adm_telegram' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_broadcast') {
    await answerCallback(cq.id, null, false, token);
    const recent = getRecentUsersList();
    const text = `📢 *Broadcast Pengumuman ke Semua Pengguna*\n\n` +
      `• Target Pengguna Aktif: *${recent.length} akun*\n\n` +
      `Untuk mengirim siaran ke semua pengguna, ketikkan perintah:\n` +
      `\`/broadcast [Pesan Anda]\`\n\n` +
      `_Contoh:_\n\`/broadcast Halo sahabat Bre AI! Kami baru saja memperbarui kecerdasan model ke versi terbaru 🚀\``;

    const markup = {
      inline_keyboard: [
        [{ text: '⬅️ Menu Utama', callback_data: 'adm_main' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_flush_confirm') {
    await answerCallback(cq.id, null, false, token);
    const text = `⚠️ *Konfirmasi Pembersihan Cache RAM & Sesi Chat:*\n\n` +
      `Apakah Anda yakin ingin mengosongkan seluruh respon cache in-memory dan membersihkan riwayat sesi obrolan Telegram?\n\n` +
      `Tindakan ini aman dan langsung membebaskan memori RAM server.`;
    const markup = {
      inline_keyboard: [
        [
          { text: '🗑️ Ya, Kosongkan Cache RAM & Sesi', callback_data: 'adm_flush_exec' }
        ],
        [
          { text: '❌ Batalkan', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_flush_exec') {
    clearResponseCache();
    botService.conversations.clear();
    await answerCallback(cq.id, '⚡ Cache RAM & sesi berhasil dibersihkan!', true, token);

    const text = getMainMenuText(senderName, botService.conversations.size);
    const markup = buildMainMenuMarkup(cfg);
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }
}

module.exports = {
  buildMainMenuMarkup,
  getMainMenuText,
  sendAdminPanel,
  handleAdminCallback
};
