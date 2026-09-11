// ========================================================
// Bre AI v3.0 - Telegram Bot Admin Control Panel Router
// Modular Architecture by Amirun Rayan Ariandi
// ========================================================
const { isOwner } = require('./accessControl');
const { getConfig } = require('../../api/_shared');
const api = require('./api');

const {
  buildMainMenuMarkup,
  getMainMenuText,
  sendAdminPanel,
  PRESET_TEMPLATES,
  PROMPT_PRESETS,
  LANGUAGE_LABELS
} = require('./admin/menuBuilder');

const telemetryModule = require('./admin/telemetry');
const logsModule = require('./admin/logs');
const providersModule = require('./admin/providers');
const engineModule = require('./admin/engine');
const securityModule = require('./admin/security');
const botConfigModule = require('./admin/botConfig');
const cloudModule = require('./admin/cloud');
const testerModule = require('./admin/tester');
const backupModule = require('./admin/backup');
const broadcastModule = require('./admin/broadcast');

const subModules = [
  telemetryModule,
  logsModule,
  providersModule,
  engineModule,
  securityModule,
  botConfigModule,
  cloudModule,
  testerModule,
  backupModule,
  broadcastModule
];

async function handleAdminCallback(cq, botService) {
  if (!cq || !cq.from) return;
  const fromUser = cq.from;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const data = cq.data || '';
  const token = botService?.activeToken || null;

  // Verify Owner authorization
  if (!isOwner(fromUser, botService?.activeOwnerId)) {
    await api.answerCallback(cq.id, '⛔ Akses Ditolak: Khusus Pemilik Bot (Owner)', true, token);
    return;
  }

  const cfg = getConfig();
  const senderName = fromUser.first_name || 'Owner';

  // 1. MAIN MENU & CLOSE
  if (data === 'adm_main') {
    await api.answerCallback(cq.id, 'Panel diperbarui', false, token);
    const text = getMainMenuText(senderName, botService?.conversations?.size || 0);
    const markup = buildMainMenuMarkup(cfg);
    await api.editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_close') {
    await api.answerCallback(cq.id, 'Panel ditutup', false, token);
    try {
      await api.apiCall('deleteMessage', { chat_id: chatId, message_id: messageId }, token);
    } catch (e) {
      await api.editTelegramMessage(chatId, messageId, '🔒 *Panel admin ditutup.* Ketik `/admin` untuk membuka kembali.', null, token);
    }
    return;
  }

  // Dispatch to modular handlers
  for (const mod of subModules) {
    if (await mod.handle(cq, botService, handleAdminCallback)) {
      return;
    }
  }
}

module.exports = {
  buildMainMenuMarkup,
  getMainMenuText,
  sendAdminPanel,
  handleAdminCallback,
  PRESET_TEMPLATES,
  PROMPT_PRESETS,
  LANGUAGE_LABELS
};
