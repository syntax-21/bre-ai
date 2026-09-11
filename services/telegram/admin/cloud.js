// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Cloud Sync
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  testUpstash,
  testGitHub,
  getCloudStorageInfo
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

  if (data === 'adm_cloud') {
    await answerCallback(cq.id, null, false, token);
    const st = getCloudStorageInfo();
    let modeText = '💾 File Lokal / Zero-DB';
    if (st.upstashActive) modeText = '🟢 Vercel KV / Upstash Redis Aktif';
    else if (st.githubActive) modeText = '🟢 GitHub Auto-Commit Aktif';

    const text = `☁️ *Status Penyimpanan Cloud & Persistensi*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Mode Penyimpanan:* ${modeText}\n` +
      `• *Vercel KV / Upstash:* ${st.upstashActive ? '🟢 Terhubung' : '⚪ Belum disetel'}\n` +
      `• *GitHub Auto-Commit:* ${st.githubActive ? '🟢 Terhubung' : '⚪ Belum disetel'}\n` +
      `• *Serverless Ready:* ${st.isServerless ? '🟢 Vercel Cloud' : '💻 Local/VPS'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih opsi pengujian koneksi cloud di bawah:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Test Upstash / Vercel KV', callback_data: 'adm_test_upstash' }
        ],
        [
          { text: '🐙 Test GitHub Sync', callback_data: 'adm_test_github' }
        ],
        [
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_test_upstash') {
    await answerCallback(cq.id, '⏳ Menguji koneksi Upstash Redis...', false, token);
    const res = await testUpstash(cfg.upstashRedisUrl, cfg.upstashRedisToken);
    await answerCallback(cq.id, res.ok ? `✅ ${res.message}` : `❌ ${res.error}`, true, token);
    return;
  }

  if (data === 'adm_test_github') {
    await answerCallback(cq.id, '⏳ Menguji koneksi GitHub API...', false, token);
    const res = await testGitHub(cfg.githubToken, cfg.githubRepo, cfg.githubBranch);
    await answerCallback(cq.id, res.ok ? `✅ ${res.message}` : `❌ ${res.error}`, true, token);
    return;
  }

  // ----------------------------------------------------
  // 9. LIVE MODEL TESTER
  // ----------------------------------------------------

  return false;
}

module.exports = { handle };
