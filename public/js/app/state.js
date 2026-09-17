// ==========================================================================
// BRE AI - State Management & Global Variables
// File: public/js/app/state.js
// ==========================================================================

let chats = [], activeChat = null, files = [];
let generating = false, ctrl = null;
let generationSequence = 0;
let clientApiKey = sessionStorage.getItem('bre_client_api_key') || '';
let mic = null, recording = false, autoTTS = false;
let persona = 'default', sandboxCode = '';
let currentLang = localStorage.getItem('bre_lang') || 'auto';
let currentTheme = localStorage.getItem('bre_theme') || 'system';
let currentStyle = localStorage.getItem('bre_style') || 'santai';

// AI Parameters & State Enhancements
let selectedModel = localStorage.getItem('bre_model') || 'mercury-2';
let temperature = parseFloat(localStorage.getItem('bre_temp') || '0.7');
let maxTokens = parseInt(localStorage.getItem('bre_maxtokens') || '4096', 10);
let contextMessages = parseInt(localStorage.getItem('bre_context_msgs') || '30', 10);
if (!Number.isFinite(contextMessages) || contextMessages < 2) contextMessages = 30;
if (contextMessages > 200) contextMessages = 200;
let chatSearchQuery = '';
let editingMsgIdx = null;
let unreadWhileScrolled = 0;
let currentArtifact = null;

// Enterprise Features State
let isIncognito = false;
let tempIncognitoChat = null;
let isWebSearch = localStorage.getItem('bre_web_search') === 'true';
let customPersonas = [];
let chatEndpoints = [];
let selectedProvider = localStorage.getItem('bre_provider') || 'auto';

const STYLE_LABELS = {
  santai: '✨ Santai & Friendly',
  jakarta: '🗣️ Jakarta / Gaul (Gue-Lu)',
  jawa_halus: '🙏 Jawa Halus (Kromo)',
  jawa_kasar: '😎 Jawa Kasar / Ngoko',
  sunda: '🍃 Sunda (Akrab)',
  sopan: '👔 Sopan & Formal',
  medan: '⚡ Medan / Batak',
  makassar: '🌊 Makassar / Bugis',
  standar: '🤖 Standar Bre AI'
};

const STYLE_PROMPTS = {
  santai: `[GAYA BAHASA & TONE]:
- Gunakan gaya bahasa santai, ramah, hangat, dan bersahabat layaknya teman diskusi yang asyik.
- Boleh gunakan kosakata kasual yang natural (misal: "yuk", "nih", "oke", "siap", "mantap").
- Tetap berikan informasi yang akurat, berbobot, dan solutif.`,

  jakarta: `[GAYA BAHASA & TONE - JAKARTA / GAUL]:
- Gunakan gaya bahasa percakapan khas Jakarta / Betawi gaul (kata ganti: "gue" / "gua" dan "lu" / "lo").
- Gunakan partikel & slang khas Jakarta yang luwes (misal: "nih", "tuh", "banget", "beneran", "udah", "dong", "gitu", "asik", "kuy", "santuy").
- Nada bicara asik, santai, ceplas-ceplos bersahabat, tapi tetap cerdas dan membantu.`,

  jawa_halus: `[GAYA BAHASA & TONE - JAWA HALUS / KROMO]:
- Gunakan bahasa yang sopan, santun, dan halus dengan sentuhan unggah-ungguh budaya Jawa (Kromo Inggil).
- Sisipkan kata sapaan dan ungkapan santun khas Jawa (misal: "Nggih", "Matur nuwun", "Monggo", "Pripun", "Saestu", "Dalem", "Nyuwun sewu").
- Bersikap sangat rendah hati, ramah, dan menghormati pengguna (tata krama luhur).`,

  jawa_kasar: `[GAYA BAHASA & TONE - JAWA NGOKO / AKRAB]:
- Gunakan gaya bahasa Jawa Ngoko yang medok, akrab, santai, dan blak-blakan layaknya sahabat karib (cangkrukan).
- Sisipkan kata-kata khas Jawa ngoko yang ekspresif (misal: "Rek", "Cak", "Bro", "Iki", "Piye", "Mantep tenan", "Wes", "Ojo lali", "Iyo").
- Bersahabat, humoris, guyub, dan seru tanpa rasa kaku.`,

  sunda: `[GAYA BAHASA & TONE - SUNDA]:
- Gunakan gaya bahasa yang ramah, sopan, lembut, dan bersahabat dengan sentuhan bahasa Sunda.
- Sisipkan partikel dan kosakata khas Sunda yang akrab (misal: "Punten", "Hatur nuhun", "Muhun", "Euy", "Atuh", "Teh", "Kang / Teteh", "Kumaha", "Sugan").
- Nada tutur kata manis, penuh kehangatan, dan bersahaja.`,

  sopan: `[GAYA BAHASA & TONE - SOPAN & FORMAL]:
- Gunakan Bahasa Indonesia yang baik, benar, formal, elegan, dan profesional.
- Gunakan kata ganti "Saya" dan "Anda".
- Struktur kalimat rapi, berwibawa, objektif, dan sangat menghargai pengguna.`,

  medan: `[GAYA BAHASA & TONE - MEDAN / BATAK]:
- Gunakan gaya bahasa khas Medan/Batak yang enerjik, tegas, blak-blakan, bersahabat, dan bersemangat.
- Sisipkan kosakata & sapaan khas Medan (misal: "Horas", "Lae", "Ito", "Kelen", "Kombur", "Kali", "Mantap kali", "Tengoklah", "Bah").
- Nada bicara lugas, percaya diri, hangat, dan solutif.`,

  makassar: `[GAYA BAHASA & TONE - MAKASSAR / BUGIS]:
- Gunakan gaya bahasa khas Makassar/Bugis yang akrab, hangat, dan bersahabat.
- Sisipkan partikel & kata khas Makassar (misal: "Tabe'", "Ji", "Mi", "Mo", "Ki'", "Tawwa", "Beda'na", "Iye'").
- Nada bicara ramah, bersahaja, dan penuh rasa kekeluargaan.`,

  standar: `[GAYA BAHASA & TONE - STANDAR BRE AI]:
- Berikan respon dengan gaya khas Bre AI yang cerdas, lugas, netral, dan solutif.`
};

const PERSONAS = {
  default:    '',
  coder:      'Act as a Principal Software Engineer. Provide world-class architecture, clean, modular, and robust code following industry best practices. Output complete and executable code.',
  prd:        'Act as a Lead Product Manager (PRD Specialist). Generate comprehensive Product Requirement Documents (PRDs) including: Objectives, User Personas, User Stories, Functional & Non-Functional Requirements, Wireframe Specs, Success Metrics (KPIs), and Roadmap. Specify file name on the first line of the codeblock.',
  uiux:       'Act as a Lead UI/UX & Modern Frontend Engineer. Design sleek, modern, and accessible user interfaces. Output production-ready HTML, Tailwind CSS, and interactive JavaScript.',
  math:       'Act as a Senior Scientist & Mathematician. Use KaTeX notation ($...$ inline, $$...$$ display) for all mathematical, physics, and statistical formulations.',
  security:   'Act as a Senior Cybersecurity & Penetration Testing Specialist. Provide in-depth security audits, vulnerability assessments (OWASP Top 10), threat modeling, and defensive mitigations.',
  writer:     'Act as a Master Copywriter & Creative Author. Deliver persuasive, high-impact, articulate, and engaging copy with natural narrative flow.',
  business:   'Act as a Senior Financial & Business Strategy Consultant. Provide market analysis, financial projections, monetization models, SWOT analysis, and ROI evaluations.',
  academic:   'Act as a Senior Academic Researcher. Structure literature reviews, empirical research methodologies, and scholarly paper frameworks with credible reference standards.',
  ml:         'Act as a Principal AI & Machine Learning Engineer. Architect AI pipelines, RAG systems, model fine-tuning, prompt engineering, and inference optimizations.',
  legal:      'Act as a Legal & Corporate Compliance Consultant. Review contractual clauses, regulatory risk frameworks, IP protection, and compliance advisory.',
  medical:    'Act as a Medical & Life Sciences Consultant. Explain physiological mechanisms, pharmacology, biochemistry, and biomedical literature with rigorous scientific precision.',
  translator: 'Act as a Master Polyglot Translator. Deliver high-fidelity translations preserving cultural nuances, idioms, tone, and grammar.',
  philosophy: 'Act as a Senior Philosopher & Critical Rationalist. Dissect complex philosophical concepts, epistemological logic, and ethical dilemmas with analytical depth.'
};

const LANGUAGE_PROMPTS = {
  auto: '',
  en: 'Respond in English by default.',
  id: 'Responlah dalam Bahasa Indonesia secara alami dan akurat.',
  ja: '常に自然で流暢な日本語で回答してください。',
  zh: '请始终使用自然流畅的中文进行回答。',
  es: 'Responde siempre en español de manera natural y precisa.',
  ar: 'أجب باللغة العربية الفصحى الطبيعية والدقيقة دائماً.',
  de: 'Antworte immer auf natürlichem und präzisem Deutsch.',
  fr: 'Répondez toujours en français soigné et naturel.',
  ru: 'Всегда отвечайте на естественном и грамотном русском языке.',
  ko: '항상 자연스럽고 유창한 한국어로 답변해 주세요.'
};

const I18N = {
  en: {
    modalTitle: 'Settings & Preferences',
    lblLanguage: '🌐 Language / Bahasa',
    lblTheme: 'Appearance Theme',
    themeLight: '☀️ Light',
    themeDark: '🌙 Dark',
    themeSystem: '💻 System',
    lblData: 'Chat History (Data)',
    lblChatsCount: 'Chats',
    lblMsgsCount: 'Messages',
    btnExport: '📥 Export JSON',
    btnClearAll: '🗑️ Clear All History',
    btnCloseModal: 'Close',
    msgPlaceholder: 'Message Bre AI...',
    footerHint: 'Bre AI can make mistakes. Check important info.',
    emptyGreeting: 'Engineered exclusively by <b>Amirun Rayan Ariandi</b>. How can I assist you today?',
    suggVision: '🖼️ Analyze Image',
    suggPrd: '📄 Generate .PRD File',
    suggCode: '⚡ Architecture Code',
    copied: 'Copied to clipboard',
    clearedToast: 'All chat history cleared'
  },
  id: {
    modalTitle: 'Pengaturan & Preferensi',
    lblLanguage: '🌐 Bahasa / Language',
    lblTheme: 'Tema Tampilan',
    themeLight: '☀️ Cahaya',
    themeDark: '🌙 Gelap',
    themeSystem: '💻 Sistem',
    lblData: 'Riwayat Percakapan (Data)',
    lblChatsCount: 'Sesi Chat',
    lblMsgsCount: 'Total Pesan',
    btnExport: '📥 Ekspor JSON',
    btnClearAll: '🗑️ Hapus Semua Riwayat',
    btnCloseModal: 'Tutup',
    msgPlaceholder: 'Kirim pesan ke Bre AI...',
    footerHint: 'Bre AI dapat membuat kesalahan. Periksa info penting.',
    emptyGreeting: 'Diciptakan eksklusif oleh <b>Amirun Rayan Ariandi</b>. Apa yang ingin Anda kerjakan hari ini?',
    suggVision: '🖼️ Analisa Gambar',
    suggPrd: '📄 Buat File .PRD',
    suggCode: '⚡ Kode Arsitektur',
    copied: 'Teks disalin ke clipboard',
    clearedToast: 'Semua riwayat percakapan telah dibersihkan'
  },
  ja: {
    modalTitle: '設定とデータ',
    lblLanguage: '🌐 言語 / Language',
    lblTheme: '外観テーマ',
    themeLight: '☀️ ライト',
    themeDark: '🌙 ダーク',
    themeSystem: '💻 システム',
    lblData: 'チャット履歴 (データ)',
    lblChatsCount: 'チャット数',
    lblMsgsCount: '総メッセージ数',
    btnExport: '📥 JSONエクスポート',
    btnClearAll: '🗑️ 履歴を全て削除',
    btnCloseModal: '閉じる',
    msgPlaceholder: 'Bre AIにメッセージを送信...',
    footerHint: 'AIは不正確な情報を生成する場合があります。',
    emptyGreeting: '<b>Amirun Rayan Ariandi</b> による開発。どのようなご用件でしょうか？',
    suggVision: '🖼️ 画像分析',
    suggPrd: '📄 PRDファイル生成',
    suggCode: '⚡ アーキテクチャ設計',
    copied: 'クリップボードにコピーしました',
    clearedToast: '履歴がクリアされました'
  },
  zh: {
    modalTitle: '设置与数据',
    lblLanguage: '🌐 语言 / Language',
    lblTheme: '外观主题',
    themeLight: '☀️ 浅色',
    themeDark: '🌙 深色',
    themeSystem: '💻 系统',
    lblData: '对话历史 (数据)',
    lblChatsCount: '对话数',
    lblMsgsCount: '消息总数',
    btnExport: '📥 导出 JSON',
    btnClearAll: '🗑️ 清除所有历史',
    btnCloseModal: '关闭',
    msgPlaceholder: '发送消息给 Bre AI...',
    footerHint: 'Bre AI 可能会提供不准确的信息。',
    emptyGreeting: '由 <b>Amirun Rayan Ariandi</b> 独家开发。今天有什么我可以帮您的吗？',
    suggVision: '🖼️ 图像分析',
    suggPrd: '📄 生成 PRD 文档',
    suggCode: '⚡ 架构代码',
    copied: '已复制到剪贴板',
    clearedToast: '所有历史记录已清除'
  }
};

const WEB_EXT_MAP = {
  javascript: 'script.js', js: 'script.js', node: 'script.js',
  typescript: 'script.ts', ts: 'script.ts',
  html: 'index.html', htm: 'index.html',
  css: 'style.css', scss: 'style.scss', sass: 'style.sass', less: 'style.less',
  python: 'script.py', py: 'script.py', pyw: 'script.py',
  json: 'data.json', jsonc: 'data.json',
  csv: 'data.csv', tsv: 'data.tsv',
  sql: 'query.sql',
  yaml: 'config.yml', yml: 'config.yml',
  xml: 'data.xml', svg: 'image.svg',
  env: '.env', ini: 'config.ini', cfg: 'config.cfg', conf: 'config.conf', toml: 'config.toml',
  bash: 'script.sh', sh: 'script.sh', shell: 'script.sh', zsh: 'script.sh',
  batch: 'script.bat', bat: 'script.bat', cmd: 'script.bat',
  powershell: 'script.ps1', ps1: 'script.ps1',
  php: 'index.php',
  cpp: 'main.cpp', 'c++': 'main.cpp', c: 'main.c', h: 'header.h', hpp: 'header.hpp',
  java: 'Main.java', kotlin: 'Main.kt', kt: 'Main.kt',
  go: 'main.go', golang: 'main.go',
  rust: 'main.rs', rs: 'main.rs',
  ruby: 'script.rb', rb: 'script.rb',
  dart: 'main.dart', swift: 'main.swift',
  lua: 'script.lua', r: 'script.r',
  perl: 'script.pl', pl: 'script.pl',
  markdown: 'document.md', md: 'document.md',
  text: 'catatan.txt', txt: 'catatan.txt', plain: 'catatan.txt',
  dockerfile: 'Dockerfile', docker: 'Dockerfile',
  prd: 'product_requirements.prd'
};

function clientHeaders() {
  return clientApiKey ? { 'x-api-key': clientApiKey } : {};
}

function saveClientApiKey() {
  const el = document.getElementById('clientApiKey');
  clientApiKey = el ? el.value.trim() : '';
  sessionStorage.setItem('bre_client_api_key', clientApiKey);
  localStorage.removeItem('bre_client_api_key');
  if (typeof toast === 'function') {
    toast('API key tersimpan untuk sesi tab ini', 'ok');
  }
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function safeLink(value) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '#';
  } catch {
    return '#';
  }
}

function gv(id) {
  return document.getElementById(id)?.value || '';
}

function sv(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

function normalizeChats(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(c => c && Array.isArray(c.msgs)).slice(0, 500).map(c => ({
    ...c,
    id: /^[\w-]{1,80}$/.test(c.id) ? c.id : 'c' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()),
    title: String(c.title || 'Conversation'),
    msgs: c.msgs.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-500).map(m => ({
      ...m,
      isTyping: false,
      searchSources: Array.isArray(m.searchSources) ? m.searchSources.filter(s => s && typeof s.url === 'string') : []
    }))
  }));
}

function loadChats() {
  try {
    chats = normalizeChats(JSON.parse(localStorage.getItem('bre_chats') || '[]'));
  } catch (e) {
    chats = [];
  }
}

function saveChats() {
  if (isIncognito) return; // Incognito mode: never save ephemeral chat
  try {
    localStorage.setItem('bre_chats', JSON.stringify(chats));
  } catch {
    if (typeof toast === 'function') {
      toast('Penyimpanan browser penuh. Ekspor riwayat lalu hapus chat lama.', 'err');
    }
  }
}

function loadCustomPersonas() {
  try {
    customPersonas = JSON.parse(localStorage.getItem('bre_custom_personas') || '[]');
    if (!Array.isArray(customPersonas)) customPersonas = [];
    customPersonas = customPersonas.filter(p => p && /^custom_[\w-]+$/.test(p.id) && typeof p.prompt === 'string' && typeof p.name === 'string');
  } catch (e) {
    customPersonas = [];
  }
  if (typeof updatePersonaSelectDropdown === 'function') {
    updatePersonaSelectDropdown();
  }
}

function saveCustomPersonasToStorage() {
  localStorage.setItem('bre_custom_personas', JSON.stringify(customPersonas));
  if (typeof updatePersonaSelectDropdown === 'function') updatePersonaSelectDropdown();
  if (typeof renderCustomPersonasList === 'function') renderCustomPersonasList();
}

const saveCustomPersonas = saveCustomPersonasToStorage;
