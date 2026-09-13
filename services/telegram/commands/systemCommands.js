// ========================================================
// Bre AI v3.0 - Telegram Commands: System, Status & Help
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  testSingleModel,
  STYLE_LABELS
} = require('../../../api/_shared');
const api = require('../api');

async function handle(ctx) {
  const { msg, botService, text, lowerText, chatId, fromUser, senderName, senderTag, token, isOwnerUser, queryBreAIRouter } = ctx;

  // /ping
  if (lowerText === '/ping' || lowerText.startsWith('/ping ')) {
    const t0 = Date.now();
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints.filter(e => e.status !== false && e.enabled !== false) : [];
    const activeEp = eps[0] || (cfg.endpoints && cfg.endpoints[0]) || null;
    const activeModel = cfg.telegramModel || cfg.model || (activeEp?.models?.[0]) || 'mercury-2';

    let providerLatencyStr = 'N/A';
    let providerStatus = '⚪ Belum ada endpoint aktif';

    if (activeEp && activeEp.url) {
      try {
        const probe = await testSingleModel(activeEp, activeModel);
        providerLatencyStr = `${probe.latencyMs} ms`;
        providerStatus = probe.ok ? '🟢 Online (200 OK)' : `🔴 Error (${probe.error || 'Timeout'})`;
      } catch (e) {
        providerStatus = `🔴 Error: ${e.message}`;
      }
    }

    const botLatency = Date.now() - t0;
    const activeStyle = STYLE_LABELS[cfg.telegramStyle || cfg.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';

    await api.sendTelegramMessage(
      chatId,
      `🏓 *Pong! Status Latensi & Koneksi Bre AI*\n\n` +
      `• *Bot Gateway Latensi:* \`${botLatency} ms\`\n` +
      `• *Provider AI Aktif:* *${activeEp?.name || 'Inception Labs'}*\n` +
      `• *Provider Latensi:* \`${providerLatencyStr}\` (${providerStatus})\n` +
      `• *Model Aktif:* \`${activeModel}\`\n` +
      `• *Gaya Bahasa:* ${activeStyle}\n` +
      `• *Waktu Server:* ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n` +
      `_Sistem berjalan normal. Ketik \`/admin\` untuk membuka Dashboard Panel._`,
      null, null, token
    );
    return true;
  }


  // /status
  if (text === '/status') {
    const cfg = getConfig();
    const isRestricted = (cfg.telegramAccessMode || 'public') !== 'public';
    const statusMode = isRestricted ? '🔒 Khusus Diizinkan' : '🟢 Publik';
    const statusStyle = STYLE_LABELS[cfg.telegramStyle || cfg.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';
    const statusMsg = `📊 *Status Sistem Bre AI Router*\n\n` +
      `• *Bot:* @${botService.botInfo?.username || 'BreAI_Bot'}\n` +
      `• *Mode Akses:* *${statusMode}*\n` +
      `• *Gaya Bahasa Indonesia Global:* *${statusStyle}*\n` +
      `• *Bahasa Respons:* *🌐 Otomatis (deteksi dari pesan)*\n` +
      `• *Auto-Failover:* *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `• *Response Cache:* *${cfg.cacheEnabled ? '⚡ Aktif' : '⚪ Nonaktif'}*\n` +
      `• *Sesi Chat Aktif:* ${botService.conversations.size} percakapan`;
    await api.sendTelegramMessage(chatId, statusMsg, null, null, token);
    return true;
  }


  // /start
  if (text === '/start' || text.startsWith('/start ')) {
    botService.conversations.delete(chatId);

    let welcome = `⚡️ *Halo ${senderName}!* Selamat datang di *Bre AI*.

Saya adalah asisten kecerdasan buatan serba bisa dan cerdas tanpa batas ciptaan *Amirun Rayan Ariandi*, siap membantu Anda menjawab pertanyaan, menulis kode program, menghasilkan pesan interaktif, menganalisis dokumen/gambar, hingga menyelesaikan tugas kompleks langsung dari Telegram.

• Tulis pesan dalam *bahasa apa pun* — Bre AI otomatis menjawab dalam bahasa yang sama.
• Gunakan tombol menu di bawah untuk membuka fitur, pengaturan, status, dan reset percakapan.`;

    let replyMarkup = {
      inline_keyboard: [
        [
          { text: '🛠️ Pusat Fitur & Tools AI', callback_data: 'menu:tools' },
          { text: '🌐 Bahasa', callback_data: 'menu:lang' }
        ],
        [
          { text: '🎭 Persona / Gaya', callback_data: 'menu:style' },
          { text: '🧹 Reset Percakapan', callback_data: 'menu:reset' }
        ]
      ]
    };

    if (isOwnerUser) {
      const cfg2 = getConfig();
      const ownerStyle = STYLE_LABELS[cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';
      welcome += `\n\n👑 *Panel Pemilik (Owner):*\n` +
        `Semua kontrol admin tersedia lewat tombol Master Admin Panel dan Command Center.\n` +
        `🎭 *Gaya Bahasa Indonesia Aktif:* ${ownerStyle}`;

      replyMarkup.inline_keyboard.push(
        [
          { text: '🎛️ Buka Master Admin Panel', callback_data: 'adm_main' },
          { text: '📊 Cek Status & Metrik', callback_data: 'adm_metrics' }
        ]
      );
    }

    await api.sendTelegramMessage(chatId, welcome, replyMarkup, null, token);
    return true;
  }


  // /help
  if (text === '/help') {
    const cfg2 = getConfig();
    const globalStyle = cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta';
    const styleLabel = STYLE_LABELS[globalStyle] || '🗣️ Jakarta / Gaul (Gue-Lu)';

    let help = `📖 *Panduan Bre AI Telegram*

Gunakan tombol di bawah untuk membuka semua fitur tanpa menghafal perintah.

• *Chat Bebas:* Langsung ketik pertanyaan apa pun.
• *Bahasa Otomatis:* Bre AI mengikuti bahasa pengguna.
• *File & Media:* Kirim foto, voice note, PDF, Word, Excel, kode, lokasi, kontak, stiker, atau GIF.
• *Tools AI:* Tersedia lewat tombol Pusat Tools AI.
• *Reset & Status:* Tersedia lewat tombol cepat.

🎭 *Gaya Bahasa Aktif:* ${styleLabel}
Pencipta & Pengembang: *Amirun Rayan Ariandi*`;

    let helpMarkup = {
      inline_keyboard: [
        [
          { text: '🛠️ Pusat Tools AI', callback_data: 'menu:tools' },
          { text: '🌐 Pilih Bahasa', callback_data: 'menu:lang' }
        ],
        [
          { text: '🎭 Pilih Persona', callback_data: 'menu:style' },
          { text: '📊 Status Sistem', callback_data: 'menu:status' }
        ],
        [
          { text: '🧹 Reset Memori Chat', callback_data: 'menu:reset' }
        ]
      ]
    };

    if (isOwnerUser) {
      help += `\n\n👑 *Mode Owner Aktif*\nSemua fitur admin tersedia lewat tombol Master Admin Panel dan Command Center.`;
      helpMarkup.inline_keyboard.push([
        { text: '🎛️ Master Admin Panel', callback_data: 'adm_main' }
      ]);
    }

    await api.sendTelegramMessage(chatId, help, helpMarkup, null, token);
    return true;
  }


  // /reset, /clear, /restart
  if (text === '/reset' || text === '/clear' || text === '/restart') {
    botService.conversations.delete(chatId);
    await api.sendTelegramMessage(chatId, `✨ *Riwayat percakapan berhasil dibersihkan!* Anda sekarang berada di sesi obrolan baru.`, null, null, token);
    return true;
  }


  // /health
  if (lowerText === '/health' || lowerText === '/kesehatan') {
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!eps.length) {
      await api.sendTelegramMessage(chatId, '⚠️ Belum ada provider yang terdaftar.', null, null, token);
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `⚡ *Memeriksa latensi & kesehatan seluruh provider AI...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const probeResults = await Promise.all(
      eps.map(async (ep, i) => {
        const modelToTest = ep.models?.[0] || 'default';
        const start = Date.now();
        const probe = await testSingleModel(ep, modelToTest);
        const ms = probe.latencyMs || (Date.now() - start);
        return {
          idx: i + 1,
          name: ep.name || 'Provider',
          model: modelToTest,
          status: ep.status !== false ? (probe.ok ? '🟢 200 OK' : '🔴 Error') : '⚪ Off',
          latency: ms,
          error: probe.error || null
        };
      })
    );

    let resText = `⚡ *Laporan Kesehatan Provider AI Live*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    probeResults.forEach(p => {
      resText += `${p.idx}. *${p.name}* [${p.status}]\n   • Model: \`${p.model}\`\n   • Latensi: \`${p.latency} ms\`\n`;
      if (p.error) resText += `   • Error: \`${p.error.slice(0, 50)}\`\n`;
      resText += `\n`;
    });

    resText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Strategi: *${(cfg.routingStrategy || 'auto').toUpperCase()}*\n` +
      `• Auto-Failover: *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `_Sistem otomatis memindahkan trafik ke provider sehat jika terjadi kendala._`;

    if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, resText, null, token);
    else await api.sendTelegramMessage(chatId, resText, null, null, token);
    return true;
  }


  return false;
}

module.exports = { handle };
