// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Backup, Maintenance & Cache
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  clearResponseCache
} = require('../../../api/_shared');
const api = require('../api');
const { getMainMenuText, buildMainMenuMarkup } = require('./menuBuilder');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }
function sendTelegramDocument(...args) { return api.sendTelegramDocument(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const fromUser = cq.from;
  const senderName = fromUser?.first_name || 'Owner';
  const cfg = getConfig();

  if (data === 'adm_backup') {
    await answerCallback(cq.id, null, false, token);
    const text = `📦 *Backup, Export & Maintenance Sistem*\n\n` +
      `• *Export Backup:* Unduh seluruh isi file \`config.json\` langsung ke chat Telegram Anda.\n` +
      `• *Bersihkan Cache RAM:* Kosongkan respon cache instan dan hapus sesi chat yang sedang berjalan.\n` +
      `• *Reset Pabrik:* Kembalikan seluruh pengaturan proxy router ke default awal.`;

    const markup = {
      inline_keyboard: [
        [
          { text: '📥 Export config.json ke Telegram', callback_data: 'adm_export_config' }
        ],
        [
          { text: '🗑️ Bersihkan Cache RAM & Sesi', callback_data: 'adm_flush_confirm' }
        ],
        [
          { text: '⚠️ Reset ke Default Pabrik', callback_data: 'adm_reset_confirm' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 10a. Export config.json directly to chat
  if (data === 'adm_export_config') {
    await answerCallback(cq.id, '📦 Menyiapkan berkas backup config.json...', false, token);
    const fullConfig = getConfig();
    const configStr = JSON.stringify(fullConfig, null, 2);
    const fileName = `bre_ai_config_${new Date().toISOString().slice(0, 10)}.json`;
    const caption = `📦 *Backup Konfigurasi Bre AI*\nTanggal: ${new Date().toLocaleString('id-ID')}\n_Simpan berkas ini untuk pemulihan konfigurasi di masa mendatang._`;

    try {
      await sendTelegramDocument(chatId, fileName, configStr, caption, token);
      await answerCallback(cq.id, '✅ Berkas config.json berhasil dikirim!', true, token);
    } catch (e) {
      await answerCallback(cq.id, `Gagal kirim berkas: ${e.message}`, true, token);
    }
    return;
  }

  // 10b. Reset to Factory Default
  if (data === 'adm_reset_confirm') {
    await answerCallback(cq.id, null, false, token);
    const text = `⚠️ *KONFIRMASI RESET PENGATURAN AWAL*\n\n` +
      `Apakah Anda yakin ingin mengembalikan SELURUH konfigurasi proxy router ke pengaturan bawaan pabrik?\n\n` +
      `Seluruh endpoint kustom dan API key klien akan direset.`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚠️ Ya, Reset ke Default', callback_data: 'adm_reset_exec' }
        ],
        [
          { text: '❌ Batalkan', callback_data: 'adm_backup' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_reset_exec') {
    const defConfig = {
      endpoints: [{
        name: "Inception Labs",
        url: "https://api.inceptionlabs.ai/v1/chat/completions",
        keys: [],
        models: ["mercury-2"]
      }],
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 16384,
      autoFailover: true,
      cacheEnabled: false,
      blacklist: []
    };
    saveConfig(defConfig);
    await answerCallback(cq.id, '🔄 Pengaturan berhasil direset ke Default Pabrik!', true, token);
    cq.data = 'adm_backup';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // ----------------------------------------------------
  // 11. NEW USER APPROVAL ACTIONS
  // ----------------------------------------------------
  // ----------------------------------------------------
  // 11. NEW USER APPROVAL ACTIONS
  // ----------------------------------------------------

  if (data === 'adm_flush_confirm') {
    await answerCallback(cq.id, null, false, token);
    const text = `⚠️ *Konfirmasi Pembersihan Cache RAM & Sesi Chat:*\n\n` +
      `Apakah Anda yakin ingin mengosongkan seluruh respon cache in-memory dan membersihkan riwayat sesi obrolan Telegram?\n\n` +
      `Tindakan ini aman dan langsung membebaskan memori RAM server.`;
    const markup = {
      inline_keyboard: [
        [
          { text: '🗑️ Ya, Kosongkan Cache RAM & Sesi', callback_data: 'adm_flush_exec' }
        ],
        [
          { text: '❌ Batalkan', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_flush_exec') {
    clearResponseCache();
    botService.conversations.clear();
    await answerCallback(cq.id, '⚡ Cache RAM & sesi berhasil dibersihkan!', true, token);

    const text = getMainMenuText(senderName, botService.conversations.size);
    const markup = buildMainMenuMarkup(cfg);
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  return false;
}

module.exports = { handle };
