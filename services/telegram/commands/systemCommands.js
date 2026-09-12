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

• Tulis pesan dalam *bahasa apa pun* — Bre AI otomatis menjawab dalam bahasa yang sama! 🌐
• Kirim /reset untuk membersihkan riwayat obrolan.
• Kirim /help untuk daftar perintah & panduan lengkap.`;

    let replyMarkup = null;

    if (isOwnerUser) {
      const cfg2 = getConfig();
      const ownerStyle = STYLE_LABELS[cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta'] || '🗣️ Jakarta / Gaul (Gue-Lu)';
      welcome += `\n\n👑 *Panel Pemilik (Owner):*\n` +
        `Kirim */admin* untuk membuka Master Control Panel atau pantau sistem dengan perintah cepat: \`/status\`, \`/metrics\`, \`/logs\`, \`/providers\`, \`/benchmark\`.\n` +
        `🎭 *Gaya Bahasa Indonesia Aktif:* ${ownerStyle}\n` +
        `_Gunakan \`/style\` untuk mengubah gaya bahasa Indonesia Bre AI (global)._`;

      replyMarkup = {
        inline_keyboard: [
          [
            { text: '🎛️ Buka Master Admin Panel', callback_data: 'adm_main' },
            { text: '📊 Cek Status & Metrik', callback_data: 'adm_metrics' }
          ]
        ]
      };
    }

    await api.sendTelegramMessage(chatId, welcome, replyMarkup, null, token);
    return true;
  }


  // /help
  if (text === '/help') {
    const cfg2 = getConfig();
    const globalStyle = cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta';
    const styleLabel = STYLE_LABELS[globalStyle] || '🗣️ Jakarta / Gaul (Gue-Lu)';

    let help = `📖 *Panduan Penggunaan Bre AI di Telegram*

• *Bahasa Otomatis:* Tulis dalam bahasa apa pun — Indonesia, Inggris, Jepang, Arab, Mandarin, dll — Bre AI otomatis menjawab dalam bahasa yang sama! 🌐
• *Semua Jenis Pesan Diterima:* Teks, foto, suara/audio, video, berkas kode, lokasi, kontak, stiker, dan GIF.
• *Pesan Non-Teks Interaktif:* Anda dapat menyuruh Bre AI membuat file kodingan unduhan, kuis/polling, lempar dadu/game, pin lokasi peta, dan kartu kontak secara alami!
• *Ingatan Konteks:* Bre AI mengingat konteks percakapan secara berkelanjutan.
• *Perintah /reset:* Membersihkan ingatan topik sebelumnya dan memulai sesi baru.

🌍 *Contoh Bahasa Otomatis:*
_• Tulis "halo bre" → Bre AI jawab GAUL Bahasa Indonesia 🇮🇩_
_• Write "hello bre" → Bre AI replies in English 🇺🇸_
_• 「Bre、こんにちは」 → Bre AI returns in Japanese 🇯🇵_

🎮 *Perintah Pintas Media Interaktif:*
• \`/dice\` atau \`/dadu\` - Lempar dadu animasi 🎲
• \`/dart\`, \`/basket\`, \`/bola\`, \`/bowling\`, \`/slot\` - Game animasi seru
• \`/poll [Pertanyaan] | [Opsi 1] | [Opsi 2] ...\` - Buat Polling Telegram
• \`/quiz [Pertanyaan] | [Opsi A] | [Opsi B*] ...\` - Buat Kuis Interaktif
• \`/file [nama_file.ext] [isi kode]\` - Buat & kirim berkas file fisik
• \`/location [lat, lon] | [Tempat] | [Alamat]\` - Kirim pin lokasi peta
• \`/contact [nomor] [Nama Depan] [Nama Belakang]\` - Kirim kartu kontak

⚡ *Perintah Pintas & Fitur Baru:*
🌅 /motivasi [topik] — Dapatkan kutipan motivasi orisinil dari Bre AI
⚡ /remind [pesan] dalam X menit — Pengingat otomatis
⏰ /listremind — Lihat daftar pengingat aktif
❌ /cancelreminder [ID] — Batalkan pengingat
📊 /mystats — Statistik penggunaan Bre AI-mu
🎤 /tts [teks] — Ubah teks menjadi suara
🖼️ /image [deskripsi] — Buat gambar dari teks

🎭 *Gaya Bahasa Indonesia Aktif:* ${styleLabel}
_Gaya ini berlaku untuk semua respons Bahasa Indonesia Bre AI._
Pencipta & Pengembang: *Amirun Rayan Ariandi* 🚀`;

    if (isOwnerUser) {
      help += `\n\n👑 *Daftar Perintah Admin (Owner):*\n` +
        `• \`/admin\` - Buka Master Control Panel Interaktif\n` +
        `• \`/style [gaya]\` - *Ganti gaya bahasa Indonesia global* (jakarta, jawa_halus, jawa_kasar, sunda, sopan, santai, medan, makassar)\n` +
        `• \`/status\` - Ringkasan status bot & engine\n` +
        `• \`/metrics\` - Laporan metrik real-time & token\n` +
        `• \`/logs\` - Lihat 5 log server terakhir\n` +
        `• \`/providers\` - Daftar endpoint AI & status routing\n` +
        `• \`/addprovider [nama] [url] [key] [model]\` - Tambah provider manual\n` +
        `• \`/editprovider [idx/nama] [field] [nilai]\` - Edit provider (url/key/model/name/weight)\n` +
        `• \`/seturl [idx/nama] [url]\` - Ganti endpoint Base URL provider\n` +
        `• \`/setmodel [idx/nama] [model]\` - Ganti model AI provider\n` +
        `• \`/setkey [idx/nama] [key]\` - Ganti API Key utama provider\n` +
        `• \`/setname [idx/nama] [nama]\` - Ganti nama label provider\n` +
        `• \`/setweight [idx/nama] [bobot]\` - Atur bobot prioritas provider\n` +
        `• \`/addkey [idx/nama] [key]\` - Tambah API key tambahan (rotasi)\n` +
        `• \`/delkey [idx/nama] [key_idx]\` - Hapus API key dari provider\n` +
        `• \`/delprovider [idx/nama]\` - Hapus provider dari router\n` +
        `• \`/setrouting [auto|priority|weighted]\` - Atur rotasi provider (AUTO bergantian)\n` +
        `• \`/benchmark\` - Uji kecepatan paralel semua provider\n` +
        `• \`/setmode [public|diizinkan]\` - Ubah mode akses bot\n` +
        `• \`/settemp [0.0-2.0]\` - Ubah suhu kreativitas\n` +
        `• \`/setprompt [teks]\` - Ganti Master System Prompt\n` +
        `• \`/setpassword [pass]\` - Ganti password Web Admin\n` +
        `• \`/izinkan [id/@user] [nama]\` - Tambah user ke daftar diizinkan\n` +
        `• \`/blokir [id/@user]\` - Blokir user\n` +
        `• \`/batalizin [id/@user]\` - Hapus dari daftar perizinan\n` +
        `• \`/pengguna\` - Lihat daftar user terdaftar\n` +
        `• \`/blacklist [add|list|clear]\` - Kelola kata terlarang\n` +
        `• \`/export\` - Unduh berkas backup config.json\n` +
        `• \`/clearcache\` - Bersihkan cache RAM & sesi\n` +
        `• \`/broadcast [pesan]\` - Kirim pesan siaran massal`;
    }

    await api.sendTelegramMessage(chatId, help, null, null, token);
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
