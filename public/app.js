// ==========================================================================
// BRE AI - Premium Multi-Language Engine with Vision & File Downloads
// Created by Amirun Rayan Ariandi
// ==========================================================================

let chats = [], activeChat = null, files = [];
let generating = false, ctrl = null;
let mic = null, recording = false, autoTTS = false;
let persona = 'default', sandboxCode = '';
let currentLang = localStorage.getItem('bre_lang') || 'en';
let currentTheme = localStorage.getItem('bre_theme') || 'system';
let currentStyle = localStorage.getItem('bre_style') || 'santai';

// AI Parameters & State Enhancements
let selectedModel = localStorage.getItem('bre_model') || 'mercury-2';
let temperature = parseFloat(localStorage.getItem('bre_temp') || '0.7');
let maxTokens = parseInt(localStorage.getItem('bre_maxtokens') || '4096', 10);
let chatSearchQuery = '';
let editingMsgIdx = null;
let unreadWhileScrolled = 0;
let currentArtifact = null;

// Enterprise Features State
let isIncognito = false;
let tempIncognitoChat = null;
let isWebSearch = localStorage.getItem('bre_web_search') === 'true';
let customPersonas = [];

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

document.addEventListener('DOMContentLoaded', () => {
  if (window.marked) marked.setOptions({ breaks: true, gfm: true });
  initTheme();
  initLanguage();
  initStyle();
  initParams();
  initModelSelect();
  loadCustomPersonas();
  initWebSearchUI();
  setupKeyboardShortcuts();
  loadChats();
  setupInput();
  renderAttachBar();
  setupDrop();
  setupPaste();
  setupSTT();
  setupScrollDetection();
  initMotivationBanner();
  if (!chats.length) newChat(); else switchChat(chats[0].id);
});

// 🌅 Motivasi Harian - banner Web Chat (sinkron dengan Telegram, 2x sehari)
function initMotivationBanner() {
  const check = async () => {
    try {
      const r = await fetch('/api/motivation');
      if (!r.ok) return;
      const data = await r.json();
      if (!data || !data.enabled || !data.lastSent || !data.lastSent.slot) return;
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayPrefix = `${y}-${m}-${d} `;
      if (!String(data.lastSent.slot).startsWith(todayPrefix)) return;
      const seenKey = 'bre_motiv_seen_' + data.lastSent.slot;
      let seen;
      try { seen = localStorage.getItem(seenKey); } catch (e) {}
      if (seen) return;
      try { localStorage.setItem(seenKey, '1'); } catch (e) {}
      toast(`🌅 ${data.lastSent.quote}`, 'ok');
    } catch (e) {}
  };
  check();
  setInterval(check, 5 * 60 * 1000);
}

function initStyle() {
  const sel = document.getElementById('styleSelect');
  if (sel) sel.value = currentStyle;
  const modalSel = document.getElementById('modalStyleSelect');
  if (modalSel) modalSel.value = currentStyle;
}

function setStyle(val) {
  currentStyle = val || 'santai';
  localStorage.setItem('bre_style', currentStyle);
  const sel = document.getElementById('styleSelect');
  if (sel) sel.value = currentStyle;
  const modalSel = document.getElementById('modalStyleSelect');
  if (modalSel) modalSel.value = currentStyle;
  const label = STYLE_LABELS[currentStyle] || currentStyle;
  toast('🎭 Gaya Bahasa: ' + label, 'ok');
}

function initLanguage() {
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = currentLang;
  applyLanguage(currentLang);
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('bre_lang', lang);
  applyLanguage(lang);
  renderChatList();
  renderMessages();
  toast('Language updated: ' + lang.toUpperCase(), 'ok');
}

function applyLanguage(lang) {
  const dict = I18N[lang] || I18N.en;
  
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerHTML = txt; };
  
  setTxt('modalTitle', dict.modalTitle);
  setTxt('lblLanguage', dict.lblLanguage);
  setTxt('lblTheme', dict.lblTheme);
  setTxt('themeLight', dict.themeLight);
  setTxt('themeDark', dict.themeDark);
  setTxt('themeSystem', dict.themeSystem);
  setTxt('lblData', dict.lblData);
  setTxt('lblChatsCount', dict.lblChatsCount);
  setTxt('lblMsgsCount', dict.lblMsgsCount);
  setTxt('btnExport', dict.btnExport);
  setTxt('btnClearAll', dict.btnClearAll);
  setTxt('btnCloseModal', dict.btnCloseModal);
  setTxt('footerHint', dict.footerHint);
  
  const msgInput = document.getElementById('msgInput');
  if (msgInput) msgInput.placeholder = dict.msgPlaceholder;
}

// ---- AI PROVIDER SELECTOR ----
let selectedProvider = 'auto';
selectedModel = 'auto';

async function initModelSelect() {
  const sel = document.getElementById('modelSelect');
  if (!sel) return;

  sel.innerHTML = '<option value="auto">✨ Bre AI</option>';
  sel.value = 'auto';
  selectedProvider = 'auto';
  selectedModel = 'auto';
  localStorage.setItem('bre_provider', 'auto');
  localStorage.setItem('bre_model', 'auto');
}

function setProvider(val) {
  selectedProvider = val || 'auto';
  selectedModel = selectedProvider;
  localStorage.setItem('bre_provider', selectedProvider);
  localStorage.setItem('bre_model', selectedModel);
  const sel = document.getElementById('modelSelect');
  const label = sel?.options[sel.selectedIndex]?.textContent || selectedProvider;
  toast('Provider aktif: ' + label, 'ok');
}

function setModel(val) {
  setProvider(val);
}

// ---- PARAMETERS (TEMPERATURE & MAX TOKENS) ----
function initParams() {
  const tempSlider = document.getElementById('tempSlider');
  const tokensSlider = document.getElementById('tokensSlider');
  if (tempSlider) {
    tempSlider.value = temperature;
    updateTemperatureDisplay(temperature);
  }
  if (tokensSlider) {
    tokensSlider.value = maxTokens;
    updateTokensDisplay(maxTokens);
  }
}

function updateTemperature(val) {
  temperature = parseFloat(val);
  localStorage.setItem('bre_temp', temperature.toString());
  updateTemperatureDisplay(temperature);
}

function updateTemperatureDisplay(val) {
  const disp = document.getElementById('tempValDisplay');
  if (!disp) return;
  let label = 'Balanced';
  if (val < 0.4) label = 'Precise';
  else if (val > 0.9) label = 'Creative';
  disp.textContent = `${val} (${label})`;
}

function updateMaxTokens(val) {
  maxTokens = parseInt(val, 10);
  localStorage.setItem('bre_maxtokens', maxTokens.toString());
  updateTokensDisplay(maxTokens);
}

function updateTokensDisplay(val) {
  const disp = document.getElementById('tokensValDisplay');
  if (disp) disp.textContent = `${val} tokens`;
}


function adjustInputHeight() {
  const el = document.getElementById('msgInput');
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.max(38, Math.min(el.scrollHeight, 180));
  el.style.height = newHeight + 'px';
  el.style.overflowY = el.scrollHeight > 180 ? 'auto' : 'hidden';
}

function ensureInputStructure() {
  const box = document.querySelector('.input-box');
  if (!box) return;
  if (box.querySelector('.input-tools-row')) return; // Already has modern row layout

  const msgInput = box.querySelector('#msgInput');
  const attachBtn = box.querySelector('.attach-btn') || box.querySelector('button[title*="Attach"]');
  const fileInput = box.querySelector('#fileInput');
  const webBtn = box.querySelector('.web-search-btn') || box.querySelector('#btnWebSearch');
  const imgBtn = box.querySelector('.img-gen-btn') || box.querySelector('#btnImgGen');
  const micBtn = box.querySelector('.mic-btn') || box.querySelector('#btnMic');
  const sendBtn = box.querySelector('.send-btn') || box.querySelector('#btnSend');

  // Wrap textarea in input-main-wrap if needed
  let mainWrap = box.querySelector('.input-main-wrap');
  if (!mainWrap && msgInput) {
    mainWrap = document.createElement('div');
    mainWrap.className = 'input-main-wrap';
    msgInput.parentNode.insertBefore(mainWrap, msgInput);
    mainWrap.appendChild(msgInput);
  }

  // Create tools row with left and right groupings
  const toolsRow = document.createElement('div');
  toolsRow.className = 'input-tools-row';

  const toolsLeft = document.createElement('div');
  toolsLeft.className = 'input-tools-left';
  if (attachBtn) toolsLeft.appendChild(attachBtn);
  if (fileInput) toolsLeft.appendChild(fileInput);
  if (webBtn) toolsLeft.appendChild(webBtn);
  if (imgBtn) toolsLeft.appendChild(imgBtn);

  const toolsRight = document.createElement('div');
  toolsRight.className = 'input-tools-right';
  if (micBtn) toolsRight.appendChild(micBtn);
  if (sendBtn) toolsRight.appendChild(sendBtn);

  toolsRow.appendChild(toolsLeft);
  toolsRow.appendChild(toolsRight);
  box.appendChild(toolsRow);
}

function setupInput() {
  ensureInputStructure();
  const el = document.getElementById('msgInput');
  if (!el) return;

  el.addEventListener('input', adjustInputHeight);
  el.addEventListener('change', adjustInputHeight);

  el.addEventListener('keydown', e => {
    const isEnter = e.key === 'Enter' || e.keyCode === 13 || e.which === 13;
    if (isEnter) {
      if (e.shiftKey) {
        // Shift + Enter: Buat baris baru (teks ke bawah)
        setTimeout(adjustInputHeight, 0);
      } else {
        // Enter: Kirim pesan
        if (e.isComposing) return;
        e.preventDefault();
        sendOrStop();
      }
    } else if (e.key === 'ArrowUp' && !el.value.trim() && activeChat?.msgs?.length) {
      // Edit last user message shortcut
      for (let i = activeChat.msgs.length - 1; i >= 0; i--) {
        if (activeChat.msgs[i].role === 'user') {
          e.preventDefault();
          startEditUserMsg(i);
          break;
        }
      }
    }
  });
}

function setupDrop() {
  const overlay = document.getElementById('dragOverlay');
  let dragCounter = 0;

  window.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    if (overlay && e.dataTransfer?.types?.includes('Files')) {
      overlay.classList.add('active');
    }
  });

  window.addEventListener('dragover', e => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', e => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay?.classList.remove('active');
    }
  });

  window.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    overlay?.classList.remove('active');
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  });
}


async function compressImage(file, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function extractVideoKeyframesAndMeta(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      try { URL.revokeObjectURL(url); } catch(e){}
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ duration: 0, width: 0, height: 0, frames: [] });
    }, 8000);

    video.onloadedmetadata = async () => {
      const duration = video.duration || 0;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;

      const timestamps = [];
      if (duration > 0) {
        if (duration <= 3) {
          timestamps.push(duration * 0.5);
        } else if (duration <= 10) {
          timestamps.push(1, duration * 0.5, duration - 1);
        } else {
          timestamps.push(duration * 0.15, duration * 0.5, duration * 0.85);
        }
      } else {
        timestamps.push(0);
      }

      const frames = [];
      const canvas = document.createElement('canvas');
      const maxDim = 640;
      let cW = width;
      let cH = height;
      if (cW > maxDim || cH > maxDim) {
        if (cW > cH) {
          cH = Math.round((cH * maxDim) / cW);
          cW = maxDim;
        } else {
          cW = Math.round((cW * maxDim) / cH);
          cH = maxDim;
        }
      }
      canvas.width = cW;
      canvas.height = cH;
      const ctx = canvas.getContext('2d');

      for (const t of timestamps) {
        try {
          await new Promise((resSeek) => {
            const onSeek = () => {
              video.removeEventListener('seeked', onSeek);
              try {
                ctx.drawImage(video, 0, 0, cW, cH);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                frames.push({ timeSec: t, dataUrl });
              } catch (e) {}
              resSeek();
            };
            video.addEventListener('seeked', onSeek);
            video.currentTime = Math.min(t, duration || 0);
          });
        } catch (err) {}
      }

      clearTimeout(timeout);
      cleanup();
      resolve({ duration, width, height, frames });
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ duration: 0, width: 0, height: 0, frames: [] });
    };
  });
}

async function extractAudioWaveformAndMeta(file) {
  return new Promise(async (resolve) => {
    let duration = 0;
    let sampleRate = 44100;
    let channels = 2;
    let peaks = [];

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const arrayBuf = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
        duration = audioBuffer.duration;
        sampleRate = audioBuffer.sampleRate;
        channels = audioBuffer.numberOfChannels;

        const rawData = audioBuffer.getChannelData(0);
        const samples = 24;
        const blockSize = Math.floor(rawData.length / samples) || 1;
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize && (blockStart + j) < rawData.length; j++) {
            sum += Math.abs(rawData[blockStart + j]);
          }
          peaks.push(Math.min(1, (sum / blockSize) * 2.5));
        }
        try { audioCtx.close(); } catch(e){}
        return resolve({ duration, sampleRate, channels, peaks });
      }
    } catch (e) {}

    try {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.onloadedmetadata = () => {
        duration = audio.duration || 0;
        try { URL.revokeObjectURL(url); } catch(e){}
        resolve({ duration, sampleRate, channels, peaks });
      };
      audio.onerror = () => {
        try { URL.revokeObjectURL(url); } catch(e){}
        resolve({ duration: 0, sampleRate, channels, peaks });
      };
    } catch(err) {
      resolve({ duration: 0, sampleRate, channels, peaks });
    }
  });
}

function setupPaste() {
  document.addEventListener('paste', async e => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          toast('🖼️ Memproses gambar dari clipboard...', 'info');
          const dataUrl = await compressImage(file);
          if (dataUrl) {
            files.push({
              name: `pasted_image_${Date.now()}.jpg`,
              type: 'image',
              content: dataUrl,
              data: dataUrl
            });
            renderAttachBar();
            toast('🖼️ Gambar berhasil ditempel!', 'ok');
          }
        }
      }
    }
  });
}

function webFormatBytes(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Deteksi magic bytes untuk berkas biner apa pun (browser)
function detectWebFileMagic(buf) {
  try {
    const len = Math.min(buf.byteLength, 300);
    const u8 = new Uint8Array(buf.slice(0, len));
    const ascii = String.fromCharCode(...u8);
    const hex4 = Array.from(u8.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (ascii.startsWith('PK\x03\x04') || ascii.startsWith('PK\x05\x06')) return 'ZIP Archive';
    if (ascii.startsWith('Rar!\x1a\x07')) return 'RAR Archive';
    if (hex4 === '377abcaf') return '7-Zip Archive';
    if (u8[0] === 0x1f && u8[1] === 0x8b) return 'GZIP Archive';
    if (ascii.indexOf('ustar') === 257) return 'TAR Archive';
    if (ascii.startsWith('%PDF-')) return 'Adobe PDF';
    if (ascii.startsWith('MZ')) return 'Windows Executable (.exe/.dll)';
    if (ascii.startsWith('\x7fELF')) return 'Linux Executable (ELF)';
    if (ascii.startsWith('{\\rtf')) return 'RTF Document';
    if (ascii.startsWith('\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1')) return 'MS Office Legacy (OLE2)';
    if (ascii.startsWith('SQLite format 3')) return 'SQLite Database';
    if (ascii.startsWith('OggS')) return 'OGG Media';
    if (ascii.startsWith('\x00asm')) return 'WebAssembly';
    if (ascii.startsWith('#!')) return 'Script Executable (shebang)';
    if (ascii.startsWith('7z\xbc\xaf')) return '7-Zip Archive';
  } catch (e) {}
  return '';
}

// Daftar isi ZIP via Central Directory (browser)
function readWebZipEntries(buf, maxEntries = 60) {
  const entries = [];
  const dv = new DataView(buf);
  const totalLen = buf.byteLength;
  if (totalLen < 22) return entries;
  let idx = -1;
  const searchFrom = Math.max(0, totalLen - (22 + 65535 + 4));
  for (let i = totalLen - 22; i >= searchFrom; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { idx = i; break; }
  }
  if (idx === -1) return entries;
  const cdSize = dv.getUint32(idx + 12, true);
  const cdOffset = dv.getUint32(idx + 16, true);
  const cdEnd = Math.min(totalLen, Math.max(cdOffset, idx) + cdSize);
  for (let off = cdOffset; off + 46 <= cdEnd; ) {
    if (dv.getUint32(off, true) !== 0x02014b50) { off += 4; continue; }
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const compSize = dv.getUint32(off + 20, true);
    const uncompSize = dv.getUint32(off + 24, true);
    let name;
    try { name = new TextDecoder().decode(new Uint8Array(buf, off + 46, nameLen)); }
    catch (e) { name = '?'; }
    entries.push({ name, compSize, uncompSize });
    off += 46 + nameLen + extraLen + commentLen;
    if (entries.length >= maxEntries) break;
  }
  return entries;
}

async function handleFiles(list) {
  for (const f of Array.from(list)) {
    const isImg = f.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp|heic|heif)$/i.test(f.name);
    const isVid = f.type.startsWith('video/') || /\.(mp4|mkv|avi|mov|webm|flv|wmv|3gp|m4v|ts|ogv|vob)$/i.test(f.name);
    const isAud = f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|mid|midi|aiff)$/i.test(f.name);
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const isDocx = /\.docx$/i.test(f.name) || f.type.includes('wordprocessingml');
    const isExcel = /\.(xlsx|xls)$/i.test(f.name) || f.type.includes('spreadsheet') || f.type.includes('excel');
    const isText = f.type.startsWith('text/') || f.type === 'application/json' || f.type === 'application/xml' || f.type === 'application/javascript' || f.type === 'application/x-javascript' || f.type === 'image/svg+xml' ||
      /\.(js|mjs|cjs|jsx|ts|tsx|py|pyw|pyi|html|htm|css|scss|sass|json|jsonl|md|markdown|mdx|c|cpp|cc|h|hpp|hh|cs|java|kt|kts|rs|go|swift|scala|php|rb|pl|pm|lua|r|m|dart|groovy|v|cob|sh|bash|zsh|fish|bat|cmd|ps1|psm1|vbs|reg|diff|patch|log|sql|tsv|tab|csv|xml|yaml|yml|toml|env|ini|cfg|conf|config|properties|editorconfig|gitignore|gitattributes|dockerfile|gradle|lock|txt|text|textile|rst|adoc|asciidoc|tex|ltx|bib|srt|vtt|gcode|stl|proto|prj|gel|gcode|asm|s|inc|pug|ejs|twig|jinja|hbs|mustache|ftl|sol|vy|cairo|zig|nim|elm|clj|cljs|erl|ex|exs|hs|lhs|fs|fsx|vb|cob)$/i.test(f.name);

    if (isImg) {
      toast(`🖼️ Mengoptimalkan gambar: ${f.name}...`, 'info');
      try {
        const compressedDataUrl = await compressImage(f);
        if (compressedDataUrl) {
          files.push({
            name: f.name,
            type: 'image',
            content: compressedDataUrl,
            data: compressedDataUrl
          });
          renderAttachBar();
          toast(`✅ Gambar terlampir: ${f.name}`, 'ok');
        }
      } catch (err) {
        console.error('Image processing failed:', err);
        toast('Gagal memproses gambar: ' + err.message, 'err');
      }
      continue;
    }

    if (isVid) {
      toast(`🎬 Menganalisis video: ${f.name}...`, 'info');
      try {
        const vidMeta = await extractVideoKeyframesAndMeta(f);
        const durStr = vidMeta.duration > 0 ? `${Math.round(vidMeta.duration)}s` : 'Video';
        const resStr = vidMeta.width && vidMeta.height ? `${vidMeta.width}x${vidMeta.height}` : 'HD';
        const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;

        const frameSummary = vidMeta.frames.length > 0
          ? `[Cuplikan Visual: ${vidMeta.frames.length} keyframe diekstrak pada timeline ${vidMeta.frames.map(fr => `${Math.round(fr.timeSec)}s`).join(', ')}]`
          : '[Analisis video container]';

        files.push({
          name: f.name,
          type: 'video',
          isVideo: true,
          badgeIcon: '🎬',
          badgeMeta: `${durStr} · ${resStr}`,
          duration: vidMeta.duration,
          previewThumb: vidMeta.frames[0]?.dataUrl || null,
          videoFrames: vidMeta.frames,
          content: `--- BEGIN VIDEO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}, Durasi: ${durStr}, Resolusi: ${resStr}) ---\n${frameSummary}\nFormat: ${f.type || 'video'}\n--- END VIDEO ATTACHMENT ---`,
          data: vidMeta.frames[0]?.dataUrl || ''
        });
        renderAttachBar();
        toast(`✅ Video terlampir: ${f.name} (${durStr})`, 'ok');
      } catch (err) {
        console.error('Video analysis failed:', err);
        const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
        files.push({
          name: f.name,
          type: 'video',
          isVideo: true,
          badgeIcon: '🎬',
          badgeMeta: sizeStr,
          content: `--- BEGIN VIDEO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}) ---\nFormat: ${f.type || 'video'}\n--- END VIDEO ATTACHMENT ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Video terlampir: ${f.name}`, 'ok');
      }
      continue;
    }

    if (isAud) {
      toast(`🎵 Menganalisis audio: ${f.name}...`, 'info');
      try {
        const audMeta = await extractAudioWaveformAndMeta(f);
        const durSec = Math.round(audMeta.duration || 0);
        const durStr = durSec > 0 ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : 'Audio';
        const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
        const ext = f.name.split('.').pop().toUpperCase() || 'AUDIO';

        files.push({
          name: f.name,
          type: 'audio',
          isAudio: true,
          badgeIcon: '🎵',
          badgeMeta: `${durStr} · ${ext}`,
          duration: audMeta.duration,
          waveform: audMeta.peaks || [],
          content: `--- BEGIN AUDIO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}, Durasi: ${durStr}, Format: ${ext}) ---\nSample Rate: ${audMeta.sampleRate || 44100} Hz (${audMeta.channels === 1 ? 'Mono' : 'Stereo'})\nKarakteristik Audio: Dinamika gelombang suara terdeteksi aktif.\n--- END AUDIO ATTACHMENT ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Audio terlampir: ${f.name} (${durStr})`, 'ok');
      } catch (err) {
        console.error('Audio analysis failed:', err);
        const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
        files.push({
          name: f.name,
          type: 'audio',
          isAudio: true,
          badgeIcon: '🎵',
          badgeMeta: sizeStr,
          content: `--- BEGIN AUDIO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}) ---\nFormat: ${f.type || 'audio'}\n--- END AUDIO ATTACHMENT ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Audio terlampir: ${f.name}`, 'ok');
      }
      continue;
    }

    if (isPdf) {
      toast(`📑 Extracting PDF: ${f.name}...`, 'info');
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          if (!window.pdfjsLib) {
            throw new Error('PDF.js engine is still loading. Please try again.');
          }
          const typedArray = new Uint8Array(e.target.result);
          const loadingTask = pdfjsLib.getDocument({ data: typedArray });
          const pdf = await loadingTask.promise;
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 20);

          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `\n\n[Page ${pageNum}]:\n` + pageText;
            if (fullText.length > 12000) {
              fullText = fullText.slice(0, 12000) + '\n... [Teks dipotong agar respons cepat]';
              break;
            }
          }

          files.push({
            name: f.name,
            type: 'text',
            isPdf: true,
            badgeIcon: '📑',
            badgeMeta: `${pdf.numPages} hal`,
            pageCount: pdf.numPages,
            content: `--- BEGIN PDF ATTACHMENT: ${f.name} (${pdf.numPages} pages) ---\n${fullText.trim()}\n--- END PDF ATTACHMENT ---`,
            data: ''
          });
          renderAttachBar();
          toast(`✅ Extracted ${pdf.numPages} pages from ${f.name}`, 'ok');
        } catch (err) {
          console.error('PDF extraction failed:', err);
          toast('PDF extraction failed: ' + err.message, 'err');
        }
      };
      reader.readAsArrayBuffer(f);
      continue;
    }

    if (isDocx) {
      toast(`📝 Extracting Word document: ${f.name}...`, 'info');
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          if (!window.mammoth) {
            throw new Error('Mammoth.js parser is loading. Please try again.');
          }
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          let rawText = (result.value || '').trim();
          if (rawText.length > 12000) {
            rawText = rawText.slice(0, 12000) + '\n... [Teks dipotong agar respons cepat]';
          }
          files.push({
            name: f.name,
            type: 'text',
            isDocx: true,
            badgeIcon: '📝',
            badgeMeta: 'Word Doc',
            content: `--- BEGIN WORD DOCUMENT: ${f.name} ---\n${rawText}\n--- END WORD DOCUMENT ---`,
            data: ''
          });
          renderAttachBar();
          toast(`✅ Extracted Word document: ${f.name}`, 'ok');
        } catch(err) {
          console.error('Word extraction failed:', err);
          toast('Word extraction failed: ' + err.message, 'err');
        }
      };
      reader.readAsArrayBuffer(f);
      continue;
    }

    if (isExcel) {
      toast(`📊 Extracting Spreadsheet: ${f.name}...`, 'info');
      const reader = new FileReader();
      reader.onload = e => {
        try {
          if (!window.XLSX) {
            throw new Error('SheetJS parser is loading. Please try again.');
          }
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          let combinedContent = '';
          const sheetCount = workbook.SheetNames.length;

          workbook.SheetNames.forEach((name, sIdx) => {
            const sheet = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!rows || !rows.length) return;

            const totalRows = rows.length;
            const headers = rows[0] || [];
            const maxSampleRows = Math.min(totalRows, 50);
            const sampleRows = rows.slice(0, maxSampleRows);

            const csvSample = sampleRows.map(r => Array.isArray(r) ? r.map(c => String(c).replace(/[\n\r,]+/g, ' ').trim()).join(', ') : '').join('\n');

            combinedContent += `\n[Sheet ${sIdx + 1}/${sheetCount}: "${name}"] (Total Rows: ${totalRows}, Columns: ${headers.length})\n[Headers]: ${headers.join(', ')}\n[Data Sample (First ${maxSampleRows} rows)]:\n${csvSample}\n`;
          });

          if (combinedContent.length > 12000) {
            combinedContent = combinedContent.slice(0, 12000) + '\n... [Data dipangkas untuk optimasi respons instan]';
          }

          files.push({
            name: f.name,
            type: 'text',
            isExcel: true,
            badgeIcon: '📊',
            badgeMeta: `${sheetCount} sheet${sheetCount > 1 ? 's' : ''}`,
            content: `--- BEGIN SPREADSHEET DATA: ${f.name} (${sheetCount} sheets) ---\n${combinedContent.trim()}\n--- END SPREADSHEET DATA ---`,
            data: ''
          });
          renderAttachBar();
          toast(`✅ Extracted spreadsheet: ${f.name} (${sheetCount} sheets)`, 'ok');
        } catch(err) {
          console.error('Excel extraction failed:', err);
          toast('Excel extraction failed: ' + err.message, 'err');
        }
      };
      reader.readAsArrayBuffer(f);
      continue;
    }

    if (isText) {
      const reader = new FileReader();
      reader.onload = e => {
        let textContent = String(e.target.result || '');
        if (textContent.length > 12000) {
          textContent = textContent.slice(0, 12000) + '\n... [Teks dipangkas agar respons instan]';
        }
        const ext = f.name.split('.').pop().toUpperCase() || 'TXT';
        files.push({
          name: f.name,
          type: 'text',
          badgeIcon: '📄',
          badgeMeta: ext,
          content: `--- BEGIN FILE: ${f.name} ---\n${textContent}\n--- END FILE ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Berkas teks terlampir: ${f.name}`, 'ok');
      };
      reader.readAsText(f);
    } else {
      // General binary file (ZIP, RAR, EXE, BIN, dll, dll) — selalu DITERIMA & dideskripsikan
      const sizeBytes = f.size || 0;
      const sizeStr = sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;
      if (f.size > 60 * 1048576) {
        // Berkas sangat besar: cukup info metadata (tanpa dump biner)
        files.push({
          name: f.name,
          type: 'binary',
          badgeIcon: '📦',
          badgeMeta: sizeStr,
          content: `[Lampiran Berkas: "${f.name}" (Ukuran: ${sizeStr}, Tipe: ${f.type || 'file biner'})]`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Berkas terlampir: ${f.name} (${sizeStr})`, 'ok');
        continue;
      }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const arr = e.target.result;
          const magic = detectWebFileMagic(arr);
          let innerInfo = '';
          if (magic === 'ZIP Archive') {
            const entries = readWebZipEntries(arr);
            if (entries.length) {
              const shown = entries.slice(0, 40).map(en => {
                const sz = en.uncompSize ? ` (${webFormatBytes(en.uncompSize)})` : '';
                return `${en.name}${sz}`;
              }).join(', ');
              innerInfo = `\nBerisi ${entries.length} berkas: ${shown}${entries.length > 40 ? '…' : ''}`;
            }
          }
          const typeLabel = magic ? `Tipe Deteksi: ${magic}` : (f.type || 'file biner');
          files.push({
            name: f.name,
            type: 'binary',
            badgeIcon: '📦',
            badgeMeta: magic ? magic : sizeStr,
            content: `[Lampiran Berkas: "${f.name}" (Ukuran: ${sizeStr}, ${typeLabel})]${innerInfo}`,
            data: ''
          });
          renderAttachBar();
          toast(`✅ Berkas terlampir: ${f.name} (${sizeStr})`, 'ok');
        } catch (err) {
          files.push({
            name: f.name,
            type: 'binary',
            badgeIcon: '📦',
            badgeMeta: sizeStr,
            content: `[Lampiran Berkas: "${f.name}" (Ukuran: ${sizeStr}, Tipe: ${f.type || 'file biner'})]`,
            data: ''
          });
          renderAttachBar();
          toast(`✅ Berkas terlampir: ${f.name} (${sizeStr})`, 'ok');
        }
      };
      reader.readAsArrayBuffer(f);
    }
  }
}

function removeFile(i) {
  files.splice(i, 1);
  renderAttachBar();
}

function renderAttachBar() {
  const bar = document.getElementById('attachBar');
  if (!bar) return;
  if (!files || !files.length) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    bar.classList.remove('active');
    return;
  }
  bar.classList.add('active');
  bar.style.display = 'flex';
  bar.innerHTML = files.map((f, i) => {
    if (f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/'))) {
      return `<div class="fchip"><img src="${f.data || f.content}" class="fchip-img"> <span>${esc(f.name)}</span><button onclick="removeFile(${i})">×</button></div>`;
    }
    if (f.isVideo) {
      const thumbHtml = f.previewThumb ? `<img src="${f.previewThumb}" class="fchip-img">` : '🎬';
      return `<div class="fchip">${thumbHtml} <span>${esc(f.name)} (${f.badgeMeta || 'Video'})</span><button onclick="removeFile(${i})">×</button></div>`;
    }
    if (f.isAudio) {
      return `<div class="fchip"><span>🎵 ${esc(f.name)} (${f.badgeMeta || 'Audio'})</span><button onclick="removeFile(${i})">×</button></div>`;
    }
    if (f.isPdf) {
      return `<div class="fchip"><span>📑 ${esc(f.name)} (${f.pageCount || 1}p)</span><button onclick="removeFile(${i})">×</button></div>`;
    }
    if (f.isDocx) {
      return `<div class="fchip"><span>📝 ${esc(f.name)}</span><button onclick="removeFile(${i})">×</button></div>`;
    }
    if (f.isExcel) {
      return `<div class="fchip"><span>📊 ${esc(f.name)}</span><button onclick="removeFile(${i})">×</button></div>`;
    }
    return `<div class="fchip"><span>📄 ${esc(f.name)}</span><button onclick="removeFile(${i})">×</button></div>`;
  }).join('');
}


function getLocaleCode(lang) {
  const map = {
    id: 'id-ID',
    ja: 'ja-JP',
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-ES',
    ar: 'ar-SA',
    de: 'de-DE',
    fr: 'fr-FR',
    ru: 'ru-RU',
    ko: 'ko-KR'
  };
  return map[lang] || 'en-US';
}

function setupSTT() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  mic = new SR();
  mic.continuous = false;
  mic.interimResults = false;
  mic.onresult = e => {
    const el = document.getElementById('msgInput');
    if (el) {
      el.value += (el.value ? ' ' : '') + e.results[0][0].transcript;
      el.dispatchEvent(new Event('input'));
    }
  };
  mic.onend = mic.onerror = () => {
    recording = false;
    document.getElementById('btnMic')?.classList.remove('active');
  };
}

function toggleMic() {
  if (!mic) return toast('Voice input not supported in this browser', 'err');
  if (recording) {
    mic.stop();
  } else {
    mic.lang = getLocaleCode(currentLang);
    try {
      mic.start();
      recording = true;
      document.getElementById('btnMic')?.classList.add('active');
    } catch(e) {
      recording = false;
      document.getElementById('btnMic')?.classList.remove('active');
    }
  }
}

function toggleTTS() {
  autoTTS = !autoTTS;
  document.getElementById('btnTTS')?.classList.toggle('active', autoTTS);
  toast(autoTTS ? 'Voice Output ON' : 'Voice Output OFF');
  if (!autoTTS && window.speechSynthesis) window.speechSynthesis.cancel();
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  
  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, ' [Code Block] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*#_~>\[\]]/g, '')
    .trim();
  if (!clean) return;
  
  const locale = getLocaleCode(currentLang);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = locale;
  u.rate = 1.0;
  
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    const matchedVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase() === locale.toLowerCase())
                      || voices.find(v => v.lang.toLowerCase().startsWith(currentLang.toLowerCase()));
    if (matchedVoice) u.voice = matchedVoice;
  }
  
  window.speechSynthesis.speak(u);
}

function loadChats() {
  try { chats = JSON.parse(localStorage.getItem('bre_chats') || '[]'); } catch(e){ chats=[]; }
}

function saveChats() {
  if (isIncognito) return; // Incognito mode: never save ephemeral chat
  localStorage.setItem('bre_chats', JSON.stringify(chats));
}

function togglePinChat(id, e) {
  if (e) e.stopPropagation();
  const target = chats.find(c => c.id === id);
  if (!target) return;
  target.pinned = !target.pinned;
  saveChats();
  renderChatList();
  toast(target.pinned ? '📌 Conversation pinned to top' : '📍 Conversation unpinned', 'ok');
}

function newChat() {
  if (generating) stopGen();
  const id = 'c' + Date.now();
  const freshChat = { id, title: 'New Conversation', msgs: [], ts: Date.now() };
  if (isIncognito) {
    activeChat = freshChat;
  } else {
    chats.unshift(freshChat);
    saveChats();
  }
  switchChat(id);
  if (window.innerWidth <= 768) toggleSidebar(false);
}

function switchChat(id) {
  if (isIncognito && tempIncognitoChat && id === tempIncognitoChat.id) {
    activeChat = tempIncognitoChat;
  } else {
    activeChat = chats.find(c => c.id === id) || chats[0];
  }
  editingMsgIdx = null;
  renderChatList();
  renderMessages();
}

function deleteChat(id, e) {
  e.stopPropagation();
  chats = chats.filter(c => c.id !== id);
  saveChats();
  if (!chats.length) newChat();
  else if (activeChat?.id === id) switchChat(chats[0].id);
  else renderChatList();
}

function renameChat(id, e) {
  e.stopPropagation();
  const target = chats.find(c => c.id === id);
  const currentTitle = target?.title || '';
  const t = prompt('Chat title:', currentTitle);
  if (t?.trim()) {
    target.title = t.trim();
    saveChats();
    renderChatList();
  }
}

function handleChatSearch(val) {
  chatSearchQuery = (val || '').trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = chatSearchQuery ? 'block' : 'none';
  renderChatList();
}

function clearChatSearch() {
  chatSearchQuery = '';
  const inp = document.getElementById('chatSearchInput');
  if (inp) inp.value = '';
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderChatList();
}

function renderChatList() {
  const container = document.getElementById('chatList');
  if (!container) return;

  let list = chats;
  if (chatSearchQuery) {
    list = chats.filter(c => {
      const matchTitle = (c.title || '').toLowerCase().includes(chatSearchQuery);
      const matchContent = c.msgs?.some(m => (typeof m.content === 'string' && m.content.toLowerCase().includes(chatSearchQuery)));
      return matchTitle || matchContent;
    });
  }

  if (!list.length) {
    container.innerHTML = `<div style="padding:16px 12px;font-size:12px;color:var(--text-muted);text-align:center;">${chatSearchQuery ? 'No matching conversations' : 'No conversations'}</div>`;
    return;
  }

  if (chatSearchQuery) {
    container.innerHTML = `<div class="chat-group-title">Search Results (${list.length})</div>` + list.map(c => renderChatItem(c)).join('');
    return;
  }

  // Split pinned and unpinned chats
  const pinnedList = list.filter(c => !!c.pinned);
  const unpinnedList = list.filter(c => !c.pinned);

  let html = '';
  if (pinnedList.length) {
    html += `<div class="chat-group-title pinned">📌 Pinned (${pinnedList.length})</div>` + pinnedList.map(c => renderChatItem(c)).join('');
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - (7 * 86400000);
  const startOf30Days = startOfToday - (30 * 86400000);

  const groups = {
    today: [],
    yesterday: [],
    sevenDays: [],
    thirtyDays: [],
    older: []
  };

  unpinnedList.forEach(c => {
    const ts = c.ts || parseInt(c.id.replace(/\D/g, ''), 10) || 0;
    if (ts >= startOfToday) {
      groups.today.push(c);
    } else if (ts >= startOfYesterday) {
      groups.yesterday.push(c);
    } else if (ts >= startOf7Days) {
      groups.sevenDays.push(c);
    } else if (ts >= startOf30Days) {
      groups.thirtyDays.push(c);
    } else {
      groups.older.push(c);
    }
  });

  const groupLabels = {
    en: { today: 'Today', yesterday: 'Yesterday', sevenDays: 'Previous 7 Days', thirtyDays: 'Previous 30 Days', older: 'Older' },
    id: { today: 'Hari Ini', yesterday: 'Kemarin', sevenDays: '7 Hari Terakhir', thirtyDays: '30 Hari Terakhir', older: 'Lebih Lama' }
  };
  const labels = groupLabels[currentLang] || groupLabels.en;

  if (groups.today.length) {
    html += `<div class="chat-group-title">${labels.today}</div>` + groups.today.map(c => renderChatItem(c)).join('');
  }
  if (groups.yesterday.length) {
    html += `<div class="chat-group-title">${labels.yesterday}</div>` + groups.yesterday.map(c => renderChatItem(c)).join('');
  }
  if (groups.sevenDays.length) {
    html += `<div class="chat-group-title">${labels.sevenDays}</div>` + groups.sevenDays.map(c => renderChatItem(c)).join('');
  }
  if (groups.thirtyDays.length) {
    html += `<div class="chat-group-title">${labels.thirtyDays}</div>` + groups.thirtyDays.map(c => renderChatItem(c)).join('');
  }
  if (groups.older.length) {
    html += `<div class="chat-group-title">${labels.older}</div>` + groups.older.map(c => renderChatItem(c)).join('');
  }

  container.innerHTML = html;
}

function renderChatItem(c) {
  const isPinned = !!c.pinned;
  return `
    <div class="citem ${activeChat?.id === c.id ? 'active' : ''} ${isPinned ? 'pinned' : ''}" onclick="switchChat('${esc(c.id)}')">
      <span class="ctitle">${esc(c.title || 'Conversation')}</span>
      <div class="cactions">
        <button class="pin-btn ${isPinned ? 'active' : ''}" onclick="togglePinChat('${esc(c.id)}', event)" title="${isPinned ? 'Unpin' : 'Pin'}">📌</button>
        <button onclick="renameChat('${esc(c.id)}', event)" title="Rename">✎</button>
        <button onclick="deleteChat('${esc(c.id)}', event)" title="Delete">×</button>
      </div>
    </div>`;
}

// ---- EXPORT CURRENT CONVERSATION ----
function toggleExportMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('exportMenu');
  if (m) m.classList.toggle('show');
}

document.addEventListener('click', () => {
  document.getElementById('exportMenu')?.classList.remove('show');
});

function exportCurrentChat(format) {
  document.getElementById('exportMenu')?.classList.remove('show');
  if (!activeChat || !activeChat.msgs?.length) {
    return toast('No messages in this conversation to export', 'err');
  }

  const title = (activeChat.title || 'conversation').replace(/[^a-zA-Z0-9_\-]/g, '_');
  let content = '';

  if (format === 'md') {
    content = `# ${activeChat.title || 'Bre AI Conversation'}\n` +
      `*Generated by Bre AI on ${new Date().toLocaleString()}*\n\n---\n\n`;
    activeChat.msgs.forEach(m => {
      const isUser = m.role === 'user';
      content += `### ${isUser ? '👤 User' : '⚡ Bre AI'}\n\n${m.content}\n\n---\n\n`;
    });
  } else {
    content = `${activeChat.title || 'Bre AI Conversation'}\n` +
      `Exported: ${new Date().toLocaleString()}\n` +
      `==========================================\n\n`;
    activeChat.msgs.forEach(m => {
      const isUser = m.role === 'user';
      content += `[${isUser ? 'USER' : 'BRE AI'}]:\n${m.content}\n\n------------------------------------------\n\n`;
    });
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.${format}`;
  a.click();
  toast(`Exported conversation as .${format}`, 'ok');
}

// ---- FLOATING SCROLL TO BOTTOM BUTTON ----
function setupScrollDetection() {
  const container = document.getElementById('messagesContainer');
  const btn = document.getElementById('btnScrollBottom');
  if (!container || !btn) return;

  container.addEventListener('scroll', () => {
    const isUp = container.scrollHeight - container.scrollTop - container.clientHeight > 120;
    if (isUp) {
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
      unreadWhileScrolled = 0;
      updateScrollBadge();
    }
  });
}

function scrollToBottom(smooth = true) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  container.scrollTo({
    top: container.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
  unreadWhileScrolled = 0;
  updateScrollBadge();
}

function updateScrollBadge() {
  const badge = document.getElementById('scrollBadge');
  if (!badge) return;
  if (unreadWhileScrolled > 0) {
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function renderMessages() {
  const el = document.getElementById('messages');
  const dict = I18N[currentLang] || I18N.en;
  
  if (!activeChat?.msgs?.length) {
    el.innerHTML = `<div class="empty-state">
      <h1>Bre AI</h1>
      <p>${dict.emptyGreeting}</p>
      <div class="suggestions">
        <div class="s-card" onclick="quickSend('Please analyze this uploaded image in detail.')">${dict.suggVision}</div>
        <div class="s-card" onclick="quickSend('Generate a comprehensive Product Requirement Document (.prd) for a SaaS platform.')">${dict.suggPrd}</div>
        <div class="s-card" onclick="quickSend('Architect a clean, scalable Node.js backend microservice.')">${dict.suggCode}</div>
      </div>
    </div>`;
    return;
  }

  el.innerHTML = activeChat.msgs.map((m, i) => {
    const isUser = m.role === 'user';
    
    if (isUser) {
      if (editingMsgIdx === i) {
        return `<div class="mrow user editing">
          <div class="mwrap" style="width:100%;max-width:85%;">
            <div class="m-edit-box">
              <textarea id="editInput${i}" class="m-edit-textarea">${esc(m.rawUserText || m.content)}</textarea>
              <div class="m-edit-actions">
                <button class="f-btn sm outline" onclick="cancelEditUserMsg()">Cancel</button>
                <button class="f-btn sm primary" onclick="saveEditUserMsg(${i})">Save & Submit</button>
              </div>
            </div>
          </div>
        </div>`;
      }

      const fileBadgesHtml = Array.isArray(m.attachments) && m.attachments.length ? `
        <div class="user-attached-files">
          ${m.attachments.filter(a => !a.isImage).map(att => `
            <div class="user-file-badge">
              <span class="ufb-icon">${att.icon || '📎'}</span>
              <span class="ufb-name" title="${esc(att.name)}">${esc(att.name)}</span>
              <span class="ufb-meta">${esc(att.meta || 'File')}</span>
            </div>
          `).join('')}
        </div>
      ` : '';

      return `<div class="mrow user">
        <div class="mwrap">
          <div class="mbubble" id="b${i}">${fileBadgesHtml}${renderContent(m.content, true)}</div>
          <div class="user-actions">
            <button onclick="startEditUserMsg(${i})" title="Edit Message">✏️ Edit</button>
            <button onclick="copyMsg(${i})" title="Copy">📋 Copy</button>
          </div>
        </div>
      </div>`;
    }

    // Bot message
    const hasVersions = Array.isArray(m.versions) && m.versions.length > 1;
    const curV = (typeof m.currentVersion === 'number' ? m.currentVersion : (m.versions?.length ? m.versions.length - 1 : 0)) + 1;
    const totalV = m.versions?.length || 1;
    const isTypingNow = Boolean(m.isTyping || (!m.content && generating && i === activeChat.msgs.length - 1));

    let versionNavHtml = '';
    if (hasVersions && !isTypingNow) {
      versionNavHtml = `
        <div class="version-nav">
          <button class="version-btn" onclick="switchBotVersion(${i}, -1)" ${curV <= 1 ? 'disabled' : ''} title="Previous version">&lt;</button>
          <span class="version-text">${curV}/${totalV}</span>
          <button class="version-btn" onclick="switchBotVersion(${i}, 1)" ${curV >= totalV ? 'disabled' : ''} title="Next version">&gt;</button>
        </div>
      `;
    }

    let statsHtml = '';
    if (m.stats && !isTypingNow) {
      statsHtml = `<div class="bot-meta-stats"><span class="tok-speed">⚡ ${m.stats.tokPerSec} tok/s</span> &bull; <span>⏱️ ${m.stats.elapsed}s</span> &bull; <span>${m.stats.tokens} tokens</span></div>`;
    }

    let searchSourcesHtml = '';
    if (m.searchSources && m.searchSources.length) {
      searchSourcesHtml = `
        <div class="search-sources-box">
          <div class="search-sources-hdr">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            <span>Real-time Search Sources (${m.searchSources.length})</span>
          </div>
          <div class="search-sources-list">
            ${m.searchSources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="search-source-chip" title="${esc(s.snippet || s.title)}">🔗 ${esc(s.title || s.url)}</a>`).join('')}
          </div>
        </div>
      `;
    }

    let followUpHtml = '';
    if (i === activeChat.msgs.length - 1 && !generating && m.content && !m.content.startsWith('**Error:**')) {
      const chips = generateFollowUpPrompts(m.content);
      if (chips.length) {
        followUpHtml = `<div class="followup-container">${chips.map(chip => `<button class="followup-chip" onclick="quickSend('${esc(chip)}')">💡 ${esc(chip)}</button>`).join('')}</div>`;
      }
    }

    let bubbleInnerHtml = '';
    if (isTypingNow) {
      const thinkLabel = currentLang === 'id' ? 'Bre AI sedang berpikir...' : 'Bre AI is thinking...';
      bubbleInnerHtml = `<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-text">${thinkLabel}</span></div>`;
    } else {
      bubbleInnerHtml = renderContent(m.content, false);
    }

    let actionsHtml = '';
    if (!isTypingNow && m.content) {
      actionsHtml = `<div class="mactions">
        ${versionNavHtml}
        <button onclick="regenerateBotMsg(${i})" title="Regenerate this response">🔄 Regenerate</button>
        <button onclick="copyMsg(${i})" title="Copy text">📋 Copy</button>
      </div>`;
    }

    return `<div class="mrow bot">
      <div class="mavatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      <div class="mwrap">
        ${searchSourcesHtml}
        <div class="mbubble" id="b${i}">${bubbleInnerHtml}</div>
        ${statsHtml}
        ${actionsHtml}
        ${followUpHtml}
      </div>
    </div>`;
  }).join('');

  afterRender(el);
  const c = document.getElementById('messagesContainer');
  if (c && editingMsgIdx === null) {
    const isScrolledUp = c.scrollHeight - c.scrollTop - c.clientHeight > 150;
    if (!isScrolledUp) c.scrollTop = c.scrollHeight;
  }
}

function generateFollowUpPrompts(content) {
  const text = (content || '').toLowerCase();
  if (text.includes('```')) {
    return [
      'Bisa berikan contoh unit test untuk kode ini?',
      'Jelaskan baris kuncinya secara bertahap.',
      'Bagaimana cara mengoptimalkan performanya?'
    ];
  }
  if (text.includes('prd') || text.includes('product requirement') || text.includes('roadmap')) {
    return [
      'Tambahkan arsitektur teknis dan database schema.',
      'Rincikan KPI dan metrik keberhasilan produk.',
      'Buat estimasi timeline dan fase sprint rilis.'
    ];
  }
  if (text.includes('analis') || text.includes('bisnis') || text.includes('keuangan')) {
    return [
      'Apa saja risiko utama dan strategi mitigasinya?',
      'Bisa buatkan proyeksi skenario terbaik dan terburuk?',
      'Rangkum dalam poin-poin eksekutif singkat.'
    ];
  }
  return [
    'Bisa tolong jelaskan dengan contoh praktis?',
    'Rangkum inti pembahasannya secara ringkas.',
    'Apa kelebihan dan kekurangannya?'
  ];
}

function quickSend(txt) { document.getElementById('msgInput').value = txt; sendOrStop(); }
function setPersona(val) {
  persona = val;
  if (val.startsWith('custom_')) {
    const custom = customPersonas.find(p => p.id === val);
    if (custom) {
      PERSONAS[val] = custom.prompt;
      toast(`Persona: ${custom.name}`, 'ok');
      return;
    }
  }
  toast('Persona: ' + val, 'ok');
}
function copyMsg(i) {
  navigator.clipboard.writeText(activeChat.msgs[i].content);
  const dict = I18N[currentLang] || I18N.en;
  toast(dict.copied, 'ok');
}

// ---- EDIT & REGENERATE ACTIONS ----
function startEditUserMsg(i) {
  editingMsgIdx = i;
  renderMessages();
  setTimeout(() => {
    const ta = document.getElementById('editInput' + i);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, 50);
}

function cancelEditUserMsg() {
  editingMsgIdx = null;
  renderMessages();
}

function saveEditUserMsg(i) {
  const ta = document.getElementById('editInput' + i);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) return;

  editingMsgIdx = null;
  if (generating) stopGen();

  activeChat.msgs = activeChat.msgs.slice(0, i);
  document.getElementById('msgInput').value = newText;
  sendOrStop();
}

function regenerateBotMsg(i) {
  if (generating) stopGen();
  const target = activeChat.msgs[i];
  if (!target) return;
  if (!target.versions) {
    target.versions = [target.content];
    target.currentVersion = 0;
  }
  target.versions.push('');
  target.currentVersion = target.versions.length - 1;
  target.content = '';
  renderMessages();
  executeBotGeneration(i);
}

function switchBotVersion(i, delta) {
  const target = activeChat.msgs[i];
  if (!target || !target.versions || target.versions.length <= 1) return;
  const cur = typeof target.currentVersion === 'number' ? target.currentVersion : 0;
  const nextVer = cur + delta;
  if (nextVer >= 0 && nextVer < target.versions.length) {
    target.currentVersion = nextVer;
    target.content = target.versions[nextVer];
    saveChats();
    renderMessages();
  }
}


// ========================================================
// KaTeX Math & LaTeX High-Fidelity Preprocessor
// ========================================================
function renderLatexAndMarkdown(text) {
  if (!text) return '';
  let str = String(text);

  // 1. Protect existing codeblocks (```...``` and `...`) so math tokens inside code aren't mangled
  const codeBlocks = [];
  str = str.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    const placeholder = `±BRECODE${codeBlocks.length}±`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 2. Normalize and standardize display math from various LLM formats:
  // a) \[ ... \]
  str = str.replace(/(?:^|\n)\s*\\\[\s*([\s\S]*?)\s*\\\]\s*(?=\n|$)/g, '\n\n$$$$\n$1\n$$$$\n\n');
  
  // b) Standalone brackets with LaTeX formulas: e.g.
  // [
  // a_s=\frac{v^2}{r}
  // ]
  str = str.replace(/(?:^|\n)\s*\[\s*(\n*[\s\S]*?(?:\\frac|\\vec|\\hat|\\Delta|\\boxed|\\alpha|\\beta|\\gamma|\\theta|\\pi|\\sqrt|\\sum|\\int|\\partial|\\approx|\\cdot|\\times|\\neq|\\leq|\\geq|\\text|\\left|\\right|\\qquad|\\quad|\^[0-9a-zA-Z\{]|\_[0-9a-zA-Z\{]|\\omega|\\tau|\\lambda|\\mu|\\sigma|\\nabla)[\s\S]*?)\s*\]\s*(?=\n|$)/g, '\n\n$$$$\n$1\n$$$$\n\n');

  // c) LaTeX math environments
  str = str.replace(/\\begin\{(equation|align|aligned|gather|matrix|pmatrix|bmatrix|cases)\*?\}[\s\S]*?\\end\{\1\*?\}/g, (match) => {
    return `\n\n$$$$\n${match}\n$$$$\n\n`;
  });

  // d) \( ... \) inline math
  str = str.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, '$$$1$$');

  // 3. Extract all math blocks ($$...$$) and inline math ($...$) and render with KaTeX or protect slots
  const mathSlots = [];

  // Match Display Math: $$ ... $$
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const trimmed = formula.trim();
    if (!trimmed) return '';
    let rendered = '';
    if (window.katex && typeof window.katex.renderToString === 'function') {
      try {
        rendered = window.katex.renderToString(trimmed, { displayMode: true, throwOnError: false });
      } catch (e) {
        rendered = `<div class="katex-display-fallback">$$\n${esc(trimmed)}\n$$</div>`;
      }
    } else {
      rendered = `<div class="katex-display-fallback">$$\n${esc(trimmed)}\n$$</div>`;
    }
    const slotKey = `±MATHDSP${mathSlots.length}±`;
    mathSlots.push(`<div class="bre-math-block">${rendered}</div>`);
    return `\n\n${slotKey}\n\n`;
  });

  // Match Inline Math: $...$ (avoiding currency like $10 or $100)
  str = str.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, formula) => {
    const trimmed = formula.trim();
    if (/^\d+(?:[.,]\d+)?\s*(?:USD|IDR|k|m|b|rb|jt)?$/i.test(trimmed)) {
      return match;
    }
    let rendered = '';
    if (window.katex && typeof window.katex.renderToString === 'function') {
      try {
        rendered = window.katex.renderToString(trimmed, { displayMode: false, throwOnError: false });
      } catch (e) {
        rendered = `<span class="katex-inline-fallback">$${esc(trimmed)}$</span>`;
      }
    } else {
      rendered = `<span class="katex-inline-fallback">$${esc(trimmed)}$</span>`;
    }
    const slotKey = `±MATHINL${mathSlots.length}±`;
    mathSlots.push(rendered);
    return `${prefix}${slotKey}`;
  });

  // 4. Parse markdown with marked
  let html = '';
  if (window.marked && typeof window.marked.parse === 'function') {
    try {
      html = window.DOMPurify ? DOMPurify.sanitize(window.marked.parse(str), { ADD_ATTR: ['target', 'class'] }) : window.marked.parse(str);
    } catch (e) {
      html = esc(str).replace(/\n/g, '<br>');
    }
  } else {
    html = esc(str).replace(/\n/g, '<br>');
  }

  // 5. Restore Math Slots (both bare and wrapped in <p>)
  mathSlots.forEach((mathHtml, idx) => {
    const displaySlot = `±MATHDSP${idx}±`;
    const inlineSlot = `±MATHINL${idx}±`;
    html = html.split(`<p>${displaySlot}</p>`).join(mathHtml);
    html = html.split(displaySlot).join(mathHtml);
    html = html.split(inlineSlot).join(mathHtml);
  });

  // 6. Restore Code Slots
  codeBlocks.forEach((codeSnippet, idx) => {
    const codeSlot = `±BRECODE${idx}±`;
    let parsedCode = '';
    if (window.marked && typeof window.marked.parse === 'function') {
      try { parsedCode = window.DOMPurify ? DOMPurify.sanitize(window.marked.parse(codeSnippet)) : window.marked.parse(codeSnippet); } catch(e) { parsedCode = `<pre><code>${esc(codeSnippet)}</code></pre>`; }
    } else {
      parsedCode = `<pre><code>${esc(codeSnippet)}</code></pre>`;
    }
    html = html.split(`<p>${codeSlot}</p>`).join(parsedCode);
    html = html.split(codeSlot).join(parsedCode);
  });

  // Safety sweep: never let any placeholder token leak into the rendered UI
  html = html.replace(/\±(?:BRECODE|MATHDSP|MATHINL)\d+±/g, '');

  return html;
}

function renderContent(raw, isUser) {
  if (isUser) {
    if (typeof raw === 'string' && raw.includes('![')) {
      if (window.marked) return marked.parse(raw);
    }
    return esc(raw).replace(/\n/g, '<br>');
  }
  let text = raw || '', thHtml = '';
  // Support both <think>...</think> and also convert any legacy ' thinking... response\n\n'
  text = text.replace(/^[\s\r\n]*thinking([\s\S]*?) response\r?\n\r?\n/i, (m, thought) => {
    return `<think>${thought.trim()}</think>\n\n`;
  });
  const tm = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (tm) {
    const done = text.includes('</think>');
    const thoughtBody = tm[1].trim();
    if (thoughtBody) {
      thHtml = `<details class="think-box" ${done?'':'open'}><summary>Bre AI Reasoning ${done?'':'...'}</summary><div class="think-content">${esc(thoughtBody)}</div></details>`;
    }
    text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
  }
  // Defensive filter: never let raw unparsed thinking monologue leak into the visible text
  text = text.replace(/^\[(?:Thinking Process|Reasoning Process|Proses Berpikir)\][\s\S]*?(?:\r?\n\r?\n|$)/gi, '');
  text = text.replace(/^\*(?:Thinking Process|Reasoning Process|Proses Berpikir)\*[\s\S]*?(?:\r?\n\r?\n|$)/gi, '');
  text = text.replace(/^(?:Thinking Process|Reasoning Process|Proses Berpikir|thinking):\s*[\s\S]*?(?:\r?\n\r?\n|$)/gi, '');
  text = text.replace(/^thinking([A-Z\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF][^\n]*\n*)/i, '');

  // Handle rich outbound tags for interactive web rendering
  text = text.replace(/\[TELEGRAM_FILE:\s*([\s\S]*?)\]/gi, (match, body) => {
    let fn = 'berkas.txt';
    let content = '';
    try {
      const p = JSON.parse(body.trim());
      if (p.filename) fn = p.filename;
      if (p.content !== undefined) content = p.content;
    } catch(e) {
      const fnM = body.match(/"filename"\s*:\s*"([^"\r\n]+)"/i);
      if (fnM) fn = fnM[1];
      const cM = body.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"caption"|\})/i);
      if (cM) content = cM[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    const ext = fn.split('.').pop() || 'text';
    return `\n\n📁 **Unduh Berkas: \`${fn}\`**\n\`\`\`${ext}\n# ${fn}\n${content}\n\`\`\`\n`;
  });
  text = text.replace(/\[TELEGRAM_POLL:\s*([\s\S]*?)\]/gi, (m, b) => {
    try {
      const p = JSON.parse(b.trim());
      const opts = (p.options || []).map(o => `• ${o}`).join('\n');
      return `\n\n📊 **Polling: ${p.question || 'Kuis'}**\n${opts}\n`;
    } catch(e) { return ''; }
  });
  text = text.replace(/\[TELEGRAM_DICE:\s*([^\]]+)\]/gi, '\n\n🎲 *$1*\n\n');
  text = text.replace(/\[TELEGRAM_LOCATION:\s*([\s\S]*?)\]/gi, (m, b) => {
    try {
      const p = JSON.parse(b.trim());
      return `\n\n📍 **Lokasi: ${p.title || 'Peta'}** (${p.latitude}, ${p.longitude})\n${p.address || ''}\n`;
    } catch(e) { return ''; }
  });
  text = text.replace(/\[TELEGRAM_CONTACT:\s*([\s\S]*?)\]/gi, (m, b) => {
    try {
      const p = JSON.parse(b.trim());
      return `\n\n👤 **Kontak: ${p.first_name || ''} ${p.last_name || ''}** (${p.phone_number || ''})\n`;
    } catch(e) { return ''; }
  });

  const bodyHtml = renderLatexAndMarkdown(text);
  return thHtml + bodyHtml;
}

function afterRender(container) {
  if (window.renderMathInElement) {
    try {
      renderMathInElement(container, {
        delimiters: [
          {left:'$$',right:'$$',display:true},
          {left:'$',right:'$',display:false},
          {left:'\\[',right:'\\]',display:true},
          {left:'\\(',right:'\\)',display:false}
        ],
        throwOnError: false
      });
    } catch(e){}
  }
  
  container.querySelectorAll('pre:not(.hl-done)').forEach(pre => {
    pre.classList.add('hl-done');
    const code = pre.querySelector('code');
    if (!code) return;
    if (window.hljs) hljs.highlightElement(code);
    
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    const hdr = document.createElement('div');
    hdr.className = 'code-hdr';
    
    let lang = 'document';
    code.classList.forEach(c => {
      if (c.startsWith('language-')) lang = c.slice(9);
    });
    
    const isHtml = /^(html|xml|svg)$/i.test(lang);
    
    const canPreview = /^(html|xml|svg|htm)$/i.test(lang);

    hdr.innerHTML = `
      <span>📄 ${lang.toUpperCase()}</span>
      <div class="code-btns">
        ${canPreview ? '<button onclick="openArtifactFromBtn(this, \'preview\')">▶ Canvas</button>' : ''}
        <button onclick="openArtifactFromBtn(this, \'code\')">👁️ View</button>
        <button onclick="downloadCode(this, '${lang}')">📥 Download</button>
        <button onclick="copyCode(this)">📋 Copy</button>
      </div>
    `;
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(hdr);
    wrap.appendChild(pre);
  });
}

// Comprehensive extension dictionary for web downloads matching Telegram bot
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

function downloadCode(btn, lang) {
  const wrap = btn.closest('.code-wrap');
  const code = wrap.querySelector('code');
  const text = code.textContent;
  const l = (lang || '').toLowerCase();
  
  let filename = WEB_EXT_MAP[l] || `file_${Date.now()}.${l === 'document' || !l ? 'txt' : l}`;
  
  const firstLine = text.split('\n')[0].trim();
  const match = firstLine.match(/(?:filename|file|name)[:=]\s*([a-zA-Z0-9_\-\.]+)/i) || firstLine.match(/^[#\/\*\-\s]*([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)/);
  if (match && match[1]) {
    filename = match[1].replace(/^[#\/\*\-\s]+/, '').trim();
  }
  
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast('✅ File downloaded: ' + filename, 'ok');
}

function copyCode(btn) {
  const c = btn.closest('.code-wrap').querySelector('code');
  navigator.clipboard.writeText(c.textContent).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
  });
}

// ---- SIDE-BY-SIDE ARTIFACTS / CANVAS PANEL ----
function openArtifactFromBtn(btn, tab = 'preview') {
  const wrap = btn.closest('.code-wrap');
  const code = wrap.querySelector('code');
  const text = code.textContent;
  let lang = 'document';
  code.classList.forEach(c => {
    if (c.startsWith('language-')) lang = c.slice(9);
  });
  
  let title = 'Document Canvas';
  const firstLine = text.split('\n')[0].trim();
  const match = firstLine.match(/(?:filename|file|name)[:=]\s*([a-zA-Z0-9_\-\.]+)/i) || firstLine.match(/^[#\/\*\-\s]*([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)/);
  if (match && match[1]) title = match[1].replace(/^[#\/\*\-\s]+/, '');
  else title = lang.toUpperCase() + ' Artifact';

  openArtifact(lang, text, title, tab);
}

function openArtifact(lang, content, title, activeTab = 'preview') {
  currentArtifact = { lang, content, title };
  sandboxCode = content;
  const panel = document.getElementById('artifactPanel');
  const toggleBtn = document.getElementById('btnArtifactToggle');
  if (!panel) return;

  document.getElementById('artifactTitle').textContent = title || 'Live Canvas';
  document.getElementById('artifactTypeTag').textContent = lang.toUpperCase();

  const isHtml = /^(html|xml|svg|htm)$/i.test(lang);
  document.getElementById('artifactTabs').style.display = isHtml ? 'flex' : 'none';

  const iframe = document.getElementById('artifactIframe');
  if (iframe) {
    iframe.srcdoc = isHtml ? content : `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;line-height:1.6;background:#fff;color:#111;"><pre style="white-space:pre-wrap;">${esc(content)}</pre></body></html>`;
  }

  const codeEl = document.getElementById('artifactCodeContent');
  if (codeEl) {
    codeEl.textContent = content;
    codeEl.className = 'language-' + (lang || 'plaintext');
    if (window.hljs) hljs.highlightElement(codeEl);
  }

  panel.classList.add('open');
  if (toggleBtn) toggleBtn.style.display = 'flex';

  switchArtifactTab(isHtml ? activeTab : 'code');
}

function switchArtifactTab(tab) {
  const iframe = document.getElementById('artifactIframe');
  const codeView = document.getElementById('artifactCodeView');
  const tabPrev = document.getElementById('tabArtPreview');
  const tabCode = document.getElementById('tabArtCode');

  if (tab === 'preview') {
    if (iframe) iframe.style.display = 'block';
    if (codeView) codeView.style.display = 'none';
    tabPrev?.classList.add('active');
    tabCode?.classList.remove('active');
  } else {
    if (iframe) iframe.style.display = 'none';
    if (codeView) codeView.style.display = 'block';
    tabCode?.classList.add('active');
    tabPrev?.classList.remove('active');
  }
}

function closeArtifactPanel() {
  const panel = document.getElementById('artifactPanel');
  if (panel) {
    panel.classList.remove('open');
    panel.classList.remove('fullscreen');
  }
}

function toggleArtifactPanel() {
  const panel = document.getElementById('artifactPanel');
  if (!panel) return;
  if (panel.classList.contains('open')) {
    closeArtifactPanel();
  } else if (currentArtifact) {
    openArtifact(currentArtifact.lang, currentArtifact.content, currentArtifact.title);
  }
}

function toggleArtifactFullscreen() {
  const panel = document.getElementById('artifactPanel');
  if (!panel) return;
  panel.classList.toggle('fullscreen');
}

function reloadArtifact() {
  if (!currentArtifact) return;
  const iframe = document.getElementById('artifactIframe');
  if (iframe) {
    iframe.srcdoc = '';
    setTimeout(() => {
      const isHtml = /^(html|xml|svg|htm)$/i.test(currentArtifact.lang);
      iframe.srcdoc = isHtml ? currentArtifact.content : `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;line-height:1.6;background:#fff;color:#111;"><pre style="white-space:pre-wrap;">${esc(currentArtifact.content)}</pre></body></html>`;
    }, 50);
  }
  toast('Canvas reloaded', 'ok');
}

function copyArtifact() {
  if (!currentArtifact?.content) return;
  navigator.clipboard.writeText(currentArtifact.content);
  toast('Canvas source copied!', 'ok');
}

function openArtifactInNewTab() {
  if (!currentArtifact?.content) return;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(currentArtifact.content);
    win.document.close();
  }
}

function runPreview(btn) {
  openArtifactFromBtn(btn, 'preview');
}
function reloadPreview() {
  reloadArtifact();
}


async function sendOrStop() {
  if (generating) { stopGen(); return; }
  const el = document.getElementById('msgInput');
  let text = el.value.trim();
  if (!text && !files.length) return;

  // Free AI Image Generation shortcut (/image or /img)
  if (text.startsWith('/image ') || text.startsWith('/img ')) {
    const prompt = text.replace(/^\/(image|img)\s+/i, '').trim();
    if (!prompt) {
      toast('Please enter a description for the image', 'err');
      return;
    }
    el.value = '';
    el.style.height = 'auto';
    if (!activeChat) newChat();
    activeChat.title = `🎨 ${prompt.slice(0, 24)}...`;
    
    const seed = Math.floor(Math.random() * 1000000);
    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
    
    activeChat.msgs.push({
      role: 'user',
      content: `🎨 **Generate Image:** ${prompt}`,
      rawUserText: text
    });
    
    activeChat.msgs.push({
      role: 'assistant',
      content: `Here is the AI generated image for **"${prompt}"**:\n\n<div class="generated-image-card"><img src="${imgUrl}" alt="${esc(prompt)}" onclick="window.open('${imgUrl}', '_blank')"><div class="generated-image-footer"><span>🎨 Pollinations Free AI Engine</span><a href="${imgUrl}" target="_blank" download style="color:#38bdf8;text-decoration:none;">📥 Full Resolution</a></div></div>\n\n*Prompt:* **"${esc(prompt)}"**`,
      versions: [""],
      currentVersion: 0,
      stats: { elapsed: '0.8', tokens: 40, tokPerSec: '50.0' }
    });
    
    saveChats();
    renderChatList();
    renderMessages();
    scrollToBottom(true);
    toast('🎨 Image generated successfully!', 'ok');
    return;
  }
  
  const currentFiles = [...files];
  files = [];
  renderAttachBar();
  el.value = '';
  adjustInputHeight();
  
  if (!activeChat) newChat();
  if (!activeChat.msgs.length) {
    activeChat.title = text.slice(0, 32).replace(/[\n\r]+/g, ' ') || 'Conversation';
  }
  
  const imageFiles = currentFiles.filter(f => f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/')));
  const videoFiles = currentFiles.filter(f => f.isVideo && Array.isArray(f.videoFrames) && f.videoFrames.length > 0);
  const otherFiles = currentFiles.filter(f => !imageFiles.includes(f) && !videoFiles.includes(f));
  
  let userPrompt = text;
  if (otherFiles.length) {
    userPrompt += '\n\n[ATTACHED MEDIA & DOCUMENTS]:\n' + otherFiles.map(f => `${f.content}`).join('\n\n');
  }
  
  // UI Display: show only user's typed prompt text + images + video preview thumbnails
  let displayContent = text || '';
  if (imageFiles.length) {
    displayContent = imageFiles.map(img => `![${esc(img.name)}](${img.data || img.content})\n\n`).join('') + displayContent;
  }
  if (videoFiles.length) {
    displayContent = videoFiles.filter(v => v.previewThumb).map(vid => `![Video: ${esc(vid.name)}](${vid.previewThumb})\n\n`).join('') + displayContent;
  }
  
  const attachedBadges = currentFiles.map(f => ({
    name: f.name,
    icon: f.badgeIcon || (f.isVideo ? '🎬' : (f.isAudio ? '🎵' : (f.type === 'image' ? '🖼️' : '📎'))),
    meta: f.badgeMeta || (f.isVideo ? 'Video' : (f.isAudio ? 'Audio' : (f.type === 'image' ? 'Image' : 'File'))),
    isImage: f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/'))
  }));
  
  const allVisionImages = [];
  imageFiles.forEach(img => {
    allVisionImages.push({
      type: 'image_url',
      image_url: { url: img.data || img.content }
    });
  });
  videoFiles.forEach(vid => {
    vid.videoFrames.forEach(fr => {
      allVisionImages.push({
        type: 'image_url',
        image_url: { url: fr.dataUrl }
      });
    });
  });

  let apiContent;
  if (allVisionImages.length) {
    if (selectedModel.toLowerCase().includes('mercury')) {
      toast('💡 Mengirim cuplikan video/gambar ke router multimodal.', 'info');
    }
    apiContent = [
      { type: 'text', text: userPrompt || 'Mohon analisis visual dan detail dari berkas ini secara mendalam.' },
      ...allVisionImages
    ];
  } else {
    apiContent = userPrompt;
  }

  // Real-time Web Search Grounding if enabled
  let searchResults = [];
  if (isWebSearch && text) {
    toast('🌐 Searching web in real-time...', 'info');
    searchResults = await performWebSearch(text);
  }
  
  activeChat.msgs.push({
    role: 'user',
    content: displayContent,
    rawUserText: text,
    apiContent: apiContent,
    attachments: attachedBadges
  });
  activeChat.ts = Date.now();
  saveChats();
  renderChatList();
  renderMessages();
  scrollToBottom(true);
  
  await executeBotGeneration(null, searchResults);
}

async function executeBotGeneration(targetBotIdx = null, searchResults = []) {
  let botIdx = targetBotIdx;
  if (botIdx === null) {
    botIdx = activeChat.msgs.length;
    activeChat.msgs.push({
      role: 'assistant',
      content: '',
      isTyping: true,
      versions: [''],
      currentVersion: 0,
      searchSources: searchResults
    });
  } else {
    activeChat.msgs[botIdx].content = '';
    activeChat.msgs[botIdx].isTyping = true;
  }
  setBusy(true);
  saveChats();
  renderMessages();
  scrollToBottom(true);
  
  const genStartTime = performance.now();
  
  const msgs = activeChat.msgs.slice(0, botIdx).map(m => ({
    role: m.role,
    content: m.apiContent || m.content
  }));
  
  let pExtra = PERSONAS[persona] || '';
  const langPrompt = LANGUAGE_PROMPTS[currentLang];
  if (langPrompt) {
    pExtra = (pExtra ? pExtra + '\n\n' : '') + `[LANGUAGE INSTRUCTION]: ${langPrompt}`;
  }
  const stylePrompt = STYLE_PROMPTS[currentStyle];
  if (stylePrompt) {
    pExtra = (pExtra ? pExtra + '\n\n' : '') + stylePrompt;
  }

  // Inject web search results into system context
  const activeSources = activeChat.msgs[botIdx].searchSources || searchResults || [];
  if (activeSources.length) {
    let searchContext = '\n\n[REAL-TIME WEB SEARCH RESULTS (DuckDuckGo Grounding - Current Year: 2026)]:\n';
    activeSources.forEach((r, idx) => {
      searchContext += `Source [${idx+1}]: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n\n`;
    });
    searchContext += 'Instruction: Utilize the fresh search results above to answer accurately with citation numbers [1], [2] where appropriate.\n';
    pExtra = (pExtra ? pExtra + '\n\n' : '') + searchContext;
  }
  
  ctrl = new AbortController();
  
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-custom-provider': selectedProvider,
        'x-custom-model': selectedModel,
        'x-custom-style': currentStyle,
        'x-custom-language': currentLang
      },
      body: JSON.stringify({
        messages: msgs,
        customSystemPrompt: pExtra,
        style: currentStyle,
        language: currentLang,
        stream: true,
        provider: selectedProvider,
        model: selectedModel,
        temperature: temperature,
        max_tokens: maxTokens
      }),
      signal: ctrl.signal
    });
    
    if (!r.ok) {
      let errDetail = 'HTTP ' + r.status;
      try {
        const errJson = await r.json();
        if (errJson && errJson.error) {
          errDetail = errJson.error;
        }
      } catch (errParse) {
        try {
          const errText = await r.text();
          if (errText) errDetail = errText.slice(0, 300);
        } catch (e) {}
      }
      throw new Error(errDetail);
    }

    if (r.headers.get('content-type')?.includes('event-stream')) {
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const d = JSON.parse(t.slice(6))?.choices?.[0]?.delta;
              if (d) {
                activeChat.msgs[botIdx].isTyping = false;
                const rc = d.reasoning_content || d.thought || (d.reasoning ? d.reasoning : null);
                if (rc) {
                  let c = activeChat.msgs[botIdx].content || '';
                  if (!c.startsWith('<think>')) {
                    activeChat.msgs[botIdx].content = '<think>' + rc;
                  } else if (!c.includes('</think>')) {
                    activeChat.msgs[botIdx].content = c + rc;
                  } else {
                    const parts = c.split('</think>');
                    activeChat.msgs[botIdx].content = parts[0] + rc + '</think>' + parts.slice(1).join('</think>');
                  }
                }
                if (d.content) {
                  let c = activeChat.msgs[botIdx].content || '';
                  if (c.startsWith('<think>') && !c.includes('</think>')) {
                    activeChat.msgs[botIdx].content = c + '</think>\n\n' + d.content;
                  } else {
                    activeChat.msgs[botIdx].content = c + d.content;
                  }
                }
                streamUpdate(botIdx);
              }
            } catch(e){}
          }
        }
      }
      if (buf && buf.trim()) {
        const remainingLines = buf.split('\n');
        for (const line of remainingLines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const d = JSON.parse(t.slice(6))?.choices?.[0]?.delta;
              if (d) {
                activeChat.msgs[botIdx].isTyping = false;
                const rc = d.reasoning_content || d.thought || (d.reasoning ? d.reasoning : null);
                if (rc) {
                  let c = activeChat.msgs[botIdx].content || '';
                  if (!c.startsWith('<think>')) {
                    activeChat.msgs[botIdx].content = '<think>' + rc;
                  } else if (!c.includes('</think>')) {
                    activeChat.msgs[botIdx].content = c + rc;
                  } else {
                    const parts = c.split('</think>');
                    activeChat.msgs[botIdx].content = parts[0] + rc + '</think>' + parts.slice(1).join('</think>');
                  }
                }
                if (d.content) {
                  let c = activeChat.msgs[botIdx].content || '';
                  if (c.startsWith('<think>') && !c.includes('</think>')) {
                    activeChat.msgs[botIdx].content = c + '</think>\n\n' + d.content;
                  } else {
                    activeChat.msgs[botIdx].content = c + d.content;
                  }
                }
                streamUpdate(botIdx);
              }
            } catch(e){}
          }
        }
      }
      // Ensure any unclosed <think> tag is sealed once stream finishes
      let curContent = activeChat.msgs[botIdx].content || '';
      if (curContent.startsWith('<think>') && !curContent.includes('</think>')) {
        activeChat.msgs[botIdx].content = curContent + '</think>\n\n';
      }
    } else {
      const respData = await r.json();
      activeChat.msgs[botIdx].isTyping = false;
      let respContent = respData.choices?.[0]?.message?.content || respData.error || '';
      // If message has separate reasoning_content, wrap in <think>
      const reasoning = respData.choices?.[0]?.message?.reasoning_content || respData.choices?.[0]?.message?.thought;
      if (reasoning && !respContent.includes('<think>')) {
        respContent = `<think>${reasoning.trim()}</think>\n\n` + respContent;
      }
      activeChat.msgs[botIdx].content = respContent;
    }

    activeChat.msgs[botIdx].isTyping = false;

    // Sync current version array
    const finalContent = activeChat.msgs[botIdx].content;
    if (!activeChat.msgs[botIdx].versions) {
      activeChat.msgs[botIdx].versions = [finalContent];
      activeChat.msgs[botIdx].currentVersion = 0;
    } else {
      const curV = activeChat.msgs[botIdx].currentVersion || 0;
      activeChat.msgs[botIdx].versions[curV] = finalContent;
    }

    // Calculate latency & token speed
    const elapsedSec = ((performance.now() - genStartTime) / 1000).toFixed(1);
    const estTokens = Math.max(1, Math.round(finalContent.length / 3.8));
    const tokPerSec = (estTokens / Math.max(0.1, parseFloat(elapsedSec))).toFixed(1);
    activeChat.msgs[botIdx].stats = {
      elapsed: elapsedSec,
      tokens: estTokens,
      tokPerSec: tokPerSec
    };

    saveChats();
    renderMessages();
    if (autoTTS) speakText(finalContent);
  } catch(e) {
    if (e.name !== 'AbortError') {
      if (activeChat?.msgs?.[botIdx]) {
        activeChat.msgs[botIdx].isTyping = false;
        const errLower = (e.message || '').toLowerCase();
        let tips = '💡 *Tips:* Pastikan backend server aktif (`node server.js`) atau periksa konfigurasi Provider di menu **Settings**.';
        if (errLower.includes('network error') || errLower.includes('failed to fetch') || errLower.includes('load failed')) {
          tips = '💡 *Tips:* Terjadi kendala koneksi jaringan atau respon serverless timeout/terputus. Pastikan koneksi internet stabil dan konfigurasi API Key provider di menu **Settings (Admin)** sudah tersimpan.';
        } else if (errLower.includes('413') || errLower.includes('payload too large')) {
          tips = '💡 *Tips:* Ukuran berkas/gambar terlalu besar untuk serverless (maksimal 4.5MB). Sistem sekarang otomatis mengompres gambar sebelum dikirim.';
        }
        activeChat.msgs[botIdx].content = `⚠️ **Bre AI:** Tidak dapat memproses permintaan.\n\n*Kendala:* ${e.message}\n\n${tips}`;
      }
      saveChats();
      renderMessages();
      scrollToBottom(true);
    }
  } finally {
    if (activeChat?.msgs?.[botIdx]) {
      activeChat.msgs[botIdx].isTyping = false;
    }
    setBusy(false);
  }
}

function streamUpdate(idx) {
  const m = activeChat.msgs[idx];
  if (m) m.isTyping = false;
  if (m && m.versions && typeof m.currentVersion === 'number') {
    m.versions[m.currentVersion] = m.content;
  }
  const b = document.getElementById('b' + idx);
  if (b) {
    b.innerHTML = renderContent(m.content, false);
    afterRender(b);
  }
  const c = document.getElementById('messagesContainer');
  if (c) {
    const isScrolledUp = c.scrollHeight - c.scrollTop - c.clientHeight > 150;
    if (!isScrolledUp) {
      c.scrollTop = c.scrollHeight;
    } else {
      unreadWhileScrolled++;
      updateScrollBadge();
    }
  }
}


function stopGen() {
  ctrl?.abort();
  setBusy(false);
}
function setBusy(v) {
  generating = v;
  document.getElementById('sendIcon').style.display = v ? 'none' : '';
  document.getElementById('stopIcon').style.display = v ? '' : 'none';
}

// ---- THEME & PREFERENCES ----
function initTheme() {
  applyTheme(currentTheme);
  updateThemeButtons();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (currentTheme === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('bre_theme', theme);
  applyTheme(theme);
  updateThemeButtons();
  toast('Theme set to: ' + (theme === 'light' ? '☀️ Light' : (theme === 'dark' ? '🌙 Dark' : '💻 System')));
}

function applyTheme(theme) {
  let active = theme;
  if (theme === 'system') {
    active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', active);
}

function updateThemeButtons() {
  document.querySelectorAll('.theme-opt-btn').forEach(btn => btn.classList.remove('active'));
  if (currentTheme === 'light') document.getElementById('themeLight')?.classList.add('active');
  else if (currentTheme === 'dark') document.getElementById('themeDark')?.classList.add('active');
  else document.getElementById('themeSystem')?.classList.add('active');
}

function openAdmin() { 
  openModal('adminModal'); 
  updateStats();
  updateThemeButtons();
  initParams();
  initStyle();
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = currentLang;
}


function updateStats() {
  document.getElementById('sSessions').textContent = chats.length;
  document.getElementById('sMsgs').textContent = chats.reduce((a,c)=>a+c.msgs.length,0);
}
function clearAllChats() {
  const dict = I18N[currentLang] || I18N.en;
  if(confirm('Clear all conversation history?')) {
    chats=[];
    saveChats();
    newChat();
    updateStats();
    toast(dict.clearedToast, 'ok');
  }
}
function exportJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(chats,null,2)],{type:'application/json'}));
  a.download = 'bre_ai_conversations.json';
  a.click();
  toast('Conversation history exported', 'ok');
}

function toggleSidebar(force) {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    const open = typeof force === 'boolean' ? force : !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    ov?.classList.toggle('show', open);
  } else {
    const collapsed = typeof force === 'boolean' ? !force : !sb.classList.contains('collapsed');
    sb.classList.toggle('collapsed', collapsed);
  }
}
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function toast(msg, type='info') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  document.getElementById('toastHub').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(()=>t.remove(), 300); }, 3000);
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function gv(id) { return document.getElementById(id)?.value||''; }
function sv(id, v) { if(document.getElementById(id)) document.getElementById(id).value=v; }

// ========================================================
// ENTERPRISE FEATURE CONTROLLERS
// ========================================================

// 1. Free AI Image Generation Helper
function promptImageGen() {
  const inp = document.getElementById('msgInput');
  if (!inp) return;
  inp.value = '/image ';
  inp.focus();
  inp.dispatchEvent(new Event('input'));
  toast('Type what you want to draw and press Enter!', 'info');
}

// 2. Real-Time Web Search (DuckDuckGo Grounding)
function initWebSearchUI() {
  const btn = document.getElementById('btnWebSearch');
  if (btn) btn.classList.toggle('active', isWebSearch);
}

function toggleWebSearch() {
  isWebSearch = !isWebSearch;
  localStorage.setItem('bre_web_search', isWebSearch.toString());
  initWebSearchUI();
  toast(isWebSearch ? '🌐 Web Search Enabled (DuckDuckGo Grounding)' : 'Web Search Disabled');
}

async function performWebSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.warn('Web search error:', err);
    return [];
  }
}

// 3. Incognito Mode (Temporary Session)
function toggleIncognito() {
  isIncognito = !isIncognito;
  const btn = document.getElementById('btnIncognito');
  const banner = document.getElementById('incognitoBanner');
  
  if (isIncognito) {
    btn?.classList.add('active');
    if (banner) banner.style.display = 'flex';
    tempIncognitoChat = {
      id: 'incognito_' + Date.now(),
      title: '🕶️ Incognito Chat',
      msgs: [],
      ts: Date.now()
    };
    activeChat = tempIncognitoChat;
    renderMessages();
    toast('🕶️ Incognito Mode Active: Chat is temporary and not saved.', 'info');
  } else {
    btn?.classList.remove('active');
    if (banner) banner.style.display = 'none';
    tempIncognitoChat = null;
    if (!chats.length) newChat();
    else switchChat(chats[0].id);
    toast('Exited Incognito Mode.', 'ok');
  }
}

// 4. Import Conversations from JSON
function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of chat objects.');
      }
      let count = 0;
      data.forEach(c => {
        if (c && Array.isArray(c.msgs)) {
          const exists = chats.some(x => x.id === c.id);
          c.id = String(c.id || '').replace(/[<>"'&]/g, '').slice(0, 50) || ('c' + Date.now());
          const newId = exists ? ('c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)) : (c.id || ('c' + Date.now()));
          chats.unshift({
            ...c,
            id: newId,
            title: c.title || 'Imported Conversation',
            ts: c.ts || Date.now()
          });
          count++;
        }
      });
      saveChats();
      renderChatList();
      updateStats();
      if (count > 0) {
        switchChat(chats[0].id);
        toast(`✅ Imported ${count} conversations successfully!`, 'ok');
      } else {
        toast('No valid conversation objects found in JSON.', 'err');
      }
    } catch(err) {
      console.error('Import error:', err);
      toast('Failed to import JSON: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// 5. Custom Personas Builder
function loadCustomPersonas() {
  try {
    customPersonas = JSON.parse(localStorage.getItem('bre_custom_personas') || '[]');
  } catch(e) {
    customPersonas = [];
  }
  updatePersonaSelectDropdown();
}

function saveCustomPersonasToStorage() {
  localStorage.setItem('bre_custom_personas', JSON.stringify(customPersonas));
  updatePersonaSelectDropdown();
  renderCustomPersonasList();
}

function openPersonaModal() {
  renderCustomPersonasList();
  openModal('personaModal');
}

function saveCustomPersona() {
  const icon = document.getElementById('customPersonaIcon')?.value.trim() || '🤖';
  const name = document.getElementById('customPersonaName')?.value.trim();
  const prompt = document.getElementById('customPersonaPrompt')?.value.trim();
  
  if (!name || !prompt) {
    return toast('Please enter both Persona Name and System Instructions', 'err');
  }
  
  const id = 'custom_' + Date.now();
  customPersonas.push({ id, icon, name, prompt });
  saveCustomPersonasToStorage();
  
  const nameInp = document.getElementById('customPersonaName');
  const promptInp = document.getElementById('customPersonaPrompt');
  if (nameInp) nameInp.value = '';
  if (promptInp) promptInp.value = '';
  
  toast(`✅ Custom persona "${name}" created!`, 'ok');
}

function deleteCustomPersona(id) {
  customPersonas = customPersonas.filter(p => p.id !== id);
  saveCustomPersonasToStorage();
  toast('Custom persona deleted.', 'info');
}

function selectAndUsePersona(id) {
  const sel = document.getElementById('personaSelect');
  if (sel) {
    sel.value = id;
    setPersona(id);
  }
  closeModal('personaModal');
}

function renderCustomPersonasList() {
  const container = document.getElementById('customPersonaList');
  if (!container) return;
  if (!customPersonas.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px;">No custom personas created yet. Fill the form above to add one.</div>`;
    return;
  }
  container.innerHTML = customPersonas.map(p => `
    <div class="custom-persona-card">
      <div class="custom-persona-meta">
        <span class="custom-persona-icon">${esc(p.icon)}</span>
        <div>
          <div class="custom-persona-name">${esc(p.name)}</div>
          <div class="custom-persona-prompt-preview">${esc(p.prompt)}</div>
        </div>
      </div>
      <div class="custom-persona-actions">
        <button class="f-btn sm outline" onclick="selectAndUsePersona('${p.id}')">Use</button>
        <button class="icon-btn close-btn" onclick="deleteCustomPersona('${p.id}')" title="Delete">×</button>
      </div>
    </div>
  `).join('');
}

function updatePersonaSelectDropdown() {
  const sel = document.getElementById('personaSelect');
  if (!sel) return;
  
  const existingGroup = sel.querySelector('optgroup[data-custom="true"]');
  if (existingGroup) existingGroup.remove();
  
  if (customPersonas.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Custom Personas';
    group.setAttribute('data-custom', 'true');
    customPersonas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.icon} ${p.name}`;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }
}

// 6. Global Keyboard Shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', e => {
    // Esc: close modals or canvas
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal-backdrop.show');
      if (openModals.length > 0) {
        openModals.forEach(m => m.classList.remove('show'));
        return;
      }
      const panel = document.getElementById('artifactPanel');
      if (panel && panel.classList.contains('open')) {
        closeArtifactPanel();
        return;
      }
    }
    
    // Ctrl + /: Open shortcuts modal
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      openModal('shortcutsModal');
      return;
    }

    // Ctrl + Shift + O: New chat
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      newChat();
      return;
    }

    // Ctrl + K: Focus chat search
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const sb = document.getElementById('sidebar');
      if (sb?.classList.contains('collapsed')) toggleSidebar(true);
      const searchInp = document.getElementById('chatSearchInput');
      searchInp?.focus();
      searchInp?.select();
      return;
    }

    // Ctrl + B: Toggle sidebar
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // Ctrl + Shift + S: Toggle web search
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      toggleWebSearch();
      return;
    }

    // Ctrl + Shift + I: Toggle incognito mode
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      toggleIncognito();
      return;
    }
  });
}
