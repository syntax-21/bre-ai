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
  loadChats();
  setupInput();
  setupDrop();
  setupPaste();
  setupSTT();
  if (!chats.length) newChat(); else switchChat(chats[0].id);
});

function initLanguage() {
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = currentLang;
  applyLanguage(currentLang);
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('bre_lang', lang);
  applyLanguage(lang);
  renderMessages();
  toast('Language updated: ' + lang.toUpperCase());
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

function setupInput() {
  const el = document.getElementById('msgInput');
  if (!el) return;
  el.addEventListener('input', () => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendOrStop();
    }
  });
}

function setupDrop() {
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });
}

function setupPaste() {
  document.addEventListener('paste', e => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = evt => {
            files.push({
              name: `pasted_image_${Date.now()}.png`,
              type: 'image',
              content: evt.target.result,
              data: evt.target.result
            });
            renderAttachBar();
            toast('🖼️ Image pasted from clipboard!', 'ok');
          };
          reader.readAsDataURL(file);
        }
      }
    }
  });
}

function handleFiles(list) {
  Array.from(list).forEach(f => {
    const reader = new FileReader();
    const isImg = f.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.name);
    const isText = f.type.startsWith('text/') || /\.(js|ts|py|html|css|json|md|c|cpp|java|go|rs|sql|sh|txt|prd|csv)$/i.test(f.name);
    
    reader.onload = e => {
      files.push({
        name: f.name,
        type: isImg ? 'image' : (isText ? 'text' : 'binary'),
        content: isText ? e.target.result : e.target.result,
        data: e.target.result
      });
      renderAttachBar();
    };
    if (isText) reader.readAsText(f);
    else reader.readAsDataURL(f);
  });
}

function removeFile(i) {
  files.splice(i, 1);
  renderAttachBar();
}

function renderAttachBar() {
  const bar = document.getElementById('attachBar');
  if (!bar) return;
  if (!files.length) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  bar.innerHTML = files.map((f, i) => {
    if (f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/'))) {
      return `<div class="fchip"><img src="${f.data || f.content}" class="fchip-img"> <span>${esc(f.name)}</span><button onclick="removeFile(${i})">×</button></div>`;
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

function loadChats() { try { chats = JSON.parse(localStorage.getItem('bre_chats') || '[]'); } catch(e){ chats=[]; } }
function saveChats() { localStorage.setItem('bre_chats', JSON.stringify(chats)); }
function newChat() {
  if (generating) stopGen();
  const id = 'c' + Date.now(); chats.unshift({ id, title: 'New Conversation', msgs: [], ts: Date.now() });
  saveChats(); switchChat(id);
  if (window.innerWidth <= 768) toggleSidebar(false);
}
function switchChat(id) { activeChat = chats.find(c => c.id === id) || chats[0]; renderChatList(); renderMessages(); }
function deleteChat(id, e) { e.stopPropagation(); chats = chats.filter(c => c.id !== id); saveChats(); if (!chats.length) newChat(); else if (activeChat.id === id) switchChat(chats[0].id); else renderChatList(); }
function renameChat(id, e) { e.stopPropagation(); const t = prompt('Chat title:'); if (t?.trim()) { chats.find(c => c.id === id).title = t.trim(); saveChats(); renderChatList(); } }
function renderChatList() {
  document.getElementById('chatList').innerHTML = chats.map(c => `
    <div class="citem ${activeChat?.id === c.id ? 'active' : ''}" onclick="switchChat('${c.id}')">
      <span class="ctitle">${esc(c.title)}</span>
      <div class="cactions"><button onclick="renameChat('${c.id}', event)">✎</button><button onclick="deleteChat('${c.id}', event)">×</button></div>
    </div>`).join('');
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
    return `<div class="mrow ${isUser ? 'user' : 'bot'}">
        <div class="mavatar">${isUser ? '' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'}</div>
        <div class="mwrap">
          <div class="mbubble" id="b${i}">${renderContent(m.content, isUser)}</div>
          ${!isUser ? `<div class="mactions"><button onclick="copyMsg(${i})">📋 Copy</button></div>` : ''}
        </div>
      </div>`;
  }).join('');
  afterRender(el);
  const c = document.getElementById('messagesContainer'); c.scrollTop = c.scrollHeight;
}

function quickSend(txt) { document.getElementById('msgInput').value = txt; sendOrStop(); }
function setPersona(val) { persona = val; toast('Persona: ' + val); }
function copyMsg(i) {
  navigator.clipboard.writeText(activeChat.msgs[i].content);
  const dict = I18N[currentLang] || I18N.en;
  toast(dict.copied);
}

function renderContent(raw, isUser) {
  if (isUser) {
    if (typeof raw === 'string' && raw.includes('![')) {
      if (window.marked) return marked.parse(raw);
    }
    return esc(raw).replace(/\n/g, '<br>');
  }
  let text = raw || '', thHtml = '';
  const tm = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (tm) {
    const done = text.includes('</think>');
    thHtml = `<details class="think-box" ${done?'':'open'}><summary>Bre AI Reasoning ${done?'':'...'}</summary><div class="think-content">${esc(tm[1].trim())}</div></details>`;
    text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
  }
  let html = text;
  if (window.marked && text) { try { html = marked.parse(text); } catch(e){ html = esc(text).replace(/\n/g,'<br>'); } }
  return thHtml + html;
}

function afterRender(container) {
  if (window.renderMathInElement) {
    try {
      renderMathInElement(container, {
        delimiters: [
          {left:'$$',right:'$$',display:true},
          {left:'$',right:'$',display:false},
          {left:'\\[',right:'\\]',display:true}
        ]
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
    
    hdr.innerHTML = `
      <span>📄 ${lang.toUpperCase()}</span>
      <div class="code-btns">
        ${isHtml ? '<button onclick="runPreview(this)">▶ Preview</button>' : ''}
        <button onclick="downloadCode(this, '${lang}')">📥 Download File</button>
        <button onclick="copyCode(this)">📋 Copy</button>
      </div>
    `;
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(hdr);
    wrap.appendChild(pre);
  });
}

function downloadCode(btn, lang) {
  const wrap = btn.closest('.code-wrap');
  const code = wrap.querySelector('code');
  const text = code.textContent;
  
  let filename = `file_${Date.now()}.${lang === 'document' ? 'txt' : lang}`;
  
  const firstLine = text.split('\n')[0].trim();
  const match = firstLine.match(/(?:filename|file|name)[:=]\s*([a-zA-Z0-9_\-\.]+)/i) || firstLine.match(/^[#\/\*\-\s]*([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)/);
  if (match && match[1]) {
    filename = match[1].replace(/^[#\/\*\-\s]+/, '');
  } else if (lang.toLowerCase() === 'prd') {
    filename = 'product_requirements.prd';
  } else if (lang.toLowerCase() === 'markdown' || lang.toLowerCase() === 'md') {
    filename = 'document.md';
  } else if (lang.toLowerCase() === 'javascript' || lang.toLowerCase() === 'js') {
    filename = 'script.js';
  } else if (lang.toLowerCase() === 'python' || lang.toLowerCase() === 'py') {
    filename = 'script.py';
  } else if (lang.toLowerCase() === 'html') {
    filename = 'index.html';
  } else if (lang.toLowerCase() === 'json') {
    filename = 'data.json';
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

function runPreview(btn) {
  sandboxCode = btn.closest('.code-wrap').querySelector('code').textContent;
  document.getElementById('previewFrame').srcdoc = sandboxCode;
  openModal('previewModal');
}
function reloadPreview() {
  const f = document.getElementById('previewFrame');
  f.srcdoc = '';
  setTimeout(() => f.srcdoc = sandboxCode, 50);
}

async function sendOrStop() {
  if (generating) { stopGen(); return; }
  const el = document.getElementById('msgInput');
  let text = el.value.trim();
  if (!text && !files.length) return;
  
  const currentFiles = [...files];
  files = [];
  renderAttachBar();
  el.value = '';
  el.style.height = 'auto';
  
  if (!activeChat) newChat();
  if (!activeChat.msgs.length) activeChat.title = text.slice(0, 32).replace(/[\n\r]+/g, ' ') || 'Conversation';
  
  const imageFiles = currentFiles.filter(f => f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/')));
  const textFiles = currentFiles.filter(f => !imageFiles.includes(f));
  
  let userPrompt = text;
  if (textFiles.length) {
    userPrompt += '\n\n[ATTACHED DOCUMENTS]:\n' + textFiles.map(f => `--- ${f.name} ---\n${f.content}\n---`).join('\n');
  }
  
  let displayContent = userPrompt;
  if (imageFiles.length) {
    displayContent = imageFiles.map(img => `![${esc(img.name)}](${img.data || img.content})\n\n`).join('') + displayContent;
  }
  
  let apiContent;
  if (imageFiles.length) {
    apiContent = [
      { type: 'text', text: userPrompt || 'Please analyze this image.' },
      ...imageFiles.map(img => ({
        type: 'image_url',
        image_url: { url: img.data || img.content }
      }))
    ];
  } else {
    apiContent = userPrompt;
  }
  
  activeChat.msgs.push({ role: 'user', content: displayContent, apiContent: apiContent });
  activeChat.ts = Date.now();
  saveChats();
  renderMessages();
  
  const botIdx = activeChat.msgs.length;
  activeChat.msgs.push({ role: 'assistant', content: '' });
  setBusy(true);
  
  const msgs = activeChat.msgs.slice(0, -1).map(m => ({
    role: m.role,
    content: m.apiContent || m.content
  }));
  
  let pExtra = PERSONAS[persona] || '';
  const langPrompt = LANGUAGE_PROMPTS[currentLang];
  if (langPrompt) {
    pExtra = (pExtra ? pExtra + '\n\n' : '') + `[LANGUAGE INSTRUCTION]: ${langPrompt}`;
  }
  
  ctrl = new AbortController();
  
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs,
        customSystemPrompt: pExtra,
        stream: true
      }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
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
                if (d.reasoning_content) {
                  const c = activeChat.msgs[botIdx].content;
                  activeChat.msgs[botIdx].content = c.startsWith('<think>') ? c + d.reasoning_content : '<think>' + d.reasoning_content;
                }
                if (d.content) {
                  const c = activeChat.msgs[botIdx].content;
                  activeChat.msgs[botIdx].content += (c.startsWith('<think>') && !c.includes('</think>')) ? '</think>\n\n' + d.content : d.content;
                }
                streamUpdate(botIdx);
              }
            } catch(e){}
          }
        }
      }
    } else {
      activeChat.msgs[botIdx].content = (await r.json()).choices?.[0]?.message?.content || '';
    }
    saveChats();
    renderMessages();
    if (autoTTS) speakText(activeChat.msgs[botIdx].content);
  } catch(e) {
    if (e.name !== 'AbortError') {
      activeChat.msgs[botIdx].content = '**Error:** ' + e.message;
      saveChats();
      renderMessages();
    }
  } finally {
    setBusy(false);
  }
}

function streamUpdate(idx) {
  const b = document.getElementById('b' + idx);
  if (b) {
    b.innerHTML = renderContent(activeChat.msgs[idx].content, false);
    afterRender(b);
  }
  const c = document.getElementById('messagesContainer');
  if (c) c.scrollTop = c.scrollHeight;
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
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function gv(id) { return document.getElementById(id)?.value||''; }
function sv(id, v) { if(document.getElementById(id)) document.getElementById(id).value=v; }
