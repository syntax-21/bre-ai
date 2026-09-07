// ========================================================
// Bre AI v3.0 - Telegram Bot Background Service
// 100% Interactive Inline Controls & User Management
// Created by Amirun Rayan Ariandi
// ========================================================
const https = require('https');
const http = require('http');
const { getConfig, saveConfig, logRequest, getMetrics, clearResponseCache } = require('../api/_shared');

// HTTPS Agent with rejectUnauthorized: false for simulated clock / TLS compatibility
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 35000
});

class TelegramBotService {
  constructor() {
    this.isRunning = false;
    this.botInfo = null;
    this.lastError = null;
    this.currentOffset = 0;
    this.conversations = new Map(); // chatId -> Array<{ role, content }>
    this.recentUsers = new Map();   // userId -> { id, username, name, lastSeen }
    this.MAX_HISTORY = 12;
  }

  // Raw Telegram Bot API request
  apiCall(method, payload = {}, customToken = null) {
    const cfg = getConfig();
    const token = customToken || cfg.telegramBotToken;
    if (!token) return Promise.reject(new Error('Telegram Bot Token tidak ditemukan'));

    const postData = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/${method}`,
        method: 'POST',
        agent: httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 35000
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              resolve(parsed.result);
            } else {
              reject(new Error(parsed.description || `Telegram API Error: ${parsed.error_code}`));
            }
          } catch (e) {
            reject(new Error(`Invalid response dari Telegram: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout ke Telegram API'));
      });

      req.write(postData);
      req.end();
    });
  }

  // Test token with getMe
  async testToken(token) {
    try {
      const info = await this.apiCall('getMe', {}, token);
      return { ok: true, bot: info };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Check if sender is Bot Owner
  isOwner(fromUser) {
    if (!fromUser) return false;
    const cfg = getConfig();
    const ownerId = String(cfg.telegramOwnerId || '').trim().toLowerCase().replace(/^@/, '');
    if (!ownerId) return false;

    const uId = String(fromUser.id);
    const uName = (fromUser.username || '').toLowerCase().replace(/^@/, '');

    if (ownerId === uId || (uName && ownerId === uName)) return true;

    // Also check role in telegramUsers array
    if (Array.isArray(cfg.telegramUsers)) {
      const found = cfg.telegramUsers.find(u =>
        String(u.id) === uId ||
        (u.username && u.username.toLowerCase().replace(/^@/, '') === uName)
      );
      if (found && found.role === 'owner') return true;
    }

    return false;
  }

  // Check if a user is allowed to chat with Bre AI
  isUserAllowed(fromUser) {
    if (!fromUser) return false;
    if (this.isOwner(fromUser)) return true; // Owner always allowed

    const cfg = getConfig();
    const uId = String(fromUser.id);
    const uName = (fromUser.username || '').toLowerCase().replace(/^@/, '');

    // 1. Check specific roles in telegramUsers list
    if (Array.isArray(cfg.telegramUsers)) {
      const match = cfg.telegramUsers.find(u =>
        String(u.id) === uId ||
        (u.username && u.username.toLowerCase().replace(/^@/, '') === uName)
      );
      if (match) {
        if (match.role === 'blocked') return false; // Blocked user always rejected
        if (match.role === 'whitelist' || match.role === 'owner') return true;
      }
    }

    // 2. Check legacy comma-separated whitelist if provided
    const rawLegacyWhitelist = (cfg.telegramAllowedUsers || '').trim();
    if (rawLegacyWhitelist) {
      const allowed = rawLegacyWhitelist.split(/[\n,;]+/).map(s => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
      if (allowed.includes(uId) || (uName && allowed.includes(uName))) return true;
    }

    // 3. Check access mode
    const mode = cfg.telegramAccessMode || 'public';
    if (mode === 'whitelist') {
      // In whitelist-only mode, unlisted users are rejected
      return false;
    }

    // In public mode, everyone not blocked is allowed
    return true;
  }

  // Send message helper with auto-split if > 4000 chars and markdown fallback
  async sendTelegramMessage(chatId, text, replyMarkup = null, replyToId = null) {
    if (!text) return;
    const CHUNK_SIZE = 4000;
    const chunks = [];

    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = (i === chunks.length - 1);
      const payload = {
        chat_id: chatId,
        text: chunks[i],
        parse_mode: 'Markdown'
      };
      if (replyToId && i === 0) payload.reply_to_message_id = replyToId;
      if (isLast && replyMarkup) payload.reply_markup = replyMarkup;

      try {
        await this.apiCall('sendMessage', payload);
      } catch (err) {
        // Fallback to plain text if Markdown syntax fails
        delete payload.parse_mode;
        try {
          await this.apiCall('sendMessage', payload);
        } catch (plainErr) {
          console.error('[TelegramBot] Gagal kirim pesan ke', chatId, plainErr.message);
        }
      }
    }
  }

  // Edit message helper for inline menus
  async editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    try {
      await this.apiCall('editMessageText', payload);
    } catch (err) {
      delete payload.parse_mode;
      try {
        await this.apiCall('editMessageText', payload);
      } catch (plainErr) {
        // Message might be unchanged or deleted
      }
    }
  }

  // Answer callback query with optional notification toast
  async answerCallback(callbackQueryId, text = null, showAlert = false) {
    try {
      const payload = { callback_query_id: callbackQueryId };
      if (text) {
        payload.text = text;
        payload.show_alert = showAlert;
      }
      await this.apiCall('answerCallbackQuery', payload);
    } catch (e) {}
  }

  // Send typing indicator
  async sendTyping(chatId) {
    try {
      await this.apiCall('sendChatAction', { chat_id: chatId, action: 'typing' });
    } catch (e) {}
  }

  // Query internal Bre AI router (works both on Localhost and Vercel Serverless)
  queryBreAIRouter(userText, history = [], senderInfo = '') {
    return new Promise(async (resolve, reject) => {
      try {
        const chatHandler = require('../api/chat');
        const cfg = getConfig();
        const model = cfg.telegramModel || cfg.model || 'mercury-2';

        const mockReq = {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-custom-provider': 'Telegram Bot'
          },
          body: {
            model: model,
            messages: history,
            stream: false,
            customSystemPrompt: `Anda sedang melayani pengguna Telegram ${senderInfo}. Formatlah jawaban Anda rapi menggunakan format Markdown standar yang nyaman dibaca di layar HP/Telegram.`
          },
          socket: { remoteAddress: '127.0.0.1' },
          on: () => {}
        };

        const mockRes = {
          statusCode: 200,
          setHeader: () => {},
          writeHead: (code) => { mockRes.statusCode = code; },
          status: (code) => { mockRes.statusCode = code; return mockRes; },
          end: (data) => {
            if (mockRes.statusCode >= 400) reject(new Error(data || `Error ${mockRes.statusCode}`));
          },
          json: (data) => {
            if (mockRes.statusCode >= 400) {
              reject(new Error(data?.error || `Error ${mockRes.statusCode}`));
            } else if (data?.choices?.[0]?.message?.content) {
              resolve(data.choices[0].message.content);
            } else {
              reject(new Error('Format jawaban tidak sesuai'));
            }
          }
        };

        await chatHandler(mockReq, mockRes);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ========================================================
  // INTERACTIVE BOT ADMIN PANEL (100% INLINE KEYBOARDS)
  // ========================================================

  buildMainMenuMarkup() {
    const cfg = getConfig();
    const modeText = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Whitelist' : '🟢 Publik';
    return {
      inline_keyboard: [
        [
          { text: '📊 Status & Metrik', callback_data: 'adm_metrics' },
          { text: '🔄 Ganti Model AI', callback_data: 'adm_models' }
        ],
        [
          { text: '👥 Kelola Pengguna', callback_data: 'adm_users' },
          { text: `🛡️ Mode: ${modeText}`, callback_data: 'adm_mode' }
        ],
        [
          { text: '⚡ Bersihkan Cache RAM', callback_data: 'adm_flush_confirm' },
          { text: '🔄 Refresh Panel', callback_data: 'adm_main' }
        ],
        [
          { text: '❌ Tutup Panel Admin', callback_data: 'adm_close' }
        ]
      ]
    };
  }

  getMainMenuText(senderName) {
    const cfg = getConfig();
    const activeModel = cfg.telegramModel || cfg.model || 'mercury-2';
    const accessMode = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Khusus Whitelist (Private)' : '🟢 Terbuka untuk Publik';
    const userCount = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers.length : 0;
    const m = getMetrics();

    return `👑 *Bre AI Owner Control Panel*\n` +
      `Halo *${senderName}*! Kelola seluruh fungsi bot secara interaktif menggunakan tombol di bawah:\n\n` +
      `• *Model Aktif:* \`${activeModel}\`\n` +
      `• *Mode Akses:* ${accessMode}\n` +
      `• *Pengguna Terdaftar:* ${userCount} akun\n` +
      `• *Total Permintaan:* ${m.totalRequests} req\n` +
      `• *Sesi Chat Aktif:* ${this.conversations.size} percakapan\n\n` +
      `👇 *Pilih menu yang ingin Anda atur:*`;
  }

  async sendAdminPanel(chatId, senderName) {
    const text = this.getMainMenuText(senderName);
    const markup = this.buildMainMenuMarkup();
    await this.sendTelegramMessage(chatId, text, markup);
  }

  // Handle Callback Queries (Button Clicks)
  async handleCallbackQuery(cq) {
    if (!cq || !cq.from) return;
    const fromUser = cq.from;
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const data = cq.data || '';

    // Verify Owner authorization
    if (!this.isOwner(fromUser)) {
      await this.answerCallback(cq.id, '⛔ Akses Ditolak: Khusus Pemilik Bot (Owner)', true);
      return;
    }

    const cfg = getConfig();
    const senderName = fromUser.first_name || 'Owner';

    // 1. Main Menu
    if (data === 'adm_main') {
      await this.answerCallback(cq.id, 'Menu diperbarui');
      const text = this.getMainMenuText(senderName);
      const markup = this.buildMainMenuMarkup();
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }

    // 2. Close Menu
    if (data === 'adm_close') {
      await this.answerCallback(cq.id, 'Panel ditutup');
      try {
        await this.apiCall('deleteMessage', { chat_id: chatId, message_id: messageId });
      } catch (e) {
        await this.editTelegramMessage(chatId, messageId, '🔒 *Panel admin telah ditutup.* Kirim `/admin` untuk membuka kembali.');
      }
      return;
    }

    // 3. Metrics & Stats Menu
    if (data === 'adm_metrics') {
      await this.answerCallback(cq.id);
      const m = getMetrics();
      const text = `📊 *Real-Time Router & Engine Performance*\n\n` +
        `• *Total Permintaan:* ${m.totalRequests.toLocaleString()} (${m.successfulRequests} sukses · ${m.failedRequests} gagal)\n` +
        `• *Total Token Diproses:* ${m.totalTokens.toLocaleString()} token\n` +
        `• *Tingkat Kegagalan (Error Rate):* ${m.errorRate}\n` +
        `• *Rata-Rata Latensi:* ${m.avgLatencyMs} ms\n` +
        `• *In-Memory Response Cache:* ${m.cacheSize} item\n` +
        `• *Sesi Chat Telegram Aktif:* ${this.conversations.size} sesi\n\n` +
        `_Data disinkronkan langsung dari RAM server Bre AI._`;
      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh Metrik', callback_data: 'adm_metrics' },
            { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
          ]
        ]
      };
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }

    // 4. Model Selection Menu
    if (data === 'adm_models') {
      await this.answerCallback(cq.id);
      const allModels = new Set();
      (cfg.endpoints || []).forEach(ep => {
        (ep.models || []).forEach(m => allModels.add(m));
        (ep.mapping || []).forEach(map => {
          const alias = map.split(':')[0]?.trim();
          if (alias) allModels.add(alias);
        });
      });
      if (!allModels.size) allModels.add('mercury-2');

      const activeModel = cfg.telegramModel || cfg.model || 'mercury-2';
      const rows = [];
      const modelList = Array.from(allModels);

      for (let i = 0; i < modelList.length; i += 2) {
        const row = [];
        const m1 = modelList[i];
        row.push({
          text: (m1 === activeModel ? `✅ ${m1}` : `⚡ ${m1}`),
          callback_data: `adm_setmodel:${m1}`
        });
        if (modelList[i + 1]) {
          const m2 = modelList[i + 1];
          row.push({
            text: (m2 === activeModel ? `✅ ${m2}` : `⚡ ${m2}`),
            callback_data: `adm_setmodel:${m2}`
          });
        }
        rows.push(row);
      }
      rows.push([{ text: '⬅️ Menu Utama', callback_data: 'adm_main' }]);

      const text = `🔄 *Pilih Model AI untuk Telegram:*\n` +
        `Model saat ini: \`${activeModel}\`\n\n` +
        `Klik salah satu model di bawah untuk mengganti engine secara instan tanpa perlu ketik apa pun:`;
      await this.editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows });
      return;
    }

    // 4b. Set Model Action
    if (data.startsWith('adm_setmodel:')) {
      const selected = data.split(':')[1];
      saveConfig({ telegramModel: selected });
      await this.answerCallback(cq.id, `✅ Model diubah ke: ${selected}`, false);

      // Re-render model selector
      const text = this.getMainMenuText(senderName);
      const markup = this.buildMainMenuMarkup();
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }

    // 5. Access Mode Switch Menu
    if (data === 'adm_mode') {
      await this.answerCallback(cq.id);
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
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }

    // 5b. Set Access Mode Action
    if (data.startsWith('adm_setmode:')) {
      const newMode = data.split(':')[1];
      saveConfig({ telegramAccessMode: newMode });
      await this.answerCallback(cq.id, `✅ Mode diubah ke: ${newMode === 'whitelist' ? 'Private Whitelist' : 'Publik'}`, false);

      const text = this.getMainMenuText(senderName);
      const markup = this.buildMainMenuMarkup();
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }

    // 6. User Management Menu
    if (data === 'adm_users') {
      await this.answerCallback(cq.id);
      const users = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers : [];
      let text = `👥 *Daftar Pengguna Telegram Terdaftar:*\n` +
        `Total: ${users.length} akun terdaftar.\n\n`;

      const rows = [];

      if (!users.length) {
        text += `_Belum ada pengguna khusus. Klik tombol di bawah untuk menambah dari pengguna yang baru berinteraksi._\n`;
      } else {
        users.slice(0, 8).forEach((u, idx) => {
          const isWhite = u.role === 'whitelist' || u.role === 'owner';
          const tag = u.username ? `@${u.username}` : (u.name || `User ${u.id}`);
          const roleLabel = u.role === 'owner' ? '👑 Owner' : (isWhite ? '🟢 Whitelist' : '🔴 Blocked');

          rows.push([
            { text: `${roleLabel} | ${tag}`, callback_data: `adm_togrole:${u.id}` },
            { text: '🗑️ Hapus', callback_data: `adm_deluser:${u.id}` }
          ]);
        });
      }

      rows.push([
        { text: '➕ Tambah dari Sesi Terakhir', callback_data: 'adm_recent_users' }
      ]);
      rows.push([
        { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
      ]);

      await this.editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows });
      return;
    }

    // 6b. Toggle User Role Action
    if (data.startsWith('adm_togrole:')) {
      const targetId = data.split(':')[1];
      const users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
      const user = users.find(u => String(u.id) === targetId);

      if (user && user.role !== 'owner') {
        user.role = user.role === 'whitelist' ? 'blocked' : 'whitelist';
        saveConfig({ telegramUsers: users });
        await this.answerCallback(cq.id, `Status ${user.username || user.name || user.id}: ${user.role}`);
      } else {
        await this.answerCallback(cq.id, 'Akun Owner tidak dapat diubah statusnya');
      }

      // Re-render user menu
      cq.data = 'adm_users';
      return this.handleCallbackQuery(cq);
    }

    // 6c. Delete User Action
    if (data.startsWith('adm_deluser:')) {
      const targetId = data.split(':')[1];
      let users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
      const user = users.find(u => String(u.id) === targetId);

      if (user && user.role !== 'owner') {
        users = users.filter(u => String(u.id) !== targetId);
        saveConfig({ telegramUsers: users });
        await this.answerCallback(cq.id, `User ${targetId} dihapus dari daftar`);
      } else {
        await this.answerCallback(cq.id, 'Akun Owner tidak dapat dihapus');
      }

      // Re-render user menu
      cq.data = 'adm_users';
      return this.handleCallbackQuery(cq);
    }

    // 6d. Add from Recent Users Interactive Menu
    if (data === 'adm_recent_users') {
      await this.answerCallback(cq.id);
      const existingIds = new Set((cfg.telegramUsers || []).map(u => String(u.id)));
      const recentList = Array.from(this.recentUsers.values()).filter(u => !existingIds.has(String(u.id)));

      let text = `➕ *Pilih Pengguna yang Baru Saja Berinteraksi:*\n\n` +
        `Klik nama pengguna di bawah untuk langsung menambahkannya ke Whitelist tanpa ketik ID:\n\n`;

      const rows = [];
      if (!recentList.length) {
        text += `_Tidak ada sesi interaksi pengguna baru yang belum terdaftar._\n`;
      } else {
        recentList.slice(0, 6).forEach(u => {
          const label = u.username ? `@${u.username}` : (u.name || `ID ${u.id}`);
          rows.push([
            { text: `➕ Whitelist ${label}`, callback_data: `adm_addrecent:${u.id}` }
          ]);
        });
      }

      rows.push([{ text: '⬅️ Kembali ke List Pengguna', callback_data: 'adm_users' }]);
      await this.editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows });
      return;
    }

    // 6e. Execute Add Recent User Action
    if (data.startsWith('adm_addrecent:')) {
      const targetId = data.split(':')[1];
      const recentObj = this.recentUsers.get(Number(targetId)) || this.recentUsers.get(targetId);
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
        await this.answerCallback(cq.id, `✅ Berhasil menambahkan @${recentObj.username || recentObj.name} ke Whitelist!`, true);
      } else {
        await this.answerCallback(cq.id, 'Pengguna tidak ditemukan dalam sesi aktif');
      }

      cq.data = 'adm_users';
      return this.handleCallbackQuery(cq);
    }

    // 7. Flush Cache Confirmation Menu
    if (data === 'adm_flush_confirm') {
      await this.answerCallback(cq.id);
      const text = `⚠️ *Konfirmasi Pembersihan Cache RAM:*\n\n` +
        `Apakah Anda yakin ingin mengosongkan seluruh respon cache in-memory dan membersihkan riwayat sesi obrolan Telegram?\n\n` +
        `Tindakan ini aman dan membebaskan memori RAM server.`;
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
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }

    // 7b. Execute Flush Cache Action
    if (data === 'adm_flush_exec') {
      clearResponseCache();
      this.conversations.clear();
      await this.answerCallback(cq.id, '⚡ Cache RAM & sesi berhasil dibersihkan!', true);

      const text = this.getMainMenuText(senderName);
      const markup = this.buildMainMenuMarkup();
      await this.editTelegramMessage(chatId, messageId, text, markup);
      return;
    }
  }

  // Handle a single Telegram message
  async handleMessage(msg) {
    if (!msg || !msg.chat || !msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const fromUser = msg.from || {};
    const senderName = fromUser.first_name || fromUser.username || 'Sahabat';
    const senderTag = fromUser.username ? `@${fromUser.username}` : `ID:${fromUser.id}`;

    // Record in recent users for easy 1-click whitelist by Owner
    if (fromUser.id) {
      this.recentUsers.set(fromUser.id, {
        id: fromUser.id,
        username: fromUser.username || '',
        name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'User',
        lastSeen: Date.now()
      });
    }

    // Check Whitelist / Blocked Access
    if (!this.isUserAllowed(fromUser)) {
      await this.sendTelegramMessage(
        chatId,
        `⚠️ *Akses Dibatasi*\n\nMaaf ${senderName}, bot ini saat ini berada dalam mode khusus. Akun Anda (${senderTag}) belum terdaftar dalam whitelist. Silakan hubungi pemilik bot untuk meminta izin akses.`
      );
      return;
    }

    // Command: /admin (Interactive Control Panel for Owner)
    if (text === '/admin' || text.startsWith('/admin ')) {
      if (!this.isOwner(fromUser)) {
        await this.sendTelegramMessage(
          chatId,
          `⛔ *Akses Ditolak*\n\nPerintah \`/admin\` hanya dapat diakses secara eksklusif oleh *Pemilik Bot (Owner)*.\n\nJika Anda adalah pemilik sistem, daftarkan ID Telegram Anda di tab *Telegram Bot* pada web panel [Bre AI Control Center](http://localhost:3000/admin).`
        );
        return;
      }
      await this.sendAdminPanel(chatId, senderName);
      return;
    }

    // Command: /start
    if (text === '/start' || text.startsWith('/start ')) {
      this.conversations.delete(chatId);
      const isOwnerUser = this.isOwner(fromUser);
      let welcome = `⚡ *Halo ${senderName}!* Selamat datang di *Bre AI*.\n\n` +
        `Saya adalah kecerdasan buatan ciptaan *Amirun Rayan Ariandi*, siap membantu Anda menjawab berbagai pertanyaan, menganalisis kode program, hingga membuat dokumen langsung dari Telegram.\n\n` +
        `📌 *Panduan Interaksi:*\n` +
        `• Kirim pesan apa pun untuk langsung mengobrol.\n` +
        `• Kirim /reset untuk membersihkan topik percakapan.\n` +
        `• Kirim /help untuk panduan penggunaan.\n`;

      if (isOwnerUser) {
        welcome += `\n👑 *Akses Pemilik (Owner):*\nKirim perintah */admin* untuk membuka panel kontrol interaktif!`;
      }

      await this.sendTelegramMessage(chatId, welcome);
      return;
    }

    // Command: /help
    if (text === '/help') {
      const isOwnerUser = this.isOwner(fromUser);
      let help = `📖 *Panduan Penggunaan Bre AI di Telegram*\n\n` +
        `• *Obrolan Alami:* Anda bisa bertanya apa saja dalam bahasa Indonesia, Inggris, atau bahasa lainnya secara santai.\n` +
        `• *Ingatan Konteks:* Bre AI mengingat percakapan Anda sehingga Anda dapat berdiskusi secara berkelanjutan.\n` +
        `• *Perintah /reset:* Gunakan saat ingin mengganti topik obrolan agar ingatan topik sebelumnya tidak bercampur.\n` +
        `• *Kode & Dokumen:* Bre AI dapat menuliskan kode lengkap atau dokumen kerja secara rapi.\n\n` +
        `Pencipta & Pengembang: *Amirun Rayan Ariandi* 🚀`;

      if (isOwnerUser) {
        help += `\n\n👑 *Panel Admin:* Kirim \`/admin\` untuk membuka menu tombol kontrol bot.`;
      }

      await this.sendTelegramMessage(chatId, help);
      return;
    }

    // Command: /reset or /clear
    if (text === '/reset' || text === '/clear') {
      this.conversations.delete(chatId);
      await this.sendTelegramMessage(chatId, `✨ *Riwayat percakapan berhasil dibersihkan!* Anda sekarang berada di sesi obrolan baru.`);
      return;
    }

    // Command: /status
    if (text === '/status') {
      const cfg = getConfig();
      const statusMsg = `📊 *Status Sistem Bre AI Router*\n\n` +
        `• Bot: @${this.botInfo?.username || 'BreAI_Bot'}\n` +
        `• Model Aktif: \`${cfg.telegramModel || cfg.model || 'mercury-2'}\`\n` +
        `• Auto-Failover: *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
        `• Response Cache: *${cfg.cacheEnabled ? '⚡ Aktif' : '⚪ Nonaktif'}*\n` +
        `• Sesi Aktif: ${this.conversations.size} percakapan`;
      await this.sendTelegramMessage(chatId, statusMsg);
      return;
    }

    // Regular Chat Flow
    await this.sendTyping(chatId);

    const typingInterval = setInterval(() => {
      this.sendTyping(chatId);
    }, 4000);

    try {
      let history = this.conversations.get(chatId) || [];
      history.push({ role: 'user', content: text });

      if (history.length > this.MAX_HISTORY) {
        history = history.slice(-this.MAX_HISTORY);
      }

      const answer = await this.queryBreAIRouter(text, history, senderTag);
      clearInterval(typingInterval);

      history.push({ role: 'assistant', content: answer });
      this.conversations.set(chatId, history);

      await this.sendTelegramMessage(chatId, answer);
    } catch (err) {
      clearInterval(typingInterval);
      console.error('[TelegramBot] Error querying Bre AI:', err.message);
      await this.sendTelegramMessage(
        chatId,
        `⚠️ *Gagal Memproses Permintaan*\n\nTerjadi kendala saat menghubungi engine AI: ${err.message}`
      );
    }
  }

  // Long Polling Loop with callback_query support
  async poll() {
    while (this.isRunning) {
      try {
        const updates = await this.apiCall('getUpdates', {
          offset: this.currentOffset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query']
        });

        this.lastError = null;

        if (Array.isArray(updates) && updates.length > 0) {
          for (const u of updates) {
            if (!this.isRunning) break;
            this.currentOffset = u.update_id + 1;

            if (u.message) {
              this.handleMessage(u.message).catch(err => {
                console.error('[TelegramBot] Error message:', err);
              });
            } else if (u.callback_query) {
              this.handleCallbackQuery(u.callback_query).catch(err => {
                console.error('[TelegramBot] Error callback:', err);
              });
            }
          }
        }
      } catch (err) {
        if (!this.isRunning) break;
        this.lastError = err.message;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // Start the bot polling service
  async start() {
    const cfg = getConfig();
    if (!cfg.telegramEnabled || !cfg.telegramBotToken) {
      this.isRunning = false;
      return false;
    }

    if (this.isRunning) return true;

    try {
      const info = await this.apiCall('getMe');
      this.botInfo = info;
      this.isRunning = true;
      this.lastError = null;
      console.log(`[TelegramBot] 🟢 Berhasil terhubung sebagai @${info.username} (ID: ${info.id})`);
      
      this.poll();
      return true;
    } catch (err) {
      this.isRunning = false;
      this.lastError = err.message;
      console.error('[TelegramBot] 🔴 Gagal mengaktifkan bot:', err.message);
      return false;
    }
  }

  // Stop polling service
  stop() {
    if (this.isRunning) {
      this.isRunning = false;
      console.log('[TelegramBot] 🛑 Bot service dihentikan');
    }
  }

  // Restart polling service
  async restart() {
    this.stop();
    await new Promise(r => setTimeout(r, 500));
    return this.start();
  }

  // Initialize on server boot
  init() {
    const cfg = getConfig();
    if (cfg.telegramEnabled && cfg.telegramBotToken) {
      this.start().catch(err => {
        console.error('[TelegramBot] Init error:', err.message);
      });
    }
  }

  // Get current status summary
  getStatus() {
    const cfg = getConfig();
    return {
      enabled: !!cfg.telegramEnabled,
      hasToken: !!cfg.telegramBotToken,
      running: this.isRunning,
      botInfo: this.botInfo,
      ownerId: cfg.telegramOwnerId || '',
      accessMode: cfg.telegramAccessMode || 'public',
      userCount: Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers.length : 0,
      lastError: this.lastError,
      activeConversations: this.conversations.size
    };
  }
}

const telegramBot = new TelegramBotService();
module.exports = telegramBot;
