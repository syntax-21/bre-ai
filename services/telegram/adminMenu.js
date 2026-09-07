// ========================================================
// Bre AI v3.0 - Comprehensive Telegram Bot Admin Panel
// Rich interactive inline menus & operational controls
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  getMetrics,
  getLogs,
  clearResponseCache
} = require('../../api/_shared');
const {
  apiCall,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallback
} = require('./api');
const {
  recentUsers,
  getRecentUsersList,
  isOwner
} = require('./accessControl');

// State for multi-step admin actions (e.g. Broadcast)
const adminActionState = new Map(); // ownerChatId -> { action: 'broadcast', step: 1 }

// 1. Build Main Menu Keyboard
function buildMainMenuMarkup(cfg) {
  const currentMode = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Whitelist' : '🟢 Publik';
  const currentLang = cfg.telegramLanguage || 'id';
  const LANG_LABELS = { id: '🇮🇩 ID', en: '🇺🇸 EN', ja: '🇯🇵 JA', zh: '🇨🇳 ZH', es: '🇪🇸 ES', ar: '🇸🇦 AR', de: '🇩🇪 DE', fr: '🇫🇷 FR', ru: '🇷🇺 RU', ko: '🇰🇷 KO' };
  const langLabel = LANG_LABELS[currentLang] || '🌐 ID';
  return {
    inline_keyboard: [
      [
        { text: '📊 Status & Metrik', callback_data: 'adm_metrics' },
        { text: '🔄 Ganti Model AI', callback_data: 'adm_models' }
      ],
      [
        { text: '👥 Kelola Pengguna', callback_data: 'adm_users' },
        { text: `🛡️ Mode: ${currentMode}`, callback_data: 'adm_mode' }
      ],
      [
        { text: `🌐 Bahasa: ${langLabel}`, callback_data: 'adm_language' },
        { text: '⚙️ Parameter Suhu', callback_data: 'adm_params' }
      ],
      [
        { text: '⚡ Benchmark Upstream', callback_data: 'adm_benchmark' },
        { text: '📢 Broadcast Pesan', callback_data: 'adm_broadcast' }
      ],
      [
        { text: '📜 Log Terakhir', callback_data: 'adm_logs' },
        { text: '🗑️ Bersihkan Cache', callback_data: 'adm_flush_confirm' }
      ],
      [
        { text: '🩺 Diagnostik Webhook', callback_data: 'adm_diag' },
        { text: '🔄 Refresh Panel', callback_data: 'adm_main' }
      ],
      [
        { text: '❌ Tutup Panel', callback_data: 'adm_close' }
      ]
    ]
  };
}

function getMainMenuText(senderName, conversationsCount = 0) {
  const cfg = getConfig();
  const activeModel = cfg.telegramModel || cfg.model || 'mercury-2';
  const accessMode = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Khusus Whitelist (Private)' : '🟢 Terbuka untuk Publik';
  const userCount = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers.length : 0;
  const m = getMetrics();
  const LANG_LABELS = { id: '🇮🇩 Indonesia', en: '🇺🇸 English', ja: '🇯🇵 日本語', zh: '🇨🇳 中文', es: '🇪🇸 Español', ar: '🇸🇦 عربية', de: '🇩🇪 Deutsch', fr: '🇫🇷 Français', ru: '🇷🇺 Русский', ko: '🇰🇷 한국어' };
  const activeLang = LANG_LABELS[cfg.telegramLanguage || 'id'] || '🇮🇩 Indonesia';

  return `👑 *Bre AI Master Control Panel*\n` +
    `Halo *${senderName}*! Kelola seluruh fungsi bot secara interaktif menggunakan tombol di bawah:\n\n` +
    `• *Model Aktif:* \`${activeModel}\`\n` +
    `• *Bahasa Default:* ${activeLang}\n` +
    `• *Mode Akses:* ${accessMode}\n` +
    `• *Pengguna Terdaftar:* ${userCount} akun\n` +
    `• *Total Permintaan:* ${m.totalRequests} req\n` +
    `• *Sesi Chat Aktif:* ${conversationsCount} percakapan\n\n` +
    `👇 *Pilih menu yang ingin Anda operasikan:*`;
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

  // 1. Main Menu
  if (data === 'adm_main') {
    await answerCallback(cq.id, 'Panel diperbarui', false, token);
    const text = getMainMenuText(senderName, botService.conversations.size);
    const markup = buildMainMenuMarkup(cfg);
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 2. Close Menu
  if (data === 'adm_close') {
    await answerCallback(cq.id, 'Panel ditutup', false, token);
    try {
      await apiCall('deleteMessage', { chat_id: chatId, message_id: messageId }, token);
    } catch (e) {
      await editTelegramMessage(chatId, messageId, '🔒 *Panel admin telah ditutup.* Kirim `/admin` untuk membuka kembali.', null, token);
    }
    return;
  }

  // 3. Metrics & Stats
  if (data === 'adm_metrics') {
    await answerCallback(cq.id, null, false, token);
    const m = getMetrics();
    const text = `📊 *Real-Time Router & Engine Performance*\n\n` +
      `• *Total Permintaan:* ${m.totalRequests.toLocaleString()} (${m.successfulRequests} sukses · ${m.failedRequests} gagal)\n` +
      `• *Total Token Diproses:* ${m.totalTokens.toLocaleString()} token\n` +
      `• *Tingkat Kegagalan (Error Rate):* ${m.errorRate}\n` +
      `• *Rata-Rata Latensi:* ${m.avgLatencyMs} ms\n` +
      `• *In-Memory Response Cache:* ${m.cacheSize} item\n` +
      `• *Sesi Chat Telegram Aktif:* ${botService.conversations.size} sesi\n\n` +
      `_Data disinkronkan langsung dari RAM server Bre AI._`;
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

  // 4. Model Selection Menu
  if (data === 'adm_models') {
    await answerCallback(cq.id, null, false, token);
    const currentModel = cfg.telegramModel || cfg.model || 'mercury-2';
    const allModels = new Set();
    allModels.add(currentModel);

    // Collect all models from configured endpoints
    if (Array.isArray(cfg.endpoints)) {
      cfg.endpoints.forEach(ep => {
        (ep.models || []).forEach(m => allModels.add(m));
        (ep.mapping || []).forEach(map => {
          const alias = map.split(':')[0]?.trim();
          if (alias) allModels.add(alias);
        });
      });
    }

    const rows = [];
    Array.from(allModels).slice(0, 10).forEach(m => {
      const isSelected = (m === currentModel);
      rows.push([{
        text: isSelected ? `✅ ${m}` : m,
        callback_data: `adm_setmodel:${m}`
      }]);
    });

    rows.push([
      { text: currentModel === '' ? '✅ Auto Router' : '🌐 Ikuti Auto Router', callback_data: 'adm_setmodel:auto' }
    ]);
    rows.push([{ text: '⬅️ Menu Utama', callback_data: 'adm_main' }]);

    const text = `🔄 *Pilih Model AI untuk Telegram:*\n` +
      `Model yang aktif saat ini: \`${currentModel || 'Auto Router'}\`\n\n` +
      `_Pilih model di bawah untuk mengganti model secara instan:_`;
    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 4b. Set Model Action
  if (data.startsWith('adm_setmodel:')) {
    const selected = data.split(':')[1];
    const targetModel = selected === 'auto' ? '' : selected;
    saveConfig({ telegramModel: targetModel });
    await answerCallback(cq.id, `✅ Model diubah ke: ${targetModel || 'Auto Router'}`, false, token);

    const text = getMainMenuText(senderName, botService.conversations.size);
    const markup = buildMainMenuMarkup(cfg);
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 5. Access Mode Switch Menu
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
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 5b. Set Access Mode Action
  if (data.startsWith('adm_setmode:')) {
    const newMode = data.split(':')[1];
    saveConfig({ telegramAccessMode: newMode });
    botService.activeAccessMode = newMode;
    await answerCallback(cq.id, `✅ Mode bot diubah ke: ${newMode === 'whitelist' ? '🔒 Khusus Whitelist' : '🟢 Publik'}`, false, token);

    const text = getMainMenuText(senderName, botService.conversations.size);
    const markup = buildMainMenuMarkup(getConfig());
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 5c. Language Selection Menu (Admin global default)
  const LANGUAGE_OPTIONS_ADMIN = {
    id: '🇮🇩 Bahasa Indonesia',
    en: '🇺🇸 English',
    ja: '🇯🇵 日本語 (Japanese)',
    zh: '🇨🇳 中文 (Chinese)',
    es: '🇪🇸 Español (Spanish)',
    ar: '🇸🇦 العربية (Arabic)',
    de: '🇩🇪 Deutsch (German)',
    fr: '🇫🇷 Français (French)',
    ru: '🇷🇺 Русский (Russian)',
    ko: '🇰🇷 한국어 (Korean)'
  };

  if (data === 'adm_language') {
    await answerCallback(cq.id, null, false, token);
    const currentLang = cfg.telegramLanguage || 'id';
    const langText = `🌐 *Pengaturan Bahasa Default Bot:*\n` +
      `Bahasa aktif: *${LANGUAGE_OPTIONS_ADMIN[currentLang] || 'Bahasa Indonesia'}*\n\n` +
      `Pilih bahasa default respons Bre AI untuk semua pengguna bot:\n` +
      `_(Pengguna individual dapat mengubah bahasa mereka sendiri dengan perintah /language)_`;

    const langRows = Object.entries(LANGUAGE_OPTIONS_ADMIN).map(([code, label]) => ([
      {
        text: (code === currentLang ? '✅ ' : '') + label,
        callback_data: `adm_setlang:${code}`
      }
    ]));
    langRows.push([{ text: '⬅️ Menu Utama', callback_data: 'adm_main' }]);

    await editTelegramMessage(chatId, messageId, langText, { inline_keyboard: langRows }, token);
    return;
  }

  // 5d. Set Language Action
  if (data.startsWith('adm_setlang:')) {
    const newLang = data.split(':')[1];
    const langLabel = LANGUAGE_OPTIONS_ADMIN[newLang] || newLang;
    saveConfig({ telegramLanguage: newLang });
    await answerCallback(cq.id, `✅ Bahasa default diubah ke: ${langLabel}`, true, token);

    cq.data = 'adm_language';
    return handleAdminCallback(cq, botService);
  }

  // 6. User Management Menu
  if (data === 'adm_users') {
    await answerCallback(cq.id, null, false, token);
    const users = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers : [];
    const recent = getRecentUsersList();

    let text = `👥 *Manajemen Pengguna Telegram*\n` +
      `• Terdaftar di Database: ${users.length} user\n` +
      `• Pengguna Terlihat Baru: ${recent.length} user\n\n`;

    if (users.length > 0) {
      text += `*Daftar User Terdaftar (Maks 10 Teratas):*\n`;
      users.slice(0, 10).forEach((u, i) => {
        const badge = u.role === 'owner' ? '👑 Owner' : (u.role === 'blocked' ? '🔴 Blocked' : '🟢 Whitelist');
        text += `${i+1}. *${u.name || u.username || u.id}* [${badge}]\n   \`${u.username ? '@' + u.username : u.id}\`\n`;
      });
    } else {
      text += `_Belum ada user khusus terdaftar._\n`;
    }

    const rows = [];
    // Tampilkan 3 user terbaru yang belum terdaftar untuk quick 1-click whitelist
    const unregisteredRecent = recent.filter(r => !users.some(u => String(u.id) === String(r.id))).slice(0, 3);
    if (unregisteredRecent.length > 0) {
      rows.push([{ text: '➕ Quick Add User Terbaru ke Whitelist:', callback_data: 'adm_noop' }]);
      unregisteredRecent.forEach(r => {
        rows.push([{
          text: `🟢 Izinkan: @${r.username || r.name} (${r.id})`,
          callback_data: `adm_addrecent:${r.id}`
        }]);
      });
    }

    rows.push([
      { text: '🔄 Refresh Pengguna', callback_data: 'adm_users' },
      { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 6b. Execute Add Recent User Action
  if (data.startsWith('adm_addrecent:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    const users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];

    if (recentObj) {
      users.push({
        id: String(recentObj.id),
        username: recentObj.username || '',
        name: recentObj.name || '',
        role: 'whitelist',
        addedAt: new Date().toISOString()
      });
      saveConfig({ telegramUsers: users });
      await answerCallback(cq.id, `✅ Berhasil menambahkan @${recentObj.username || recentObj.name} ke Whitelist!`, true, token);
    } else {
      await answerCallback(cq.id, 'Pengguna tidak ditemukan dalam sesi aktif', false, token);
    }

    cq.data = 'adm_users';
    return handleAdminCallback(cq, botService);
  }

  // 7. Benchmark Upstream Provider Speed
  if (data === 'adm_benchmark') {
    await answerCallback(cq.id, '⏳ Menguji kecepatan upstream provider...', false, token);
    await editTelegramMessage(chatId, messageId, `⏳ *Sedang Menguji Kecepatan Provider Upstream...*\nMohon tunggu beberapa detik...`, null, token);

    const startTime = Date.now();
    try {
      const probePrompt = 'Hi';
      const answer = await botService.queryBreAIRouter(probePrompt, [{ role: 'user', content: probePrompt }]);
      const elapsed = Date.now() - startTime;
      const activeModel = cfg.telegramModel || cfg.model || 'mercury-2';

      let speedRating = '⚡ Ultra Fast (<500ms)';
      if (elapsed > 1500) speedRating = '🟡 Lambat (>1500ms)';
      else if (elapsed > 800) speedRating = '🟢 Normal';

      const text = `🏆 *Hasil Benchmark Kecepatan Upstream:*\n\n` +
        `• *Model Uji:* \`${activeModel}\`\n` +
        `• *Latensi Response:* \`${elapsed} ms\`\n` +
        `• *Kategori Kecepatan:* ${speedRating}\n` +
        `• *Status Provider:* 🟢 Online & Siap Melayani\n\n` +
        `_Respon cuplikan:_\n"${answer.slice(0, 80)}..."`;

      const markup = {
        inline_keyboard: [
          [
            { text: '⚡ Uji Ulang Benchmark', callback_data: 'adm_benchmark' },
            { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, text, markup, token);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const text = `❌ *Benchmark Gagal:*\n\n` +
        `• Latensi: ${elapsed} ms\n` +
        `• Error: \`${err.message}\`\n\n` +
        `_Periksa API Key atau kuota upstream provider Anda._`;
      const markup = {
        inline_keyboard: [
          [{ text: '🔄 Coba Lagi', callback_data: 'adm_benchmark' }, { text: '⬅️ Menu Utama', callback_data: 'adm_main' }]
        ]
      };
      await editTelegramMessage(chatId, messageId, text, markup, token);
    }
    return;
  }

  // 8. AI Parameters (Temperature & Streaming)
  if (data === 'adm_params') {
    await answerCallback(cq.id, null, false, token);
    const temp = cfg.temperature ?? 0.7;
    const stream = cfg.forceStream === true ? 'Aktif' : (cfg.forceStream === false ? 'Mati' : 'Auto');

    const text = `⚙️ *Pengaturan Parameter AI Engine:*\n\n` +
      `• *Temperature Saat Ini:* \`${temp}\`\n` +
      `• *Mode Streaming:* \`${stream}\`\n\n` +
      `_Pilih preset suhu kreatifitas di bawah:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: temp === 0.2 ? '✅ 🎯 Presisi (0.2)' : '🎯 Presisi (0.2)', callback_data: 'adm_settemp:0.2' },
          { text: temp === 0.7 ? '✅ ⚖️ Seimbang (0.7)' : '⚖️ Seimbang (0.7)', callback_data: 'adm_settemp:0.7' }
        ],
        [
          { text: temp === 1.0 ? '✅ 🎨 Kreatif (1.0)' : '🎨 Kreatif (1.0)', callback_data: 'adm_settemp:1.0' },
          { text: temp === 1.5 ? '✅ 🚀 Jenius/Liar (1.5)' : '🚀 Jenius/Liar (1.5)', callback_data: 'adm_settemp:1.5' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 8b. Set Temperature
  if (data.startsWith('adm_settemp:')) {
    const newTemp = parseFloat(data.split(':')[1]);
    saveConfig({ temperature: newTemp });
    await answerCallback(cq.id, `✅ Suhu diubah ke: ${newTemp}`, false, token);

    cq.data = 'adm_params';
    return handleAdminCallback(cq, botService);
  }

  // 9. Broadcast Announcement to All Users
  if (data === 'adm_broadcast') {
    await answerCallback(cq.id, null, false, token);
    const recent = getRecentUsersList();
    const text = `📢 *Broadcast Pengumuman ke Semua Pengguna*\n\n` +
      `• Total Target Pengguna Aktif: *${recent.length} akun*\n\n` +
      `Untuk mengirim broadcast, cukup balas chat ini dengan format:\n` +
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

  // 10. Webhook Diagnostics
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
      `• *Koneksi Terakhir Sukses:* ${webhookInfo.last_error_date ? '⚠️ Ada Error' : '🟢 Normal'}\n` +
      (webhookInfo.last_error_message ? `• *Pesan Error:* \`${webhookInfo.last_error_message}\`\n` : '') +
      `• *Node.js Runtime:* \`${process.version}\`\n` +
      `• *Serverless Platform:* \`${process.env.VERCEL ? 'Vercel Lambda' : 'Local Server'}\`\n` +
      `• *Uptime Server:* \`${Math.round(process.uptime())} detik\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Cek Ulang Diagnostik', callback_data: 'adm_diag' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 11. Last 5 Logs Viewer
  if (data === 'adm_logs') {
    await answerCallback(cq.id, null, false, token);
    const logs = getLogs().slice(0, 5);
    let text = `📜 *Riwayat 5 Permintaan / Error Terakhir:*\n\n`;

    if (!logs.length) {
      text += `_Belum ada riwayat aktivitas terekam di RAM server._\n`;
    } else {
      logs.forEach((l, i) => {
        const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('id-ID') : '-';
        const st = l.status >= 400 ? `🔴 ${l.status}` : `🟢 ${l.status}`;
        text += `${i+1}. [${time}] *${l.provider || 'API'}* (${l.model || '-'})\n   Status: ${st} | ${l.latencyMs || 0}ms\n`;
        if (l.error) text += `   ⚠️ Error: \`${l.error.slice(0, 60)}\`\n`;
      });
    }

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Log', callback_data: 'adm_logs' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 12. Flush Cache Confirmation
  if (data === 'adm_flush_confirm') {
    await answerCallback(cq.id, null, false, token);
    const text = `⚠️ *Konfirmasi Pembersihan Cache RAM:*\n\n` +
      `Apakah Anda yakin ingin mengosongkan seluruh respon cache in-memory dan membersihkan riwayat sesi obrolan Telegram?\n\n` +
      `Tindakan ini aman dan langsung membebaskan memori RAM server.`;
    const markup = {
      inline_keyboard: [
        [
          { text: '🗑️ Ya, Kosongkan Cache RAM', callback_data: 'adm_flush_exec' }
        ],
        [
          { text: '❌ Batalkan', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 12b. Execute Flush Cache Action
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
