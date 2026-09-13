// ========================================================
// Bre v3.0 Telegram Bot Service Orchestrator
// Clean modular architecture for Telegram operations
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig, saveConfig } = require('../../api/_shared');
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

const {
  conversationsMap,
  DEFAULT_MAX_HISTORY,
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  clearAllHistories,
  getActiveConversationsCount,
  pruneConversationHistory,
  sanitizeMessagesForLLM,
  buildHistoryUserSnippet
} = require('./sessionManager');

const { getDueReminders, markReminderSent, loadReminders } = require('./reminderManager');

class TelegramBotService {
  constructor() {
    this.isRunning = false;
    this.botInfo = null;
    this.lastError = null;
    this.currentOffset = 0;
    this.recentUsers = recentUsers; // shared reference Map
    this.conversations = conversationsMap; // shared reference Map for active session tracking
    this.MAX_HISTORY = DEFAULT_MAX_HISTORY || 30;
    this.pollingTimer = null;
    this.reminderTimer = null;
    this.activeToken = null;
    this.activeOwnerId = null;
    this.activeAccessMode = null;
  }

  // Access control delegates
  recordRecentUser(fromUser, customToken = null) {
    return recordRecentUser(fromUser, customToken || this.activeToken);
  }

  getRecentUsersList(customToken = null) {
    return getRecentUsersList(customToken || this.activeToken);
  }

  isOwner(fromUser, overrideOwnerId = null) {
    return isOwner(fromUser, overrideOwnerId || this.activeOwnerId);
  }

  isUserAllowed(fromUser, overrideOwnerId = null, overrideAccessMode = null) {
    return isUserAllowed(fromUser, overrideOwnerId || this.activeOwnerId, overrideAccessMode || this.activeAccessMode);
  }

  // Session & conversation history delegates
  getChatHistory(chatId) {
    return getChatHistory(chatId);
  }

  saveChatHistory(chatId, history) {
    return saveChatHistory(chatId, history);
  }

  clearChatHistory(chatId) {
    return clearChatHistory(chatId);
  }

  clearAllHistories() {
    return clearAllHistories();
  }

  pruneConversationHistory(history, maxLimit = null) {
    return pruneConversationHistory(history, maxLimit || this.MAX_HISTORY);
  }

  getActiveConversationsCount() {
    return getActiveConversationsCount();
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

  sendTelegramMessage(chatId, text, replyMarkup = null, replyToId = null, customToken = null, editMessageId = null) {
    return sendTelegramMessage(chatId, text, replyMarkup, replyToId, customToken || this.activeToken, editMessageId);
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

  sendTelegramVenue(chatId, latitude, longitude, title, address, customToken = null) {
    return sendTelegramVenue(chatId, latitude, longitude, title, address, customToken || this.activeToken);
  }

  sendTelegramContact(chatId, phoneNumber, firstName, lastName = '', customToken = null) {
    return sendTelegramContact(chatId, phoneNumber, firstName, lastName, '', customToken || this.activeToken);
  }

  sendTelegramPhoto(chatId, photoBufferOrUrl, caption = '', replyMarkup = null, customToken = null) {
    return sendTelegramPhoto(chatId, photoBufferOrUrl, caption, customToken || this.activeToken);
  }

  // Delegated UI / Menu
  buildMainMenuMarkup(chatId, isOwnerUser = false) {
    return buildMainMenuMarkup(chatId, isOwnerUser);
  }

  getMainMenuText(senderName, activeSessionsCount = 0) {
    return getMainMenuText(senderName, activeSessionsCount);
  }

  sendAdminPanel(chatId, senderName, activeSessionsCount = 0, customToken = null) {
    return sendAdminPanel(chatId, senderName, activeSessionsCount, customToken || this.activeToken);
  }

  handleAdminCallback(cq, botService) {
    return handleAdminCallback(cq, botService || this);
  }

  queryBreAIRouter(...args) {
    return queryBreAIRouter(...args);
  }

  handleBroadcastCommand(chatId, fromUser, broadcastText) {
    return handleBroadcastCommand(chatId, fromUser, broadcastText, this);
  }

  handleCallbackQuery(query) { return this.handleUpdate({ callback_query: query }); }
  handleMessage(message) { return this.handleUpdate({ message }); }
  async restart() { this.stop(); return this.init(); }

  async handleUpdate(u, webhookCtx = {}) {
    if (!u) return;

    // Set contextual config for request scope if passed from webhook
    const cfg = getConfig();
    this.activeToken = cfg.telegramBotToken || null;
    this.activeOwnerId = cfg.telegramOwnerId || null;
    this.activeAccessMode = cfg.telegramAccessMode || 'public';
    const token = this.activeToken;

    // Handle interactive callback queries
    if (u.callback_query) {
      const cq = u.callback_query;
      const data = cq.data || '';
      if (!this.isUserAllowed(cq.from)) return this.answerCallback(cq.id, 'Akses Ditolak', true, token);

      if (cq.from) {
        this.recordRecentUser(cq.from, token);
      }

      // Check admin panel callbacks
      if (data.startsWith('admin_') || data.startsWith('adm_')) {
        return this.handleAdminCallback(cq, this);
      }

      // Handle language selector callback
      if (data.startsWith('set_lang:')) {
        const parts = data.split(':');
        const langCode = parts[2];
        const targetChatId = cq.message?.chat?.id;

        if (langCode === 'close') {
          await this.answerCallback(cq.id, 'Menu ditutup', false, token);
          if (cq.message?.message_id && targetChatId) {
            await this.editTelegramMessage(targetChatId, cq.message.message_id, 'ℹ️ Menu pemilihan bahasa ditutup.', null, token);
          }
          return;
        }

        if (LANGUAGE_OPTIONS[langCode] && targetChatId) {
          saveUserLanguage(targetChatId, langCode);
          chatLanguages.set(String(targetChatId), langCode);
          await this.answerCallback(cq.id, `Bahasa diubah ke ${LANGUAGE_OPTIONS[langCode].label}`, false, token);
          if (cq.message?.message_id) {
            await this.editTelegramMessage(
              targetChatId,
              cq.message.message_id,
              `✅ *Bahasa Berhasil Diubah!*\n\nBahasa komunikasi bot sekarang diatur ke: *${LANGUAGE_OPTIONS[langCode].label}*`,
              null,
              token
            );
          }
        }
        return;
      }

      // Handle style selector callback
      if (data.startsWith('set_style:')) {
        const parts = data.split(':');
        const styleCode = parts[2];
        const targetChatId = cq.message?.chat?.id;

        if (styleCode === 'close') {
          await this.answerCallback(cq.id, 'Menu ditutup', false, token);
          if (cq.message?.message_id && targetChatId) {
            await this.editTelegramMessage(targetChatId, cq.message.message_id, 'ℹ️ Menu pemilihan persona ditutup.', null, token);
          }
          return;
        }

        if (STYLE_LABELS[styleCode] && targetChatId) {
          saveUserStyle(targetChatId, styleCode);
          chatStyles.set(String(targetChatId), styleCode);
          await this.answerCallback(cq.id, `Gaya diubah ke ${STYLE_LABELS[styleCode]}`, false, token);
          if (cq.message?.message_id) {
            await this.editTelegramMessage(
              targetChatId,
              cq.message.message_id,
              `🎭 *Persona Berhasil Diubah!*\n\nGaya bicara bot sekarang diatur ke: *${STYLE_LABELS[styleCode]}*`,
              null,
              token
            );
          }
        }
        return;
      }

      // Handle quick menu callbacks
      if (data.startsWith('menu:')) {
        const targetChatId = cq.message?.chat?.id;
        const fromUser = cq.from;
        const isOwnerUser = this.isOwner(fromUser);

        if (data === 'menu:lang' && targetChatId) {
          await this.answerCallback(cq.id, 'Pilih bahasa', false, token);
          const currentLang = getUserLanguage(targetChatId);
          const langRows = Object.entries(LANGUAGE_OPTIONS).map(([code, name]) => ([{
            text: (code === currentLang ? '✅ ' : '') + name.label,
            callback_data: `set_lang:${targetChatId}:${code}`
          }]));
          langRows.push([{ text: '❌ Tutup', callback_data: `set_lang:${targetChatId}:close` }]);
          await this.sendTelegramMessage(targetChatId, '🌐 *Pilih Bahasa Komunikasi:*', { inline_keyboard: langRows }, null, token);
          return;
        }

        if (data === 'menu:style' && targetChatId) {
          await this.answerCallback(cq.id, 'Pilih gaya persona', false, token);
          const currentStyle = getUserStyle(targetChatId);
          const styleRows = Object.entries(STYLE_LABELS).map(([code, label]) => ([{
            text: (code === currentStyle ? '✅ ' : '') + label,
            callback_data: `set_style:${targetChatId}:${code}`
          }]));
          styleRows.push([{ text: '❌ Tutup', callback_data: `set_style:${targetChatId}:close` }]);
          await this.sendTelegramMessage(targetChatId, '🎭 *Pilih Persona AI:*', { inline_keyboard: styleRows }, null, token);
          return;
        }

        if (data === 'menu:reset' && targetChatId) {
          this.clearChatHistory(targetChatId);
          await this.answerCallback(cq.id, 'Memori percakapan direset', true, token);
          await this.sendTelegramMessage(targetChatId, '🧹 *Memori percakapan telah dibersihkan.*', null, null, token);
          return;
        }

        if (data === 'menu:status' && targetChatId) {
          await this.answerCallback(cq.id, 'Status dimuat', false, token);
          const history = this.getChatHistory(targetChatId);
          const lang = getUserLanguage(targetChatId);
          const style = getUserStyle(targetChatId);
          const statusText = `📊 *Status Chat*\n\n• Sesi Aktif: ${this.getActiveConversationsCount()} pengguna\n• Riwayat Chat Ini: ${history.length} pesan\n• Bahasa: ${LANGUAGE_OPTIONS[lang] || lang}\n• Persona: ${STYLE_LABELS[style] || style}`;
          await this.sendTelegramMessage(targetChatId, statusText, null, null, token);
          return;
        }

        if (data === 'menu:admin' && targetChatId) {
          if (!isOwnerUser) {
            await this.answerCallback(cq.id, 'Akses Ditolak: Hanya untuk Owner Bot.', true, token);
            return;
          }
          await this.answerCallback(cq.id, 'Membuka Admin Panel...', false, token);
          const senderName = [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(' ') || fromUser?.username || 'Owner';
          await this.sendAdminPanel(targetChatId, senderName, this.getActiveConversationsCount(), token);
          return;
        }
      }

      await this.answerCallback(cq.id, null, false, token);
      return;
    }

    const incomingMsg = u.message || u.channel_post || u.edited_message;
    if (incomingMsg) {
      await handleMessage(incomingMsg, this, webhookCtx);
    }
  }

  async checkReminders() {
    const dueList = getDueReminders();
    if (!dueList || dueList.length === 0) return;

    for (const r of dueList) {
      try {
        const text = `⏰ *PENGINGAT ANDA*\n\n"${r.message}"\n\n_Pengingat dijadwalkan untuk sekarang._`;
        await this.sendTelegramMessage(r.chatId, text);
        markReminderSent(r.id);
      } catch (e) {
        console.warn(`[Reminder Error] Gagal kirim reminder ${r.id}:`, e.message);
      }
    }
  }

  async pollUpdates() {
    if (!this.isRunning) return;

    try {
      const updates = await this.apiCall('getUpdates', {
        offset: this.currentOffset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query', 'channel_post', 'edited_message']
      });

      if (Array.isArray(updates)) {
        for (const u of updates) {
          if (u.update_id >= this.currentOffset) {
            this.currentOffset = u.update_id + 1;
          }
          await this.handleUpdate(u);
        }
      }
      this.lastError = null;
    } catch (e) {
      this.lastError = e.message;
      console.warn('[Telegram Polling Warning]:', e.message);
      await new Promise(r => setTimeout(r, 4000));
    }

    if (this.isRunning) {
      this.pollingTimer = setTimeout(() => this.pollUpdates(), 100);
    }
  }

  async init() {
    const cfg = getConfig();
    if (!cfg.telegramEnabled) {
      this.stop();
      return { ok: true, status: 'disabled', message: 'Telegram Bot dinonaktifkan di konfigurasi.' };
    }

    const token = (cfg.telegramBotToken || '').trim();
    if (!token) {
      this.stop();
      return { ok: false, error: 'Token bot belum diisi.' };
    }

    try {
      const tested = await this.testToken(token);
      if (!tested.ok) throw new Error(tested.error || 'Token bot tidak valid');
      const me = tested.bot;
      this.botInfo = me;
      this.activeToken = token;
      this.activeOwnerId = cfg.telegramOwnerId || null;
      this.activeAccessMode = cfg.telegramAccessMode || 'public';

      await loadReminders();

      // Check if webhook is set
      const webhookInfo = await this.apiCall('getWebhookInfo', {}, token).catch(() => ({ url: '' }));
      if (webhookInfo && webhookInfo.url) {
        console.log('[Telegram Bot] Terhubung via Webhook');
        this.isRunning = true;
        if (this.reminderTimer) clearInterval(this.reminderTimer);
        if (!process.env.VERCEL) this.reminderTimer = setInterval(() => this.checkReminders().catch(console.error), 30000);
        return { ok: true, status: 'webhook_active', bot: me, webhookUrl: webhookInfo.url };
      }

      // Start long-polling
      if (process.env.VERCEL) return { ok: false, error: 'Pasang webhook Telegram untuk mode Vercel.' };
      this.isRunning = true;
      if (this.pollingTimer) clearTimeout(this.pollingTimer);
      if (this.reminderTimer) clearInterval(this.reminderTimer);

      this.pollUpdates();
      this.reminderTimer = setInterval(() => this.checkReminders().catch(console.error), 30000);

      console.log(`[Telegram Bot] Berjalan via Long-Polling sebagai @${me.username}`);
      return { ok: true, status: 'polling_active', bot: me };
    } catch (e) {
      this.lastError = e.message;
      this.isRunning = false;
      return { ok: false, error: e.message };
    }
  }

  stop() {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      bot: this.botInfo,
      botInfo: this.botInfo,
      accessMode: getConfig().telegramAccessMode,
      username: this.botInfo?.username || null,
      mode: this.isRunning ? (this.pollingTimer ? 'polling' : 'webhook') : 'stopped',
      lastError: this.lastError,
      activeSessions: this.getActiveConversationsCount(),
      recentUsersCount: this.recentUsers.size
    };
  }
}

// Singleton instance
const botService = new TelegramBotService();
module.exports = botService;
