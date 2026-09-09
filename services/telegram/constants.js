// ========================================================
// Bre AI v3.0 - Telegram Service Constants & Shared State
// Created by Amirun Rayan Ariandi
// ========================================================

const {
  LANGUAGE_OPTIONS: SHARED_LANGUAGES,
  getConfig,
  saveConfig
} = require('../../api/_shared');

// Per-chat language and style selections (in-memory state)
const chatLanguages = new Map(); // chatId -> languageCode ('id', 'en', 'ja', etc.)
const chatStyles = new Map();    // chatId -> styleCode ('santai', 'jakarta', 'jawa_halus', etc.)

// Multi-language options synchronized with core API
const LANGUAGE_OPTIONS = SHARED_LANGUAGES || {
  id: { label: '🇮🇩 Bahasa Indonesia', name: 'Bahasa Indonesia', prompt: 'Responlah dalam Bahasa Indonesia secara alami, cerdas, dan akurat.', instruction: 'Anda WAJIB menjawab secara alami, akurat, dan fasih dalam Bahasa Indonesia.' },
  en: { label: '🇺🇸 English', name: 'English', prompt: 'You MUST respond EXCLUSIVELY and FLUENTLY in English. Even if the user asks in Indonesian, answer in English.', instruction: 'You MUST respond EXCLUSIVELY and FLUENTLY in English. Even if the user asks or greets in Indonesian or another language, your entire response MUST be in English.' },
  ja: { label: '🇯🇵 日本語 (Japanese)', name: 'Japanese', prompt: '回答は必ず自然で流暢な日本語で行ってください。ユーザーが他の言語で質問しても、常に日本語で回答してください。', instruction: '回答は必ず自然で正確な日本語で行ってください。ユーザーが他の言語で話しかけても、常に流暢な日本語で回答してください。' },
  zh: { label: '🇨🇳 中文 (Chinese)', name: 'Chinese', prompt: '请始终使用自然流畅的中文进行回答。即使用户使用其他语言提问，也必须用中文回答。', instruction: '请始终使用自然、准确且流畅的中文进行回答。即使提问使用了印尼语或其他语言，您的所有回复也必须是中文。' },
  es: { label: '🇪🇸 Español (Spanish)', name: 'Spanish', prompt: 'Responde siempre en español fluido y natural. Incluso si el usuario pregunta en indonesio, responde en español.', instruction: 'Debes responder SIEMPRE de manera fluida, natural y precisa en español. Incluso si el usuario pregunta en indonesio u otro idioma, toda tu response debe estar en español.' },
  ar: { label: '🇸🇦 العربية (Arabic)', name: 'Arabic', prompt: 'أجب باللغة العربية الفصحى الطبيعية والدقيقة دائماً. حتى لو سأل المستخدم بلغة أخرى، يجب أن تجيب بالعربية.', instruction: 'يجب عليك دائماً الإجابة باللغة العربية الفصحى الطبيعية والدقيقة. حتى لو تحدث المستخدم باللغة الإندونيسية أو لغة أخرى، يجب أن تكون إجابتك بالكامل باللغة العربية.' },
  de: { label: '🇩🇪 Deutsch (German)', name: 'German', prompt: 'Antworte immer auf natürlichem und präzisem Deutsch. Selbst wenn der Benutzer auf Indonesisch fragt, antworte auf Deutsch.', instruction: 'Du musst IMMER auf fließendem, präzisem und natürlichem Deutsch antworten. Selbst wenn der Benutzer auf Indonesisch atau in einer anderen Sprache fragt, muss die gesamte Antwort auf Deutsch sein.' },
  fr: { label: '🇫🇷 Français (French)', name: 'French', prompt: 'Répondez toujours en français soigné et naturel. Même si l\'utilisateur pose une question en indonésien, répondez en français.', instruction: 'Vous devez TOUJOURS répondre de manière fluide, soignée et naturelle en français. Même si l\'utilisateur pose une question en indonésien ou dans une autre langue, votre réponse doit être en français.' },
  ru: { label: '🇷🇺 Русский (Russian)', name: 'Russian', prompt: 'Всегда отвечайте на естественном и грамотном русском языке. Даже если пользователь спрашивает на индонезийском, отвечайте по-русски.', instruction: 'Всегда отвечайте ИСКЛЮЧИТЕЛЬНО на естественном, грамотном и точном русском языке. Даже если пользователь обращается на индонезийском или другом языке, весь ваш ответ должен быть на русском языке.' },
  ko: { label: '🇰🇷 한국어 (Korean)', name: 'Korean', prompt: '항상 자연스럽고 유창한 한국어로 답변해 주세요. 사용자가 인도네시아어로 질문하더라도 한국어로 답변하세요.', instruction: '항상 자연스럽고 유창한 한국어로만 답변해 주세요. 사용자가 인도네시아어나 다른 언어로 질문하더라도 모든 답변은 반드시 한국어로 작성되어야 합니다.' }
};

/**
 * Normalizes input language name or code into supported canonical code ('id', 'en', etc.)
 */
function resolveLanguageCode(input) {
  if (!input || typeof input !== 'string') return null;
  let clean = input.trim().toLowerCase().replace(/^[/#]/, '');
  clean = clean.replace(/^(bahasa|language|lang|setlang|setbahasa)\s+/i, '').trim();
  if (LANGUAGE_OPTIONS[clean]) return clean;

  const aliasMap = {
    // Indonesian
    'id': 'id', 'ind': 'id', 'indo': 'id', 'indonesia': 'id', 'bahasa': 'id', 'bahasaindonesia': 'id', 'indonesian': 'id',
    // English
    'en': 'en', 'eng': 'en', 'english': 'en', 'inggris': 'en', 'us': 'en', 'uk': 'en', 'amerika': 'en',
    // Japanese
    'ja': 'ja', 'jp': 'ja', 'jpn': 'ja', 'japan': 'ja', 'japanese': 'ja', 'jepang': 'ja', 'nihon': 'ja', 'nihongo': 'ja',
    // Chinese
    'zh': 'zh', 'cn': 'zh', 'chn': 'zh', 'chinese': 'zh', 'mandarin': 'zh', 'cina': 'zh', 'tiongkok': 'zh', 'zhongwen': 'zh',
    // Spanish
    'es': 'es', 'esp': 'es', 'spain': 'es', 'spanish': 'es', 'spanyol': 'es', 'espanol': 'es',
    // Arabic
    'ar': 'ar', 'ara': 'ar', 'arab': 'ar', 'arabic': 'ar', 'arabik': 'ar', 'arabiyah': 'ar',
    // German
    'de': 'de', 'ger': 'de', 'deu': 'de', 'german': 'de', 'jerman': 'de', 'deutsch': 'de',
    // French
    'fr': 'fr', 'fra': 'fr', 'fre': 'fr', 'french': 'fr', 'prancis': 'fr', 'perancis': 'fr', 'francais': 'fr',
    // Russian
    'ru': 'ru', 'rus': 'ru', 'russian': 'ru', 'rusia': 'ru', 'russkiy': 'ru',
    // Korean
    'ko': 'ko', 'kor': 'ko', 'kr': 'ko', 'korean': 'ko', 'korea': 'ko', 'hangul': 'ko'
  };

  return aliasMap[clean] || null;
}

/**
 * Retrieves the current language preference for a given userId
 * Selalu gunakan String(chatId) sebagai canonical key.
 */
function getUserLanguage(chatId) {
  if (!chatId) return 'id';
  const key = String(chatId);
  const val = chatLanguages.get(key);
  if (val && LANGUAGE_OPTIONS[val]) return val;

  try {
    const cfg = getConfig();
    if (Array.isArray(cfg.telegramUsers)) {
      const user = cfg.telegramUsers.find(u => String(u.id) === key);
      if (user && user.language && LANGUAGE_OPTIONS[user.language]) {
        chatLanguages.set(key, user.language);
        return user.language;
      }
    }
    if (cfg.telegramLanguage && LANGUAGE_OPTIONS[cfg.telegramLanguage]) {
      return cfg.telegramLanguage;
    }
  } catch (e) {}

  return 'id';
}

/**
 * Saves and persists user language selection in memory and config.json
 * Selalu gunakan String(chatId) sebagai canonical key.
 */
function saveUserLanguage(chatId, langCode) {
  if (!chatId || !langCode) return false;
  const canonical = resolveLanguageCode(String(langCode)) || String(langCode);
  if (!LANGUAGE_OPTIONS[canonical]) return false;

  const key = String(chatId);
  chatLanguages.set(key, canonical);

  try {
    const cfg = getConfig();
    const users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
    const idx = users.findIndex(u => String(u.id) === key);
    if (idx >= 0) {
      users[idx] = { ...users[idx], language: canonical };
    } else {
      users.push({ id: key, language: canonical, role: 'user' });
    }
    saveConfig({ telegramUsers: users });
  } catch (e) {
    console.warn('[saveUserLanguage] Failed to persist into config.json:', e.message);
  }

  return true;
}

/**
 * Retrieves the current style preference for a given userId
 * Selalu gunakan String(chatId) sebagai canonical key.
 */
function getUserStyle(chatId) {
  if (!chatId) return 'santai';
  const key = String(chatId);
  const val = chatStyles.get(key);
  if (val) return val;

  try {
    const cfg = getConfig();
    if (Array.isArray(cfg.telegramUsers)) {
      const user = cfg.telegramUsers.find(u => String(u.id) === key);
      if (user && user.style) {
        chatStyles.set(key, user.style);
        return user.style;
      }
    }
    return cfg.telegramStyle || cfg.defaultStyle || 'santai';
  } catch (e) {}

  return 'santai';
}

/**
 * Saves and persists user style selection in memory and config.json
 * Selalu gunakan String(chatId) sebagai canonical key.
 */
function saveUserStyle(chatId, styleCode) {
  if (!chatId || !styleCode) return false;
  const key = String(chatId);
  chatStyles.set(key, styleCode);

  try {
    const cfg = getConfig();
    const users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
    const idx = users.findIndex(u => String(u.id) === key);
    if (idx >= 0) {
      users[idx] = { ...users[idx], style: styleCode };
    } else {
      users.push({ id: key, style: styleCode, role: 'user' });
    }
    saveConfig({ telegramUsers: users });
  } catch (e) {
    console.warn('[saveUserStyle] Failed to persist into config.json:', e.message);
  }

  return true;
}

/**
 * Preload persisted preferences from config.json into memory
 * Selalu gunakan String sebagai canonical key.
 */
function initUserPreferences() {
  try {
    const cfg = getConfig();
    if (Array.isArray(cfg.telegramUsers)) {
      for (const u of cfg.telegramUsers) {
        if (u.id) {
          const key = String(u.id);
          if (u.language) chatLanguages.set(key, u.language);
          if (u.style) chatStyles.set(key, u.style);
        }
      }
    }
  } catch (e) {}
}

// Preload on startup
initUserPreferences();

// Map file extensions and MIME types to universal file categories
function getCategoryFromFilename(filename = '', mimeType = '') {
  const ext = (filename || '').split('.').pop() || '';
  const e = ext.toLowerCase();
  const m = (mimeType || '').toLowerCase();

  const codeAndTextExts = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'pyw', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'json', 'jsonc',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh', 'java', 'kt', 'kts', 'rs', 'go',
    'php', 'phtml', 'rb', 'rbw', 'swift', 'dart', 'lua', 'r', 'pl', 'pm', 't',
    'scala', 'sc', 'groovy', 'gvy', 'asm', 's', 'v', 'sv', 'vhd', 'vhdl', 'jl',
    'ex', 'exs', 'erl', 'hrl', 'clj', 'cljs', 'edn', 'hs', 'lhs', 'nim', 'cr',
    'zig', 'odin', 'pas', 'pp', 'd', 'sol', 'vy', 'proto', 'graphql', 'gql',
    'csv', 'tsv', 'tab', 'xml', 'svg', 'yaml', 'yml', 'env', 'log', 'ini', 'cfg',
    'conf', 'config', 'toml', 'properties', 'dockerfile', 'containerfile', 'gitignore',
    'gitattributes', 'editorconfig', 'cmake', 'makefile', 'mk', 'gradle', 'lock',
    'tex', 'bib', 'diff', 'patch', 'nfo', 'srt', 'vtt', 'ass', 'sub', 'lrc', 'prd'
  ];

  if (codeAndTextExts.includes(e) || m.startsWith('text/') || m.includes('json') || m.includes('javascript') || m.includes('xml')) {
    return 'code_or_text';
  }
  if (['pdf'].includes(e) || m.includes('pdf')) return 'pdf_document';
  if (['doc', 'docx', 'rtf', 'odt', 'pages'].includes(e) || m.includes('word') || m.includes('officedocument.wordprocessingml')) return 'word_document';
  if (['xls', 'xlsx', 'ods', 'csv', 'numbers'].includes(e) || m.includes('excel') || m.includes('spreadsheetml')) return 'spreadsheet';
  if (['ppt', 'pptx', 'odp', 'key'].includes(e) || m.includes('powerpoint') || m.includes('presentationml')) return 'presentation';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'pkg', 'deb', 'rpm'].includes(e) || m.includes('zip') || m.includes('compressed') || m.includes('tar') || m.includes('archive')) return 'archive';
  if (['apk', 'aab', 'ipa', 'exe', 'msi', 'dll', 'so', 'dylib', 'bin', 'dat', 'wasm', 'dex'].includes(e)) return 'executable_or_package';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'].includes(e) || m.startsWith('audio/')) return 'audio_file';
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', '3gp'].includes(e) || m.startsWith('video/')) return 'video_file';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'ico', 'psd', 'ai', 'eps'].includes(e) || m.startsWith('image/')) return 'image_file';
  return 'general_file';
}

const getFileCategory = getCategoryFromFilename;

module.exports = {
  chatLanguages,
  chatStyles,
  LANGUAGE_OPTIONS,
  resolveLanguageCode,
  getUserLanguage,
  saveUserLanguage,
  getUserStyle,
  saveUserStyle,
  initUserPreferences,
  getCategoryFromFilename,
  getFileCategory
};
