// ========================================================
// Bre AI v3.0 - Telegram Service Constants & Shared State
// Created by Amirun Rayan Ariandi
// ========================================================

// Per-chat language and style selections (in-memory state)
const chatLanguages = new Map(); // chatId -> languageCode ('id', 'en', 'ja', etc.)
const chatStyles = new Map();    // chatId -> styleCode ('santai', 'jakarta', 'jawa_halus', etc.)

// Multi-language options matching web app prompts
const LANGUAGE_OPTIONS = {
  id: { label: '🇮🇩 Bahasa Indonesia', prompt: 'Responlah dalam Bahasa Indonesia secara alami dan akurat.' },
  en: { label: '🇺🇸 English', prompt: 'Respond in English by default.' },
  ja: { label: '🇯🇵 日本語 (Japanese)', prompt: '常に自然で流暢な日本語で回答してください。' },
  zh: { label: '🇨🇳 中文 (Chinese)', prompt: '请始终使用自然流畅的中文进行回答。' },
  es: { label: '🇪🇸 Español (Spanish)', prompt: 'Responde siempre en español de manera natural y precisa.' },
  ar: { label: '🇸🇦 العربية (Arabic)', prompt: 'أجب باللغة العربية الفصحى الطبيعية والدقيقة دائماً.' },
  de: { label: '🇩🇪 Deutsch (German)', prompt: 'Antworte immer auf natürlichem und präzisem Deutsch.' },
  fr: { label: '🇫🇷 Français (French)', prompt: 'Répondez toujours en français soigné et naturel.' },
  ru: { label: '🇷🇺 Русский (Russian)', prompt: 'Всегда отвечайте на естественном и грамотном русском языке.' },
  ko: { label: '🇰🇷 한국어 (Korean)', prompt: '항상 자연스럽고 유창한 한국어로 답변해 주세요.' }
};

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
  getCategoryFromFilename,
  getFileCategory
};
