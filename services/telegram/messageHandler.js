// ========================================================
// Bre AI v3.0 - Telegram Message Handler & Router Query
// Modular routing for chat, media, commands, and documents
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig, logRequest } = require('../../api/_shared');
const {
  sendTelegramMessage,
  sendTyping,
  downloadTelegramFile
} = require('./api');
const {
  recordRecentUser,
  isOwner,
  isUserAllowed,
  recentUsers
} = require('./accessControl');
const { sendAdminPanel } = require('./adminMenu');

// Query internal Bre AI router (works both on Localhost and Vercel Serverless)
function queryBreAIRouter(userText, history = [], senderInfo = '') {
  return new Promise(async (resolve, reject) => {
    try {
      const chatHandler = require('../../api/chat');
      const cfg = getConfig();
      const model = cfg.telegramModel || cfg.model || 'mercury-2';

      const EventEmitter = require('events');
      const mockReq = Object.assign(new EventEmitter(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-custom-provider': 'Telegram Bot'
        },
        body: {
          model: model,
          messages: history,
          stream: false,
          customSystemPrompt: `Anda sedang melayani pengguna Telegram ${senderInfo}.
[PANDUAN FORMAT TAMPILAN TELEGRAM]:
- DILARANG KERAS menggunakan tag HTML apa pun (JANGAN gunakan <br>, <p>, <div>, <script>, dll). Gunakan baris baru biasa (Enter/newline) untuk jeda antar-kalimat.
- DILARANG membuat tabel markdown (| kolom | kolom |) karena Telegram ponsel tidak mendukung tabel dan tampilannya akan berantakan.
- GANTILAH TABEL dengan format daftar poin/bullet points (• atau -) dengan judul tebal (*Judul*) yang ringkas, rapi, dan mudah dibaca di layar HP.
- Gunakan format Telegram Markdown yang sah: *teks tebal*, _teks miring_, \`kode ringkas\`, dan \`\`\`blok kode\`\`\`.`
        },
        socket: { remoteAddress: '127.0.0.1' }
      });

      const mockRes = {
        statusCode: 200,
        setHeader: () => {},
        writeHead: (code) => { mockRes.statusCode = code; },
        status: (code) => { mockRes.statusCode = code; return mockRes; },
        end: (data) => {
          if (mockRes.statusCode >= 400) reject(new Error(data || `Error ${mockRes.statusCode}`));
        },
        json: (data) => {
          if (mockRes.statusCode >= 400) {
            reject(new Error(data?.error || `Error ${mockRes.statusCode}`));
          } else if (data?.choices?.[0]?.message?.content) {
            resolve(data.choices[0].message.content);
          } else {
            reject(new Error('Format jawaban tidak sesuai'));
          }
        }
      };

      await chatHandler(mockReq, mockRes);
    } catch (err) {
      reject(err);
    }
  });
}

// Broadcast announcement to all known users
async function handleBroadcastCommand(chatId, fromUser, broadcastText, botService) {
  const token = botService.activeToken || null;
  if (!isOwner(fromUser, botService.activeOwnerId)) {
    await sendTelegramMessage(chatId, '⛔ Perintah siaran hanya dapat dijalankan oleh Owner.', null, null, token);
    return;
  }

  const messageToSend = broadcastText.trim();
  if (!messageToSend) {
    await sendTelegramMessage(
      chatId,
      '📢 *Panduan Format Broadcast:*\n\nGunakan format:\n`/broadcast [isi pesan siaran]`\n\n_Contoh:_\n`/broadcast Halo! Kami baru saja memperbarui kecerdasan Bre AI ke versi terbaru 🚀`',
      null, null, token
    );
    return;
  }

  // Collect target recipients: recentUsers + telegramUsers from config
  const cfg = getConfig();
  const recipientIds = new Set();

  for (const [uid] of recentUsers) {
    recipientIds.add(Number(uid));
  }
  if (Array.isArray(cfg.telegramUsers)) {
    for (const u of cfg.telegramUsers) {
      if (u.id && !isNaN(Number(u.id)) && u.role !== 'blocked') {
        recipientIds.add(Number(u.id));
      }
    }
  }

  if (recipientIds.size === 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ *Tidak Ada Penerima Siaran*\n\nBelum ada pengguna lain yang berinteraksi dengan bot sejak server aktif.',
      null, null, token
    );
    return;
  }

  await sendTelegramMessage(chatId, `🚀 *Memulai Pengiriman Siaran...*\nTarget penerima: ${recipientIds.size} pengguna.`, null, null, token);

  let successCount = 0;
  let failCount = 0;
  const formattedBroadcast = `📢 *PENGUMUMAN RESMI BRE AI*\n\n${messageToSend}\n\n— _Pesan dari Pengelola Bot_`;

  for (const targetId of recipientIds) {
    // Avoid sending broadcast to the owner executing it
    if (String(targetId) === String(fromUser.id)) continue;

    try {
      await sendTelegramMessage(targetId, formattedBroadcast, null, null, token);
      successCount++;
      // Brief pause to honor Telegram rate limits (30 msgs/sec)
      await new Promise(r => setTimeout(r, 60));
    } catch (err) {
      failCount++;
    }
  }

  await sendTelegramMessage(
    chatId,
    `✅ *Laporan Siaran Broadcast Selesai*\n\n` +
    `• Berhasil terkirim: *${successCount} pengguna*\n` +
    `• Gagal terkirim: *${failCount} pengguna* (kemungkinan memblokir bot)\n` +
    `• Total target: *${recipientIds.size} akun*`,
    null, null, token
  );
}

// Master Message Handler
async function handleMessage(msg, botService, ctx = null) {
  if (!msg || !msg.chat) return;

  if (ctx) {
    if (ctx.token) botService.activeToken = ctx.token;
    if (ctx.ownerId) botService.activeOwnerId = ctx.ownerId;
    if (ctx.accessMode) botService.activeAccessMode = ctx.accessMode;
  }

  const chatId = msg.chat.id;
  const fromUser = msg.from || {};
  const senderName = fromUser.first_name || fromUser.username || 'Sahabat';
  const senderTag = fromUser.username ? `@${fromUser.username}` : `ID:${fromUser.id}`;
  const token = botService.activeToken || null;

  // Track user in memory
  recordRecentUser(fromUser);

  // Check Whitelist / Blocked Access
  if (!isUserAllowed(fromUser, botService.activeOwnerId, botService.activeAccessMode)) {
    await sendTelegramMessage(
      chatId,
      `⚠️ *Akses Dibatasi*\n\nMaaf ${senderName}, bot ini saat ini berada dalam mode khusus. Akun Anda (${senderTag}) belum terdaftar dalam whitelist. Silakan hubungi pemilik bot untuk meminta izin akses.`,
      null, null, token
    );
    return;
  }

  let text = (msg.text || '').trim();

  // 1. STICKER
  if (msg.sticker) {
    const emoji = msg.sticker.emoji || '😄';
    await sendTelegramMessage(
      chatId,
      `👋 ${emoji} Terima kasih stikernya! Ada pertanyaan, analisis kode, atau tugas yang bisa Bre AI bantu hari ini?`,
      null, null, token
    );
    return;
  }

  // 2. VOICE / AUDIO
  if (msg.voice || msg.audio) {
    const caption = (msg.caption || '').trim();
    if (caption) {
      text = `[Pengguna melampirkan pesan audio dengan catatan]: ${caption}`;
    } else {
      await sendTelegramMessage(
        chatId,
        `🎙️ *Pesan Suara Diterima*\n\nBre AI saat ini berfokus pada pemrosesan teks dan dokumen kode. Silakan ketikkan pertanyaan atau topik Anda melalui pesan teks agar saya dapat membantu secara maksimal!`,
        null, null, token
      );
      return;
    }
  }

  // 3. VIDEO / VIDEO NOTE
  if (msg.video || msg.video_note) {
    const caption = (msg.caption || '').trim();
    if (caption) {
      text = `[Pengguna melampirkan video dengan catatan]: ${caption}`;
    } else {
      await sendTelegramMessage(
        chatId,
        `🎬 *Video Diterima*\n\nBre AI saat ini berfokus pada asisten percakapan teks, pemrograman, dan penulisan dokumen. Silakan tanyakan hal yang ingin Anda diskusikan melalui teks!`,
        null, null, token
      );
      return;
    }
  }

  // 4. PHOTO
  if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
    const caption = (msg.caption || '').trim();
    if (caption) {
      text = `[Pengguna melampirkan gambar/foto dengan keterangan]: ${caption}`;
    } else {
      await sendTelegramMessage(
        chatId,
        `📷 *Foto Diterima!*\n\nSaya telah menerima foto yang Anda kirimkan. Saat ini model AI utama berfokus pada pemrosesan teks, kode, dan logika.\n\n💡 *Tips:* Anda bisa mengirim ulang foto dengan menyertakan teks *caption* (misal: _"Tuliskan caption untuk foto ini"_ atau _"Jelaskan konsep gambar ini"_) agar saya dapat membantu Anda!`,
        null, null, token
      );
      return;
    }
  }

  // 5. DOCUMENT / FILE (Direct code/text analysis)
  if (msg.document) {
    const doc = msg.document;
    const fileName = doc.file_name || 'file.txt';
    const caption = (msg.caption || '').trim();
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const textExts = ['txt', 'py', 'js', 'json', 'md', 'html', 'css', 'sql', 'sh', 'ts', 'csv', 'xml', 'yaml', 'yml', 'c', 'cpp', 'java', 'rs', 'go', 'php', 'env', 'bat'];

    if (textExts.includes(ext) && (doc.file_size || 0) <= 250000) { // <= 250 KB
      await sendTyping(chatId, token);
      try {
        const buf = await downloadTelegramFile(doc.file_id, token);
        const content = buf.toString('utf-8');
        const snippet = content.length > 12000 ? content.slice(0, 12000) + '\n... [dipotong karena terlalu panjang]' : content;
        text = caption
          ? `[Pengguna melampirkan file dokumen: "${fileName}"]:\n\`\`\`${ext}\n${snippet}\n\`\`\`\n\nPertanyaan/Instruksi dari pengguna:\n${caption}`
          : `[Pengguna melampirkan file dokumen: "${fileName}"]:\n\`\`\`${ext}\n${snippet}\n\`\`\`\n\nJelaskan isi file ini, analisislah strukturnya, dan berikan ringkasan atau poin-poin pentingnya.`;
      } catch (err) {
        console.error('[TelegramBot] Gagal download file teks:', err.message);
        await sendTelegramMessage(chatId, `⚠️ Gagal membaca berkas \`${fileName}\`: ${err.message}`, null, null, token);
        return;
      }
    } else {
      const sizeStr = doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Dokumen';
      const captionNote = caption ? `\n\nCatatan Anda: "${caption}"` : '';
      await sendTelegramMessage(
        chatId,
        `📄 *Berkas Diterima: \`${fileName}\`* (${sizeStr})${captionNote}\n\n` +
        `💡 *Tips:* Bre AI dapat membaca dan menganalisis berkas kode/teks langsung (.txt, .py, .js, .json, .md, .csv, dll). Untuk berkas biner/PDF/Word, silakan salin teks penting ke dalam pesan teks agar dapat dianalisis!`,
        null, null, token
      );
      return;
    }
  }

  // 6. CONTACT / LOCATION
  if (msg.location) {
    await sendTelegramMessage(chatId, `📍 *Lokasi Diterima* (Lat: ${msg.location.latitude}, Long: ${msg.location.longitude}). Ada hal yang ingin ditanyakan seputar lokasi ini?`, null, null, token);
    return;
  }
  if (msg.contact) {
    await sendTelegramMessage(chatId, `👤 *Kontak Diterima* (${msg.contact.first_name || ''} ${msg.contact.phone_number || ''}). Kontak tersimpan di riwayat obrolan.`, null, null, token);
    return;
  }

  // Empty text check
  if (!text) {
    await sendTelegramMessage(chatId, `💬 Pesan diterima. Kirimkan teks, pertanyaan, atau lampiran dokumen teks untuk mulai berdiskusi.`, null, null, token);
    return;
  }

  // Command: /broadcast [pesan]
  if (text === '/broadcast' || text.startsWith('/broadcast ')) {
    const broadcastBody = text.slice(10).trim();
    await handleBroadcastCommand(chatId, fromUser, broadcastBody, botService);
    return;
  }

  // Command: /admin
  if (text === '/admin' || text.startsWith('/admin ')) {
    if (!isOwner(fromUser, botService.activeOwnerId)) {
      await sendTelegramMessage(
        chatId,
        `⛔ *Akses Ditolak*\n\nPerintah \`/admin\` hanya dapat diakses secara eksklusif oleh *Pemilik Bot (Owner)*.\n\nJika Anda adalah pemilik sistem, daftarkan ID Telegram Anda di tab *Telegram Bot* pada web panel [Bre AI Control Center](http://localhost:3000/admin).`,
        null, null, token
      );
      return;
    }
    await sendAdminPanel(chatId, senderName, botService.conversations.size, token);
    return;
  }

  // Command: /start
  if (text === '/start' || text.startsWith('/start ')) {
    botService.conversations.delete(chatId);
    const isOwnerUser = isOwner(fromUser, botService.activeOwnerId);
    let welcome = `⚡ *Halo ${senderName}!* Selamat datang di *Bre AI*.\n\n` +
      `Saya adalah kecerdasan buatan ciptaan *Amirun Rayan Ariandi*, siap membantu Anda menjawab berbagai pertanyaan, menganalisis kode program, hingga membuat dokumen langsung dari Telegram.\n\n` +
      `📌 *Panduan Interaksi:*\n` +
      `• Kirim pesan apa pun untuk langsung mengobrol.\n` +
      `• Kirim /reset untuk membersihkan topik percakapan.\n` +
      `• Kirim /help untuk panduan penggunaan.\n`;

    if (isOwnerUser) {
      welcome += `\n👑 *Akses Pemilik (Owner):*\nKirim perintah */admin* untuk membuka panel kontrol interaktif!`;
    }

    await sendTelegramMessage(chatId, welcome, null, null, token);
    return;
  }

  // Command: /help
  if (text === '/help') {
    const isOwnerUser = isOwner(fromUser, botService.activeOwnerId);
    let help = `📖 *Panduan Penggunaan Bre AI di Telegram*\n\n` +
      `• *Obrolan Alami:* Anda bisa bertanya apa saja dalam bahasa Indonesia, Inggris, atau bahasa lainnya secara santai.\n` +
      `• *Ingatan Konteks:* Bre AI mengingat percakapan Anda sehingga Anda dapat berdiskusi secara berkelanjutan.\n` +
      `• *Perintah /reset:* Gunakan saat ingin mengganti topik obrolan agar ingatan topik sebelumnya tidak bercampur.\n` +
      `• *Kode & Dokumen:* Bre AI dapat menuliskan kode lengkap atau dokumen kerja secara rapi.\n\n` +
      `Pencipta & Pengembang: *Amirun Rayan Ariandi* 🚀`;

    if (isOwnerUser) {
      help += `\n\n👑 *Panel Admin:* Kirim \`/admin\` untuk membuka menu tombol kontrol bot.\n📢 *Siaran Broadcast:* Kirim \`/broadcast [pesan]\` untuk mengirim pesan massal ke seluruh pengguna.`;
    }

    await sendTelegramMessage(chatId, help, null, null, token);
    return;
  }

  // Command: /reset or /clear
  if (text === '/reset' || text === '/clear') {
    botService.conversations.delete(chatId);
    await sendTelegramMessage(chatId, `✨ *Riwayat percakapan berhasil dibersihkan!* Anda sekarang berada di sesi obrolan baru.`, null, null, token);
    return;
  }

  // Command: /status
  if (text === '/status') {
    const cfg = getConfig();
    const statusMsg = `📊 *Status Sistem Bre AI Router*\n\n` +
      `• Bot: @${botService.botInfo?.username || 'BreAI_Bot'}\n` +
      `• Model Aktif: \`${cfg.telegramModel || cfg.model || 'mercury-2'}\`\n` +
      `• Auto-Failover: *${cfg.autoFailover !== false ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `• Response Cache: *${cfg.cacheEnabled ? '⚡ Aktif' : '⚪ Nonaktif'}*\n` +
      `• Sesi Aktif: ${botService.conversations.size} percakapan`;
    await sendTelegramMessage(chatId, statusMsg, null, null, token);
    return;
  }

  // Regular Chat Flow
  await sendTyping(chatId, token);

  const typingInterval = setInterval(() => {
    sendTyping(chatId, token);
  }, 4000);

  try {
    let history = botService.conversations.get(chatId) || [];
    history.push({ role: 'user', content: text });

    if (history.length > botService.MAX_HISTORY) {
      history = history.slice(-botService.MAX_HISTORY);
    }

    const answer = await queryBreAIRouter(text, history, senderTag);
    clearInterval(typingInterval);

    history.push({ role: 'assistant', content: answer });
    botService.conversations.set(chatId, history);

    await sendTelegramMessage(chatId, answer, null, null, token);
  } catch (err) {
    clearInterval(typingInterval);
    console.error('[TelegramBot] Error querying Bre AI:', err.message);
    await sendTelegramMessage(
      chatId,
      `⚠️ *Gagal Memproses Permintaan*\n\nTerjadi kendala saat menghubungi engine AI: ${err.message}`,
      null, null, token
    );
  }
}

module.exports = {
  queryBreAIRouter,
  handleBroadcastCommand,
  handleMessage
};
