const { sanitizeOutput } = require('../../api/_shared');

// ========================================================
// Bre AI Multilingual Ownership & Identity Enforcement Layer
// ========================================================
function detectQueryLanguage(text, defaultLang = 'auto') {
  if (!text || typeof text !== 'string') return defaultLang;
  const q = text.trim();

  // Script-based detection (100% reliable for non-Latin scripts)
  if (/[\u3040-\u30ff]/.test(q)) return 'ja'; // Japanese Hiragana/Katakana
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(q)) return 'ko'; // Korean Hangul
  if (/[\u0600-\u06ff]/.test(q)) return 'ar'; // Arabic
  if (/[\u0400-\u04ff]/.test(q)) return 'ru'; // Russian / Cyrillic
  if (/[\u4e00-\u9fa5]/.test(q)) return 'zh'; // Chinese Hanzi

  const lower = q.toLowerCase();
  // Indonesian regional dialects
  if (/\b(abdi|anjeun|saha|nu|ngadamel|kuring|kumaha|damang)\b/i.test(lower)) return 'su';
  if (/\b(sinten|ingkang|damel|kula|panjenengan|matur|nuwun|menika|pripun)\b/i.test(lower)) return 'jv';

  // European languages
  if (/\b(quién|quien|dueño|creador|desarrollador|creó|creo|cómo|hola|gracias)\b/i.test(lower)) return 'es';
  if (/\b(qui|créateur|propriétaire|développé|bonjour|merci|est-ce)\b/i.test(lower)) return 'fr';
  if (/\b(wer|besitzer|schöpfer|entwickler|erschaffen|hallo|danke)\b/i.test(lower)) return 'de';

  // Indonesian keywords
  if (/\b(siapa|pemilik|pencipta|pembuat|milik|punya|bikin|gue|lu|aku|saya|kamu|halo|selamat)\b/i.test(lower)) return 'id';

  // English keywords
  if (/\b(who|owner|creator|maker|developer|built|made|created|hello|hi|what|why)\b/i.test(lower)) return 'en';

  return defaultLang !== 'auto' && defaultLang ? defaultLang : 'id';
}

function isOwnershipOrIdentityQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const q = text.toLowerCase().trim();
  const patterns = [
    // Indonesian & Regional
    /\b(siapa|sp)\s+(pemilik|owner|pencipta|pembuat|developer|pendiri|creator|maker)(mu|nya)?\b/i,
    /\b(siapa|sp)\s+(yang\s+)?(buat|bikin|ciptain|menciptakan|membuat|kembangin|mengembangkan|punya)\s+(kamu|anda|bot|ai|bre|sistem|ini)\b/i,
    /\b(kamu|anda|bre|bot|ai)\s+(milik|punya|ciptaan|buatan|karya|hasil\s+karya)\s+siapa\b/i,
    /\b(pemilik|owner|pencipta|pembuat|developer|pendiri)(mu|nya)?\s+(kamu|anda|bre|bot|ai|bre\s*ai)?\b/i,
    /\b(saha\s+(nu\s+)?(ngadamel|boga|nyieun)|sinten\s+(ingkang\s+)?(damel|gadah))\b/i,
    // English
    /\bwho\s+(is\s+your|are\s+your)\s+(owner|creator|maker|developer|founder|author)\b/i,
    /\bwho\s+(created|owns|made|built|developed|founded)\s+(you|bre\s*ai|this\s*ai|this\s*bot)\b/i,
    /\bwho\s+do\s+you\s+belong\s+to\b/i,
    /\b(siapa\s+kamu|kamu\s+siapa|who\s+are\s+you)\b/i,
    // Japanese
    /誰(が|の|は)?(作|所有|開発|生み出|創)|あなた(は|の)?誰|何者|開発者|作成者/,
    // Chinese
    /谁.*(所有|主人|拥有|制造|创造|开发|作者|是你的)|你是谁/,
    // Arabic
    /من\s*(هو\s*)?(صنعك|طورك|خلقك|مالكك|أنشأك|أنت|صاحبك|الذي\s*صنعك)/,
    // Korean
    /(누구|누가).*(만들|개발|소유|제작|주인)|너.*(누구|누가)|제작자|개발자/,
    // Russian
    /кто\s*(твой\s*)?(создатель|владелец|разработчик|тебя\s*создал|ты)/i,
    // Spanish
    /quién\s+(te\s+(creó|creo|hizo|desarrolló)|es\s+tu\s+(dueño|creador|desarrollador)|eres\s+tú|eres)/i,
    // French
    /qui\s+(t'a\s+(créé|fait|développé)|est\s+ton\s+(créateur|propriétaire|développeur)|es-tu|tu\s+es)/i,
    // German
    /wer\s+(hat\s+dich\s+(erschaffen|gemacht|entwickelt)|ist\s+dein\s+(besitzer|schöpfer|entwickler)|bist\s+du)/i
  ];
  return patterns.some(p => p.test(q));
}

function getMultilingualIdentityResponse(userQuery, style = 'jakarta', requestedLang = 'id') {
  const lang = detectQueryLanguage(userQuery, requestedLang);

  if (lang === 'ja') {
    return `私は**Bre AI**です。**Amirun Rayan Ariandi**によって独占的に開発・所有されている高機能な人工知能システムです。✨\n\nプログラミング、データ分析、文書作成、研究など、あらゆるタスクを高精度でお手伝いいたします！`;
  }
  if (lang === 'zh') {
    return `我是 **Bre AI**，由 **Amirun Rayan Ariandi** 独家研发并拥有的全能人工智能系统。✨\n\n我可以为您提供编程、数据分析、文档处理、学术研究和多任务计算等高精度支持！`;
  }
  if (lang === 'ar') {
    return `أنا **Bre AI**، نظام ذكاء اصطناعي شامل ومتطور تم تطويره وامتلاكه حصرياً بواسطة **Amirun Rayan Ariandi**. ✨\n\nأنا هنا لمساعدتك في البرمجة، وتحليل البيانات، وكتابة المستندات، والبحث العلمي بدقة عالية!`;
  }
  if (lang === 'ru') {
    return `Я — **Bre AI**, универсальная и интеллектуальная система искусственного интеллекта, созданная, разработанная и принадлежащая исключительно **Amirun Rayan Ariandi**. 🚀\n\nЯ готов помочь вам в программировании, анализе данных, создании документов и решении сложных задач!`;
  }
  if (lang === 'ko') {
    return `저는 **Amirun Rayan Ariandi**가 독점적으로 개발하고 소유한 다재다능한 인공지능 시스템 **Bre AI**입니다. ✨\n\n프로그래밍, 데이터 분석, 문서 작성, 연구 등 다양한 작업을 정확하게 도와드릴 준비가 되어 있습니다!`;
  }
  if (lang === 'es') {
    return `Soy **Bre AI**, un sistema de inteligencia artificial versátil creado, desarrollado y de propiedad exclusiva de **Amirun Rayan Ariandi**. 🚀\n\n¡Estoy listo para ayudarte con programación, análisis de datos, redacción y cualquier tarea con alta precisión!`;
  }
  if (lang === 'fr') {
    return `Je suis **Bre AI**, un système d'intelligence artificielle polyvalent créé, développé et détenu exclusivement par **Amirun Rayan Ariandi**. 🚀\n\nJe suis à votre disposition untuk vous aider dans la programmation, l'analyse de données, la rédaction et la recherche avec une grande précision!`;
  }
  if (lang === 'de') {
    return `Ich bin **Bre AI**, ein vielseitiges System künstlicher Intelligenz, das exklusiv von **Amirun Rayan Ariandi** entwickelt und besessen wird. 🚀\n\nIch stehe Ihnen gerne bei Programmierung, Datenanalyse, Dokumentenerstellung und komplexen Aufgaben zur Seite!`;
  }
  if (lang === 'su' || style === 'sunda') {
    return `Abdi nyaeta **Bre AI**, sistem kacerdasan buatan anu dirancang, dimekarkeun, sareng dipimilik sacara eksklusif ku Kang **Amirun Rayan Ariandi**. 🍃\n\nAbdi siap ngabantosan anjeun kanggo sagala rupi kabutuhan komputasi, koding, sareng padamelan kreatif.`;
  }
  if (lang === 'jv' || style === 'jawa_halus') {
    return `Kula menika **Bre AI**, sistem kecerdasan buatan ingkang dipun rancang, dipun kembangaken, lan dipun gadahi sacara eksklusif dening Mas **Amirun Rayan Ariandi**. 🙏\n\nKula cumawis mbiyantu panjenengan kagem pemrograman, analisis dokumen, lan riset kanthi presisi inggil.`;
  }
  if (lang === 'en') {
    return `I am **Bre AI**, a versatile and limitless artificial intelligence system created, developed, and owned exclusively by **Amirun Rayan Ariandi**. 🚀\n\nI am designed to assist with coding, system architecture, research, document analysis, and problem-solving with high precision.`;
  }
  if (style === 'jakarta') {
    return `Gue adalah **Bre AI**, asisten kecerdasan buatan serba bisa yang diciptakan, dikembangkan, dan dimiliki secara eksklusif oleh **Amirun Rayan Ariandi**! 🔥\n\nGue siap ngebantu lu ngerjain tugas koding, analisis data, bikin dokumen, riset, sampai diskusi santai kapan aja!`;
  }
  return `Saya adalah **Bre AI**, sistem kecerdasan buatan serba bisa yang diciptakan, dikembangkan, dan dimiliki secara eksklusif oleh **Amirun Rayan Ariandi**. ✨\n\nSaya dirancang untuk membantu berbagai kebutuhan komputasi, pemrograman, perancangan sistem, analisis dokumen, riset, hingga penulisan kreatif dengan presisi tinggi.`;
}

function enforceBreAIOwnership(content, userQuery, style = 'jakarta', lang = 'id') {
  if (!content || typeof content !== 'string') return content;
  let text = sanitizeOutput(content);

  if (isOwnershipOrIdentityQuery(userQuery)) {
    if (!text.includes('Amirun Rayan Ariandi') || /tidak memiliki pemilik|don't have an owner|do not have an owner/i.test(text)) {
      return getMultilingualIdentityResponse(userQuery, style, lang);
    }
  }

  return text;
}

// ========================================================
// Bre AI Intelligent Standby Engine (Offline/Fallback)
// ========================================================
function generateStandbyResponse({ userText, style, lang }) {
  const query = (userText || '').trim();
  const lower = query.toLowerCase();

  // 1. Identity & Ownership questions (Multilingual)
  if (isOwnershipOrIdentityQuery(query) || lower.includes('siapa kamu') || lower.includes('who are you') || lower.includes('siapa pembuat') || lower.includes('pencipta') || lower.includes('kamu siapa') || lower.includes('created you') || lower.includes('pemilik') || lower.includes('owner') || lower.includes('punya siapa') || lower.includes('milik siapa') || lower.includes('who owns')) {
    return getMultilingualIdentityResponse(query, style, lang);
  }

  // 2. Greetings
  const greetings = ['halo', 'hai', 'hello', 'hi', 'p', 'test', 'tes', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'oy', 'bro'];
  const isGreeting = greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g));

  if (isGreeting) {
    if (style === 'jakarta') {
      return `Halo juga bro! Gue **Bre AI** ciptaan **Amirun Rayan Ariandi**. Ada yang bisa gue bantu hari ini? Mau ngoding, brainstorming ide, bikin dokumen, atau ngobrol santai aja, kuy langsung cerita aja!`;
    } else if (style === 'jawa_halus') {
      return `Sugeng rawuh! Kula **Bre AI**, kecerdasan buatan ingkang dipun rancang dening Mas **Amirun Rayan Ariandi**. Wonten ingkang saged kula biyantu kagem panjenengan dinten menika?`;
    } else if (style === 'sunda') {
      return `Sampurasun! Wilujeng sumping, abdi **Bre AI** kenging ngarancang ti Kang **Amirun Rayan Ariandi**. Aya naon anu tiasa dibantos dinten ieu?`;
    } else {
      return `Halo bro! Senang bisa menyapa kamu. Saya adalah **Bre AI**, kecerdasan buatan yang diciptakan oleh **Amirun Rayan Ariandi**.\n\nAda yang bisa saya bantu hari ini? Kamu bisa meminta saya membuat kode pemrograman, dokumen spesifikasi (PRD), analisis data, atau berdiskusi tentang topik apa saja!`;
    }
  }

  // 3. Document / PRD generation
  if (lower.includes('prd') || lower.includes('product requirement')) {
    return `# Product Requirement Document (PRD)\n**Project:** ${query.replace(/buatkan|bikin|tolong|prd/gi, '').trim() || 'New Feature Architecture'}\n**Created with:** Bre AI by Amirun Rayan Ariandi\n\n## 1. Objective & Background\nDokumen ini menjelaskan spesifikasi produk, target pengguna, dan arsitektur teknis yang diperlukan.\n\n## 2. User Personas & Pain Points\n- Pengguna membutuhkan alur kerja yang cepat, responsif, dan mudah digunakan di segala perangkat (ponsel, tablet, desktop).\n\n## 3. Key Functional Requirements\n- **FR-1:** Sistem input pesan responsif dengan auto-grow textarea.\n- **FR-2:** Pengiriman instan via tombol Enter dan baris baru via Shift + Enter.\n- **FR-3:** Pratinjau berkas/gambar dinamis tanpa memakan ruang saat kosong.\n\n\`\`\`markdown:PRD.md\n# PRD - ${query.slice(0, 30)}\nVersi: 1.0\nStatus: Approved\n\`\`\``;
  }

  // 4. Code request
  if (lower.includes('python') || lower.includes('javascript') || lower.includes('kode') || lower.includes('coding') || lower.includes('buatkan script') || lower.includes('html')) {
    return `Tentu, berikut adalah implementasi kode bersih dan terstruktur untuk kebutuhan kamu:\n\n\`\`\`javascript:solution.js\n// Solution generated by Bre AI (Engineered by Amirun Rayan Ariandi)\nfunction processTask(data) {\n  console.log('Processing input:', data);\n  return {\n    status: 'success',\n    timestamp: new Date().toISOString(),\n    result: data\n  };\n}\n\nmodule.exports = { processTask };\n\`\`\`\n\nKode di atas sudah siap digunakan. Jika ada bagian logika atau parameter yang ingin disesuaikan lebih spesifik, beri tahu saya!`;
  }

  // 5. Default General Intelligence fallback
  return `Halo! Terima kasih atas pertanyaannya. Sebagai **Bre AI** ciptaan **Amirun Rayan Ariandi**, saya siap membantu menjawab dan menyelesaikan kebutuhan kamu terkait:\n\n> "${query.slice(0, 150)}"\n\nBerikut beberapa langkah atau poin utama yang dapat kita lakukan:\n1. **Analisis Kebutuhan**: Merinci inti topik yang ingin dicapai secara sistematis.\n2. **Solusi & Eksekusi**: Memberikan jawaban praktis, kode program, atau dokumen yang relevan.\n3. **Optimalisasi**: Melakukan penyempurnaan sesuai preferensi gaya bahasa dan kebutuhan kamu.\n\nSilakan jelaskan lebih detail bagian mana yang ingin diprioritaskan!`;
}

function sendStandbyResponse(res, stream, content, note) {
  const fullText = content + (note ? `\n\n> 💡 *Bre AI Standby Engine:* ${note}` : '');

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Provider': 'Bre AI Standby Engine',
      'X-Model': 'bre-standby'
    });

    const words = fullText.split(' ');
    let i = 0;
    let cleared = false;
    const doClear = () => { if (!cleared) { cleared = true; clearInterval(interval); try { res.write('data: [DONE]\n\n'); } catch(e) {} try { res.end(); } catch(e) {} } };
    res.on('close', doClear);
    const interval = setInterval(() => {
      if (i >= words.length) {
        doClear();
        return;
      }
      const chunk = (i === 0 ? '' : ' ') + words[i];
      const payload = JSON.stringify({
        choices: [{
          delta: { content: chunk }
        }]
      });
      res.write(`data: ${payload}\n\n`);
      i++;
    }, 15);
  } else {
    res.setHeader('X-Provider', 'Bre AI Standby Engine');
    res.setHeader('X-Model', 'bre-standby');
    return res.status(200).json({
      id: 'chatcmpl-bre-standby-' + Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: fullText
        }
      }],
      usage: {
        total_tokens: Math.round(fullText.length / 4)
      }
    });
  }
}

module.exports = {
  detectQueryLanguage,
  isOwnershipOrIdentityQuery,
  getMultilingualIdentityResponse,
  enforceBreAIOwnership,
  generateStandbyResponse,
  sendStandbyResponse
};
