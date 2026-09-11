// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Providers & Routing
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  fetchAvailableModels,
  testSingleModel
} = require('../../../api/_shared');
const api = require('../api');
const { PRESET_TEMPLATES } = require('./menuBuilder');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const cfg = getConfig();

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
      { text: '➕ Tambah Preset', callback_data: 'adm_prov_presets' },
      { text: '✍️ Tambah Manual', callback_data: 'adm_prov_manual' }
    ]);
    rows.push([
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
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 4b. Toggle Auto Failover
  if (data === 'adm_toggle_af') {
    const current = cfg.autoFailover !== false;
    const nextVal = !current;
    saveConfig({ autoFailover: nextVal });
    await answerCallback(cq.id, `Auto-Failover ${nextVal ? 'Diaktifkan 🟢' : 'Dinonaktifkan 🔴'}`, false, token);
    cq.data = 'adm_providers';
    return (router ? router(cq, botService) : handle(cq, botService, router));
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
      return (router ? router(cq, botService) : handle(cq, botService, router));
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
          { text: isActive ? '🔴 Nonaktifkan' : '🟢 Aktifkan', callback_data: `adm_prov_toggle:${idx}` },
          { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${idx}` }
        ],
        [
          { text: '✏️ Edit URL / Model / Nama', callback_data: `adm_prov_edit:${idx}` },
          { text: '🔑 Kelola API Key', callback_data: `adm_prov_keys:${idx}` }
        ],
        [
          { text: '🔍 Detect Model', callback_data: `adm_prov_detect:${idx}` },
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

  // 4c-edit. Edit Provider Main Hub
  if (data.startsWith('adm_prov_edit:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      cq.data = 'adm_providers';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const keyCount = Array.isArray(ep.keys) ? ep.keys.length : (ep.keys ? 1 : 0);
    const text = `✏️ *Edit Provider #${idx+1}: ${ep.name || 'Unnamed'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Nama:* \`${ep.name || '-'}\`\n` +
      `• *Base URL:* \`${ep.url || '-'}\`\n` +
      `• *Model Aktif:* \`${(ep.models || []).join(', ') || '-'}\`\n` +
      `• *Bobot (Weight):* \`${ep.weight || 1}\`\n` +
      `• *API Keys:* ${keyCount} key terpasang\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih bagian yang ingin diubah atau ketik perintah langsung via chat:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🌐 Ganti Base URL', callback_data: `adm_prov_edit_url:${idx}` },
          { text: '🤖 Ganti Model', callback_data: `adm_prov_edit_model:${idx}` }
        ],
        [
          { text: '🏷️ Ganti Nama', callback_data: `adm_prov_edit_name:${idx}` },
          { text: '⚖️ Ubah Bobot (Weight)', callback_data: `adm_prov_edit_weight:${idx}` }
        ],
        [
          { text: '🔑 Kelola / Ganti API Key', callback_data: `adm_prov_keys:${idx}` }
        ],
        [
          { text: `⬅️ Kembali ke Detail [${ep.name || 'Provider'}]`, callback_data: `adm_prov_det:${idx}` }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4c-edit-url. Edit Provider Base URL Guide
  if (data.startsWith('adm_prov_edit_url:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      cq.data = 'adm_providers';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const text = `🌐 *Ganti Base URL Provider: ${ep.name}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *URL Saat Ini:* \`${ep.url || '-'}\`\n\n` +
      `Ketik perintah berikut di chat untuk mengganti URL:\n` +
      `\`\`\`\n/seturl ${idx+1} [URL_BARU]\n\`\`\`\n` +
      `📌 *Contoh:*\n` +
      `\`/seturl ${idx+1} https://api.openai.com/v1/chat/completions\`\n` +
      `\`/seturl ${idx+1} https://api.deepseek.com/chat/completions\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '⬅️ Kembali ke Menu Edit', callback_data: `adm_prov_edit:${idx}` }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4c-edit-model. Edit Provider Model Guide
  if (data.startsWith('adm_prov_edit_model:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      cq.data = 'adm_providers';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const currentModel = (ep.models || []).join(', ') || 'default';
    const text = `🤖 *Ganti Model Provider: ${ep.name}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Model Saat Ini:* \`${currentModel}\`\n\n` +
      `Ketik perintah berikut di chat untuk mengganti model:\n` +
      `\`\`\`\n/setmodel ${idx+1} [NAMA_MODEL_BARU]\n\`\`\`\n` +
      `📌 *Contoh:*\n` +
      `\`/setmodel ${idx+1} mercury-2\`\n` +
      `\`/setmodel ${idx+1} deepseek-chat\`\n` +
      `\`/setmodel ${idx+1} gpt-4o\`\n` +
      `\`/setmodel ${idx+1} llama-3.3-70b-versatile\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔍 Auto-Detect dari /v1/models', callback_data: `adm_prov_detect:${idx}` }
        ],
        [
          { text: '⬅️ Kembali ke Menu Edit', callback_data: `adm_prov_edit:${idx}` }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4c-edit-name. Edit Provider Name Guide
  if (data.startsWith('adm_prov_edit_name:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      cq.data = 'adm_providers';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const text = `🏷️ *Ganti Nama Label Provider*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Nama Saat Ini:* \`${ep.name || '-'}\`\n\n` +
      `Ketik perintah berikut di chat untuk mengganti nama:\n` +
      `\`\`\`\n/setname ${idx+1} [NAMA_BARU]\n\`\`\`\n` +
      `📌 *Contoh:*\n` +
      `\`/setname ${idx+1} Inception Primary\`\n` +
      `\`/setname ${idx+1} DeepSeek Backup\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '⬅️ Kembali ke Menu Edit', callback_data: `adm_prov_edit:${idx}` }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4c-edit-weight. Edit Provider Weight Hub
  if (data.startsWith('adm_prov_edit_weight:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      cq.data = 'adm_providers';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const curWeight = ep.weight || 1;
    const text = `⚖️ *Atur Bobot (Weight) Provider: ${ep.name}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Bobot Saat Ini:* *${curWeight}*\n` +
      `_Bobot menentukan proporsi distribusi beban trafik pada mode routing Weighted._\n\n` +
      `Pilih nilai bobot cepat di bawah atau ketik \`/setweight ${idx+1} [1-10]\`:`;

    const weights = [1, 2, 3, 5, 10];
    const weightButtons = weights.map(w => ({
      text: (w === curWeight ? '✅ ' : '') + `Bobot ${w}`,
      callback_data: `adm_prov_setweight:${idx}:${w}`
    }));

    const markup = {
      inline_keyboard: [
        weightButtons.slice(0, 3),
        weightButtons.slice(3),
        [
          { text: '⬅️ Kembali ke Menu Edit', callback_data: `adm_prov_edit:${idx}` }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4c-setweight. Set Provider Weight Action
  if (data.startsWith('adm_prov_setweight:')) {
    const parts = data.split(':');
    const idx = parseInt(parts[1]);
    const val = parseInt(parts[2]) || 1;
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    if (endpoints[idx]) {
      endpoints[idx].weight = val;
      saveConfig({ endpoints });
      await answerCallback(cq.id, `✅ Bobot [${endpoints[idx].name}] diubah ke: ${val}`, false, token);
    }
    cq.data = `adm_prov_edit:${idx}`;
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 4c-keys. Provider API Key Management Menu
  if (data.startsWith('adm_prov_keys:')) {
    await answerCallback(cq.id, null, false, token);
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep) {
      cq.data = 'adm_providers';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const keys = Array.isArray(ep.keys) ? ep.keys : (ep.keys ? [ep.keys] : []);
    let keyListText = '';
    const rows = [];

    if (keys.length === 0) {
      keyListText = `_Belum ada API Key yang terpasang untuk provider ini._\n`;
    } else {
      keys.forEach((k, kIdx) => {
        const masked = k.length > 10 ? `${k.slice(0, 7)}...${k.slice(-4)}` : '••••••••';
        keyListText += `${kIdx+1}. \`${masked}\`\n`;
        rows.push([
          { text: `🗑️ Hapus Key #${kIdx+1}`, callback_data: `adm_prov_delkey:${idx}:${kIdx}` }
        ]);
      });
    }

    const text = `🔑 *Kelola API Key: ${ep.name || 'Provider'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Daftar API Key (${keys.length} key terpasang):\n\n` +
      keyListText +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `➕ *Cara Tambah Key Baru via Chat:*\n` +
      `Ketik perintah:\n\`/addkey ${idx+1} [API_KEY_ANDA]\`\n` +
      `Contoh:\n\`/addkey ${idx+1} sk_live_abcdef123456\``;

    rows.push([
      { text: `⬅️ Kembali ke Detail [${ep.name || 'Provider'}]`, callback_data: `adm_prov_det:${idx}` }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 4c-delkey. Delete specific API Key from Provider
  if (data.startsWith('adm_prov_delkey:')) {
    const parts = data.split(':');
    const idx = parseInt(parts[1]);
    const kIdx = parseInt(parts[2]);
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    if (endpoints[idx] && Array.isArray(endpoints[idx].keys) && endpoints[idx].keys[kIdx] !== undefined) {
      endpoints[idx].keys.splice(kIdx, 1);
      saveConfig({ endpoints });
      await answerCallback(cq.id, `🗑️ Key #${kIdx+1} berhasil dihapus!`, true, token);
    }
    cq.data = `adm_prov_keys:${idx}`;
    return (router ? router(cq, botService) : handle(cq, botService, router));
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
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 4e. Test Ping Provider
  if (data.startsWith('adm_prov_ping:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep || !ep.url) {
      await answerCallback(cq.id, 'URL provider tidak valid atau belum diisi', true, token);
      return;
    }

    await answerCallback(cq.id, null, false, token);
    const targetModel = ep.models?.[0] || 'mercury-2';

    await editTelegramMessage(
      chatId,
      messageId,
      `⏳ *Sedang Menguji Ping & Latensi Endpoint...*\n\n` +
      `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
      `• *Target URL:* \`${ep.url}\`\n` +
      `• *Model:* \`${targetModel}\`\n\n` +
      `_Sedang mengirim probe minimal dan mengukur waktu respons (RTT)..._`,
      null,
      token
    );

    const testResult = await testSingleModel(ep, targetModel);
    const isOk = testResult.ok;
    const statusIcon = isOk ? '🟢' : '🔴';
    const statusText = isOk ? 'Online (HTTP 200 OK)' : 'Offline / Mengalami Kendala';

    const text = `⚡ *Hasil Uji Ping & Latensi Provider*\n\n` +
      `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
      `• *Status Koneksi:* ${statusIcon} *${statusText}*\n` +
      `• *Waktu Respons (Latensi):* \`${testResult.latencyMs} ms\`\n` +
      `• *Target URL:* \`${ep.url}\`\n` +
      `• *Model Diuji:* \`${targetModel}\`\n` +
      (testResult.preview ? `• *Respon Sample:* \`"${testResult.preview}"\`\n` : '') +
      (testResult.error ? `• *Detail Kendala:* \`${testResult.error}\`\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Waktu pengujian: ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Uji Ping Ulang', callback_data: `adm_prov_ping:${idx}` },
          { text: '🧪 Test Model Live', callback_data: `adm_prov_test:${idx}` }
        ],
        [
          { text: '🔍 Detect Model', callback_data: `adm_prov_detect:${idx}` },
          { text: '⬅️ Kembali ke Provider', callback_data: `adm_prov_det:${idx}` }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 4f. Auto Detect Models for Provider
  if (data.startsWith('adm_prov_detect:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const ep = endpoints[idx];
    if (!ep || !ep.url) {
      await answerCallback(cq.id, 'URL provider tidak valid', true, token);
      return;
    }

    await answerCallback(cq.id, null, false, token);
    await editTelegramMessage(
      chatId,
      messageId,
      `🔍 *Mendeteksi Daftar Model AI dari Endpoint...*\n\n` +
      `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
      `• *Target URL:* \`${ep.url}\`\n\n` +
      `_Sedang mengirim permintaan GET ke rute /v1/models..._`,
      null,
      token
    );

    const res = await fetchAvailableModels(ep);
    if (res.ok && res.models && res.models.length > 0) {
      endpoints[idx].models = res.models;
      saveConfig({ endpoints });

      const sampleList = res.models.slice(0, 8).map((m, i) => `  ${i + 1}. \`${m}\``).join('\n');
      const moreText = res.models.length > 8 ? `\n  _...dan ${res.models.length - 8} model lainnya_` : '';

      const text = `✅ *Berhasil Mendeteksi Model dari Provider!*\n\n` +
        `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
        `• *Total Model Ditemukan:* *${res.models.length} model*\n` +
        `• *Endpoint models:* \`${res.modelsUrl || ep.url}\`\n\n` +
        `*Daftar Model Tersedia:*\n${sampleList}${moreText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Seluruh model di atas telah otomatis disimpan ke konfigurasi provider ini._`;

      const markup = {
        inline_keyboard: [
          [
            { text: `⚡ Jadikan Model: ${res.models[0].slice(0, 18)}`, callback_data: `adm_prov_set_active_model:${idx}:0` }
          ],
          [
            { text: '🧪 Test Model Live', callback_data: `adm_prov_test:${idx}` },
            { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${idx}` }
          ],
          [
            { text: '⬅️ Kembali ke Provider', callback_data: `adm_prov_det:${idx}` }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, text, markup, token);
    } else {
      const text = `❌ *Gagal Mendeteksi Model AI*\n\n` +
        `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
        `• *Endpoint:* \`${ep.url}\`\n` +
        `• *Kendala:* \`${res.error || 'Endpoint tidak merespons rute /v1/models atau format JSON tidak sesuai'}\`\n\n` +
        `_Catatan: Beberapa provider API (seperti custom endpoint atau proxy pihak ketiga) menonaktifkan rute \`/v1/models\`. Anda tetap dapat mengatur nama model secara manual via menu Edit._`;

      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Coba Deteksi Lagi', callback_data: `adm_prov_detect:${idx}` },
            { text: '✏️ Edit Model Manual', callback_data: `adm_prov_edit_field:${idx}:model` }
          ],
          [
            { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${idx}` },
            { text: '⬅️ Kembali ke Provider', callback_data: `adm_prov_det:${idx}` }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, text, markup, token);
    }
    return;
  }

  // 4f-sub. Set Active Model from Detected List
  if (data.startsWith('adm_prov_set_active_model:')) {
    const parts = data.split(':');
    const idx = parseInt(parts[1]);
    const mIdx = parseInt(parts[2]) || 0;
    const endpoints = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    if (endpoints[idx] && endpoints[idx].models && endpoints[idx].models[mIdx]) {
      const chosen = endpoints[idx].models[mIdx];
      endpoints[idx].models = [chosen, ...endpoints[idx].models.filter(m => m !== chosen)];
      saveConfig({ endpoints, telegramModel: chosen });
      await answerCallback(cq.id, `✅ Model aktif diubah ke: ${chosen}`, true, token);
    }
    cq.data = `adm_prov_det:${idx}`;
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 4f-test. Test Model Live for Specific Provider
  if (data.startsWith('adm_prov_test:')) {
    const idx = parseInt(data.split(':')[1]);
    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const ep = endpoints[idx];
    if (!ep || !ep.url) {
      await answerCallback(cq.id, 'URL provider tidak valid', true, token);
      return;
    }

    await answerCallback(cq.id, null, false, token);
    const targetModel = ep.models?.[0] || cfg.telegramModel || cfg.model || 'mercury-2';

    await editTelegramMessage(
      chatId,
      messageId,
      `🧪 *Sedang Menguji Model Secara Live...*\n\n` +
      `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
      `• *Model:* \`${targetModel}\`\n` +
      `• *Prompt Uji:* _"Hai Bre AI, perkenalkan dirimu secara singkat."_\n\n` +
      `_Mengirim chat completion ke endpoint dan mengukur waktu proses..._`,
      null,
      token
    );

    const startTime = Date.now();
    const testResult = await testSingleModel(ep, targetModel);
    const elapsed = testResult.latencyMs || (Date.now() - startTime);

    if (testResult.ok) {
      const text = `✅ *Live Test Model Berhasil! (200 OK)*\n\n` +
        `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
        `• *Model:* \`${targetModel}\`\n` +
        `• *Waktu Respons:* \`${elapsed} ms\`\n` +
        `• *Status:* 🟢 Online (HTTP 200 OK)\n\n` +
        `*Cuplikan Respon Model:*\n"${testResult.preview || 'Model merespons dengan normal.'}"\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Model siap digunakan untuk melayani percakapan pengguna!_`;

      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Tes Live Ulang', callback_data: `adm_prov_test:${idx}` },
            { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${idx}` }
          ],
          [
            { text: '🔍 Detect Model', callback_data: `adm_prov_detect:${idx}` },
            { text: '⬅️ Kembali ke Provider', callback_data: `adm_prov_det:${idx}` }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, text, markup, token);
    } else {
      const text = `❌ *Live Test Model Gagal*\n\n` +
        `• *Provider:* *${ep.name || 'Unnamed'}* (Index #${idx + 1})\n` +
        `• *Model:* \`${targetModel}\`\n` +
        `• *Waktu Respons:* \`${elapsed} ms\`\n` +
        `• *Kendala:* \`${testResult.error || 'Gagal menghubungi model'}\`\n\n` +
        `_Periksa kembali API Key, kuota token akun provider, atau nama model._`;

      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Coba Tes Lagi', callback_data: `adm_prov_test:${idx}` },
            { text: '✏️ Edit Model', callback_data: `adm_prov_edit_field:${idx}:model` }
          ],
          [
            { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${idx}` },
            { text: '⬅️ Kembali ke Provider', callback_data: `adm_prov_det:${idx}` }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, text, markup, token);
    }
    return;
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
    return (router ? router(cq, botService) : handle(cq, botService, router));
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
        { text: '✍️ Tambah Manual (Isi Sendiri)', callback_data: 'adm_prov_manual' },
        { text: '⬅️ Kembali ke Provider', callback_data: 'adm_providers' }
      ]
    ];
    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 4h-manual. Manual Provider Instructions (Isi Sendiri)
  if (data === 'adm_prov_manual') {
    await answerCallback(cq.id, null, false, token);
    const text = `✍️ *Tambah Provider AI Manual (Isi Sendiri)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Anda dapat menambahkan upstream provider AI OpenAI-compatible secara mandiri dan fleksibel dengan perintah chat:\n\n` +
      `\`\`\`\n/addprovider [Nama] [URL] [API_Key] [Model]\n\`\`\`\n\n` +
      `📌 *Contoh Perintah Siap Pakai (Tinggal Ganti Key):*\n` +
      `• *Inception Labs:*\n\`/addprovider Inception https://api.inceptionlabs.ai/v1/chat/completions sk_xxxx mercury-2\`\n\n` +
      `• *DeepSeek API:*\n\`/addprovider DeepSeek https://api.deepseek.com/chat/completions sk-xxxx deepseek-chat\`\n\n` +
      `• *OpenAI:*\n\`/addprovider OpenAI https://api.openai.com/v1/chat/completions sk-xxxx gpt-4o\`\n\n` +
      `• *Groq Cloud:*\n\`/addprovider Groq https://api.groq.com/openai/v1/chat/completions gsk_xxxx llama-3.3-70b-versatile\`\n\n` +
      `• *OpenRouter:*\n\`/addprovider OpenRouter https://openrouter.ai/api/v1/chat/completions sk-or-v1-xxxx auto\`\n\n` +
      `• *Ollama Lokal:*\n\`/addprovider Ollama http://localhost:11434/v1/chat/completions none llama3.2\`\n\n` +
      `💡 _Provider baru akan otomatis aktif & langsung diikutsertakan dalam sistem routing multi-provider._`;

    const markup = {
      inline_keyboard: [
        [
          { text: '➕ Tambah dari Preset', callback_data: 'adm_prov_presets' },
          { text: '🔌 Daftar Provider', callback_data: 'adm_providers' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
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
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // ----------------------------------------------------
  // 5. GLOBAL ENGINE AI
  // ----------------------------------------------------

  return false;
}

module.exports = { handle };
