// ========================================================
// Bre AI v3.0 - Telegram Bot Service Orchestrator
// Clean modular architecture for Telegram operations
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig } = require('../../api/_shared');
const {
  apiCall,
  testToken,
  downloadTelegramFile,
  cleanTelegramText,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallback,
  sendTyping,
  sendTelegramDocument,
  sendTelegramPoll,
  sendTelegramDice,
  sendTelegramLocation,
  sendTelegramVenue,
  sendTelegramContact,
  sendTelegramPhoto
} = require('./api');

const {
  recentUsers,
  recordRecentUser,
  getRecentUsersList,
  isOwner,
  isUserAllowed
} = require('./accessControl');

const {
  buildMainMenuMarkup,
  getMainMenuText,
  sendAdminPanel,
  handleAdminCallback
} = require('./adminMenu');

const {
  queryBreAIRouter,
  handleBroadcastCommand,
  handleMessage,
  chatLanguages,
  chatStyles,
  LANGUAGE_OPTIONS,
  STYLE_LABELS
} = require('./messageHandler');

const {
  saveUserLanguage,
  saveUserStyle,
  getUserLanguage,
  getUserStyle
} = require('./constants');

class TelegramBotService {
  constructor() {
    this.isRunning = false;
    this.botInfo = null;
    this.lastError = null;
    this.currentOffset = 0;
    this.conversations = new Map(); // chatId -> Array<{ role, content }>
    this.recentUsers = recentUsers;   // shared reference to Map
    this.MAX_HISTORY = 12;
    this.activeToken = null;
    this.activeOwnerId = null;
    this.activeAccessMode = null;
  }

  // Delegated API Calls
  apiCall(method, payload = {}, customToken = null) {
    return apiCall(method, payload, customToken || this.activeToken);
  }

  testToken(token) {
    return testToken(token);
  }

  downloadTelegramFile(fileId, customToken = null) {
    return downloadTelegramFile(fileId, customToken || this.activeToken);
  }

  cleanTelegramText(text) {
    return cleanTelegramText(text);
  }

  sendTelegramMessage(chatId, text, replyMarkup = null, replyToId = null, customToken = null) {
    return sendTelegramMessage(chatId, text, replyMarkup, replyToId, customToken || this.activeToken);
  }

  editTelegramMessage(chatId, messageId, text, replyMarkup = null, customToken = null) {
    return editTelegramMessage(chatId, messageId, text, replyMarkup, customToken || this.activeToken);
  }

  answerCallback(callbackQueryId, text = null, showAlert = false, customToken = null) {
    return answerCallback(callbackQueryId, text, showAlert, customToken || this.activeToken);
  }

  sendTyping(chatId, customToken = null) {
    return sendTyping(chatId, customToken || this.activeToken);
  }

  sendTelegramDocument(chatId, filename, bufferOrString, caption = '', customToken = null) {
    return sendTelegramDocument(chatId, filename, bufferOrString, caption, customToken || this.activeToken);
  }

  sendTelegramPoll(chatId, question, options, isAnonymous = true, type = 'regular', correctOptionId = null, explanation = '', customToken = null) {
    return sendTelegramPoll(chatId, question, options, isAnonymous, type, correctOptionId, explanation, customToken || this.activeToken);
  }

  sendTelegramDice(chatId, emoji = '🎲', customToken = null) {
    return sendTelegramDice(chatId, emoji, customToken || this.activeToken);
  }

  sendTelegramLocation(chatId, latitude, longitude, customToken = null) {
    return sendTelegramLocation(chatId, latitude, longitude, customToken || this.activeToken);
  }

  sendTelegramVenue(chatId, latitude, longitude, title, address = '', customToken = null) {
    return sendTelegramVenue(chatId, latitude, longitude, title, address, customToken || this.activeToken);
  }

  sendTelegramContact(chatId, phoneNumber, firstName, lastName = '', vcard = '', customToken = null) {
    return sendTelegramContact(chatId, phoneNumber, firstName, lastName, vcard, customToken || this.activeToken);
  }

  sendTelegramPhoto(chatId, photoUrl, caption = '', customToken = null) {
    return sendTelegramPhoto(chatId, photoUrl, caption, customToken || this.activeToken);
  }

  // Delegated Access Control
  isOwner(fromUser) {
    return isOwner(fromUser, this.activeOwnerId);
  }

  isUserAllowed(fromUser) {
    return isUserAllowed(fromUser, this.activeOwnerId, this.activeAccessMode);
  }

  // Delegated Admin UI
  buildMainMenuMarkup() {
    return buildMainMenuMarkup(getConfig());
  }

  getMainMenuText(senderName) {
    return getMainMenuText(senderName, this.conversations.size);
  }

  sendAdminPanel(chatId, senderName) {
    return sendAdminPanel(chatId, senderName, this.conversations.size, this.activeToken);
  }

  // Delegated AI Routing
  queryBreAIRouter(...args) {
    return queryBreAIRouter(...args);
  }

  async handleCallbackQuery(cq, ctx = null) {
    if (ctx) {
      if (ctx.token) this.activeToken = ctx.token;
      if (ctx.ownerId) this.activeOwnerId = ctx.ownerId;
      if (ctx.accessMode) this.activeAccessMode = ctx.accessMode;
    }

    // Handle language selection callbacks (available to all users, not just admin)
    const data = cq.data || '';
    if (data.startsWith('set_lang:')) {
      const parts = data.split(':');
      // parts[1] = userId yang dikirim saat menu dibuat (fromUser.id)
      // Tapi yang LEBIH AMAN dan PASTI adalah langsung pakai cq.from.id
      // karena itu adalah Telegram account ID yang benar-benar menekan tombol.
      const actualUserId = String(cq.from?.id || parts[1]);
      const langCode = parts[2];
      const token = this.activeToken || null;

      if (langCode === 'close') {
        // Close: delete language menu message
        try {
          await apiCall('deleteMessage', {
            chat_id: cq.message?.chat?.id,
            message_id: cq.message?.message_id
          }, token);
        } catch (e) {
          await editTelegramMessage(cq.message?.chat?.id, cq.message?.message_id, '\ud83c\udf10 Menu bahasa ditutup. Kirim /language untuk membuka kembali.', null, token);
        }
        await answerCallback(cq.id, 'Menu ditutup', false, token);
        return;
      }

      if (LANGUAGE_OPTIONS[langCode]) {
        // Simpan HANYA ke akun yang menekan tombol (cq.from.id)
        saveUserLanguage(actualUserId, langCode);
        const selectedLabel = LANGUAGE_OPTIONS[langCode].label;
        await answerCallback(cq.id, `\u2705 Bahasa diubah ke: ${selectedLabel}`, true, token);

        // Refresh menu menampilkan checkmark pada bahasa yang baru dipilih
        // Tetap embed actualUserId di callback_data agar konsisten
        const currentLang = langCode;
        const entries = Object.entries(LANGUAGE_OPTIONS);
        const langRows = [];
        for (let i = 0; i < entries.length; i += 2) {
          const row = [];
          const [code1, info1] = entries[i];
          row.push({
            text: (code1 === currentLang ? '\u2705 ' : '') + info1.label,
            callback_data: `set_lang:${actualUserId}:${code1}`
          });
          if (entries[i + 1]) {
            const [code2, info2] = entries[i + 1];
            row.push({
              text: (code2 === currentLang ? '\u2705 ' : '') + info2.label,
              callback_data: `set_lang:${actualUserId}:${code2}`
            });
          }
          langRows.push(row);
        }
        langRows.push([{ text: '\u274c Tutup Menu', callback_data: `set_lang:${actualUserId}:close` }]);

        const langText = `\ud83c\udf10 *Pilih Bahasa Respons Bre AI*\n\n` +
          `Bahasa aktif: *${selectedLabel}*\n\n` +
          `Pilihan bahasa telah tersimpan permanen. Bre AI kini akan merespons dalam bahasa ini secara mutlak.\nPilih bahasa lain atau tutup menu:`;

        await editTelegramMessage(cq.message?.chat?.id, cq.message?.message_id, langText, { inline_keyboard: langRows }, token);
      } else {
        await answerCallback(cq.id, 'Bahasa tidak dikenal', false, token);
      }
      return;
    }

    // Handle style selection callbacks (available to all users)
    if (data.startsWith('set_style:')) {
      const parts = data.split(':');
      const targetChatId = parseInt(parts[1]);
      const styleCode = parts[2];
      const token = this.activeToken || null;

      if (styleCode === 'close') {
        try {
          await apiCall('deleteMessage', {
            chat_id: cq.message?.chat?.id,
            message_id: cq.message?.message_id
          }, token);
        } catch (e) {
          await editTelegramMessage(cq.message?.chat?.id, cq.message?.message_id, '🎭 Menu gaya bahasa ditutup. Kirim /style untuk membuka kembali.', null, token);
        }
        await answerCallback(cq.id, 'Menu ditutup', false, token);
        return;
      }

      if (STYLE_LABELS[styleCode]) {
        saveUserStyle(targetChatId, styleCode);
        const selectedLabel = STYLE_LABELS[styleCode];
        await answerCallback(cq.id, `✅ Gaya bahasa diubah ke: ${selectedLabel}`, true, token);

        const currentStyle = styleCode;
        const styleRows = Object.entries(STYLE_LABELS).map(([code, label]) => ([
          {
            text: (code === currentStyle ? '✅ ' : '') + label,
            callback_data: `set_style:${targetChatId}:${code}`
          }
        ]));
        styleRows.push([{ text: '❌ Tutup Menu', callback_data: `set_style:${targetChatId}:close` }]);

        const styleText = `🎭 *Pilih Gaya Bahasa Respons Bre AI*\n\n` +
          `Gaya aktif saat ini: *${selectedLabel}*\n\n` +
          `Pilihan gaya telah tersimpan permanen. Pilih gaya bahasa yang Anda sukai untuk percakapan:`;

        await editTelegramMessage(cq.message?.chat?.id, cq.message?.message_id, styleText, { inline_keyboard: styleRows }, token);
      } else {
        await answerCallback(cq.id, 'Gaya bahasa tidak dikenal', false, token);
      }
      return;
    }

    return handleAdminCallback(cq, this);
  }

  // Delegated Chat & Message Handling
  async handleMessage(msg, ctx = null) {
    return handleMessage(msg, this, ctx);
  }

  queryBreAIRouter(userText, history = [], senderInfo = '') {
    return queryBreAIRouter(userText, history, senderInfo);
  }

  // Long Polling Loop with callback_query support
  async poll() {
    while (this.isRunning) {
      try {
        const updates = await this.apiCall('getUpdates', {
          offset: this.currentOffset,
          timeout: 25,
          allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query']
        });

        this.lastError = null;

        if (Array.isArray(updates) && updates.length > 0) {
          for (const u of updates) {
            if (!this.isRunning) break;
            this.currentOffset = u.update_id + 1;

            const incomingMsg = u.message || u.channel_post;
            if (incomingMsg) {
              this.handleMessage(incomingMsg).catch(err => {
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
        if (err.message && (err.message.includes('webhook') || err.message.includes('409'))) {
          try { await this.apiCall('deleteWebhook', { drop_pending_updates: false }); } catch (e) {}
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // Start the bot service
  async start(host = null) {
    const cfg = getConfig();
    if (!cfg.telegramEnabled) {
      this.isRunning = false;
      this.lastError = 'Fitur bot Telegram dinonaktifkan dalam konfigurasi.';
      return false;
    }
    if (!cfg.telegramBotToken) {
      this.isRunning = false;
      this.lastError = 'Bot Token Telegram masih kosong. Masukkan token dari @BotFather lalu simpan.';
      return false;
    }

    try {
      const info = await this.apiCall('getMe');
      this.botInfo = info;
      this.lastError = null;

      const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_URL || process.env.AWS_LAMBDA_FUNCTION_NAME);

      // Serverless Mode (Vercel): Gunakan Webhook 24/7, JANGAN hapus webhook & JANGAN jalankan polling!
      if (isServerless || (host && !host.includes('localhost') && !host.includes('127.0.0.1'))) {
        if (host) {
          const webhookUrl = `https://${host}/api/telegram`;
          try {
            await this.apiCall('setWebhook', { url: webhookUrl });
            console.log(`[TelegramBot] 🌐 Webhook serverless 24/7 dipasang ke ${webhookUrl}`);
          } catch (e) {}
        }
        this.isRunning = true;
        console.log(`[TelegramBot] 🟢 Berhasil terhubung sebagai @${info.username} (Mode Serverless Webhook 24/7)`);
        return true;
      }

      // Local Development Mode: Gunakan Long-Polling
      if (this.isRunning) return true;

      // Hapus webhook sebelumnya agar long-polling lokal tidak bentrok
      try {
        await this.apiCall('deleteWebhook', { drop_pending_updates: false });
      } catch (e) {}

      this.isRunning = true;
      console.log(`[TelegramBot] 🟢 Berhasil terhubung sebagai @${info.username} (Mode Long-Polling Lokal)`);
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

  // Restart bot service
  async restart(host = null) {
    this.stop();
    await new Promise(r => setTimeout(r, 500));
    return this.start(host);
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

  // Get detailed status including Telegram Webhook info
  async getDetailedStatus(currentHost = null, customToken = null) {
    const cfg = getConfig();
    const effectiveToken = customToken || this.activeToken || cfg.telegramBotToken;
    const hasToken = !!effectiveToken;
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_URL);

    let webhookInfo = null;
    let botInfo = this.botInfo || null;

    if (hasToken) {
      try {
        botInfo = await this.apiCall('getMe', {}, effectiveToken);
        this.botInfo = botInfo;
      } catch (e) {
        this.lastError = e.message;
      }

      try {
        webhookInfo = await this.apiCall('getWebhookInfo', {}, effectiveToken);
      } catch (e) {}
    }

    const hasActiveWebhook = Boolean(webhookInfo && webhookInfo.url && webhookInfo.url.length > 0);

    return {
      enabled: !!cfg.telegramEnabled,
      hasToken,
      running: Boolean(hasActiveWebhook || this.isRunning),
      isVercel,
      isWebhookActive: hasActiveWebhook,
      webhookUrl: webhookInfo?.url || '',
      pendingUpdates: webhookInfo?.pending_update_count || 0,
      botInfo,
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
module.exports.TelegramBotService = TelegramBotService;
