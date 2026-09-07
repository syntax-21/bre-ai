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
  sendTyping
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
  handleMessage
} = require('./messageHandler');

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

  async handleCallbackQuery(cq, ctx = null) {
    if (ctx) {
      if (ctx.token) this.activeToken = ctx.token;
      if (ctx.ownerId) this.activeOwnerId = ctx.ownerId;
      if (ctx.accessMode) this.activeAccessMode = ctx.accessMode;
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
