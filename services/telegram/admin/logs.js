// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Logs Viewer & Clear
// Created by Amirun Rayan Ariandi
// ========================================================
const { getLogs, clearLogs } = require('../../../api/_shared');
const api = require('../api');

async function handle(cq, botService) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;

  if (data === 'adm_clear_logs') {
    clearLogs();
    await api.answerCallback(cq.id, '🗑️ Seluruh log server berhasil dibersihkan!', true, token);
    cq.data = 'adm_logs';
    return handle(cq, botService);
  }

  if (data === 'adm_logs' || data === 'adm_logs_err') {
    await api.answerCallback(cq.id, null, false, token);
    const isErrorOnly = (data === 'adm_logs_err');
    let logs = getLogs();
    if (isErrorOnly) logs = logs.filter(l => l.status >= 400);
    logs = logs.slice(0, 6);

    let text = `📜 *${isErrorOnly ? 'Error Logs Server (Status >= 400)' : 'Log Permintaan Terbaru'}*\n\n`;
    if (!logs.length) {
      text += `_Belum ada ${isErrorOnly ? 'error' : 'log aktivitas'} yang terekam di memori server._\n`;
    } else {
      logs.forEach((l, i) => {
        const time = l.timeStr || (l.timestamp ? new Date(l.timestamp).toLocaleTimeString('id-ID') : '-');
        const st = l.status >= 400 ? `🔴 ${l.status}` : `🟢 ${l.status}`;
        const cacheTag = l.cached ? ' [⚡RAM]' : '';
        text += `${i+1}. [${time}] *${l.provider || 'API'}* (${l.model || '-'})${cacheTag}\n   Status: ${st} | ${l.latencyMs || 0}ms | ${l.tokens || 0} tok\n`;
        if (l.error) text += `   ⚠️ _${l.error.slice(0, 60)}_\n`;
      });
    }

    const markup = {
      inline_keyboard: [
        [
          { text: isErrorOnly ? '📋 Tampilkan Semua Log' : '⚠️ Filter Error Saja', callback_data: isErrorOnly ? 'adm_logs' : 'adm_logs_err' },
          { text: '🔄 Refresh', callback_data: data }
        ],
        [
          { text: '🗑️ Bersihkan Semua Log', callback_data: 'adm_clear_logs' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await api.editTelegramMessage(chatId, messageId, text, markup, token);
    return true;
  }

  return false;
}

module.exports = { handle };
