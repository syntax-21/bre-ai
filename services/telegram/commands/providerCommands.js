// ========================================================
// Bre AI v3.0 - Telegram Commands: Provider Management & Routing
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  testSingleModel,
  fetchAvailableModels
} = require('../../../api/_shared');
const api = require('../api');

function resolveTargetProvider(target, eps) {
  if (!target) return -1;
  if (!isNaN(parseInt(target))) {
    const idx = parseInt(target) - 1;
    return (idx >= 0 && idx < eps.length) ? idx : -1;
  }
  return eps.findIndex(e => (e.name || '').toLowerCase() === target.toLowerCase());
}

async function handle(ctx) {
  const { msg, botService, text, lowerText, chatId, fromUser, senderName, senderTag, token, isOwnerUser, queryBreAIRouter } = ctx;

  // /detect [index|nama]
  if (lowerText === '/detect' || lowerText.startsWith('/detect ') || lowerText.startsWith('/detectmodels')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini hanya dapat dijalankan oleh Owner.', null, null, token);
      return true;
    }
    const rawArg = text.replace(/^\/(detectmodels|detect)/i, '').trim();
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!eps.length) {
      await api.sendTelegramMessage(chatId, '⚠️ Belum ada provider yang terdaftar di konfigurasi.', null, null, token);
      return true;
    }

    let targetIdx = 0;
    if (rawArg) {
      const found = resolveTargetProvider(rawArg, eps);
      if (found === -1) {
        await api.sendTelegramMessage(chatId, `⚠️ Provider "${rawArg}" tidak ditemukan.`, null, null, token);
        return true;
      }
      targetIdx = found;
    }

    const ep = eps[targetIdx];
    await api.sendTelegramMessage(chatId, `🔍 *Sedang mendeteksi daftar model dari [${ep.name}]...*\nTarget URL: \`${ep.url}\`\nMohon tunggu beberapa detik...`, null, null, token);

    const res = await fetchAvailableModels(ep);
    if (res.ok && res.models && res.models.length > 0) {
      eps[targetIdx].models = res.models;
      saveConfig({ endpoints: eps });

      const sample = res.models.slice(0, 10).map((m, i) => `${i + 1}. \`${m}\``).join('\n');
      const more = res.models.length > 10 ? `\n_...dan ${res.models.length - 10} model lainnya_` : '';

      await api.sendTelegramMessage(
        chatId,
        `✅ *Berhasil Mendeteksi ${res.models.length} Model dari [${ep.name}]!*\n\n` +
        `*Daftar Model Tersedia:*\n${sample}${more}\n\n` +
        `_Seluruh model telah otomatis disimpan ke konfigurasi provider ini._\n` +
        `Gunakan \`/setmodel ${targetIdx + 1} [nama_model]\` untuk memilih model aktif.`,
        null, null, token
      );
    } else {
      await api.sendTelegramMessage(
        chatId,
        `❌ *Gagal Mendeteksi Model dari [${ep.name}]:*\n\n` +
        `• Target URL: \`${ep.url}\`\n` +
        `• Kendala: \`${res.error || 'Endpoint tidak merespons rute /v1/models atau format JSON tidak sesuai'}\`\n\n` +
        `_Gunakan \`/setmodel ${targetIdx + 1} [nama_model]\` untuk memasukkan nama model secara manual._`,
        null, null, token
      );
    }
    return true;
  }


  // /livetest [index|nama|model]
  if (lowerText === '/livetest' || lowerText.startsWith('/livetest ') || lowerText.startsWith('/testmodel')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini hanya dapat dijalankan oleh Owner.', null, null, token);
      return true;
    }
    const rawArg = text.replace(/^\/(livetest|testmodel)/i, '').trim();
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!eps.length) {
      await api.sendTelegramMessage(chatId, '⚠️ Belum ada provider yang terdaftar di konfigurasi.', null, null, token);
      return true;
    }

    let targetIdx = 0;
    if (rawArg) {
      const found = resolveTargetProvider(rawArg, eps);
      if (found !== -1) targetIdx = found;
    }

    const ep = eps[targetIdx];
    const testModel = (rawArg && isNaN(parseInt(rawArg)) && targetIdx === 0 && !eps.some(e => e.name.toLowerCase() === rawArg.toLowerCase()))
      ? rawArg
      : (ep.models?.[0] || cfg.telegramModel || cfg.model || 'mercury-2');

    await api.sendTelegramMessage(chatId, `🧪 *Menguji Model [${testModel}] Secara Live...*\nProvider: *${ep.name}*\nMohon tunggu beberapa detik...`, null, null, token);

    const start = Date.now();
    const probeResult = await testSingleModel(ep, testModel);
    const elapsed = probeResult.latencyMs || (Date.now() - start);

    if (probeResult.ok) {
      await api.sendTelegramMessage(
        chatId,
        `✅ *Live Test Model Berhasil!*\n\n` +
        `• *Provider:* *${ep.name}*\n` +
        `• *Model:* \`${testModel}\`\n` +
        `• *Latensi:* \`${elapsed} ms\`\n` +
        `• *Status HTTP:* 🟢 200 OK\n\n` +
        `*Cuplikan Respon Model:*\n"${probeResult.preview || 'Sukses'}"\n\n` +
        `_Engine AI berfungsi normal dan siap melayani percakapan pengguna!_`,
        null, null, token
      );
    } else {
      await api.sendTelegramMessage(
        chatId,
        `❌ *Live Test Model Gagal:*\n\n` +
        `• *Provider:* *${ep.name}*\n` +
        `• *Model:* \`${testModel}\`\n` +
        `• *Latensi:* \`${elapsed} ms\`\n` +
        `• *Error:* \`${probeResult.error || 'Gagal menghubungi model'}\``,
        null, null, token
      );
    }
    return true;
  }


  // /providers
  if (text === '/providers') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    const routingMode = (cfg.routingStrategy || cfg.providerRoutingMode || 'auto').toLowerCase();
    
    let routingLabel = '🔄 AUTO (Rotasi Bergantian Semua Provider Aktif)';
    if (routingMode === 'priority') routingLabel = '🥇 Prioritas Tunggal';
    else if (routingMode === 'weighted') routingLabel = '⚖️ Berdasarkan Bobot (Weight)';

    let provMsg = `🔌 *Daftar Provider AI & Strategi Routing*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Strategi Routing:* *${routingLabel}*\n` +
      `• *Auto-Failover:* *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `• *Total Provider:* *${eps.length} endpoint*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    eps.forEach((e, i) => {
      const st = e.status !== false ? '🟢 Aktif' : '🔴 Nonaktif';
      const kCount = Array.isArray(e.keys) ? e.keys.length : (e.keys ? 1 : 0);
      provMsg += `${i+1}. *${e.name || 'Provider'}* [${st}]\n   • Models: \`${(e.models || []).join(', ') || '-'}\`\n   • Keys: ${kCount} key\n   • Weight: ${e.weight || 1}\n\n`;
    });

    provMsg += `💡 _Ketik \`/addprovider [Nama] [URL] [Key] [Model]\` untuk menambah provider baru, atau \`/addkey [No] [Key]\` untuk menambah key._`;
    await api.sendTelegramMessage(chatId, provMsg, null, null, token);
    return true;
  }


  // /setrouting [auto|priority|weighted]
  if (lowerText.startsWith('/setrouting') || lowerText.startsWith('/routing')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawMode = text.replace(/^\/(setrouting|routing)/i, '').trim().toLowerCase();
    if (!['auto', 'priority', 'weighted'].includes(rawMode)) {
      await api.sendTelegramMessage(
        chatId,
        `🔀 *Panduan Mengatur Strategi Routing Provider:*\n\n` +
        `Gunakan format:\n\`/setrouting [auto | priority | weighted]\`\n\n` +
        `• \`/setrouting auto\` -> 🔄 *Mode AUTO (Bergantian)*: Membagi beban dengan menggunakan semua provider secara bergantian bergilir (Round-Robin).\n` +
        `• \`/setrouting priority\` -> 🥇 *Prioritas Tunggal*: Menggunakan provider pertama dan fallback jika error.\n` +
        `• \`/setrouting weighted\` -> ⚖️ *Berdasarkan Bobot*: Mengikuti nilai bobot weight masing-masing provider.`,
        null, null, token
      );
      return true;
    }

    saveConfig({ routingStrategy: rawMode, providerRoutingMode: rawMode });
    const labels = {
      auto: '🔄 AUTO (Rotasi Bergantian Seluruh Provider Aktif)',
      priority: '🥇 Prioritas Tunggal (Fallback Failover)',
      weighted: '⚖️ Berdasarkan Bobot (Weight Distribution)'
    };
    await api.sendTelegramMessage(chatId, `✅ Strategi routing AI berhasil diubah ke: *${labels[rawMode]}*`, null, null, token);
    return true;
  }


  // /addprovider [name] [url] [key] [model]
  if (lowerText.startsWith('/addprovider') || lowerText.startsWith('/tambahprovider') || lowerText.startsWith('/addendpoint')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(addprovider|tambahprovider|addendpoint)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      const guide = `✍️ *Format Menambah Provider Manual (Isi Sendiri):*\n\n` +
        `Gunakan format:\n\`/addprovider [Nama] [Base_URL] [API_Key] [Model]\`\n\n` +
        `📌 *Contoh Penggunaan Langsung:*\n` +
        `• \`/addprovider Inception https://api.inceptionlabs.ai/v1/chat/completions sk_xxxx mercury-2\`\n` +
        `• \`/addprovider DeepSeek https://api.deepseek.com/chat/completions sk-xxxx deepseek-chat\`\n` +
        `• \`/addprovider OpenAI https://api.openai.com/v1/chat/completions sk-xxxx gpt-4o\`\n` +
        `• \`/addprovider Groq https://api.groq.com/openai/v1/chat/completions gsk_xxxx llama-3.3-70b-versatile\`\n` +
        `• \`/addprovider Ollama http://localhost:11434/v1/chat/completions none llama3.2\``;
      await api.sendTelegramMessage(chatId, guide, null, null, token);
      return true;
    }

    const provName = parts[0];
    let provUrl = parts[1];
    if (!provUrl.startsWith('http://') && !provUrl.startsWith('https://')) {
      provUrl = 'https://' + provUrl;
    }
    const provKey = parts[2] && parts[2] !== 'none' && parts[2] !== '-' ? parts[2] : '';
    const provModel = parts[3] || 'default';

    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    
    const existingIdx = eps.findIndex(e => (e.name || '').toLowerCase() === provName.toLowerCase());
    const newEndpoint = {
      name: provName,
      url: provUrl,
      status: true,
      weight: 1,
      models: [provModel],
      mapping: [],
      keys: provKey ? [provKey] : []
    };

    if (existingIdx >= 0) {
      eps[existingIdx] = { ...eps[existingIdx], ...newEndpoint };
    } else {
      eps.push(newEndpoint);
    }

    saveConfig({ endpoints: eps });

    const keyMasked = provKey ? (provKey.length > 10 ? `${provKey.slice(0, 6)}...${provKey.slice(-4)}` : '••••••') : '(tanpa API Key)';
    const epIndex = existingIdx >= 0 ? existingIdx : eps.length - 1;
    const successMsg = `✅ *Provider AI Berhasil Ditambahkan & Aktif!*\n\n` +
      `• *Nama Provider:* *${provName}*\n` +
      `• *Base URL:* \`${provUrl}\`\n` +
      `• *Model:* \`${provModel}\`\n` +
      `• *API Key:* \`${keyMasked}\`\n` +
      `• *Status:* 🟢 Aktif (Melayani Trafik Multi-Provider)\n\n` +
      `_Gunakan tombol di bawah untuk uji ping latensi atau lihat daftar provider._`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${epIndex}` },
          { text: '🔌 Daftar Provider', callback_data: 'adm_providers' }
        ]
      ]
    };

    await api.sendTelegramMessage(chatId, successMsg, markup, null, token);
    return true;
  }


  // /setkey [idx/name] [key]
  if (lowerText.startsWith('/setkey') || lowerText.startsWith('/setproviderkey')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(setkey|setproviderkey)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await api.sendTelegramMessage(
        chatId,
        `🔑 *Format Ganti/Set Utama API Key:*\n\n` +
        `Gunakan format:\n\`/setkey [Nomor/Nama Provider] [API_Key_Baru]\`\n\n` +
        `📌 *Contoh:*\n` +
        `• \`/setkey 1 sk_live_kunci_utama_baru_12345\`\n` +
        `• \`/setkey Inception sk_live_kunci_baru_67890\``,
        null, null, token
      );
      return true;
    }

    const target = parts[0];
    const newKey = parts[1];
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan. Buka \`/providers\` untuk melihat nomor/nama provider.`, null, null, token);
      return true;
    }

    eps[targetIdx].keys = [newKey];
    saveConfig({ endpoints: eps });

    const masked = newKey.length > 10 ? `${newKey.slice(0, 6)}...${newKey.slice(-4)}` : '••••••';
    await api.sendTelegramMessage(
      chatId,
      `✅ *API Key [${eps[targetIdx].name}] berhasil diperbarui!*\n\n• *Kunci Utama Baru:* \`${masked}\``,
      null, null, token
    );
    return true;
  }


  // /addkey [idx/name] [key]
  if (lowerText.startsWith('/addkey') || lowerText.startsWith('/tambahkey')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(addkey|tambahkey)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await api.sendTelegramMessage(
        chatId,
        `🔑 *Format Tambah API Key Tambahan (Rotasi Round-Robin):*\n\n` +
        `Gunakan format:\n\`/addkey [Nomor/Nama Provider] [API_Key_Baru]\`\n\n` +
        `📌 *Contoh:*\n` +
        `• \`/addkey 1 sk_live_kunci_tambahan_12345\`\n` +
        `• \`/addkey Inception sk_live_kunci_kedua_67890\``,
        null, null, token
      );
      return true;
    }

    const target = parts[0];
    const newKey = parts[1];
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    const ep = eps[targetIdx];
    if (!Array.isArray(ep.keys)) ep.keys = ep.keys ? [ep.keys] : [];
    if (!ep.keys.includes(newKey)) {
      ep.keys.push(newKey);
      saveConfig({ endpoints: eps });
    }

    const masked = newKey.length > 10 ? `${newKey.slice(0, 6)}...${newKey.slice(-4)}` : '••••••';
    await api.sendTelegramMessage(
      chatId,
      `✅ *API Key Berhasil Ditambahkan!*\n\n` +
      `• *Provider:* *${ep.name}* (#${targetIdx+1})\n` +
      `• *Key Baru:* \`${masked}\`\n` +
      `• *Total Key Terpasang:* ${ep.keys.length} key (Rotasi Otomatis Aktif)`,
      null, null, token
    );
    return true;
  }


  // /seturl [idx/name] [newUrl]
  if (lowerText.startsWith('/seturl') || lowerText.startsWith('/setproviderurl')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(seturl|setproviderurl)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await api.sendTelegramMessage(
        chatId,
        `🌐 *Format Ganti Base URL Provider:*\n\n` +
        `Gunakan format:\n\`/seturl [Nomor/Nama Provider] [URL_Baru]\`\n\n` +
        `📌 *Contoh:*\n` +
        `• \`/seturl 1 https://api.openai.com/v1/chat/completions\`\n` +
        `• \`/seturl Inception https://api.inceptionlabs.ai/v1/chat/completions\``,
        null, null, token
      );
      return true;
    }

    const target = parts[0];
    let newUrl = parts[1];
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) newUrl = 'https://' + newUrl;

    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    eps[targetIdx].url = newUrl;
    saveConfig({ endpoints: eps });

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Test Ping Latensi', callback_data: `adm_prov_ping:${targetIdx}` },
          { text: '🔌 Detail Provider', callback_data: `adm_prov_det:${targetIdx}` }
        ]
      ]
    };
    await api.sendTelegramMessage(
      chatId,
      `✅ *Base URL Provider [${eps[targetIdx].name}] Berhasil Diperbarui!*\n\n• *URL Baru:* \`${newUrl}\``,
      markup, null, token
    );
    return true;
  }


  // /setmodel [idx/name] [model]
  if (lowerText.startsWith('/setmodel') || lowerText.startsWith('/setprovidermodel')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(setmodel|setprovidermodel)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await api.sendTelegramMessage(
        chatId,
        `🤖 *Format Ganti Model AI Provider:*\n\n` +
        `Gunakan format:\n\`/setmodel [Nomor/Nama Provider] [Nama_Model_Baru]\`\n\n` +
        `📌 *Contoh:*\n` +
        `• \`/setmodel 1 mercury-2\`\n` +
        `• \`/setmodel DeepSeek deepseek-chat\``,
        null, null, token
      );
      return true;
    }

    const target = parts[0];
    const newModel = parts[1];
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    eps[targetIdx].models = [newModel];
    saveConfig({ endpoints: eps });

    const markup = {
      inline_keyboard: [
        [
          { text: '🧪 Test Model Live', callback_data: `adm_prov_test:${targetIdx}` },
          { text: '🔌 Detail Provider', callback_data: `adm_prov_det:${targetIdx}` }
        ]
      ]
    };
    await api.sendTelegramMessage(
      chatId,
      `✅ *Model AI untuk Provider [${eps[targetIdx].name}] Berhasil Diubah!*\n\n• *Model Baru:* \`${newModel}\``,
      markup, null, token
    );
    return true;
  }


  // /setname [idx/name] [newName]
  if (lowerText.startsWith('/setname') || lowerText.startsWith('/setprovidername')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(setname|setprovidername)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await api.sendTelegramMessage(chatId, `🏷️ Format: \`/setname [Nomor/Nama Provider] [Nama_Baru]\``, null, null, token);
      return true;
    }

    const target = parts[0];
    const newName = parts.slice(1).join(' ').trim();
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    const oldName = eps[targetIdx].name;
    eps[targetIdx].name = newName;
    saveConfig({ endpoints: eps });

    await api.sendTelegramMessage(
      chatId,
      `✅ *Nama Provider Berhasil Diubah!*\n\n• *Nama Lama:* \`${oldName}\`\n• *Nama Baru:* *${newName}*`,
      null, null, token
    );
    return true;
  }


  // /setweight [idx/name] [1-100]
  if (lowerText.startsWith('/setweight') || lowerText.startsWith('/setproviderweight')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(setweight|setproviderweight)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1] || isNaN(parseInt(parts[1]))) {
      await api.sendTelegramMessage(chatId, `⚖️ Format: \`/setweight [Nomor/Nama Provider] [1-100]\``, null, null, token);
      return true;
    }

    const target = parts[0];
    const weightVal = Math.max(1, Math.min(100, parseInt(parts[1]) || 1));
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    eps[targetIdx].weight = weightVal;
    saveConfig({ endpoints: eps });

    await api.sendTelegramMessage(chatId, `✅ *Bobot (Weight) [${eps[targetIdx].name}] diubah ke:* *${weightVal}*`, null, null, token);
    return true;
  }


  // /editprovider [idx/name] [field] [value]
  if (lowerText.startsWith('/editprovider') || lowerText.startsWith('/ubahprovider')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(editprovider|ubahprovider)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 3) {
      await api.sendTelegramMessage(
        chatId,
        `✏️ *Panduan Edit Provider AI:*\n\n` +
        `Format: \`/editprovider [No/Nama] [url|key|model|name|weight] [Nilai_Baru]\`\n\n` +
        `_Contoh:_\n\`/editprovider 1 model gpt-4o\``,
        null, null, token
      );
      return true;
    }

    const target = parts[0];
    const field = parts[1].toLowerCase();
    const value = parts.slice(2).join(' ').trim();
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    const ep = eps[targetIdx];
    if (['url', 'endpoint', 'baseurl'].includes(field)) {
      ep.url = value.startsWith('http') ? value : 'https://' + value;
    } else if (['key', 'apikey'].includes(field)) {
      ep.keys = [value];
    } else if (['model', 'models'].includes(field)) {
      ep.models = [value];
    } else if (['name', 'nama'].includes(field)) {
      ep.name = value;
    } else if (['weight', 'bobot'].includes(field)) {
      ep.weight = Math.max(1, Math.min(100, parseInt(value) || 1));
    } else {
      await api.sendTelegramMessage(chatId, `⚠️ Field \`${field}\` tidak dikenal. Gunakan: url, key, model, name, weight.`, null, null, token);
      return true;
    }

    saveConfig({ endpoints: eps });
    const maskedVal = field === 'key' ? (value.length > 10 ? value.slice(0, 6) + '...' + value.slice(-4) : '••••••') : value;
    await api.sendTelegramMessage(
      chatId,
      `✅ *Provider [${ep.name}] berhasil diperbarui!*\n\n• *Field Diubah:* \`${field}\`\n• *Nilai Baru:* \`${maskedVal}\``,
      null, null, token
    );
    return true;
  }


  // /delkey [idx/name] [keyTarget]
  if (lowerText.startsWith('/delkey') || lowerText.startsWith('/hapuskey')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArgs = text.replace(/^\/(delkey|hapuskey)/i, '').trim();
    const parts = rawArgs.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await api.sendTelegramMessage(chatId, `🗑️ Format: \`/delkey [Nomor/Nama Provider] [Nomor Key / Isi Key]\``, null, null, token);
      return true;
    }

    const target = parts[0];
    const keyTarget = parts[1];
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    const ep = eps[targetIdx];
    if (!Array.isArray(ep.keys) || ep.keys.length === 0) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider *${ep.name}* tidak memiliki API Key terpasang.`, null, null, token);
      return true;
    }

    let removed = false;
    if (!isNaN(parseInt(keyTarget))) {
      const kIdx = parseInt(keyTarget) - 1;
      if (ep.keys[kIdx] !== undefined) {
        ep.keys.splice(kIdx, 1);
        removed = true;
      }
    } else {
      const kIdx = ep.keys.indexOf(keyTarget);
      if (kIdx >= 0) {
        ep.keys.splice(kIdx, 1);
        removed = true;
      }
    }

    if (!removed) {
      await api.sendTelegramMessage(chatId, `⚠️ Key \`${keyTarget}\` tidak ditemukan pada provider *${ep.name}*.`, null, null, token);
      return true;
    }

    saveConfig({ endpoints: eps });
    await api.sendTelegramMessage(chatId, `🗑️ *API Key berhasil dihapus dari ${ep.name}!* Sisa: ${ep.keys.length} key.`, null, null, token);
    return true;
  }


  // /delprovider [idx/name]
  if (lowerText.startsWith('/delprovider') || lowerText.startsWith('/hapusprovider')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const target = text.replace(/^\/(delprovider|hapusprovider)/i, '').trim();
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/delprovider [Nomor Provider atau Nama]\``, null, null, token);
      return true;
    }

    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? [...cfg.endpoints] : [];
    const targetIdx = resolveTargetProvider(target, eps);

    if (targetIdx < 0 || !eps[targetIdx]) {
      await api.sendTelegramMessage(chatId, `⚠️ Provider \`${target}\` tidak ditemukan.`, null, null, token);
      return true;
    }

    const removedName = eps[targetIdx].name;
    eps.splice(targetIdx, 1);
    saveConfig({ endpoints: eps });
    await api.sendTelegramMessage(chatId, `🗑️ Provider *[${removedName}]* berhasil dihapus dari daftar router!`, null, null, token);
    return true;
  }


  return false;
}

module.exports = {
  handle,
  resolveTargetProvider
};
