// ========================================================
// Bre AI v3.0 - Telegram Message Coordinator
// Clean, Modular Coordinator for Telegram Bot Interactions
// Created by Amirun Rayan Ariandi
// ========================================================

const {
  getConfig,
  STYLE_LABELS,
  STYLE_PROMPTS
} = require('../../api/_shared');

const api = require('./api');
const {
  recordRecentUser,
  isOwner,
  isUserAllowed,
  isUserRegistered,
  notifyOwnerNewUser
} = require('./accessControl');

const {
  chatLanguages,
  chatStyles,
  LANGUAGE_OPTIONS,
  getUserLanguage,
  saveUserLanguage,
  getUserStyle,
  saveUserStyle,
  resolveLanguageCode,
  getFileCategory
} = require('./constants');

const {
  extractForwardOrigin,
  buildForwardGuidance
} = require('./forwardHandler');

const {
  processAndSendOutboundMedia
} = require('./mediaProcessor');

const {
  handleSlashCommand,
  handleBroadcastCommand
} = require('./commandHandler');

/**
 * Query internal Bre AI router (works seamlessly on Localhost, Serverless, and VPS)
 * @param {string|Array} userContent - Text prompt or vision payload
 * @param {Array} history - Previous conversation turns
 * @param {string} senderInfo - Sender identifier tag
 * @param {string|null} langCode - Language override code
 * @param {string|null} styleCode - Style/dialect override code
 * @returns {Promise<string>} AI response text
 */
function queryBreAIRouter(userContent, history = [], senderInfo = '', langCode = null, styleCode = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const chatHandler = require('../../api/chat');
      const cfg = getConfig();
      const model = cfg.telegramModel || cfg.model || 'mercury-2';

      const lastUserMessage = {
        role: 'user',
        content: userContent
      };

      const effectiveLang = (langCode || cfg.telegramLanguage || 'id').toLowerCase().trim();
      const langEntry = LANGUAGE_OPTIONS[effectiveLang] || LANGUAGE_OPTIONS['id'];
      const isIndonesian = effectiveLang === 'id';

      // For Indonesian -> GAUL by default. For foreign languages -> formal Bre AI
      const effectiveStyle = isIndonesian
        ? ((styleCode && styleCode !== 'default' && styleCode !== 'standar') ? styleCode : 'jakarta')
        : 'formal';

      let customSystemPrompt = '';
      if (isIndonesian) {
        customSystemPrompt = `[PLATFORM TELEGRAM - PENGGUNA ${senderInfo}]:
- Gaya Respons: Bahasa Indonesia GAUL & SANTAI khas anak muda Indonesia yang akrab, luwes, seru, dan cerdas.
- Gunakan format Telegram Markdown yang sah: *teks tebal*, _teks miring_, \`kode ringkas\`, dan \`\`\`blok kode\`\`\`.
- DILARANG menggunakan tag HTML (<br>, <div>, dll) dan jangan gunakan tabel markdown bergaris (gantilah dengan daftar poin • yang rapi).
[KEMAMPUAN FITUR NON-TEKS & FILE TELEGRAM (100% PASTI BISA)]:
1. Buat Berkas File Unduhan Asli (.py, .js, .html, .css, .json, .csv, .txt, dll):
   Tuliskan isi lengkap di dalam blok kode dengan nama berkas di baris pertama ATAU gunakan tag:
   [TELEGRAM_FILE: {"filename": "nama_berkas.ext", "content": "...isi lengkap...", "caption": "Keterangan"}]
2. Polling/Kuis Telegram: [TELEGRAM_POLL: {"question": "...", "options": ["A", "B"]}]
3. Dadu/Game: [TELEGRAM_DICE: 🎲] (pilihan: 🎲, 🎯, 🏀, ⚽, 🎳, 🎰)
4. Pin Lokasi: [TELEGRAM_LOCATION: {"latitude": -6.2, "longitude": 106.8, "title": "Tempat", "address": "Alamat"}]
5. Kartu Kontak: [TELEGRAM_CONTACT: {"phone_number": "+628123456789", "first_name": "Nama"}]
6. Foto Web: [TELEGRAM_PHOTO: {"url": "https://...", "caption": "Foto"}]`;
      } else {
        customSystemPrompt = `[TELEGRAM PLATFORM INSTRUCTIONS - ${langEntry.name.toUpperCase()}]:
- Target Output: Strictly 100% in ${langEntry.name.toUpperCase()} (${langEntry.nativeName || langEntry.name}).
- Tone: FORMAL, POLITE, INTELLIGENT, AND PROFESSIONAL (Standard Formal Bre AI).
- Use standard Telegram Markdown (*bold*, _italic_, \`code\`, \`\`\`code blocks\`\`\`).
- Do NOT use HTML tags and do NOT use markdown tables (use bullet points • instead).
[TELEGRAM INTERACTIVE FEATURES & FILE GENERATION]:
1. Real Downloadable Files & Scripts (100% Supported):
   Provide the complete, functional, and untruncated code in a code block with filename on line 1 OR use tag:
   [TELEGRAM_FILE: {"filename": "filename.ext", "content": "...", "caption": "..."}]
2. Polls / Quizzes: [TELEGRAM_POLL: {"question": "...", "options": ["A", "B"]}]
3. Animated Dice / Games: [TELEGRAM_DICE: 🎲]
4. Location Pin: [TELEGRAM_LOCATION: {"latitude": -6.2, "longitude": 106.8, "title": "Place", "address": "Address"}]
5. Contact Card: [TELEGRAM_CONTACT: {"phone_number": "+123456789", "first_name": "Name"}]
6. Web Photo: [TELEGRAM_PHOTO: {"url": "https://...", "caption": "Caption"}]`;
      }

      const EventEmitter = require('events');
      const mockReq = Object.assign(new EventEmitter(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-custom-provider': 'Telegram Bot',
          'x-custom-style': effectiveStyle,
          'x-custom-language': effectiveLang
        },
        body: {
          model: model,
          style: effectiveStyle,
          language: effectiveLang,
          messages: [...history, lastUserMessage],
          stream: false,
          customSystemPrompt
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

/**
 * Master Message Handler coordinating message ingestion, permission, commands, and AI routing
 * @param {object} msg - Incoming Telegram message object
 * @param {object} botService - Telegram Bot Service instance
 * @param {object|null} ctx - Optional context overrides (token, ownerId, accessMode)
 */
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
  const isOwnerUser = isOwner(fromUser, botService.activeOwnerId);

  // Track user in memory
  recordRecentUser(fromUser);

  let text = (msg.text || '').trim();
  let userQueryPrompt = '';
  let historyDisplaySnippet = '';
  let visionPayload = null;

  // 1. EXTRACT REPLIED / QUOTED CONTEXT
  let replyPrefix = '';
  if (msg.reply_to_message) {
    const rep = msg.reply_to_message;
    const repSender = rep.from?.first_name || rep.from?.username || (rep.from?.is_bot ? 'Bre AI' : 'Pengguna');
    const repText = rep.text || rep.caption || (rep.photo ? '[Foto]' : (rep.document ? '[Dokumen]' : ''));
    if (repText) {
      replyPrefix = `[Konteks: Membalas pesan ${repSender}: "${repText.slice(0, 200)}"]\n\n`;
    }
  }

  // 2. EXTRACT FORWARDED CONTEXT (Bot API 7.0+ & Classic)
  const forwardInfo = extractForwardOrigin(msg);
  let forwardPrefix = '';
  let forwardGuidance = '';

  if (forwardInfo) {
    forwardPrefix = `${forwardInfo.header}\n`;
    forwardGuidance = buildForwardGuidance(forwardInfo);
  }

  // 3. DETECT INBOUND MESSAGE TYPE & CONSTRUCT AI PROMPT
  if (msg.sticker) {
    const emoji = msg.sticker.emoji || '😄';
    const setName = msg.sticker.set_name || 'Sticker';
    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna mengirimkan stiker Telegram dengan ekspresi/emoji: "${emoji}" (set stiker: "${setName}")]. Responlah stiker ini secara ramah, ekspresif, cerdas, dan interaktif sebagai Bre AI.`;
    historyDisplaySnippet = forwardInfo ? `[Stiker Terusan dari ${forwardInfo.sourceName}: ${emoji}]` : `[Stiker Telegram: ${emoji}]`;
  } else if (msg.voice || msg.audio) {
    const isVoice = !!msg.voice;
    const audioObj = msg.voice || msg.audio;
    const duration = audioObj.duration || 0;
    const caption = (msg.caption || '').trim();
    const title = msg.audio?.title ? ` (Judul: "${msg.audio.title}", Artis: "${msg.audio.performer || 'Unknown'}")` : '';

    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna mengirimkan rekaman ${isVoice ? 'suara (Voice Note)' : 'audio/musik'}${title}, Durasi: ${duration} detik, Catatan: "${caption || '(tanpa catatan teks)'}"]. Responlah pesan suara/audio ini dengan ramah, apresiatif, cerdas, dan tawarkan bantuan yang relevan sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
    historyDisplaySnippet = forwardInfo
      ? `[${isVoice ? 'Voice Note' : 'Audio'} Terusan dari ${forwardInfo.sourceName} (${duration}s)]: ${caption || 'Rekaman Suara'}`
      : `[${isVoice ? 'Voice Note' : 'Audio'} (${duration}s)]: ${caption || 'Rekaman Suara'}`;
  } else if (msg.video || msg.video_note) {
    const isRound = !!msg.video_note;
    const vidObj = msg.video || msg.video_note;
    const duration = vidObj.duration || 0;
    const caption = (msg.caption || '').trim();
    const dims = msg.video ? ` (${msg.video.width}x${msg.video.height})` : '';

    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna mengirimkan ${isRound ? 'Video Bulat (Video Note)' : 'Video'}${dims}, Durasi: ${duration} detik, Catatan: "${caption || '(tanpa keterangan)'}"]. Berikan tanggapan yang apresiatif, cerdas, dan tanyakan apa yang ingin dibahas atau dibantu terkait video tersebut sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
    historyDisplaySnippet = forwardInfo
      ? `[Video Terusan dari ${forwardInfo.sourceName} (${duration}s)]: ${caption || 'Video'}`
      : `[Video (${duration}s)]: ${caption || 'Video'}`;
  } else if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
    const caption = (msg.caption || '').trim();
    const questionText = `${replyPrefix}${forwardPrefix}${caption ? `Keterangan/Instruksi: "${caption}"\n\n` : ''}Deskripsikan, analisis, dan jelaskan isi gambar/foto ini secara lengkap, rinci, dan terstruktur sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
    historyDisplaySnippet = forwardInfo
      ? `[Foto Terusan dari ${forwardInfo.sourceName}]: ${caption || 'Analisis Gambar'}`
      : `[Foto]: ${caption || 'Analisis Gambar'}`;

    try {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      const buf = await api.downloadTelegramFile(largestPhoto.file_id, token);
      const base64Image = buf.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      visionPayload = [
        { type: 'text', text: questionText },
        { type: 'image_url', image_url: { url: dataUrl } }
      ];
    } catch (e) {
      console.warn('[TelegramBot] Gagal download foto untuk vision:', e.message);
      userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna melampirkan foto dengan keterangan: "${caption || 'Mohon analisis gambar ini'}"] (Catatan: file biner tidak dapat diunduh sementara). Jawablah dan berikan panduan relevan sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
    }
  } else if (msg.document) {
    const doc = msg.document;
    const fileName = doc.file_name || 'berkas.bin';
    const caption = (msg.caption || '').trim();
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const category = getFileCategory(fileName, doc.mime_type);
    const sizeBytes = doc.file_size || 0;
    const sizeStr = sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;
    const mime = doc.mime_type || 'application/octet-stream';

    // If file is within text-read limit (up to 1MB), attempt to read content
    if (sizeBytes <= 1048576 && (category === 'code_or_text' || ext === '' || !ext)) {
      try {
        const buf = await api.downloadTelegramFile(doc.file_id, token);
        const isText = !buf.slice(0, 1000).includes(0);
        if (isText) {
          const content = buf.toString('utf-8');
          const snippet = content.length > 16000 ? content.slice(0, 16000) + '\n... [dipotong karena terlalu panjang]' : content;
          userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna melampirkan berkas teks/kode: "${fileName}" (Ukuran: ${sizeStr}, Format: .${ext || 'txt'})]:\n\`\`\`${ext || 'text'}\n${snippet}\n\`\`\`\n\nInstruksi/Pertanyaan dari pengguna:\n${caption || 'Analisis dan jelaskan isi berkas ini secara rinci, periksa kualitas/logika/strukturnya, dan berikan evaluasi atau solusi terbaik sebagai Bre AI.'}${forwardGuidance ? '\n' + forwardGuidance : ''}`;
          historyDisplaySnippet = forwardInfo
            ? `[Berkas Terusan dari ${forwardInfo.sourceName}]: ${fileName} (${sizeStr})`
            : `[Berkas ${fileName} (${sizeStr})]: ${caption || 'Analisis Berkas'}`;
        } else {
          userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna melampirkan berkas biner: "${fileName}" (Kategori: ${category}, Ukuran: ${sizeStr}, MIME: ${mime}) dengan catatan: "${caption || 'Mohon berikan panduan terkait berkas ini.'}"]. Berikan panduan teknis, jelaskan fungsi/struktur berkas tersebut, dan berikan saran atau evaluasi komprehensif sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
          historyDisplaySnippet = forwardInfo
            ? `[Berkas Terusan dari ${forwardInfo.sourceName}]: ${fileName} (${sizeStr})`
            : `[Berkas ${fileName} (${sizeStr})]: ${caption || 'Panduan Berkas'}`;
        }
      } catch (err) {
        userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna melampirkan berkas: "${fileName}" (Kategori: ${category}, Ukuran: ${sizeStr}, MIME: ${mime})]. Instruksi pengguna: "${caption || 'Bahas berkas ini.'}". Responlah secara profesional, cerdas, dan solutif sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
        historyDisplaySnippet = forwardInfo
          ? `[Berkas Terusan dari ${forwardInfo.sourceName}]: ${fileName} (${sizeStr})`
          : `[Berkas: ${fileName} (${sizeStr})]`;
      }
    } else {
      const catDescriptions = {
        pdf_document: 'Dokumen Adobe PDF',
        word_document: 'Dokumen Microsoft Word / Dokumen Teks',
        spreadsheet: 'Dokumen Spreadsheet / Excel / Data Tabel',
        presentation: 'Dokumen Presentasi PowerPoint / Slide',
        archive: 'Arsip Terkompresi (ZIP/RAR/7Z/TAR/GZ)',
        executable_or_package: 'Paket Aplikasi / Installer / Eksekusi Biner (APK/EXE/DEB/DMG)',
        audio_file: 'Berkas Rekaman Audio / Musik',
        video_file: 'Berkas Rekaman Video / Animasi',
        image_file: 'Berkas Desain / Grafis / Gambar Resolusi Tinggi',
        general_file: 'Berkas Data / Dokumen Umum'
      };
      const catLabel = catDescriptions[category] || 'Berkas Dokumen';

      userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna melampirkan berkas: "${fileName}" (Jenis: ${catLabel}, Format: .${ext || 'file'}, Ukuran: ${sizeStr}, MIME: ${mime}) dengan catatan: "${caption || 'Mohon berikan analisis, panduan, atau informasi teknis terkait berkas ini.'}"]. Berikan tanggapan cerdas, jelaskan fungsi dan cara penanganan berkas tersebut, berikan panduan langkah demi langkah, dan tawarkan bantuan lanjutan sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
      historyDisplaySnippet = forwardInfo
        ? `[${catLabel} Terusan dari ${forwardInfo.sourceName}]: ${fileName} (${sizeStr})`
        : `[${catLabel}: ${fileName} (${sizeStr})]: ${caption || 'Panduan Berkas'}`;
    }
  } else if (msg.location || msg.venue) {
    const loc = msg.location || msg.venue?.location;
    const lat = loc?.latitude || 0;
    const lon = loc?.longitude || 0;
    const venueTitle = msg.venue?.title ? `Tempat: "${msg.venue.title}"` : '';
    const venueAddr = msg.venue?.address ? ` (Alamat: "${msg.venue.address}")` : '';

    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna membagikan titik lokasi GPS: Latitude ${lat}, Longitude ${lon} ${venueTitle}${venueAddr}]. Berikan informasi geografis, wilayah, zona waktu, atau hal menarik seputar lokasi ini, serta tawarkan bantuan terkait rute, analisis area, atau informasi lokal sebagai Bre AI.`;
    historyDisplaySnippet = forwardInfo
      ? `[Lokasi Terusan dari ${forwardInfo.sourceName}: ${lat}, ${lon} ${venueTitle}]`
      : `[Lokasi GPS: ${lat}, ${lon} ${venueTitle}]`;
  } else if (msg.contact) {
    const c = msg.contact;
    const cName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Kontak';
    const cPhone = c.phone_number || '';

    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna membagikan kartu kontak: "${cName}" (No. Telepon: ${cPhone})]. Berikan respon konfirmasi yang sopan, ramah, dan tanyakan bantuan apa yang diperlukan terkait kontak tersebut sebagai Bre AI.`;
    historyDisplaySnippet = forwardInfo
      ? `[Kontak Terusan dari ${forwardInfo.sourceName}: ${cName} (${cPhone})]`
      : `[Kartu Kontak: ${cName} (${cPhone})]`;
  } else if (msg.dice) {
    const emoji = msg.dice.emoji || '🎲';
    const val = msg.dice.value;
    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna melempar ${emoji} animasi Telegram dan mendapatkan angka/skor: ${val}]. Berikan reaksi atau komentar yang seru, interaktif, dan menyenangkan sebagai Bre AI.`;
    historyDisplaySnippet = `[Animasi ${emoji}: Skor ${val}]`;
  } else if (msg.poll) {
    const p = msg.poll;
    const q = p.question || 'Polling';
    const opts = (p.options || []).map(o => `• ${o.text}`).join('\n');
    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna membagikan polling Telegram: "${q}"\nOpsi Pilihan:\n${opts}]. Berikan analisis, pandangan objektif, atau argumen komprehensif terkait topik polling tersebut secara cerdas sebagai Bre AI.${forwardGuidance ? '\n' + forwardGuidance : ''}`;
    historyDisplaySnippet = forwardInfo
      ? `[Polling Terusan dari ${forwardInfo.sourceName}: "${q}"]`
      : `[Polling: "${q}"]`;
  } else if (msg.animation) {
    const caption = (msg.caption || '').trim();
    const dur = msg.animation.duration || 0;
    userQueryPrompt = `${replyPrefix}${forwardPrefix}[Pengguna mengirimkan animasi GIF (Durasi: ${dur} detik) dengan keterangan: "${caption || 'Ekspresi Ceria'}"]. Responlah animasi GIF ini secara asyik, ramah, dan interaktif sebagai Bre AI.`;
    historyDisplaySnippet = `[GIF Animasi: ${caption || 'Ekspresi'}]`;
  } else if (text) {
    if (forwardInfo) {
      userQueryPrompt = `${replyPrefix}${forwardPrefix}Isi Pesan Terusan:\n"""\n${text}\n"""${forwardGuidance}`;
      historyDisplaySnippet = `[Pesan Terusan dari ${forwardInfo.sourceName}]: ${text.slice(0, 100)}`;
    } else {
      userQueryPrompt = `${replyPrefix}${text}`;
      historyDisplaySnippet = text;
    }
  }

  // 4. ALERT OWNER IF NEW USER (First interaction)
  if (!isOwnerUser && !isUserRegistered(fromUser)) {
    notifyOwnerNewUser(fromUser, historyDisplaySnippet || text || '[Interaksi Baru]', botService).catch(() => {});
  }

  // 5. CHECK ACCESS PERMISSION (Allowed vs Public)
  if (!isUserAllowed(fromUser, botService.activeOwnerId, botService.activeAccessMode)) {
    const isRestricted = (botService.activeAccessMode || getConfig().telegramAccessMode) !== 'public';
    const rejectText = isRestricted
      ? `🔒 *Akses Memerlukan Izin*\n\nMaaf ${senderName}, bot ini saat ini dibatasi untuk pengguna yang telah diizinkan.\n\n🔔 Permintaan izin akses Anda telah otomatis diteruskan ke Pemilik Bot (Owner). Anda akan menerima pemberitahuan langsung begitu akses Anda disetujui!`
      : `⚠️ *Akses Ditolak*\n\nMaaf ${senderName}, akun Anda (${senderTag}) saat ini diblokir dari akses Bre AI. Silakan hubungi pemilik bot jika ini merupakan kekeliruan.`;

    await api.sendTelegramMessage(chatId, rejectText, null, null, token);
    return;
  }

  // 6. SLASH COMMAND ROUTING
  if (text && text.startsWith('/')) {
    const handled = await handleSlashCommand({
      msg,
      botService,
      text,
      chatId,
      fromUser,
      senderName,
      senderTag,
      token,
      isOwnerUser,
      queryBreAIRouter
    });
    if (handled) return;
  }

  // 7. CHECK USABLE PROMPT
  if (!userQueryPrompt && !visionPayload) {
    await api.sendTelegramMessage(chatId, `💬 Pesan diterima. Kirimkan pertanyaan, file, gambar, atau audio untuk berdiskusi dengan Bre AI.`, null, null, token);
    return;
  }

  // 8. UNIFIED AI ROUTING
  await api.sendTyping(chatId, token);

  const typingInterval = setInterval(() => {
    api.sendTyping(chatId, token);
  }, 4000);

  let loadingMsgId = null;
  try {
    const loadingRes = await api.sendTelegramMessage(chatId, '⏳ _Bre AI sedang memproses respons..._', null, null, token);
    if (loadingRes && loadingRes.message_id) {
      loadingMsgId = loadingRes.message_id;
    }
  } catch (e) {}

  try {
    let history = botService.conversations.get(chatId) || [];

    if (history.length >= botService.MAX_HISTORY) {
      history = history.slice(-(botService.MAX_HISTORY - 1));
    }

    const userAccountId = fromUser?.id || chatId;
    const chatLang = getUserLanguage(userAccountId) || getUserLanguage(chatId) || 'id';
    const chatStyle = getUserStyle(userAccountId) || getUserStyle(chatId) || 'jakarta';
    const contentToSend = visionPayload || userQueryPrompt;

    let answer = '';
    try {
      answer = await queryBreAIRouter(contentToSend, history, senderTag, chatLang, chatStyle);
    } catch (routeErr) {
      if (visionPayload) {
        console.warn('[TelegramBot] Vision request failed, falling back to text prompt:', routeErr.message);
        const fallbackText = userQueryPrompt || `[Pengguna mengirimkan foto/gambar]: ${text || 'Deskripsikan dan berikan analisis terkait gambar ini.'}`;
        answer = await queryBreAIRouter(fallbackText, history, senderTag, chatLang, chatStyle);
      } else {
        throw routeErr;
      }
    }

    clearInterval(typingInterval);

    // Record user interaction snippet and assistant response in conversation history
    history.push({ role: 'user', content: historyDisplaySnippet || userQueryPrompt });
    history.push({ role: 'assistant', content: answer });
    botService.conversations.set(chatId, history);

    // Deliver text & all interactive rich media outbound elements (guaranteed file creation)
    await processAndSendOutboundMedia(chatId, answer, token, loadingMsgId, userQueryPrompt || text);
  } catch (err) {
    clearInterval(typingInterval);
    console.error('[TelegramBot] Error querying Bre AI:', err.message);
    const errorMsg = `⚠️ *Gagal Memproses Permintaan*\n\nTerjadi kendala saat menghubungi engine AI: ${err.message}`;
    await api.sendTelegramMessage(chatId, errorMsg, null, null, token, loadingMsgId);
  }
}

module.exports = {
  queryBreAIRouter,
  handleBroadcastCommand,
  handleMessage,
  processAndSendOutboundMedia,
  extractForwardOrigin,
  chatLanguages,
  chatStyles,
  LANGUAGE_OPTIONS,
  STYLE_LABELS,
  getUserLanguage,
  saveUserLanguage,
  getUserStyle,
  saveUserStyle,
  resolveLanguageCode
};
