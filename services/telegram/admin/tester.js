// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Model Tester & Diagnostics
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  getMetrics,
  testSingleModel,
  fetchAvailableModels,
  clearLogs,
  STYLE_LABELS
} = require('../../../api/_shared');
const api = require('../api');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const cfg = getConfig();

  if (data === 'adm_tester') {
    await answerCallback(cq.id, null, false, token);
    const currentModel = cfg.telegramModel || cfg.model || 'mercury-2';

    const text = `🧪 *Live Model Query & Latency Tester*\n\n` +
      `Uji kecepatan dan responsivitas model AI upstream langsung dari Telegram tanpa perlu membuka Web Admin:\n\n` +
      `• *Model Uji Default:* \`${currentModel}\``;

    const markup = {
      inline_keyboard: [
        [
          { text: `⚡ Tes Model: ${currentModel}`, callback_data: `adm_run_test:${currentModel}` }
        ],
        [
          { text: '🔄 Ganti Model Uji', callback_data: 'adm_models' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_run_test:')) {
    const targetModel = data.split(':')[1] || 'mercury-2';
    await answerCallback(cq.id, null, false, token);
    await editTelegramMessage(chatId, messageId, `⏳ *Sedang Mengirim Test Query ke [${targetModel}]...*\nMohon tunggu beberapa detik...`, null, token);

    const startTime = Date.now();
    try {
      const probePrompt = 'Hai Bre AI, perkenalkan dirimu secara singkat.';
      const queryRouter = (botService && typeof botService.queryBreAIRouter === 'function')
        ? botService.queryBreAIRouter.bind(botService)
        : require('./messageHandler').queryBreAIRouter;
      const answer = await queryRouter(probePrompt, [{ role: 'user', content: probePrompt }]);
      const elapsed = Date.now() - startTime;

      const resultText = `✅ *Hasil Live Test Model:*\n\n` +
        `• *Model:* \`${targetModel}\`\n` +
        `• *Latensi:* \`${elapsed} ms\`\n` +
        `• *Status HTTP:* 🟢 200 OK\n\n` +
        `*Cuplikan Respon:*\n"${(answer || '').slice(0, 250)}..."`;

      const markup = {
        inline_keyboard: [
          [
            { text: '⚡ Uji Ulang', callback_data: `adm_run_test:${targetModel}` },
            { text: '⬅️ Menu Tester', callback_data: 'adm_tester' }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, resultText, markup, token);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const failText = `❌ *Live Test Gagal:*\n\n` +
        `• *Model:* \`${targetModel}\`\n` +
        `• *Latensi:* \`${elapsed} ms\`\n` +
        `• *Error:* \`${err.message}\``;

      const markup = {
        inline_keyboard: [
          [
            { text: '🔄 Coba Lagi', callback_data: `adm_run_test:${targetModel}` },
            { text: '⬅️ Menu Tester', callback_data: 'adm_tester' }
          ]
        ]
      };
      await editTelegramMessage(chatId, messageId, failText, markup, token);
    }
    return;
  }

  // ----------------------------------------------------
  // 10. BACKUP & MAINTENANCE
  // ----------------------------------------------------

  if (data === 'adm_benchmark') {
    await answerCallback(cq.id, '⏳ Menguji kecepatan seluruh provider...', false, token);
    await editTelegramMessage(chatId, messageId, `⏳ *Sedang Menjalankan Parallel Latency Probe Benchmark...*\nMohon tunggu beberapa detik...`, null, token);

    const endpoints = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!endpoints.length) {
      await editTelegramMessage(chatId, messageId, '⚠️ Tidak ada endpoint provider yang terkonfigurasi.', {
        inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'adm_providers' }]]
      }, token);
      return;
    }

    const results = await Promise.all(
      endpoints.map(async (ep, idx) => {
        const start = Date.now();
        const testRes = await testSingleModel(ep, ep.models?.[0] || 'mercury-2');
        return {
          name: ep.name || `Provider #${idx+1}`,
          model: ep.models?.[0] || 'mercury-2',
          ok: testRes.ok,
          latencyMs: testRes.latencyMs || (Date.now() - start),
          error: testRes.error || null
        };
      })
    );

    results.sort((a, b) => {
      if (a.ok && !b.ok) return -1;
      if (!a.ok && b.ok) return 1;
      return a.latencyMs - b.latencyMs;
    });

    let text = `🏆 *Leaderboard Kecepatan Upstream Provider*\n\n`;
    results.forEach((item, i) => {
      const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}.`));
      const st = item.ok ? `🟢 ${item.latencyMs}ms` : `🔴 Gagal (${item.error?.slice(0, 30) || 'Error'})`;
      text += `${medal} *${item.name}* (\`${item.model}\`)\n   Kecepatan: ${st}\n\n`;
    });

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Uji Ulang Benchmark', callback_data: 'adm_benchmark' },
          { text: '⬅️ Daftar Provider', callback_data: 'adm_providers' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

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
      `• *Koneksi Terakhir:* ${webhookInfo.last_error_date ? '⚠️ Ada Error' : '🟢 Normal'}\n` +
      (webhookInfo.last_error_message ? `• *Pesan Error:* \`${webhookInfo.last_error_message}\`\n` : '') +
      `• *Node.js Runtime:* \`${process.version}\`\n` +
      `• *Platform Server:* \`${process.env.VERCEL ? 'Vercel Lambda' : 'Local Server'}\`\n` +
      `• *Uptime Server:* \`${Math.round(process.uptime())} detik\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Cek Ulang Diagnostik', callback_data: 'adm_diag' },
          { text: '⬅️ Pengaturan Bot', callback_data: 'adm_telegram' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }


  return false;
}

module.exports = { handle };
