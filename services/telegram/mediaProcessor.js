// ========================================================
// Bre AI v3.0 - Telegram Outbound Media & File Generation Processor
// 100% Guaranteed Physical File Delivery Pipeline & Interactive Non-Text Media
// Created by Amirun Rayan Ariandi
// ========================================================
const api = require('./api');

// Comprehensive extension mapping for all major programming, data, markup & doc formats
const EXT_MAP = {
  // Web
  javascript: 'script.js', js: 'script.js', node: 'script.js',
  typescript: 'script.ts', ts: 'script.ts',
  html: 'index.html', htm: 'index.html',
  css: 'style.css', scss: 'style.scss', sass: 'style.sass', less: 'style.less',
  // Python
  python: 'script.py', py: 'script.py', pyw: 'script.py',
  // Data & Config
  json: 'data.json', jsonc: 'data.json',
  csv: 'data.csv', tsv: 'data.tsv',
  sql: 'query.sql',
  yaml: 'config.yml', yml: 'config.yml',
  xml: 'data.xml', svg: 'image.svg',
  env: '.env', ini: 'config.ini', cfg: 'config.cfg', conf: 'config.conf', toml: 'config.toml',
  // Shell & Scripts
  bash: 'script.sh', sh: 'script.sh', shell: 'script.sh', zsh: 'script.sh',
  batch: 'script.bat', bat: 'script.bat', cmd: 'script.bat',
  powershell: 'script.ps1', ps1: 'script.ps1',
  // Programming Languages
  php: 'index.php',
  cpp: 'main.cpp', 'c++': 'main.cpp', c: 'main.c', h: 'header.h', hpp: 'header.hpp',
  java: 'Main.java', kotlin: 'Main.kt', kt: 'Main.kt',
  go: 'main.go', golang: 'main.go',
  rust: 'main.rs', rs: 'main.rs',
  ruby: 'script.rb', rb: 'script.rb',
  dart: 'main.dart', swift: 'main.swift',
  lua: 'script.lua', r: 'script.r',
  perl: 'script.pl', pl: 'script.pl',
  // Documents & Text
  markdown: 'document.md', md: 'document.md',
  text: 'catatan.txt', txt: 'catatan.txt', plain: 'catatan.txt',
  dockerfile: 'Dockerfile', docker: 'Dockerfile',
  prd: 'PRD.md'
};

/**
 * Check if the user prompt expresses an intent to generate or download a file
 * @param {string} prompt 
 * @returns {boolean}
 */
function checkWantsFile(prompt = '') {
  const p = (prompt || '').toLowerCase();
  return (
    p.includes('buat file') ||
    p.includes('buatkan file') ||
    p.includes('bikin file') ||
    p.includes('bikinin file') ||
    p.includes('generate file') ||
    p.includes('jadikan file') ||
    p.includes('kirim sebagai file') ||
    p.includes('kirimkan sebagai file') ||
    p.includes('kirim file') ||
    p.includes('kirimkan file') ||
    p.includes('simpan ke file') ||
    p.includes('export file') ||
    p.includes('ekspor file') ||
    p.includes('buat berkas') ||
    p.includes('buatkan berkas') ||
    p.includes('bikin berkas') ||
    p.includes('bikinin berkas') ||
    p.includes('kirim berkas') ||
    p.includes('jadikan berkas') ||
    p.includes('buat script') ||
    p.includes('buatkan script') ||
    p.includes('bikin script') ||
    p.includes('bikinin script') ||
    p.includes('buatkan kodingan') ||
    p.includes('bikin kodingan') ||
    p.includes('buatkan dokumen') ||
    p.includes('bikin dokumen') ||
    p.includes('buat dokumen') ||
    p.includes('/file') ||
    p.includes('/buatfile') ||
    /\b(unduh|download)\b.*?\b(file|berkas|script|dokumen|kode)\b/i.test(p) ||
    /\b(file|berkas|script|dokumen|kode)\b.*?\b(unduh|download)\b/i.test(p)
  );
}

/**
 * Extract an explicit filename with extension from a user prompt (e.g. "buatkan file bot.py")
 * @param {string} prompt 
 * @returns {string|null}
 */
function extractFilenameFromPrompt(prompt = '') {
  if (!prompt) return null;
  const match = prompt.match(/\b([a-zA-Z0-9_\-]+\.(py|js|ts|jsx|tsx|html|css|scss|sass|json|csv|tsv|sql|sh|bash|bat|cmd|ps1|php|c|cpp|h|hpp|java|go|rs|rb|lua|swift|kt|xml|yaml|yml|env|ini|txt|md|log|svg|toml|conf|prd))\b/i);
  return (match && match[1]) ? match[1] : null;
}

/**
 * Safe JSON parser with lenient fallback
 * @param {string} str 
 * @returns {object|null}
 */
function tryParseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      const cleaned = str
        .replace(/[\r\n\t]/g, ' ')
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Process raw AI answer, extract interactive tags and codeblocks,
 * deliver actual physical files via sendTelegramDocument, and send text response.
 * @param {string|number} chatId 
 * @param {string} rawAnswer 
 * @param {string|null} token 
 * @param {number|null} loadingMsgId 
 * @param {string} userPrompt 
 * @returns {Promise<{deliveredText: string, mediaCount: number}>}
 */
async function processAndSendOutboundMedia(chatId, rawAnswer, token = null, loadingMsgId = null, userPrompt = '') {
  if (!rawAnswer) return { deliveredText: '', mediaCount: 0 };

  let textToDeliver = String(rawAnswer)
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '')
    .replace(/<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi, '')
    .replace(/^[\s\r\n]*thinking[\s\S]*? response\r?\n\r?\n/gi, '')
    .replace(/^\[(?:Thinking Process|Reasoning Process|Proses Berpikir)\][\s\S]*?(?:\r?\n\r?\n|$)/gi, '')
    .replace(/^\*(?:Thinking Process|Reasoning Process|Proses Berpikir)\*[\s\S]*?(?:\r?\n\r?\n|$)/gi, '')
    .replace(/^(?:Thinking Process|Reasoning Process|Proses Berpikir|thinking):\s*[\s\S]*?(?:\r?\n\r?\n|$)/gi, '')
    .replace(/^thinking([A-Z\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF][^\n]*\n*)/i, '');
  const outboundActions = [];
  const generatedFiles = [];

  // 1. Parse [TELEGRAM_FILE: ...] robustly (handles raw newlines, unescaped quotes, etc.)
  textToDeliver = textToDeliver.replace(/\[TELEGRAM_FILE:\s*([\s\S]*?)\]/gi, (fullMatch, tagBody) => {
    let filename = '';
    let content = '';
    let caption = '';

    // Attempt 1: Direct JSON.parse
    try {
      const parsed = JSON.parse(tagBody.trim());
      if (parsed && parsed.filename && parsed.content !== undefined) {
        filename = String(parsed.filename).trim();
        content = String(parsed.content);
        caption = parsed.caption ? String(parsed.caption) : '';
      }
    } catch (e1) {
      // JSON parse failed (likely raw unescaped newlines or quotes in content)
    }

    // Attempt 2: Resilient field extraction
    if (!filename || content === '') {
      const fnM = tagBody.match(/"filename"\s*:\s*"([^"\r\n]+)"/i) || tagBody.match(/filename\s*[:=]\s*"([^"\r\n]+)"/i);
      if (fnM) filename = fnM[1].trim();

      const capM = tagBody.match(/"caption"\s*:\s*"([^"\r\n]+)"/i) || tagBody.match(/caption\s*[:=]\s*"([^"\r\n]+)"/i);
      if (capM) caption = capM[1].trim();

      const cIdx = tagBody.search(/"content"\s*:\s*"/i);
      if (cIdx !== -1) {
        const afterContent = tagBody.slice(cIdx);
        const firstQuote = afterContent.indexOf('"', afterContent.indexOf('"content"') + 9);
        if (firstQuote !== -1) {
          const contentStart = cIdx + firstQuote + 1;
          let contentEnd = tagBody.lastIndexOf('"}');
          if (contentEnd === -1) contentEnd = tagBody.lastIndexOf('"\n}');
          if (contentEnd === -1) {
            const capIdx = tagBody.search(/",\s*"caption"/i);
            if (capIdx !== -1 && capIdx > contentStart) contentEnd = capIdx;
          }
          if (contentEnd === -1 || contentEnd <= contentStart) {
            contentEnd = tagBody.lastIndexOf('"');
          }

          if (contentEnd > contentStart) {
            content = tagBody.slice(contentStart, contentEnd)
              .replace(/\\r\\n/g, '\n')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
        }
      }
    }

    if (filename && (content !== '' && content !== undefined)) {
      generatedFiles.push(filename);
      const finalCaption = caption || `📄 Berkas \`${filename}\` siap diunduh.`;
      outboundActions.push(async () => {
        await api.sendTelegramDocument(chatId, filename, content, finalCaption, token);
      });
      return '';
    }

    return ''; // Remove corrupted/unparseable file tag so it doesn't leak into chat text
  });

  // 2. Parse [TELEGRAM_POLL: ...]
  textToDeliver = textToDeliver.replace(/\[TELEGRAM_POLL:\s*(\{[\s\S]*?\})\s*\]/gi, (match, jsonStr) => {
    const data = tryParseJson(jsonStr);
    if (data && data.question && Array.isArray(data.options) && data.options.length >= 2) {
      outboundActions.push(async () => {
        await api.sendTelegramPoll(
          chatId,
          data.question,
          data.options,
          data.is_anonymous !== false,
          data.type || 'regular',
          typeof data.correct_option_id === 'number' ? data.correct_option_id : null,
          data.explanation || '',
          token
        );
      });
      return '';
    }
    return match;
  });

  // 3. Parse [TELEGRAM_DICE: ...]
  textToDeliver = textToDeliver.replace(/\[TELEGRAM_DICE:\s*(?:(\{[\s\S]*?\})|([^\]\r\n]+))\s*\]/gi, (match, jsonStr, rawEmoji) => {
    let emoji = (rawEmoji || '').trim();
    if (!emoji && jsonStr) {
      const data = tryParseJson(jsonStr);
      emoji = (data?.emoji || '').trim();
    }
    const validEmojis = ['🎲', '🎯', '🏀', '⚽', '🎳', '🎰'];
    const finalEmoji = validEmojis.find(e => emoji.includes(e)) || '🎲';
    outboundActions.push(async () => {
      await api.sendTelegramDice(chatId, finalEmoji, token);
    });
    return '';
  });

  // 4. Parse [TELEGRAM_LOCATION: ...]
  textToDeliver = textToDeliver.replace(/\[TELEGRAM_LOCATION:\s*(\{[\s\S]*?\})\s*\]/gi, (match, jsonStr) => {
    const data = tryParseJson(jsonStr);
    if (data && (!isNaN(parseFloat(data.latitude)) && !isNaN(parseFloat(data.longitude)))) {
      const lat = parseFloat(data.latitude);
      const lon = parseFloat(data.longitude);
      outboundActions.push(async () => {
        if (data.title || data.address) {
          await api.sendTelegramVenue(chatId, lat, lon, data.title || 'Lokasi Peta', data.address || '', token);
        } else {
          await api.sendTelegramLocation(chatId, lat, lon, token);
        }
      });
      return '';
    }
    return match;
  });

  // 5. Parse [TELEGRAM_CONTACT: ...]
  textToDeliver = textToDeliver.replace(/\[TELEGRAM_CONTACT:\s*(\{[\s\S]*?\})\s*\]/gi, (match, jsonStr) => {
    const data = tryParseJson(jsonStr);
    if (data && (data.phone_number || data.phone)) {
      const phone = data.phone_number || data.phone;
      const firstName = data.first_name || data.name || 'Kontak';
      const lastName = data.last_name || '';
      outboundActions.push(async () => {
        await api.sendTelegramContact(chatId, phone, firstName, lastName, data.vcard || '', token);
      });
      return '';
    }
    return match;
  });

  // 6. Parse [TELEGRAM_PHOTO: ...]
  textToDeliver = textToDeliver.replace(/\[TELEGRAM_PHOTO:\s*(\{[\s\S]*?\})\s*\]/gi, (match, jsonStr) => {
    const data = tryParseJson(jsonStr);
    if (data && (data.url || data.photo)) {
      const photoUrl = data.url || data.photo;
      outboundActions.push(async () => {
        await api.sendTelegramPhoto(chatId, photoUrl, data.caption || '', token);
      });
      return '';
    }
    return match;
  });

  // 7. Auto-extract code blocks into real downloadable files
  const userPromptLower = (userPrompt || '').toLowerCase();
  const wantsFile = checkWantsFile(userPromptLower);
  const userSpecifiedFilename = extractFilenameFromPrompt(userPrompt);

  if (generatedFiles.length === 0) {
    const codeBlockRegex = /```([a-zA-Z0-9_\-+]+)?\r?\n([\s\S]*?)```/g;
    let match;
    let extractedCount = 0;

    while ((match = codeBlockRegex.exec(rawAnswer)) !== null && extractedCount < 5) {
      const lang = (match[1] || '').toLowerCase();
      const code = match[2];
      if (!code || code.trim().length < 15) continue;

      let detectedFilename = null;
      const firstLines = code.slice(0, 300).split('\n').slice(0, 5);
      for (const line of firstLines) {
        const fnMatch = line.match(/(?:\/\/|#|<!--|\/\*|--|;\s*)\s*([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]{1,10})\b/);
        if (fnMatch && fnMatch[1]) {
          detectedFilename = fnMatch[1];
          break;
        }
      }

      if (!detectedFilename && userSpecifiedFilename && extractedCount === 0) {
        detectedFilename = userSpecifiedFilename;
      }

      if (!detectedFilename && (wantsFile || userSpecifiedFilename) && lang && EXT_MAP[lang]) {
        detectedFilename = EXT_MAP[lang];
      }

      if (!detectedFilename && wantsFile) {
        if (lang && EXT_MAP[lang]) detectedFilename = EXT_MAP[lang];
        else if (userPromptLower.includes('python') || userPromptLower.includes('.py')) detectedFilename = 'script.py';
        else if (userPromptLower.includes('html') || userPromptLower.includes('.html')) detectedFilename = 'index.html';
        else if (userPromptLower.includes('csv') || userPromptLower.includes('.csv')) detectedFilename = 'data.csv';
        else if (userPromptLower.includes('json') || userPromptLower.includes('.json')) detectedFilename = 'data.json';
        else if (userPromptLower.includes('sql') || userPromptLower.includes('.sql')) detectedFilename = 'query.sql';
        else if (userPromptLower.includes('bash') || userPromptLower.includes('sh')) detectedFilename = 'script.sh';
        else if (userPromptLower.includes('md') || userPromptLower.includes('markdown')) detectedFilename = 'dokumen.md';
        else detectedFilename = `berkas_${extractedCount + 1}.txt`;
      }

      if (detectedFilename && !generatedFiles.includes(detectedFilename)) {
        extractedCount++;
        generatedFiles.push(detectedFilename);
        const finalFn = detectedFilename;
        const finalCode = code;
        outboundActions.push(async () => {
          await api.sendTelegramDocument(
            chatId,
            finalFn,
            finalCode,
            `📥 *Berkas Unduhan:* \`${finalFn}\`\n_Dibuat otomatis oleh Bre AI_`,
            token
          );
        });
      }
    }
  }

  // 8. ABSOLUTE GUARANTEE: If user requested a file (wantsFile is true)
  // and no file has been packaged yet (generatedFiles.length === 0):
  if (wantsFile && generatedFiles.length === 0) {
    let fallbackContent = '';
    let fallbackFilename = userSpecifiedFilename || '';

    // Check if there is ANY code block in rawAnswer (even without lang identifier)
    const anyCodeBlockMatch = rawAnswer.match(/```(?:[a-zA-Z0-9_\-+]+)?\r?\n([\s\S]*?)```/);
    if (anyCodeBlockMatch && anyCodeBlockMatch[1] && anyCodeBlockMatch[1].trim().length > 10) {
      fallbackContent = anyCodeBlockMatch[1].trim();
    } else {
      // If no code block, package the clean textual content of rawAnswer
      fallbackContent = textToDeliver
        .replace(/\[TELEGRAM_[A-Z_]+:[^\]]*\]/gi, '')
        .trim();
    }

    if (fallbackContent) {
      if (!fallbackFilename) {
        if (userPromptLower.includes('python') || userPromptLower.includes('.py')) fallbackFilename = 'script.py';
        else if (userPromptLower.includes('html') || userPromptLower.includes('.html')) fallbackFilename = 'index.html';
        else if (userPromptLower.includes('css') || userPromptLower.includes('.css')) fallbackFilename = 'style.css';
        else if (userPromptLower.includes('javascript') || userPromptLower.includes('.js')) fallbackFilename = 'script.js';
        else if (userPromptLower.includes('typescript') || userPromptLower.includes('.ts')) fallbackFilename = 'script.ts';
        else if (userPromptLower.includes('json') || userPromptLower.includes('.json')) fallbackFilename = 'data.json';
        else if (userPromptLower.includes('csv') || userPromptLower.includes('excel') || userPromptLower.includes('tabel') || userPromptLower.includes('.csv')) fallbackFilename = 'data.csv';
        else if (userPromptLower.includes('sql') || userPromptLower.includes('database') || userPromptLower.includes('.sql')) fallbackFilename = 'query.sql';
        else if (userPromptLower.includes('bash') || userPromptLower.includes('shell') || userPromptLower.includes('.sh')) fallbackFilename = 'script.sh';
        else if (userPromptLower.includes('batch') || userPromptLower.includes('.bat')) fallbackFilename = 'script.bat';
        else if (userPromptLower.includes('powershell') || userPromptLower.includes('.ps1')) fallbackFilename = 'script.ps1';
        else if (userPromptLower.includes('markdown') || userPromptLower.includes('.md')) fallbackFilename = 'dokumen.md';
        else if (userPromptLower.includes('prd')) fallbackFilename = 'PRD.md';
        else if (userPromptLower.includes('yaml') || userPromptLower.includes('.yml')) fallbackFilename = 'config.yml';
        else if (userPromptLower.includes('php') || userPromptLower.includes('.php')) fallbackFilename = 'index.php';
        else if (userPromptLower.includes('java') || userPromptLower.includes('.java')) fallbackFilename = 'Main.java';
        else if (userPromptLower.includes('cpp') || userPromptLower.includes('.cpp')) fallbackFilename = 'main.cpp';
        else if (userPromptLower.includes('go') || userPromptLower.includes('.go')) fallbackFilename = 'main.go';
        else if (userPromptLower.includes('rust') || userPromptLower.includes('.rs')) fallbackFilename = 'main.rs';
        else fallbackFilename = 'dokumen_bre_ai.txt';
      }

      generatedFiles.push(fallbackFilename);
      const guaranteedFn = fallbackFilename;
      const guaranteedContent = fallbackContent;
      outboundActions.push(async () => {
        await api.sendTelegramDocument(
          chatId,
          guaranteedFn,
          guaranteedContent,
          `📄 *Berkas Unduhan:* \`${guaranteedFn}\`\n_Dibuat otomatis oleh Bre AI_`,
          token
        );
      });
    }
  }

  // Clean trailing empty lines
  textToDeliver = textToDeliver.trim();

  // Send main text response (or edit loading message)
  if (textToDeliver) {
    await api.sendTelegramMessage(chatId, textToDeliver, null, null, token, loadingMsgId);
  } else if (loadingMsgId) {
    await api.editTelegramMessage(chatId, loadingMsgId, '✨ *Pesan interaktif berhasil dikirim!*', null, token);
  }

  // Execute all rich media outbound actions sequentially
  for (const action of outboundActions) {
    try {
      await action();
      await new Promise(r => setTimeout(r, 200));
    } catch (actErr) {
      console.warn('[TelegramBot] Gagal kirim media non-teks:', actErr.message);
    }
  }

  return { deliveredText: textToDeliver, mediaCount: outboundActions.length };
}

module.exports = {
  processAndSendOutboundMedia,
  checkWantsFile,
  extractFilenameFromPrompt,
  EXT_MAP
};
