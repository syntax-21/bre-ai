// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Broadcast Panel
// Created by Amirun Rayan Ariandi
// ========================================================
const api = require('../api');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;

  if (data === 'adm_broadcast') {
    await answerCallback(cq.id, null, false, token);
    const recent = getRecentUsersList();
    const text = `📢 *Broadcast Pengumuman ke Semua Pengguna*\n\n` +
      `• Target Pengguna Aktif: *${recent.length} akun*\n\n` +
      `Untuk mengirim siaran ke semua pengguna, ketikkan perintah:\n` +
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


  return false;
}

module.exports = { handle };
