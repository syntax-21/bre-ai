// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Bot Settings & Webhook
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  STYLE_LABELS
} = require('../../../api/_shared');
const api = require('../api');
const { LANGUAGE_LABELS } = require('./menuBuilder');
const { makeConfirmation, consumeConfirmation } = require('../accessControl');
const { sanitizeErrorMessage } = require('../../../api/_shared');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const cfg = getConfig();

  if (data === 'adm_telegram') {
    await answerCallback(cq.id, null, false, token);
    const isRestricted = (cfg.telegramAccessMode || 'public') !== 'public';
    const accessMode = isRestricted ? '🔒 Khusus Diizinkan' : '🟢 Publik';
    const activeStyle = STYLE_LABELS[cfg.telegramStyle || cfg.defaultStyle || 'santai'] || '✨ Santai & Friendly';
    const activeLang = LANGUAGE_LABELS[cfg.telegramLanguage || 'id'] || '🇮🇩 Indonesia';
    const usersCount = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers.length : 0;
    const motivStatus = cfg.motivationEnabled ? '🟢' : '🔴';

    const text = `🤖 *Pengaturan Bot Telegram & Akses Serverless*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Mode Akses:* ${accessMode}\n` +
      `• *Gaya Bahasa (Tone):* ${activeStyle}\n` +
      `• *Bahasa Default:* ${activeLang}\n` +
      `• *Pengguna Terdaftar:* ${usersCount} akun\n` +
      `• *Admin Chat ID:* \`${cfg.telegramOwnerId || '-'}\`\n` +
      `• *Domain Webhook:* \`${cfg.telegramDomain || '(auto)'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih menu pengaturan bot:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: `🛡️ Akses: ${accessMode}`, callback_data: 'adm_mode' },
          { text: `🎭 Gaya: ${activeStyle}`, callback_data: 'adm_style' }
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
          { text: `${motivStatus} Motivasi Harian`, callback_data: 'adm_motivation' },
          { text: '♻️ Restart Service Bot', callback_data: 'adm_restart_confirm' }
        ],
        [
          { text: '🛑 Stop Service Bot', callback_data: 'adm_stop_confirm' },
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
    const webhookUrl = `https://${domain}/api/telegram`;
    try {
      const parsed = require('../../safeFetch').validateUrl(webhookUrl);
      if (parsed.search) throw new Error('Domain webhook tidak valid');
      const secret = cfg.telegramWebhookSecret || cfg.webhookSecret || require('crypto').randomBytes(32).toString('hex');
      const saved = await saveConfig({ telegramWebhookSecret: secret });
      if (!saved.ok) throw new Error(saved.error);
      await api.apiCall('setWebhook', { url: webhookUrl, secret_token: secret }, token);
      await answerCallback(cq.id, `✅ Webhook 24/7 berhasil dipasang ke https://${domain}/api/telegram`, true, token);
    } catch (e) {
      await answerCallback(cq.id, `❌ Gagal pasang webhook: ${e.message}`, true, token);
    }
    cq.data = 'adm_diag';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data === 'adm_del_webhook') {
    await answerCallback(cq.id, null, false, token);
    const nonce = makeConfirmation('del_webhook', cq);
    const markup = {
      inline_keyboard: [
        [{ text: '⚠️ Ya, Hapus Webhook', callback_data: `adm_del_webhook_exec:${nonce}` }],
        [{ text: '❌ Batalkan', callback_data: 'adm_diag' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, '⚠️ *Konfirmasi Hapus Webhook:*\nApakah Anda yakin ingin menghapus webhook?', markup, token);
    return true;
  }

  if (data.startsWith('adm_del_webhook_exec:')) {
    if (!consumeConfirmation(data.split(':')[1], 'del_webhook', cq)) {
      await answerCallback(cq.id, 'Konfirmasi kedaluwarsa atau tidak valid.', true, token);
      return true;
    }
    try {
      await api.apiCall('deleteWebhook', { drop_pending_updates: false }, token);
      await answerCallback(cq.id, '✅ Webhook dihapus (Mode Polling Aktif)', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Gagal hapus webhook: ${sanitizeErrorMessage(e)}`, true, token);
    }
    cq.data = 'adm_diag';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data === 'adm_restart_confirm') {
    await answerCallback(cq.id, null, false, token);
    const nonce = makeConfirmation('restart_bot', cq);
    const markup = {
      inline_keyboard: [
        [{ text: '♻️ Ya, Restart Bot', callback_data: `adm_restart_exec:${nonce}` }],
        [{ text: '❌ Batalkan', callback_data: 'adm_telegram' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, '♻️ *Konfirmasi Restart Service Bot:*\nApakah Anda yakin ingin mereboot bot?', markup, token);
    return true;
  }

  if (data.startsWith('adm_restart_exec:')) {
    if (!consumeConfirmation(data.split(':')[1], 'restart_bot', cq)) {
      await answerCallback(cq.id, 'Konfirmasi kedaluwarsa atau tidak valid.', true, token);
      return true;
    }
    try {
      await botService.restart();
      await answerCallback(cq.id, '♻️ Bot service berhasil direstart!', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Error restart: ${sanitizeErrorMessage(e)}`, true, token);
    }
    cq.data = 'adm_telegram';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data === 'adm_stop_confirm') {
    await answerCallback(cq.id, null, false, token);
    const nonce = makeConfirmation('stop_bot', cq);
    const markup = {
      inline_keyboard: [
        [{ text: '🛑 Ya, Hentikan Service', callback_data: `adm_stop_exec:${nonce}` }],
        [{ text: '❌ Batalkan', callback_data: 'adm_telegram' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, '🛑 *Konfirmasi Hentikan Layanan Bot Telegram:*\nApakah Anda yakin?', markup, token);
    return true;
  }

  if (data.startsWith('adm_stop_exec:')) {
    if (!consumeConfirmation(data.split(':')[1], 'stop_bot', cq)) {
      await answerCallback(cq.id, 'Konfirmasi kedaluwarsa atau tidak valid.', true, token);
      return true;
    }
    try {
      const saved = await saveConfig({ telegramEnabled: false });
      if (!saved.ok) throw new Error(saved.error);
      botService.stop();
      await answerCallback(cq.id, '🛑 Bot service dihentikan', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Error stop: ${sanitizeErrorMessage(e)}`, true, token);
    }
    cq.data = 'adm_telegram';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // ----------------------------------------------------
  // 8. CLOUD STORAGE & PERSISTENCE
  // ----------------------------------------------------

  // ----------------------------------------------------
  // 9. MOTIVASI HARIAN (otomatis 2x sehari, sinkron Web+Telegram)
  // ----------------------------------------------------
  if (data === 'adm_motivation' || data === 'adm_motiv_status') {
    await answerCallback(cq.id, null, false, token);
    const motivation = require('../../motivation');
    const preview = await motivation.previewMotivation();
    const lastSent = motivation.getLastMotivation();
    const timeStr = preview.times.length ? preview.times.join(' & ') : '—';
    const status = preview.enabled ? '🟢 AKTIF' : '🔴 NONAKTIF';
    const lastStr = lastSent ? new Date(lastSent.ts).toLocaleString('id-ID') : 'Belum pernah terkirim';
    const previewSample = preview.quote ? preview.quote.slice(0, 90) : '—';

    const text = `🌅 *Motivasi Harian Otomatis (Bre AI)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Status:* ${status}\n` +
      `• *Jadwal (2x sehari):* ${timeStr}\n` +
      `• *Penerima aktif:* ${preview.recipients} chat\n` +
      `• *Terakhir dikirim:* ${lastStr}\n` +
      `• *Contoh Kutipan AI:* _${previewSample}…_\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Kutipan dibuat langsung oleh kecerdasan buatan Bre AI. Atur jadwal & topik di Web Admin → Tab Telegram → Kartu Motivasi Harian._`;

    const markup = {
      inline_keyboard: [
        [
          { text: preview.enabled ? '⏸️ Nonaktifkan' : '▶️ Aktifkan', callback_data: 'adm_motiv_toggle' },
          { text: '🚀 Kirim Sekarang', callback_data: 'adm_motiv_now' }
        ],
        [
          { text: '⬅️ Kembali', callback_data: 'adm_telegram' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_motiv_toggle') {
    const cfg = getConfig();
    const newState = !cfg.motivationEnabled;
    saveConfig({ motivationEnabled: newState });
    await answerCallback(cq.id, newState ? '✅ Motivasi Harian diaktifkan' : '⏸️ Motivasi Harian dinonaktifkan', true, token);
    cq.data = 'adm_motiv_status';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data === 'adm_motiv_now') {
    await answerCallback(cq.id, 'Mengirim motivasi sekarang…', false, token);
    try {
      const motivation = require('../../motivation');
      const result = await motivation.sendMotivationNow();
      await answerCallback(cq.id, `✅ Motivasi terkirim ke ${result.delivered} chat`, true, token);
    } catch (err) {
      await answerCallback(cq.id, `❌ Gagal kirim: ${err.message}`, true, token);
    }
    cq.data = 'adm_motiv_status';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  return false;
}

module.exports = { handle };
