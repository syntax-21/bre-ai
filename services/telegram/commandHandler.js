// ========================================================
// Bre AI v3.0 - Telegram Slash Commands Handler
// Handles admin controls, provider routing, files, media shortcuts, and user config
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  getMetrics,
  getLogs,
  getRouterOverview,
  clearResponseCache,
  testSingleModel,
  fetchAvailableModels,
  STYLE_LABELS
} = require('../../api/_shared');

const api = require('./api');
const {
  setUserRole,
  removeUserRole,
  recentUsers
} = require('./accessControl');

const { sendAdminPanel } = require('./adminMenu');
const {
  chatLanguages,
  chatStyles,
  LANGUAGE_OPTIONS,
  resolveLanguageCode,
  getUserLanguage,
  saveUserLanguage,
  getUserStyle,
  saveUserStyle
} = require('./constants');
const { processAndSendOutboundMedia } = require('./mediaProcessor');

// Helper to resolve provider index by 1-based index or name
function resolveTargetProvider(target, eps) {
  if (!target) return -1;
  if (!isNaN(parseInt(target))) {
    const idx = parseInt(target) - 1;
    return (idx >= 0 && idx < eps.length) ? idx : -1;
  }
  return eps.findIndex(e => (e.name || '').toLowerCase() === target.toLowerCase());
}

// Broadcast announcement to all known users
async function handleBroadcastCommand(chatId, fromUser, broadcastText, botService) {
  const token = botService.activeToken || null;
  const messageToSend = broadcastText.trim();
  if (!messageToSend) {
    await api.sendTelegramMessage(
      chatId,
      '📢 *Panduan Format Broadcast:*\n\nGunakan format:\n`/broadcast [isi pesan siaran]`\n\n_Contoh:_\n`/broadcast Halo! Kami baru saja memperbarui kecerdasan Bre AI ke versi terbaru 🚀`',
      null, null, token
    );
    return true;
  }

  const cfg = getConfig();
  const recipientIds = new Set();

  for (const [uid] of recentUsers) {
    recipientIds.add(Number(uid));
  }
  if (Array.isArray(cfg.telegramUsers)) {
    for (const u of cfg.telegramUsers) {
      if (u.id && !isNaN(Number(u.id)) && u.role !== 'blocked') {
        recipientIds.add(Number(u.id));
      }
    }
  }

  if (recipientIds.size === 0) {
    await api.sendTelegramMessage(
      chatId,
      '⚠️ *Tidak Ada Penerima Siaran*\n\nBelum ada pengguna lain yang berinteraksi dengan bot sejak server aktif.',
      null, null, token
    );
    return true;
  }

  await api.sendTelegramMessage(chatId, `🚀 *Memulai Pengiriman Siaran...*\nTarget penerima: ${recipientIds.size} pengguna.`, null, null, token);

  let successCount = 0;
  let failCount = 0;
  const formattedBroadcast = `📢 *PENGUMUMAN RESMI BRE AI*\n\n${messageToSend}\n\n— _Pesan dari Pengelola Bot_`;

  for (const targetId of recipientIds) {
    if (String(targetId) === String(fromUser.id)) continue;
    try {
      await api.sendTelegramMessage(targetId, formattedBroadcast, null, null, token);
      successCount++;
      await new Promise(r => setTimeout(r, 60));
    } catch (err) {
      failCount++;
    }
  }

  await api.sendTelegramMessage(
    chatId,
    `✅ *Laporan Siaran Broadcast Selesai*\n\n` +
    `• Berhasil terkirim: *${successCount} pengguna*\n` +
    `• Gagal terkirim: *${failCount} pengguna*\n` +
    `• Total target: *${recipientIds.size} akun*`,
    null, null, token
  );
  return true;
}

/**
 * Handle slash commands sent by users
 * @returns {Promise<boolean>} true if command was handled, false otherwise
 */
async function handleSlashCommand({
  msg,
  botService,
  text,
  chatId,
  fromUser,
  senderName,
  senderTag,
  token,
  isOwnerUser,
  queryBreAIRouter
}) {
  if (!text || !text.startsWith('/')) return false;

  const lowerText = text.toLowerCase();

  // /admin
  if (text === '/admin' || text.startsWith('/admin ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(
        chatId,
        `⛔ *Akses Ditolak*\n\nPerintah \`/admin\` hanya dapat diakses secara eksklusif oleh *Pemilik Bot (Owner)*.`,
        null, null, token
      );
      return true;
    }
    await sendAdminPanel(chatId, senderName, botService.conversations.size, token);
    return true;
  }

  // /ping
  if (lowerText === '/ping' || lowerText.startsWith('/ping ')) {
    const t0 = Date.now();
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints.filter(e => e.status !== false && e.enabled !== false) : [];
    const activeEp = eps[0] || (cfg.endpoints && cfg.endpoints[0]) || null;
    const activeModel = cfg.telegramModel || cfg.model || (activeEp?.models?.[0]) || 'mercury-2';

    let providerLatencyStr = 'N/A';
    let providerStatus = '⚪ Belum ada endpoint aktif';

    if (activeEp && activeEp.url) {
      try {
        const probe = await testSingleModel(activeEp, activeModel);
        providerLatencyStr = `${probe.latencyMs} ms`;
        providerStatus = probe.ok ? '🟢 Online (200 OK)' : `🔴 Error (${probe.error || 'Timeout'})`;
      } catch (e) {
        providerStatus = `🔴 Error: ${e.message}`;
      }
    }

    const botLatency = Date.now() - t0;
    const activeStyle = STYLE_LABELS[cfg.telegramStyle || cfg.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';

    await api.sendTelegramMessage(
      chatId,
      `🏓 *Pong! Status Latensi & Koneksi Bre AI*\n\n` +
      `• *Bot Gateway Latensi:* \`${botLatency} ms\`\n` +
      `• *Provider AI Aktif:* *${activeEp?.name || 'Inception Labs'}*\n` +
      `• *Provider Latensi:* \`${providerLatencyStr}\` (${providerStatus})\n` +
      `• *Model Aktif:* \`${activeModel}\`\n` +
      `• *Gaya Bahasa:* ${activeStyle}\n` +
      `• *Waktu Server:* ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n` +
      `_Sistem berjalan normal. Ketik \`/admin\` untuk membuka Dashboard Panel._`,
      null, null, token
    );
    return true;
  }

  // /stats, /telemetry, /overview
  if (lowerText === '/stats' || lowerText.startsWith('/stats ') || lowerText === '/telemetry' || lowerText.startsWith('/telemetry ') || lowerText === '/overview' || lowerText.startsWith('/overview ')) {
    const rawArg = lowerText.replace(/^\/(stats|telemetry|overview)/, '').trim();
    let range = 'today';
    if (['24h', '24 jam', '1d'].includes(rawArg)) range = '24h';
    else if (['7d', '7 hari', '1w'].includes(rawArg)) range = '7d';
    else if (['30d', '30 hari', '1m'].includes(rawArg)) range = '30d';
    else if (['60d', 'all', 'semua'].includes(rawArg)) range = '60d';

    const overview = getRouterOverview({ timeRange: range });
    const kpi = overview.kpi || {};
    const totalReq = (kpi.totalRequests || overview.totalRequests || 0).toLocaleString();
    const successReq = (overview.successfulRequests || 0).toLocaleString();
    const failedReq = (overview.failedRequests || 0).toLocaleString();
    const inTokens = (kpi.totalInputTokens || overview.totalInputTokens || 0).toLocaleString();
    const cachedTokens = (kpi.totalCachedTokens || overview.totalCachedTokens || 0).toLocaleString();
    const outTokens = (kpi.totalOutputTokens || overview.totalOutputTokens || 0).toLocaleString();
    const totalTokens = (kpi.totalTokens || overview.totalTokens || 0).toLocaleString();
    const estCost = overview.estCostStr || `~$${(overview.estCost || 0).toFixed(4)}`;
    const avgLat = kpi.avgLatencyMs || 0;
    const avgTtft = kpi.avgTtftMs || 0;
    const errRate = kpi.errorRate || '0.0%';

    let rangeLabel = 'Hari Ini (Today)';
    if (range === '24h') rangeLabel = '24 Jam Terakhir';
    else if (range === '7d') rangeLabel = '7 Hari Terakhir';
    else if (range === '30d') rangeLabel = '30 Hari Terakhir';
    else if (range === '60d') rangeLabel = 'Semua Waktu (60 Hari)';

    const recents = (overview.recentRequests || []).slice(0, 4);
    let recentStr = '';
    if (recents.length > 0) {
      recentStr = '\n\n⏱️ *Aktivitas Terakhir:*\n' + recents.map(r => {
        const statusIcon = r.status >= 200 && r.status < 400 ? '🟢' : '🔴';
        const snippet = (r.requestSummary || r.model || '').slice(0, 35);
        return `${statusIcon} \`${r.model}\` (${r.provider || 'router'}) — _${r.when || 'baru saja'}_: "${snippet}..."`;
      }).join('\n');
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: range === 'today' ? '🔘 Today' : 'Today', callback_data: 'adm_telemetry_range:today' },
          { text: range === '24h' ? '🔘 24h' : '24h', callback_data: 'adm_telemetry_range:24h' },
          { text: range === '7d' ? '🔘 7D' : '7D', callback_data: 'adm_telemetry_range:7d' },
          { text: range === '60d' ? '🔘 All' : 'All', callback_data: 'adm_telemetry_range:60d' }
        ],
        [
          { text: '📊 Buka Admin Panel', callback_data: 'adm_main' },
          { text: '🔄 Refresh', callback_data: `adm_telemetry_range:${range}` }
        ]
      ]
    };

    await api.sendTelegramMessage(
      chatId,
      `📊 *Statistik & Telemetry Bre AI*\n` +
      `📅 *Periode:* *${rangeLabel}*\n\n` +
      `• 📈 *Total Permintaan:* \`${totalReq} req\` (${successReq} sukses · ${failedReq} error)\n` +
      `• 📥 *Input Tokens:* \`${inTokens} token\`\n` +
      `• 💾 *Cached Tokens:* \`${cachedTokens} token\` (Diskon Cache Hit)\n` +
      `• 📤 *Output Tokens:* \`${outTokens} token\`\n` +
      `• 🪙 *Total Tokens:* \`${totalTokens} token\`\n` +
      `• 💵 *Estimasi Biaya:* \`${estCost}\`\n` +
      `• ⚡ *Rata-rata Latensi:* \`${avgLat} ms\` (TTFT: ~${avgTtft} ms)\n` +
      `• 🛡️ *Tingkat Error:* \`${errRate}\`` +
      recentStr +
      `\n\n_Ketik \`/stats [today|24h|7d|30d]\` atau pilih tombol periode di bawah._`,
      replyMarkup,
      null,
      token
    );
    return true;
  }

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

  // /status
  if (text === '/status') {
    const cfg = getConfig();
    const isRestricted = (cfg.telegramAccessMode || 'public') !== 'public';
    const statusMode = isRestricted ? '🔒 Khusus Diizinkan' : '🟢 Publik';
    const statusStyle = STYLE_LABELS[cfg.telegramStyle || cfg.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';
    const statusMsg = `📊 *Status Sistem Bre AI Router*\n\n` +
      `• *Bot:* @${botService.botInfo?.username || 'BreAI_Bot'}\n` +
      `• *Mode Akses:* *${statusMode}*\n` +
      `• *Gaya Bahasa Indonesia Global:* *${statusStyle}*\n` +
      `• *Bahasa Respons:* *🌐 Otomatis (deteksi dari pesan)*\n` +
      `• *Auto-Failover:* *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `• *Response Cache:* *${cfg.cacheEnabled ? '⚡ Aktif' : '⚪ Nonaktif'}*\n` +
      `• *Sesi Chat Aktif:* ${botService.conversations.size} percakapan`;
    await api.sendTelegramMessage(chatId, statusMsg, null, null, token);
    return true;
  }

  // /metrics
  if (text === '/metrics') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const m = getMetrics();
    const metricsText = `📊 *Laporan Metrik Real-Time Bre AI*\n\n` +
      `• *Total Permintaan:* ${m.totalRequests.toLocaleString()} (${m.successfulRequests} sukses · ${m.failedRequests} gagal)\n` +
      `• *Total Token Diproses:* ${m.totalTokens.toLocaleString()} token\n` +
      `• *Tingkat Kegagalan (Error Rate):* ${m.errorRate}\n` +
      `• *Rata-Rata Latensi:* ${m.avgLatencyMs} ms\n` +
      `• *Cache RAM:* ${m.cacheSize} item\n` +
      `• *Sesi Percakapan:* ${botService.conversations.size} sesi`;
    await api.sendTelegramMessage(chatId, metricsText, null, null, token);
    return true;
  }

  // /logs
  if (text === '/logs' || text.startsWith('/logs ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const logs = getLogs().slice(0, 5);
    let logMsg = `📜 *5 Log Permintaan Terakhir:*\n\n`;
    if (!logs.length) {
      logMsg += `_Belum ada riwayat aktivitas terekam di memori._`;
    } else {
      logs.forEach((l, i) => {
        const time = l.timeStr || (l.timestamp ? new Date(l.timestamp).toLocaleTimeString('id-ID') : '-');
        const st = l.status >= 400 ? `🔴 ${l.status}` : `🟢 ${l.status}`;
        logMsg += `${i+1}. [${time}] *${l.provider || 'API'}* (${l.model || '-'})\n   Status: ${st} | ${l.latencyMs || 0}ms\n`;
        if (l.error) logMsg += `   ⚠️ Error: \`${l.error.slice(0, 60)}\`\n`;
      });
    }
    await api.sendTelegramMessage(chatId, logMsg, null, null, token);
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

  // /benchmark
  if (text === '/benchmark') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!eps.length) {
      await api.sendTelegramMessage(chatId, '⚠️ Tidak ada endpoint provider yang terdaftar.', null, null, token);
      return true;
    }

    await api.sendTelegramMessage(chatId, '⏳ Sedang menguji latensi seluruh provider secara paralel...', null, null, token);
    const results = await Promise.all(
      eps.map(async (ep, idx) => {
        const testRes = await testSingleModel(ep, ep.models?.[0] || 'mercury-2');
        return {
          name: ep.name || `Provider #${idx+1}`,
          model: ep.models?.[0] || 'mercury-2',
          ok: testRes.ok,
          latencyMs: testRes.latencyMs || 0,
          error: testRes.error || null
        };
      })
    );

    results.sort((a, b) => {
      if (a.ok && !b.ok) return -1;
      if (!a.ok && b.ok) return 1;
      return a.latencyMs - b.latencyMs;
    });

    let benchText = `🏆 *Leaderboard Kecepatan Provider:*\n\n`;
    results.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}.`));
      const st = r.ok ? `🟢 ${r.latencyMs}ms` : `🔴 Gagal (${r.error?.slice(0, 30) || 'Error'})`;
      benchText += `${medal} *${r.name}* (\`${r.model}\`): ${st}\n`;
    });
    await api.sendTelegramMessage(chatId, benchText, null, null, token);
    return true;
  }

  // /setmode [public|diizinkan]
  if (lowerText.startsWith('/setmode')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawMode = text.slice(8).trim().toLowerCase();
    let mode = '';
    if (rawMode === 'public') mode = 'public';
    else if (rawMode === 'diizinkan' || rawMode === 'whitelist') mode = 'diizinkan';

    if (!mode) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/setmode public\` atau \`/setmode diizinkan\``, null, null, token);
      return true;
    }
    saveConfig({ telegramAccessMode: mode });
    botService.activeAccessMode = mode;
    await api.sendTelegramMessage(chatId, `✅ Mode akses bot diubah ke: *${mode === 'public' ? '🟢 Publik' : '🔒 Khusus Pengguna Diizinkan'}*`, null, null, token);
    return true;
  }

  // /settemp [0.0-2.0]
  if (lowerText.startsWith('/settemp')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const val = parseFloat(text.slice(8).trim());
    if (isNaN(val) || val < 0 || val > 2.0) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/settemp [0.0 - 2.0]\` (Contoh: \`/settemp 0.7\`)`, null, null, token);
      return true;
    }
    saveConfig({ temperature: val });
    await api.sendTelegramMessage(chatId, `✅ Suhu kreativitas (temperature) diubah ke: \`${val}\``, null, null, token);
    return true;
  }

  // /setprompt [text]
  if (lowerText.startsWith('/setprompt')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const newPrompt = text.slice(10).trim();
    if (!newPrompt) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/setprompt [isi system prompt baru Anda]\``, null, null, token);
      return true;
    }
    saveConfig({ systemPrompt: newPrompt });
    await api.sendTelegramMessage(chatId, `✅ Master System Prompt berhasil diperbarui!`, null, null, token);
    return true;
  }

  // /setpassword [new_password]
  if (lowerText.startsWith('/setpassword')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const newPass = text.slice(12).trim();
    if (!newPass) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/setpassword [password_baru]\``, null, null, token);
      return true;
    }
    saveConfig({ adminPassword: newPass });
    await api.sendTelegramMessage(chatId, `✅ Password login Web Admin berhasil diganti!`, null, null, token);
    return true;
  }

  // /izinkan [id/@username] [optional name] (alias: /whitelist)
  if (lowerText.startsWith('/izinkan') || lowerText.startsWith('/whitelist')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cmdLen = lowerText.startsWith('/izinkan') ? 8 : 10;
    const args = text.slice(cmdLen).trim().split(/\s+/);
    const target = args[0];
    const customName = args.slice(1).join(' ') || '';
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/izinkan [ID atau @username] [Nama/Catatan]\`\nContoh: \`/izinkan 123456789 Rayan Sahabat\``, null, null, token);
      return true;
    }
    const isId = !isNaN(Number(target));
    const uId = isId ? target : target.replace(/^@/, '');
    const uName = isId ? '' : target.replace(/^@/, '');
    const userEntry = setUserRole(uId, uName, customName, 'diizinkan');
    await api.sendTelegramMessage(chatId, `✅ Pengguna *${userEntry.name}* (\`${userEntry.id || '@' + userEntry.username}\`) berhasil ditambahkan ke daftar Pengguna Diizinkan!`, null, null, token);
    return true;
  }

  // /blokir [id/@username] (alias: /block)
  if (lowerText.startsWith('/blokir') || lowerText.startsWith('/block')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cmdLen = lowerText.startsWith('/blokir') ? 7 : 6;
    const target = text.slice(cmdLen).trim();
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/blokir [ID atau @username]\``, null, null, token);
      return true;
    }
    const isId = !isNaN(Number(target));
    const uId = isId ? target : target.replace(/^@/, '');
    const uName = isId ? '' : target.replace(/^@/, '');
    const userEntry = setUserRole(uId, uName, `Blocked User`, 'blocked');
    await api.sendTelegramMessage(chatId, `🔴 Pengguna *${userEntry.name}* (\`${target}\`) telah diblokir dari bot!`, null, null, token);
    return true;
  }

  // /batalizin [id/@username] (alias: /hapususer, /unblock)
  if (lowerText.startsWith('/batalizin') || lowerText.startsWith('/hapususer') || lowerText.startsWith('/unblock')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const parts = text.trim().split(/\s+/);
    const target = parts[1];
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/batalizin [ID atau @username]\``, null, null, token);
      return true;
    }
    removeUserRole(target);
    await api.sendTelegramMessage(chatId, `✅ Pengguna \`${target}\` telah dihapus dari daftar perizinan / blokir.`, null, null, token);
    return true;
  }

  // /pengguna (alias: /users)
  if (text === '/pengguna' || text === '/users') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const users = Array.isArray(getConfig().telegramUsers) ? getConfig().telegramUsers : [];
    let uMsg = `👥 *Daftar Pengguna Terdaftar (${users.length} akun):*\n\n`;
    if (!users.length) {
      uMsg += `_Belum ada pengguna khusus terdaftar._`;
    } else {
      users.forEach((u, i) => {
        const isOwnerRole = u.role === 'owner';
        const isBlocked = u.role === 'blocked';
        const badge = isOwnerRole ? '👑 Owner' : (isBlocked ? '🔴 Diblokir' : '🟢 Diizinkan');
        uMsg += `${i+1}. *${u.name || u.username || u.id}* [${badge}]\n   \`${u.username ? '@' + u.username : u.id}\`\n`;
      });
    }
    await api.sendTelegramMessage(chatId, uMsg, null, null, token);
    return true;
  }

  // /blacklist [list | add kata | clear]
  if (lowerText.startsWith('/blacklist')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArg = text.slice(10).trim();
    const parts = rawArg.split(/\s+/);
    const subCmd = parts[0]?.toLowerCase();
    const currentBlacklist = Array.isArray(getConfig().blacklist) ? [...getConfig().blacklist] : [];

    if (subCmd === 'add') {
      const word = parts.slice(1).join(' ').trim();
      if (!word) {
        await api.sendTelegramMessage(chatId, 'ℹ️ Format: `/blacklist add [kata]`', null, null, token);
        return true;
      }
      if (!currentBlacklist.includes(word)) {
        currentBlacklist.push(word);
        saveConfig({ blacklist: currentBlacklist });
      }
      await api.sendTelegramMessage(chatId, `✅ Kata \`${word}\` ditambahkan ke Blacklist Moderasi!`, null, null, token);
      return true;
    }

    if (subCmd === 'clear') {
      saveConfig({ blacklist: [] });
      await api.sendTelegramMessage(chatId, `🗑️ Blacklist kata berhasil dikosongkan!`, null, null, token);
      return true;
    }

    let blMsg = `🛡️ *Daftar Kata Terlarang (Blacklist ${currentBlacklist.length} kata):*\n\n`;
    if (!currentBlacklist.length) {
      blMsg += `_Belum ada kata terlarang didaftarkan._\n\nKetik \`/blacklist add [kata]\` untuk menambah kata.`;
    } else {
      blMsg += currentBlacklist.map(w => `• \`${w}\``).join('\n') + `\n\nKetik \`/blacklist add [kata]\` untuk menambah kata.`;
    }
    await api.sendTelegramMessage(chatId, blMsg, null, null, token);
    return true;
  }

  // /export
  if (text === '/export') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const fullConfig = getConfig();
    const configStr = JSON.stringify(fullConfig, null, 2);
    const fileName = `bre_ai_config_${new Date().toISOString().slice(0, 10)}.json`;
    const caption = `📦 *Backup Konfigurasi Bre AI*\nTanggal: ${new Date().toLocaleString('id-ID')}`;
    try {
      await api.sendTelegramDocument(chatId, fileName, configStr, caption, token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim berkas backup: ${e.message}`, null, null, token);
    }
    return true;
  }

  // /clearcache
  if (text === '/clearcache') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    clearResponseCache();
    botService.conversations.clear();
    await api.sendTelegramMessage(chatId, `⚡ *Cache RAM dan seluruh sesi percakapan berhasil dibersihkan!*`, null, null, token);
    return true;
  }

  // /broadcast [pesan]
  if (text === '/broadcast' || text.startsWith('/broadcast ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah siaran hanya dapat dijalankan oleh Owner.', null, null, token);
      return true;
    }
    const broadcastBody = text.slice(10).trim();
    await handleBroadcastCommand(chatId, fromUser, broadcastBody, botService);
    return true;
  }

  // /start
  if (text === '/start' || text.startsWith('/start ')) {
    botService.conversations.delete(chatId);

    let welcome = `⚡️ *Halo ${senderName}!* Selamat datang di *Bre AI*.

Saya adalah asisten kecerdasan buatan serba bisa dan cerdas tanpa batas ciptaan *Amirun Rayan Ariandi*, siap membantu Anda menjawab pertanyaan, menulis kode program, menghasilkan pesan interaktif, menganalisis dokumen/gambar, hingga menyelesaikan tugas kompleks langsung dari Telegram.

• Tulis pesan dalam *bahasa apa pun* — Bre AI otomatis menjawab dalam bahasa yang sama! 🌐
• Kirim /reset untuk membersihkan riwayat obrolan.
• Kirim /help untuk daftar perintah & panduan lengkap.`;

    let replyMarkup = null;

    if (isOwnerUser) {
      const cfg2 = getConfig();
      const ownerStyle = STYLE_LABELS[cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';
      welcome += `\n\n👑 *Panel Pemilik (Owner):*\n` +
        `Kirim */admin* untuk membuka Master Control Panel atau pantau sistem dengan perintah cepat: \`/status\`, \`/metrics\`, \`/logs\`, \`/providers\`, \`/benchmark\`.\n` +
        `🎭 *Gaya Bahasa Indonesia Aktif:* ${ownerStyle}\n` +
        `_Gunakan \`/style\` untuk mengubah gaya bahasa Indonesia Bre AI (global)._`;

      replyMarkup = {
        inline_keyboard: [
          [
            { text: '🎛️ Buka Master Admin Panel', callback_data: 'adm_main' },
            { text: '📊 Cek Status & Metrik', callback_data: 'adm_metrics' }
          ]
        ]
      };
    }

    await api.sendTelegramMessage(chatId, welcome, replyMarkup, null, token);
    return true;
  }

  // /help
  if (text === '/help') {
    const cfg2 = getConfig();
    const globalStyle = cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta';
    const styleLabel = STYLE_LABELS[globalStyle] || '🗣️ Jakarta / Gaul (Gue-Lu)';

    let help = `📖 *Panduan Penggunaan Bre AI di Telegram*

• *Bahasa Otomatis:* Tulis dalam bahasa apa pun — Indonesia, Inggris, Jepang, Arab, Mandarin, dll — Bre AI otomatis menjawab dalam bahasa yang sama! 🌐
• *Semua Jenis Pesan Diterima:* Teks, foto, suara/audio, video, berkas kode, lokasi, kontak, stiker, dan GIF.
• *Pesan Non-Teks Interaktif:* Anda dapat menyuruh Bre AI membuat file kodingan unduhan, kuis/polling, lempar dadu/game, pin lokasi peta, dan kartu kontak secara alami!
• *Ingatan Konteks:* Bre AI mengingat konteks percakapan secara berkelanjutan.
• *Perintah /reset:* Membersihkan ingatan topik sebelumnya dan memulai sesi baru.

🌍 *Contoh Bahasa Otomatis:*
_• Tulis "halo bre" → Bre AI jawab GAUL Bahasa Indonesia 🇮🇩_
_• Write "hello bre" → Bre AI replies in English 🇺🇸_
_• 「Bre、こんにちは」 → Bre AI returns in Japanese 🇯🇵_

🎮 *Perintah Pintas Media Interaktif:*
• \`/dice\` atau \`/dadu\` - Lempar dadu animasi 🎲
• \`/dart\`, \`/basket\`, \`/bola\`, \`/bowling\`, \`/slot\` - Game animasi seru
• \`/poll [Pertanyaan] | [Opsi 1] | [Opsi 2] ...\` - Buat Polling Telegram
• \`/quiz [Pertanyaan] | [Opsi A] | [Opsi B*] ...\` - Buat Kuis Interaktif
• \`/file [nama_file.ext] [isi kode]\` - Buat & kirim berkas file fisik
• \`/location [lat, lon] | [Tempat] | [Alamat]\` - Kirim pin lokasi peta
• \`/contact [nomor] [Nama Depan] [Nama Belakang]\` - Kirim kartu kontak

🎭 *Gaya Bahasa Indonesia Aktif:* ${styleLabel}
_Gaya ini berlaku untuk semua respons Bahasa Indonesia Bre AI._
Pencipta & Pengembang: *Amirun Rayan Ariandi* 🚀`;

    if (isOwnerUser) {
      help += `\n\n👑 *Daftar Perintah Admin (Owner):*\n` +
        `• \`/admin\` - Buka Master Control Panel Interaktif\n` +
        `• \`/style [gaya]\` - *Ganti gaya bahasa Indonesia global* (jakarta, jawa_halus, jawa_kasar, sunda, sopan, santai, medan, makassar)\n` +
        `• \`/status\` - Ringkasan status bot & engine\n` +
        `• \`/metrics\` - Laporan metrik real-time & token\n` +
        `• \`/logs\` - Lihat 5 log server terakhir\n` +
        `• \`/providers\` - Daftar endpoint AI & status routing\n` +
        `• \`/addprovider [nama] [url] [key] [model]\` - Tambah provider manual\n` +
        `• \`/editprovider [idx/nama] [field] [nilai]\` - Edit provider (url/key/model/name/weight)\n` +
        `• \`/seturl [idx/nama] [url]\` - Ganti endpoint Base URL provider\n` +
        `• \`/setmodel [idx/nama] [model]\` - Ganti model AI provider\n` +
        `• \`/setkey [idx/nama] [key]\` - Ganti API Key utama provider\n` +
        `• \`/setname [idx/nama] [nama]\` - Ganti nama label provider\n` +
        `• \`/setweight [idx/nama] [bobot]\` - Atur bobot prioritas provider\n` +
        `• \`/addkey [idx/nama] [key]\` - Tambah API key tambahan (rotasi)\n` +
        `• \`/delkey [idx/nama] [key_idx]\` - Hapus API key dari provider\n` +
        `• \`/delprovider [idx/nama]\` - Hapus provider dari router\n` +
        `• \`/setrouting [auto|priority|weighted]\` - Atur rotasi provider (AUTO bergantian)\n` +
        `• \`/benchmark\` - Uji kecepatan paralel semua provider\n` +
        `• \`/setmode [public|diizinkan]\` - Ubah mode akses bot\n` +
        `• \`/settemp [0.0-2.0]\` - Ubah suhu kreativitas\n` +
        `• \`/setprompt [teks]\` - Ganti Master System Prompt\n` +
        `• \`/setpassword [pass]\` - Ganti password Web Admin\n` +
        `• \`/izinkan [id/@user] [nama]\` - Tambah user ke daftar diizinkan\n` +
        `• \`/blokir [id/@user]\` - Blokir user\n` +
        `• \`/batalizin [id/@user]\` - Hapus dari daftar perizinan\n` +
        `• \`/pengguna\` - Lihat daftar user terdaftar\n` +
        `• \`/blacklist [add|list|clear]\` - Kelola kata terlarang\n` +
        `• \`/export\` - Unduh berkas backup config.json\n` +
        `• \`/clearcache\` - Bersihkan cache RAM & sesi\n` +
        `• \`/broadcast [pesan]\` - Kirim pesan siaran massal`;
    }

    await api.sendTelegramMessage(chatId, help, null, null, token);
    return true;
  }

  // /reset, /clear, /restart
  if (text === '/reset' || text === '/clear' || text === '/restart') {
    botService.conversations.delete(chatId);
    await api.sendTelegramMessage(chatId, `✨ *Riwayat percakapan berhasil dibersihkan!* Anda sekarang berada di sesi obrolan baru.`, null, null, token);
    return true;
  }

  // /style, /gayabahasa, /gaya — OWNER ONLY — sets global Indonesian dialect style
  if (lowerText === '/style' || lowerText.startsWith('/style ') || lowerText === '/gayabahasa' || lowerText.startsWith('/gayabahasa ') || lowerText === '/gaya' || lowerText.startsWith('/gaya ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(
        chatId,
        `🔒 *Perintah ini hanya untuk Owner Bot.*\n\nGaya bahasa diatur secara global oleh owner. Bre AI otomatis mendeteksi bahasa yang kamu pakai dan menyesuaikan responnya. 😊`,
        null, null, token
      );
      return true;
    }

    const rawArg = text.replace(/^\/(style|gayabahasa|gaya)/i, '').trim().toLowerCase();
    const styleEntries = Object.entries(STYLE_LABELS);

    if (rawArg) {
      const matchKey = Object.keys(STYLE_LABELS).find(k => k === rawArg || k.replace('_', '') === rawArg.replace(/[\s_-]/g, ''));
      if (matchKey) {
        // Save globally to config.telegramStyle (applies to ALL Indonesian responses bot-wide)
        await saveConfig({ telegramStyle: matchKey, defaultStyle: matchKey });
        await api.sendTelegramMessage(
          chatId,
          `✅ *Gaya Bahasa Global Berhasil Diubah!*\n\n• *Gaya Aktif:* ${STYLE_LABELS[matchKey]}\n\n_Gaya ini berlaku global untuk seluruh respons Bahasa Indonesia Bre AI di bot ini._`,
          null, null, token
        );
        return true;
      } else {
        const styleList = Object.entries(STYLE_LABELS).map(([k, v]) => `• \`/style ${k}\` — ${v}`).join('\n');
        await api.sendTelegramMessage(chatId, `⚠️ *Gaya "${rawArg}" tidak dikenal.*\n\nPilihan gaya yang tersedia:\n${styleList}`, null, null, token);
        return true;
      }
    }

    const cfg2 = getConfig();
    const currentStyle = cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta';
    const styleRows = styleEntries.map(([code, label]) => ([
      {
        text: (code === currentStyle ? '✅ ' : '') + label,
        callback_data: `set_style:${chatId}:${code}`
      }
    ]));
    styleRows.push([{ text: '❌ Tutup', callback_data: `set_style:${chatId}:close` }]);

    const styleText = `🎭 *Pilih Gaya Bahasa Global Bre AI*\n\n` +
      `Gaya aktif saat ini: *${STYLE_LABELS[currentStyle] || '✨ Santai & Friendly'}*\n\n` +
      `Gaya ini berlaku global untuk SEMUA respons Bahasa Indonesia di bot ini.\n` +
      `_Gunakan \`/style [nama_gaya]\` untuk langsung mengubah, atau pilih tombol:_`;

    await api.sendTelegramMessage(chatId, styleText, { inline_keyboard: styleRows }, null, token);
    return true;
  }

  // /language, /bahasa, /lang, /setlang, /setbahasa — DIHAPUS
  // Bahasa sekarang otomatis mengikuti bahasa pesan masing-masing pengguna.
  if (
    lowerText === '/language' || lowerText.startsWith('/language ') ||
    lowerText === '/bahasa' || lowerText.startsWith('/bahasa ') ||
    lowerText === '/lang' || lowerText.startsWith('/lang ') ||
    lowerText === '/setlang' || lowerText.startsWith('/setlang ') ||
    lowerText === '/setbahasa' || lowerText.startsWith('/setbahasa ')
  ) {
    await api.sendTelegramMessage(
      chatId,
      `🌐 *Pengaturan Bahasa Otomatis*\n\nBre AI sekarang otomatis mendeteksi bahasa yang kamu pakai dan menjawab dalam bahasa yang sama!\n\n` +
      `• Tulis dalam Bahasa Indonesia → Bre AI balas dalam Bahasa Indonesia 🇮🇩\n` +
      `• Write in English → Bre AI replies in English 🇺🇸\n` +
      `• 日本語で書く → 日本語で返信します 🇯🇵\n` +
      `• ...dan seterusnya untuk semua bahasa.\n\n` +
      `_Tidak perlu setting apa pun. Cukup tulis pakai bahasa yang kamu mau!_ ✨`,
      null, null, token
    );
    return true;
  }



  // /dice, /dadu, /dart, /panah, /basket, /bola, /football, /bowling, /slot, /kasino
  if (['/dice', '/dadu', '/dart', '/panah', '/basket', '/bola', '/football', '/bowling', '/slot', '/kasino'].some(c => lowerText === c || lowerText.startsWith(c + ' '))) {
    const emojiMap = {
      '/dice': '🎲', '/dadu': '🎲',
      '/dart': '🎯', '/panah': '🎯',
      '/basket': '🏀',
      '/bola': '⚽', '/football': '⚽',
      '/bowling': '🎳',
      '/slot': '🎰', '/kasino': '🎰'
    };
    const cmd = lowerText.split(/\s+/)[0];
    const emoji = emojiMap[cmd] || '🎲';
    try {
      await api.sendTelegramDice(chatId, emoji, token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal melempar dadu/game: ${e.message}`, null, null, token);
    }
    return true;
  }

  // /poll [Pertanyaan] | [Opsi 1] | [Opsi 2] | [Opsi 3]...
  if (lowerText.startsWith('/poll')) {
    const rawArgs = text.slice(5).trim();
    const parts = rawArgs.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
      await api.sendTelegramMessage(
        chatId,
        `📊 *Panduan Format Polling Telegram:*\n\n` +
        `Gunakan format:\n\`/poll [Pertanyaan] | [Opsi 1] | [Opsi 2] | [Opsi 3]\`\n\n` +
        `_Contoh:_\n\`/poll Framework favorit Anda? | React | Vue | Next.js | Svelte\``,
        null, null, token
      );
      return true;
    }
    const question = parts[0];
    const options = parts.slice(1);
    try {
      await api.sendTelegramPoll(chatId, question, options, true, 'regular', null, '', token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal membuat polling: ${e.message}`, null, null, token);
    }
    return true;
  }

  // /quiz [Pertanyaan] | [Opsi 1] | [Opsi 2*] | [Opsi 3]...
  if (lowerText.startsWith('/quiz')) {
    const rawArgs = text.slice(5).trim();
    const parts = rawArgs.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
      await api.sendTelegramMessage(
        chatId,
        `🧠 *Panduan Format Kuis Interaktif Telegram:*\n\n` +
        `Gunakan format (tambahkan tanda \`*\` di ujung opsi yang benar):\n\`/quiz [Pertanyaan] | [Opsi A] | [Opsi B*] | [Opsi C]\`\n\n` +
        `_Contoh:_\n\`/quiz Siapa pencipta Bre AI? | Elon Musk | Amirun Rayan Ariandi* | Sam Altman\``,
        null, null, token
      );
      return true;
    }
    const question = parts[0];
    let correctIdx = 0;
    const cleanOptions = [];
    parts.slice(1).forEach((opt, idx) => {
      if (opt.endsWith('*')) {
        correctIdx = idx;
        cleanOptions.push(opt.slice(0, -1).trim());
      } else {
        cleanOptions.push(opt);
      }
    });

    try {
      await api.sendTelegramPoll(chatId, question, cleanOptions, false, 'quiz', correctIdx, 'Jawaban yang tepat!', token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal membuat kuis: ${e.message}`, null, null, token);
    }
    return true;
  }

  // /file [filename] [content...] or /file [prompt] or /buatfile [prompt]
  if (lowerText.startsWith('/file') || lowerText.startsWith('/buatfile')) {
    const raw = text.replace(/^\/(file|buatfile)/i, '').trim();

    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `📄 *Panduan Format Buat Berkas File:*\n\n` +
        `Anda dapat membuat berkas dengan 2 cara mudah:\n\n` +
        `*1. Buat Berkas Langsung (Instan):*\n` +
        `\`/file [nama_file.ext] [isi konten/kode]\`\n` +
        `_Contoh:_\n\`/file halo.py print("Halo dari Bre AI!")\`\n\n` +
        `*2. Minta Bre AI Menyusun File Otomatis:*\n` +
        `\`/file [nama_file.ext]\` (tanpa isi)\n` +
        `_Contoh:_ \`/file script.py\` atau \`/file index.html\`\n` +
        `Atau perintah bahasa alami:\n` +
        `\`/file buatkan script python untuk hitung zakat\`\n` +
        `\`/file bikin file rekap data.csv nilai siswa\`\n\n` +
        `_Tips: Anda juga bisa langsung chat biasa seperti "Bre, buatkan file bot.py"!_ 🚀`,
        null, null, token
      );
      return true;
    }

    const spaceIdx = raw.indexOf(' ');
    const newlineIdx = raw.indexOf('\n');
    let splitIdx = spaceIdx;
    if (newlineIdx !== -1 && (spaceIdx === -1 || newlineIdx < spaceIdx)) splitIdx = newlineIdx;

    const firstToken = splitIdx !== -1 ? raw.slice(0, splitIdx).trim() : raw.trim();
    const remainingText = splitIdx !== -1 ? raw.slice(splitIdx).trim() : '';
    const hasExtension = /\.[a-zA-Z0-9]{1,10}$/.test(firstToken);
    const isNaturalPrompt = remainingText.toLowerCase().startsWith('buatkan') || remainingText.toLowerCase().startsWith('bikin') || remainingText.toLowerCase().startsWith('tolong');

    // Case 1: Direct File Creation (User supplied filename with extension AND actual content)
    if (hasExtension && remainingText.length > 0 && !isNaturalPrompt) {
      try {
        await api.sendTelegramDocument(chatId, firstToken, remainingText, `📄 Berkas \`${firstToken}\` berhasil dibuat.`, token);
      } catch (e) {
        await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim berkas: ${e.message}`, null, null, token);
      }
      return true;
    }

    // Case 2: AI-Powered File Generation
    let generationPrompt = '';
    if (hasExtension && !remainingText) {
      generationPrompt = `Tolong buatkan berkas file "${firstToken}" secara lengkap, rapi, dan fungsional. Tuliskan seluruh kode atau isi berkas lengkapnya di dalam blok kode dengan nama file di baris pertama atau tag [TELEGRAM_FILE: ...] agar langsung dikirimkan sebagai berkas unduhan ke pengguna.`;
    } else {
      generationPrompt = `Tolong buatkan berkas file untuk permintaan berikut: "${raw}". Pastikan menyertakan isi/kode berkas secara LENGKAP di dalam blok kode dengan nama file di baris pertama atau tag [TELEGRAM_FILE: ...] agar langsung dikemas menjadi berkas unduhan fisik asli.`;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadingMsg = await api.sendTelegramMessage(chatId, `⏳ *Bre AI sedang membuat dan mengemas berkas file Anda...*`, null, null, token);
    const loadingMsgId = loadingMsg?.message_id || null;

    try {
      const answer = await queryBreAIRouter(generationPrompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await processAndSendOutboundMedia(chatId, answer, token, loadingMsgId, raw);
    } catch (genErr) {
      const errTxt = `⚠️ Gagal membuat berkas file: ${genErr.message}`;
      if (loadingMsgId) await api.editTelegramMessage(chatId, loadingMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /location [lat, lon] | [Nama Tempat] | [Alamat]
  if (lowerText.startsWith('/location') || lowerText.startsWith('/lokasi')) {
    const raw = text.replace(/^\/(location|lokasi)/i, '').trim();
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    if (!parts.length) {
      await api.sendTelegramMessage(
        chatId,
        `📍 *Panduan Format Kirim Lokasi:*\n\n` +
        `Gunakan format:\n\`/location [latitude, longitude] | [Nama Tempat] | [Alamat Lengkap]\`\n\n` +
        `_Contoh:_\n\`/location -6.175392, 106.827153 | Monas | Gambir, Jakarta Pusat\``,
        null, null, token
      );
      return true;
    }

    const coords = parts[0].split(',').map(s => parseFloat(s.trim()));
    const lat = coords[0];
    const lon = coords[1];
    const title = parts[1] || '';
    const addr = parts[2] || '';

    if (isNaN(lat) || isNaN(lon)) {
      await api.sendTelegramMessage(chatId, `⚠️ Format koordinat tidak valid. Contoh: \`/location -6.175392, 106.827153\``, null, null, token);
      return true;
    }

    try {
      if (title || addr) {
        await api.sendTelegramVenue(chatId, lat, lon, title || 'Lokasi', addr || 'Alamat', token);
      } else {
        await api.sendTelegramLocation(chatId, lat, lon, token);
      }
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim titik lokasi: ${e.message}`, null, null, token);
    }
    return true;
  }

  // /contact [nomor] [Nama Depan] [Nama Belakang]
  if (lowerText.startsWith('/contact') || lowerText.startsWith('/kontak')) {
    const raw = text.replace(/^\/(contact|kontak)/i, '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await api.sendTelegramMessage(
        chatId,
        `👤 *Panduan Format Kirim Kontak:*\n\n` +
        `Gunakan format:\n\`/contact [Nomor Telepon] [Nama Depan] [Nama Belakang]\`\n\n` +
        `_Contoh:_\n\`/contact +628123456789 Amirun Ariandi\``,
        null, null, token
      );
      return true;
    }

    const phone = parts[0];
    const firstName = parts[1];
    const lastName = parts.slice(2).join(' ') || '';

    try {
      await api.sendTelegramContact(chatId, phone, firstName, lastName, '', token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim kartu kontak: ${e.message}`, null, null, token);
    }
    return true;
  }

  // /tools or /alat
  if (lowerText === '/tools' || lowerText === '/alat' || lowerText === '/menu') {
    const toolsMsg = `🛠️ *Pusat Alat Pintar & AI Tools Bre AI*\n\n` +
      `Gunakan perintah spesialis di bawah untuk hasil instan dan terstruktur:\n\n` +
      `🔍 \`/search [kueri]\` — Riset web & cari data internet live\n` +
      `💻 \`/code [deskripsi]\` — Generator kode pemrograman & bug fixer\n` +
      `📝 \`/summary [teks]\` — Ringkasan poin eksekutif artikel/teks\n` +
      `📋 \`/prd [nama fitur]\` — Buat dokumen Product Requirement (PRD)\n` +
      `✍️ \`/copy [topik]\` — Generator copywriting & konten viral\n` +
      `🧠 \`/think [masalah]\` — Penalaran analitis mendalam (Deep Reasoning)\n` +
      `🌐 \`/translate [bahasa] [teks]\` — Terjemahan bahasa & perbaikan grammar\n` +
      `⚡ \`/health\` — Monitor latensi & kesehatan seluruh provider AI\n` +
      `📄 \`/file [nama_file.ext]\` — Buat berkas & unduhan fisik otomatis\n\n` +
      `_Contoh cepat:_\n` +
      `• \`/search harga saham nvidia hari ini\`\n` +
      `• \`/code scraper tokopedia python\`\n` +
      `• \`/prd fitur live chat customer service\`\n` +
      `• \`/copy promosi kopi susu gula aren\``;
    await api.sendTelegramMessage(chatId, toolsMsg, null, null, token);
    return true;
  }

  // /health
  if (lowerText === '/health' || lowerText === '/kesehatan') {
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!eps.length) {
      await api.sendTelegramMessage(chatId, '⚠️ Belum ada provider yang terdaftar.', null, null, token);
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `⚡ *Memeriksa latensi & kesehatan seluruh provider AI...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const probeResults = await Promise.all(
      eps.map(async (ep, i) => {
        const modelToTest = ep.models?.[0] || 'default';
        const start = Date.now();
        const probe = await testSingleModel(ep, modelToTest);
        const ms = probe.latencyMs || (Date.now() - start);
        return {
          idx: i + 1,
          name: ep.name || 'Provider',
          model: modelToTest,
          status: ep.status !== false ? (probe.ok ? '🟢 200 OK' : '🔴 Error') : '⚪ Off',
          latency: ms,
          error: probe.error || null
        };
      })
    );

    let resText = `⚡ *Laporan Kesehatan Provider AI Live*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    probeResults.forEach(p => {
      resText += `${p.idx}. *${p.name}* [${p.status}]\n   • Model: \`${p.model}\`\n   • Latensi: \`${p.latency} ms\`\n`;
      if (p.error) resText += `   • Error: \`${p.error.slice(0, 50)}\`\n`;
      resText += `\n`;
    });

    resText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Strategi: *${(cfg.routingStrategy || 'auto').toUpperCase()}*\n` +
      `• Auto-Failover: *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `_Sistem otomatis memindahkan trafik ke provider sehat jika terjadi kendala._`;

    if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, resText, null, token);
    else await api.sendTelegramMessage(chatId, resText, null, null, token);
    return true;
  }

  // /search [kueri] or /cari [kueri]
  if (lowerText.startsWith('/search') || lowerText.startsWith('/cari')) {
    const query = text.replace(/^\/(search|cari)/i, '').trim();
    if (!query) {
      await api.sendTelegramMessage(
        chatId,
        `🔍 *Panduan Pencarian Web Live:*\n\nGunakan format:\n\`/search [kueri pencarian]\`\n\n_Contoh:_\n\`/search berita teknologi kecerdasan buatan terkini\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `🔍 *Bre AI sedang menjelajah web untuk:* _"${query}"_...`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    let webSnippets = '';
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const searchRes = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (searchRes.ok) {
        const json = await searchRes.json();
        let items = [];
        if (json.AbstractText) items.push(`• ${json.Heading || query}: ${json.AbstractText} (Sumber: ${json.AbstractURL || 'Web'})`);
        if (Array.isArray(json.RelatedTopics)) {
          json.RelatedTopics.slice(0, 4).forEach(t => {
            if (t.Text) items.push(`• ${t.Text} (Sumber: ${t.FirstURL || 'Web'})`);
          });
        }
        if (items.length) webSnippets = items.join('\n');
      }
    } catch (e) {}

    const prompt = `[HASIL PENCARIAN WEB TERKINI UNTUK: "${query}"]\n${webSnippets || 'Data web langsung diperoleh dari internet.'}\n\n[INSTRUKSI]:\nSebagai Bre AI, jawab dan rangkum pertanyaan/topik "${query}" berdasarkan data di atas secara jelas, komprehensif, dan sertakan sumber/referensi jika ada.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal memproses pencarian: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /code [deskripsi] or /coding [deskripsi]
  if (lowerText.startsWith('/code') || lowerText.startsWith('/coding')) {
    const raw = text.replace(/^\/(code|coding)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `💻 *Panduan Generator Kode AI:*\n\nGunakan format:\n\`/code [deskripsi program atau perbaikan bug]\`\n\n_Contoh:_\n\`/code script python telegram bot dengan webhook\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `💻 *Bre AI sedang merancang & menyusun kode program...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Bertindaklah sebagai Principal Software Engineer. Buatkan kode pemrograman berkualitas tinggi, bersih, optimal, dan aman untuk permintaan berikut: "${raw}". Berikan penjelasan ringkas dan letakkan seluruh kode lengkap di dalam blok kode dengan mencantumkan nama berkas (misal: script.py, app.js, index.html) di baris pertama blok kode agar sistem otomatis membuatkan berkas unduhan fisik bagi pengguna.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await processAndSendOutboundMedia(chatId, answer, token, loadMsgId, raw);
    } catch (err) {
      const errTxt = `⚠️ Gagal menghasilkan kode: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /summary [teks] or /ringkas [teks]
  if (lowerText.startsWith('/summary') || lowerText.startsWith('/ringkas')) {
    const raw = text.replace(/^\/(summary|ringkas)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `📝 *Panduan Ringkas Dokumen:*\n\nGunakan format:\n\`/summary [teks atau artikel panjang]\`\n\n_Contoh:_\n\`/summary [tempel teks artikel di sini]\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `📝 *Bre AI sedang menganalisis & merangkum inti teks...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Tolong buatkan ringkasan eksekutif, poin-poin penting (Key Takeaways), dan Action Items yang terstruktur dan mudah dipahami dari teks berikut:\n\n${raw}`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal membuat ringkasan: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /prd [nama fitur]
  if (lowerText.startsWith('/prd')) {
    const raw = text.replace(/^\/prd/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `📋 *Panduan Pembuatan PRD (Product Requirement Document):*\n\nGunakan format:\n\`/prd [nama fitur atau produk]\`\n\n_Contoh:_\n\`/prd Sistem Booking Lapangan Futsal Otomatis\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `📋 *Bre AI sedang menyusun dokumen PRD standar industri...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Bertindaklah sebagai Senior Product Manager (PRD Specialist). Susun dokumen PRD (Product Requirement Document) lengkap dan terstruktur rapi untuk: "${raw}". Format dokumen mencakup: 1. Overview, 2. Problem Statement & Goals, 3. User Persona & User Stories, 4. Functional Specifications, 5. Non-Functional Specs & Security, 6. Acceptance Criteria, 7. Edge Cases & Risks, 8. Success Metrics (KPIs). Letakkan dalam blok kode markdown agar dapat diunduh langsung.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await processAndSendOutboundMedia(chatId, answer, token, loadMsgId, raw);
    } catch (err) {
      const errTxt = `⚠️ Gagal menyusun PRD: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /copy [topik] or /copywriting [topik]
  if (lowerText.startsWith('/copy') || lowerText.startsWith('/copywriting')) {
    const raw = text.replace(/^\/(copywriting|copy)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `✍️ *Panduan Copywriting AI:*\n\nGunakan format:\n\`/copy [nama produk, promosi, atau topik iklan]\`\n\n_Contoh:_\n\`/copy Kursus Digital Marketing Garansi Kerja\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `✍️ *Bre AI sedang meracik formula copywriting persuasif...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Bertindaklah sebagai Master Copywriter kelas dunia (AIDA & PAS framework). Buatkan materi copywriting persuasif dan berkonversi tinggi untuk topik/produk: "${raw}". Berikan: 1. 3 Pilihan Hook/Headline yang memikat, 2. Storytelling & Emotional Benefit, 3. Solusi & Value Proposition, 4. Call to Action (CTA) yang kuat, 5. Contoh teks untuk Caption Instagram/TikTok.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal membuat copywriting: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /think [masalah] or /analisis [masalah]
  if (lowerText.startsWith('/think') || lowerText.startsWith('/analisis')) {
    const raw = text.replace(/^\/(think|analisis)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `🧠 *Panduan Deep Analytical Reasoning:*\n\nGunakan format:\n\`/think [masalah rumit atau pertanyaan analitis]\`\n\n_Contoh:_\n\`/think Mana strategi bisnis yang lebih baik: Bootstrapping vs Mencari Investor VC?\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `🧠 *Bre AI sedang melakukan penalaran mendalam langkah demi langkah...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Analisis dan pecahkan pertanyaan/masalah berikut dengan penalaran sistematis langkah demi langkah (Deep Analytical Reasoning / Chain of Thought):\n\n"${raw}"\n\nSajikan analisis komparatif, trade-offs, mitigasi risiko, dan rekomendasi konkrit.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal menganalisis: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }

  // /translate [bahasa] [teks] or /terjemah [bahasa] [teks]
  if (lowerText.startsWith('/translate') || lowerText.startsWith('/terjemah')) {
    const raw = text.replace(/^\/(translate|terjemah)/i, '').trim();
    const spaceIdx = raw.indexOf(' ');
    if (spaceIdx === -1 || !raw) {
      await api.sendTelegramMessage(
        chatId,
        `🌐 *Panduan Penerjemah Cerdas:*\n\nGunakan format:\n\`/translate [bahasa target] [teks]\`\n\n_Contoh:_\n\`/translate english Selamat pagi rekan-rekan, mari kita mulai meeting hari ini.\``,
        null, null, token
      );
      return true;
    }

    const targetLang = raw.slice(0, spaceIdx).trim();
    const content = raw.slice(spaceIdx).trim();

    api.sendTyping(chatId, token).catch(() => {});
    const prompt = `Terjemahkan teks berikut ke dalam bahasa ${targetLang} dengan nada profesional, natural, dan akurat secara tata bahasa:\n\n"${content}"\n\nBerikan juga 1 opsi alternatif yang lebih santai jika relevan.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal menerjemahkan: ${err.message}`, null, null, token);
    }
    return true;
  }

  return false;
}

module.exports = {
  handleSlashCommand,
  handleBroadcastCommand,
  resolveTargetProvider
};
