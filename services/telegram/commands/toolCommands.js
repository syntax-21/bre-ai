// ========================================================
// Bre AI v3.0 - Telegram Commands: AI Tools, Code, Media, File
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig } = require('../../../api/_shared');
const api = require('../api');
const { processAndSendOutboundMedia } = require('../mediaProcessor');
const { getUserLanguage, getUserStyle } = require('../constants');

async function handle(ctx) {
  const { msg, botService, text, lowerText, chatId, fromUser, senderName, senderTag, token, isOwnerUser, queryBreAIRouter } = ctx;


  // /dice, /dadu, /dart, /panah, /basket, /bola, /football, /bowling, /slot, /kasino
  if (['/dice', '/dadu', '/dart', '/panah', '/basket', '/bola', '/football', '/bowling', '/slot', '/kasino'].some(c => lowerText === c || lowerText.startsWith(c + ' '))) {
    const emojiMap = {
      '/dice': '🎲', '/dadu': '🎲',
      '/dart': '🎯', '/panah': '🎯',
      '/basket': '🏀',
      '/bola': '⚽', '/football': '⚽',
      '/bowling': '🎳',
      '/slot': '🎰', '/kasino': '🎰'
    };
    const cmd = lowerText.split(/\s+/)[0];
    const emoji = emojiMap[cmd] || '🎲';
    try {
      await api.sendTelegramDice(chatId, emoji, token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal melempar dadu/game: ${e.message}`, null, null, token);
    }
    return true;
  }


  // /poll [Pertanyaan] | [Opsi 1] | [Opsi 2] | [Opsi 3]...
  if (lowerText.startsWith('/poll')) {
    const rawArgs = text.slice(5).trim();
    const parts = rawArgs.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
      await api.sendTelegramMessage(
        chatId,
        `📊 *Panduan Format Polling Telegram:*\n\n` +
        `Gunakan format:\n\`/poll [Pertanyaan] | [Opsi 1] | [Opsi 2] | [Opsi 3]\`\n\n` +
        `_Contoh:_\n\`/poll Framework favorit Anda? | React | Vue | Next.js | Svelte\``,
        null, null, token
      );
      return true;
    }
    const question = parts[0];
    const options = parts.slice(1);
    try {
      await api.sendTelegramPoll(chatId, question, options, true, 'regular', null, '', token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal membuat polling: ${e.message}`, null, null, token);
    }
    return true;
  }


  // /quiz [Pertanyaan] | [Opsi 1] | [Opsi 2*] | [Opsi 3]...
  if (lowerText.startsWith('/quiz')) {
    const rawArgs = text.slice(5).trim();
    const parts = rawArgs.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
      await api.sendTelegramMessage(
        chatId,
        `🧠 *Panduan Format Kuis Interaktif Telegram:*\n\n` +
        `Gunakan format (tambahkan tanda \`*\` di ujung opsi yang benar):\n\`/quiz [Pertanyaan] | [Opsi A] | [Opsi B*] | [Opsi C]\`\n\n` +
        `_Contoh:_\n\`/quiz Siapa pencipta Bre AI? | Elon Musk | Amirun Rayan Ariandi* | Sam Altman\``,
        null, null, token
      );
      return true;
    }
    const question = parts[0];
    let correctIdx = 0;
    const cleanOptions = [];
    parts.slice(1).forEach((opt, idx) => {
      if (opt.endsWith('*')) {
        correctIdx = idx;
        cleanOptions.push(opt.slice(0, -1).trim());
      } else {
        cleanOptions.push(opt);
      }
    });

    try {
      await api.sendTelegramPoll(chatId, question, cleanOptions, false, 'quiz', correctIdx, 'Jawaban yang tepat!', token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal membuat kuis: ${e.message}`, null, null, token);
    }
    return true;
  }


  // /file [filename] [content...] or /file [prompt] or /buatfile [prompt]
  if (lowerText.startsWith('/file') || lowerText.startsWith('/buatfile')) {
    const raw = text.replace(/^\/(file|buatfile)/i, '').trim();

    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `📄 *Panduan Format Buat Berkas File:*\n\n` +
        `Anda dapat membuat berkas dengan 2 cara mudah:\n\n` +
        `*1. Buat Berkas Langsung (Instan):*\n` +
        `\`/file [nama_file.ext] [isi konten/kode]\`\n` +
        `_Contoh:_\n\`/file halo.py print("Halo dari Bre AI!")\`\n\n` +
        `*2. Minta Bre AI Menyusun File Otomatis:*\n` +
        `\`/file [nama_file.ext]\` (tanpa isi)\n` +
        `_Contoh:_ \`/file script.py\` atau \`/file index.html\`\n` +
        `Atau perintah bahasa alami:\n` +
        `\`/file buatkan script python untuk hitung zakat\`\n` +
        `\`/file bikin file rekap data.csv nilai siswa\`\n\n` +
        `_Tips: Anda juga bisa langsung chat biasa seperti "Bre, buatkan file bot.py"!_ 🚀`,
        null, null, token
      );
      return true;
    }

    const spaceIdx = raw.indexOf(' ');
    const newlineIdx = raw.indexOf('\n');
    let splitIdx = spaceIdx;
    if (newlineIdx !== -1 && (spaceIdx === -1 || newlineIdx < spaceIdx)) splitIdx = newlineIdx;

    const firstToken = splitIdx !== -1 ? raw.slice(0, splitIdx).trim() : raw.trim();
    const remainingText = splitIdx !== -1 ? raw.slice(splitIdx).trim() : '';
    const hasExtension = /\.[a-zA-Z0-9]{1,10}$/.test(firstToken);
    const isNaturalPrompt = remainingText.toLowerCase().startsWith('buatkan') || remainingText.toLowerCase().startsWith('bikin') || remainingText.toLowerCase().startsWith('tolong');

    // Case 1: Direct File Creation (User supplied filename with extension AND actual content)
    if (hasExtension && remainingText.length > 0 && !isNaturalPrompt) {
      try {
        await api.sendTelegramDocument(chatId, firstToken, remainingText, `📄 Berkas \`${firstToken}\` berhasil dibuat.`, token);
      } catch (e) {
        await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim berkas: ${e.message}`, null, null, token);
      }
      return true;
    }

    // Case 2: AI-Powered File Generation
    let generationPrompt = '';
    if (hasExtension && !remainingText) {
      generationPrompt = `Tolong buatkan berkas file "${firstToken}" secara lengkap, rapi, dan fungsional. Tuliskan seluruh kode atau isi berkas lengkapnya di dalam blok kode dengan nama file di baris pertama atau tag [TELEGRAM_FILE: ...] agar langsung dikirimkan sebagai berkas unduhan ke pengguna.`;
    } else {
      generationPrompt = `Tolong buatkan berkas file untuk permintaan berikut: "${raw}". Pastikan menyertakan isi/kode berkas secara LENGKAP di dalam blok kode dengan nama file di baris pertama atau tag [TELEGRAM_FILE: ...] agar langsung dikemas menjadi berkas unduhan fisik asli.`;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadingMsg = await api.sendTelegramMessage(chatId, `⏳ *Bre AI sedang membuat dan mengemas berkas file Anda...*`, null, null, token);
    const loadingMsgId = loadingMsg?.message_id || null;

    try {
      const answer = await queryBreAIRouter(generationPrompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await processAndSendOutboundMedia(chatId, answer, token, loadingMsgId, raw);
    } catch (genErr) {
      const errTxt = `⚠️ Gagal membuat berkas file: ${genErr.message}`;
      if (loadingMsgId) await api.editTelegramMessage(chatId, loadingMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /location [lat, lon] | [Nama Tempat] | [Alamat]
  if (lowerText.startsWith('/location') || lowerText.startsWith('/lokasi')) {
    const raw = text.replace(/^\/(location|lokasi)/i, '').trim();
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    if (!parts.length) {
      await api.sendTelegramMessage(
        chatId,
        `📍 *Panduan Format Kirim Lokasi:*\n\n` +
        `Gunakan format:\n\`/location [latitude, longitude] | [Nama Tempat] | [Alamat Lengkap]\`\n\n` +
        `_Contoh:_\n\`/location -6.175392, 106.827153 | Monas | Gambir, Jakarta Pusat\``,
        null, null, token
      );
      return true;
    }

    const coords = parts[0].split(',').map(s => parseFloat(s.trim()));
    const lat = coords[0];
    const lon = coords[1];
    const title = parts[1] || '';
    const addr = parts[2] || '';

    if (isNaN(lat) || isNaN(lon)) {
      await api.sendTelegramMessage(chatId, `⚠️ Format koordinat tidak valid. Contoh: \`/location -6.175392, 106.827153\``, null, null, token);
      return true;
    }

    try {
      if (title || addr) {
        await api.sendTelegramVenue(chatId, lat, lon, title || 'Lokasi', addr || 'Alamat', token);
      } else {
        await api.sendTelegramLocation(chatId, lat, lon, token);
      }
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim titik lokasi: ${e.message}`, null, null, token);
    }
    return true;
  }


  // /contact [nomor] [Nama Depan] [Nama Belakang]
  if (lowerText.startsWith('/contact') || lowerText.startsWith('/kontak')) {
    const raw = text.replace(/^\/(contact|kontak)/i, '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await api.sendTelegramMessage(
        chatId,
        `👤 *Panduan Format Kirim Kontak:*\n\n` +
        `Gunakan format:\n\`/contact [Nomor Telepon] [Nama Depan] [Nama Belakang]\`\n\n` +
        `_Contoh:_\n\`/contact +628123456789 Amirun Ariandi\``,
        null, null, token
      );
      return true;
    }

    const phone = parts[0];
    const firstName = parts[1];
    const lastName = parts.slice(2).join(' ') || '';

    try {
      await api.sendTelegramContact(chatId, phone, firstName, lastName, '', token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim kartu kontak: ${e.message}`, null, null, token);
    }
    return true;
  }


  // /tools or /alat
  if (lowerText === '/tools' || lowerText === '/alat' || lowerText === '/menu') {
    const toolsMsg = `🛠️ *Pusat Alat Pintar & AI Tools Bre AI*\n\n` +
      `Gunakan perintah spesialis di bawah untuk hasil instan dan terstruktur:\n\n` +
      `🔍 \`/search [kueri]\` — Riset web & cari data internet live\n` +
      `💻 \`/code [deskripsi]\` — Generator kode pemrograman & bug fixer\n` +
      `📝 \`/summary [teks]\` — Ringkasan poin eksekutif artikel/teks\n` +
      `📋 \`/prd [nama fitur]\` — Buat dokumen Product Requirement (PRD)\n` +
      `✍️ \`/copy [topik]\` — Generator copywriting & konten viral\n` +
      `🧠 \`/think [masalah]\` — Penalaran analitis mendalam (Deep Reasoning)\n` +
      `🌐 \`/translate [bahasa] [teks]\` — Terjemahan bahasa & perbaikan grammar\n` +
      `⚡ \`/health\` — Monitor latensi & kesehatan seluruh provider AI\n` +
      `📄 \`/file [nama_file.ext]\` — Buat berkas & unduhan fisik otomatis\n\n` +
      `_Contoh cepat:_\n` +
      `• \`/search harga saham nvidia hari ini\`\n` +
      `• \`/code scraper tokopedia python\`\n` +
      `• \`/prd fitur live chat customer service\`\n` +
      `• \`/copy promosi kopi susu gula aren\``;
    await api.sendTelegramMessage(chatId, toolsMsg, null, null, token);
    return true;
  }


  // /search [kueri] or /cari [kueri]
  if (lowerText.startsWith('/search') || lowerText.startsWith('/cari')) {
    const query = text.replace(/^\/(search|cari)/i, '').trim();
    if (!query) {
      await api.sendTelegramMessage(
        chatId,
        `🔍 *Panduan Pencarian Web Live:*\n\nGunakan format:\n\`/search [kueri pencarian]\`\n\n_Contoh:_\n\`/search berita teknologi kecerdasan buatan terkini\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `🔍 *Bre AI sedang menjelajah web untuk:* _"${query}"_...`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    let webSnippets = '';
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const searchRes = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (searchRes.ok) {
        const json = await searchRes.json();
        let items = [];
        if (json.AbstractText) items.push(`• ${json.Heading || query}: ${json.AbstractText} (Sumber: ${json.AbstractURL || 'Web'})`);
        if (Array.isArray(json.RelatedTopics)) {
          json.RelatedTopics.slice(0, 4).forEach(t => {
            if (t.Text) items.push(`• ${t.Text} (Sumber: ${t.FirstURL || 'Web'})`);
          });
        }
        if (items.length) webSnippets = items.join('\n');
      }
    } catch (e) {}

    const prompt = `[HASIL PENCARIAN WEB TERKINI UNTUK: "${query}"]\n${webSnippets || 'Data web langsung diperoleh dari internet.'}\n\n[INSTRUKSI]:\nSebagai Bre AI, jawab dan rangkum pertanyaan/topik "${query}" berdasarkan data di atas secara jelas, komprehensif, dan sertakan sumber/referensi jika ada.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal memproses pencarian: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /code [deskripsi] or /coding [deskripsi]
  if (lowerText.startsWith('/code') || lowerText.startsWith('/coding')) {
    const raw = text.replace(/^\/(code|coding)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `💻 *Panduan Generator Kode AI:*\n\nGunakan format:\n\`/code [deskripsi program atau perbaikan bug]\`\n\n_Contoh:_\n\`/code script python telegram bot dengan webhook\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `💻 *Bre AI sedang merancang & menyusun kode program...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Bertindaklah sebagai Principal Software Engineer. Buatkan kode pemrograman berkualitas tinggi, bersih, optimal, dan aman untuk permintaan berikut: "${raw}". Berikan penjelasan ringkas dan letakkan seluruh kode lengkap di dalam blok kode dengan mencantumkan nama berkas (misal: script.py, app.js, index.html) di baris pertama blok kode agar sistem otomatis membuatkan berkas unduhan fisik bagi pengguna.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await processAndSendOutboundMedia(chatId, answer, token, loadMsgId, raw);
    } catch (err) {
      const errTxt = `⚠️ Gagal menghasilkan kode: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /summary [teks] or /ringkas [teks]
  if (lowerText.startsWith('/summary') || lowerText.startsWith('/ringkas')) {
    const raw = text.replace(/^\/(summary|ringkas)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `📝 *Panduan Ringkas Dokumen:*\n\nGunakan format:\n\`/summary [teks atau artikel panjang]\`\n\n_Contoh:_\n\`/summary [tempel teks artikel di sini]\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `📝 *Bre AI sedang menganalisis & merangkum inti teks...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Tolong buatkan ringkasan eksekutif, poin-poin penting (Key Takeaways), dan Action Items yang terstruktur dan mudah dipahami dari teks berikut:\n\n${raw}`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal membuat ringkasan: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /prd [nama fitur]
  if (lowerText.startsWith('/prd')) {
    const raw = text.replace(/^\/prd/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `📋 *Panduan Pembuatan PRD (Product Requirement Document):*\n\nGunakan format:\n\`/prd [nama fitur atau produk]\`\n\n_Contoh:_\n\`/prd Sistem Booking Lapangan Futsal Otomatis\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `📋 *Bre AI sedang menyusun dokumen PRD standar industri...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Bertindaklah sebagai Senior Product Manager (PRD Specialist). Susun dokumen PRD (Product Requirement Document) lengkap dan terstruktur rapi untuk: "${raw}". Format dokumen mencakup: 1. Overview, 2. Problem Statement & Goals, 3. User Persona & User Stories, 4. Functional Specifications, 5. Non-Functional Specs & Security, 6. Acceptance Criteria, 7. Edge Cases & Risks, 8. Success Metrics (KPIs). Letakkan dalam blok kode markdown agar dapat diunduh langsung.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await processAndSendOutboundMedia(chatId, answer, token, loadMsgId, raw);
    } catch (err) {
      const errTxt = `⚠️ Gagal menyusun PRD: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /copy [topik] or /copywriting [topik]
  if (lowerText.startsWith('/copy') || lowerText.startsWith('/copywriting')) {
    const raw = text.replace(/^\/(copywriting|copy)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `✍️ *Panduan Copywriting AI:*\n\nGunakan format:\n\`/copy [nama produk, promosi, atau topik iklan]\`\n\n_Contoh:_\n\`/copy Kursus Digital Marketing Garansi Kerja\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `✍️ *Bre AI sedang meracik formula copywriting persuasif...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Bertindaklah sebagai Master Copywriter kelas dunia (AIDA & PAS framework). Buatkan materi copywriting persuasif dan berkonversi tinggi untuk topik/produk: "${raw}". Berikan: 1. 3 Pilihan Hook/Headline yang memikat, 2. Storytelling & Emotional Benefit, 3. Solusi & Value Proposition, 4. Call to Action (CTA) yang kuat, 5. Contoh teks untuk Caption Instagram/TikTok.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal membuat copywriting: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /think [masalah] or /analisis [masalah]
  if (lowerText.startsWith('/think') || lowerText.startsWith('/analisis')) {
    const raw = text.replace(/^\/(think|analisis)/i, '').trim();
    if (!raw) {
      await api.sendTelegramMessage(
        chatId,
        `🧠 *Panduan Deep Analytical Reasoning:*\n\nGunakan format:\n\`/think [masalah rumit atau pertanyaan analitis]\`\n\n_Contoh:_\n\`/think Mana strategi bisnis yang lebih baik: Bootstrapping vs Mencari Investor VC?\``,
        null, null, token
      );
      return true;
    }

    api.sendTyping(chatId, token).catch(() => {});
    const loadMsg = await api.sendTelegramMessage(chatId, `🧠 *Bre AI sedang melakukan penalaran mendalam langkah demi langkah...*`, null, null, token);
    const loadMsgId = loadMsg?.message_id || null;

    const prompt = `Analisis dan pecahkan pertanyaan/masalah berikut dengan penalaran sistematis langkah demi langkah (Deep Analytical Reasoning / Chain of Thought):\n\n"${raw}"\n\nSajikan analisis komparatif, trade-offs, mitigasi risiko, dan rekomendasi konkrit.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, answer, null, token);
      else await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      const errTxt = `⚠️ Gagal menganalisis: ${err.message}`;
      if (loadMsgId) await api.editTelegramMessage(chatId, loadMsgId, errTxt, null, token);
      else await api.sendTelegramMessage(chatId, errTxt, null, null, token);
    }
    return true;
  }


  // /translate [bahasa] [teks] or /terjemah [bahasa] [teks]
  if (lowerText.startsWith('/translate') || lowerText.startsWith('/terjemah')) {
    const raw = text.replace(/^\/(translate|terjemah)/i, '').trim();
    const spaceIdx = raw.indexOf(' ');
    if (spaceIdx === -1 || !raw) {
      await api.sendTelegramMessage(
        chatId,
        `🌐 *Panduan Penerjemah Cerdas:*\n\nGunakan format:\n\`/translate [bahasa target] [teks]\`\n\n_Contoh:_\n\`/translate english Selamat pagi rekan-rekan, mari kita mulai meeting hari ini.\``,
        null, null, token
      );
      return true;
    }

    const targetLang = raw.slice(0, spaceIdx).trim();
    const content = raw.slice(spaceIdx).trim();

    api.sendTyping(chatId, token).catch(() => {});
    const prompt = `Terjemahkan teks berikut ke dalam bahasa ${targetLang} dengan nada profesional, natural, dan akurat secara tata bahasa:\n\n"${content}"\n\nBerikan juga 1 opsi alternatif yang lebih santai jika relevan.`;

    try {
      const answer = await queryBreAIRouter(prompt, [], senderTag, getUserLanguage(chatId), getUserStyle(chatId));
      await api.sendTelegramMessage(chatId, answer, null, null, token);
    } catch (err) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal menerjemahkan: ${err.message}`, null, null, token);
    }
    return true;
  }


  return false;
}

module.exports = { handle };
