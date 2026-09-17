// ==========================================================================
// BRE AI - UI Components, Rendering, Theme & Artifacts
// File: public/js/app/ui.js
// ==========================================================================

// ---- THEME MANAGEMENT ----
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

// ---- TOAST & MODAL HELPERS ----
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  const hub = document.getElementById('toastHub');
  if (hub) {
    hub.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

function openAdmin() {
  openModal('adminModal');
  updateStats();
  updateThemeButtons();
  initParams();
  initStyle();
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = currentLang;
  if (document.getElementById('clientApiKey')) document.getElementById('clientApiKey').value = clientApiKey;
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

// ---- MOTIVATION BANNER ----
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

// ---- STYLE & LANGUAGE PREFERENCES ----
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
  const dict = I18N[lang] || (lang === 'auto' ? (I18N.id || I18N.en) : I18N.en);

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

// ---- PARAMETERS (TEMPERATURE & MAX TOKENS) ----
function initParams() {
  const tempSlider = document.getElementById('tempSlider');
  const tokensSlider = document.getElementById('tokensSlider');
  const ctxMsgsSlider = document.getElementById('ctxMsgsSlider');
  if (tempSlider) {
    tempSlider.value = temperature;
    updateTemperatureDisplay(temperature);
  }
  if (tokensSlider) {
    tokensSlider.value = maxTokens;
    updateTokensDisplay(maxTokens);
  }
  if (ctxMsgsSlider) {
    ctxMsgsSlider.value = contextMessages;
    updateContextMessagesDisplay(contextMessages);
  }
}

function updateContextMessages(v) {
  contextMessages = parseInt(v, 10) || 30;
  if (contextMessages < 2) contextMessages = 2;
  if (contextMessages > 200) contextMessages = 200;
  localStorage.setItem('bre_context_msgs', String(contextMessages));
  updateContextMessagesDisplay(contextMessages);
}

function updateContextMessagesDisplay(v) {
  const el = document.getElementById('ctxMsgsDisplay');
  if (el) el.textContent = `${v} messages`;
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

// ---- CUSTOM PERSONAS UI ----
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

// ---- INPUT STRUCTURE & ADJUSTMENT ----
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
        setTimeout(adjustInputHeight, 0);
      } else {
        if (e.isComposing) return;
        e.preventDefault();
        sendOrStop();
      }
    } else if (e.key === 'ArrowUp' && !el.value.trim() && activeChat?.msgs?.length) {
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
  badge.style.display = unreadWhileScrolled > 0 ? 'block' : 'none';
}

// ---- LATEX & MARKDOWN PREPROCESSOR ----
function renderLatexAndMarkdown(text) {
  if (!text) return '';
  let str = String(text);

  const codeBlocks = [];
  str = str.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    const placeholder = `±BRECODE${codeBlocks.length}±`;
    codeBlocks.push(match);
    return placeholder;
  });

  str = str.replace(/(?:^|\n)\s*\\\[\s*([\s\S]*?)\s*\\\]\s*(?=\n|$)/g, '\n\n$$$$\n$1\n$$$$\n\n');

  str = str.replace(/(?:^|\n)\s*\[\s*(\n*[\s\S]*?(?:\\frac|\\vec|\\hat|\\Delta|\\boxed|\\alpha|\\beta|\\gamma|\\theta|\\pi|\\sqrt|\\sum|\\int|\\partial|\\approx|\\cdot|\\times|\\neq|\\leq|\\geq|\\text|\\left|\\right|\\qquad|\\quad|\^[0-9a-zA-Z\{]|\_[0-9a-zA-Z\{]|\\omega|\\tau|\\lambda|\\mu|\\sigma|\\nabla)[\s\S]*?)\s*\]\s*(?=\n|$)/g, '\n\n$$$$\n$1\n$$$$\n\n');

  str = str.replace(/\\begin\{(equation|align|aligned|gather|matrix|pmatrix|bmatrix|cases)\*?\}[\s\S]*?\\end\{\1\*?\}/g, (match) => {
    return `\n\n$$$$\n${match}\n$$$$\n\n`;
  });

  str = str.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, '$$$1$$');

  const mathSlots = [];

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

  let html = '';
  if (window.marked && typeof window.marked.parse === 'function') {
    try {
      html = window.DOMPurify ? DOMPurify.sanitize(window.marked.parse(str), { ADD_ATTR: ['target', 'class'] }) : esc(str).replace(/\n/g, '<br>');
    } catch (e) {
      html = esc(str).replace(/\n/g, '<br>');
    }
  } else {
    html = esc(str).replace(/\n/g, '<br>');
  }

  mathSlots.forEach((mathHtml, idx) => {
    const displaySlot = `±MATHDSP${idx}±`;
    const inlineSlot = `±MATHINL${idx}±`;
    html = html.split(`<p>${displaySlot}</p>`).join(mathHtml);
    html = html.split(displaySlot).join(mathHtml);
    html = html.split(inlineSlot).join(mathHtml);
  });

  codeBlocks.forEach((codeSnippet, idx) => {
    const codeSlot = `±BRECODE${idx}±`;
    let parsedCode = '';
    if (window.marked && typeof window.marked.parse === 'function') {
      try { parsedCode = window.DOMPurify ? DOMPurify.sanitize(window.marked.parse(codeSnippet)) : `<pre><code>${esc(codeSnippet)}</code></pre>`; } catch(e) { parsedCode = `<pre><code>${esc(codeSnippet)}</code></pre>`; }
    } else {
      parsedCode = `<pre><code>${esc(codeSnippet)}</code></pre>`;
    }
    html = html.split(`<p>${codeSlot}</p>`).join(parsedCode);
    html = html.split(codeSlot).join(parsedCode);
  });

  html = html.replace(/\±(?:BRECODE|MATHDSP|MATHINL)\d+±/g, '');

  return html;
}

function renderContent(raw, isUser) {
  if (isUser) {
    if (typeof raw === 'string' && raw.includes('![')) {
      if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(raw));
    }
    return esc(raw).replace(/\n/g, '<br>');
  }
  let text = raw || '', thHtml = '';
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
  text = text.replace(/^\[(?:Thinking Process|Reasoning Process|Proses Berpikir)\][\s\S]*?(?:\r?\n\r?\n|$)/gi, '');
  text = text.replace(/^\*(?:Thinking Process|Reasoning Process|Proses Berpikir)\*[\s\S]*?(?:\r?\n\r?\n|$)/gi, '');
  text = text.replace(/^(?:Thinking Process|Reasoning Process|Proses Berpikir|thinking):\s*[\s\S]*?(?:\r?\n\r?\n|$)/gi, '');
  text = text.replace(/^thinking([A-Z\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF][^\n]*\n*)/i, '');

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
    if (!/^[a-zA-Z0-9_+.-]{1,40}$/.test(lang)) lang = 'text';

    const canPreview = /^(html|xml|svg|htm|mermaid)$/i.test(lang);

    hdr.innerHTML = `
      <span>📄 ${lang.toUpperCase()}</span>
      <div class="code-btns">
        ${canPreview ? '<button onclick="openArtifactFromBtn(this, \'preview\')">▶ ' + (lang === 'mermaid' ? 'Diagram' : 'Canvas') + '</button>' : ''}
        <button onclick="openArtifactFromBtn(this, \'code\')">👁️ View</button>
        <button onclick="downloadCode(this, \'' + lang + '\')">📥 Download</button>
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

// ---- ARTIFACTS & CANVAS PANEL ----
function buildArtifactSrcdoc(type, code) {
  const t = (type || 'html').toLowerCase();
  if (t === 'mermaid') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>body{margin:0;padding:24px;background:#fff;display:flex;justify-content:center;align-items:center;min-height:90vh;font-family:sans-serif;}</style>
</head>
<body>
  <div class="mermaid">${esc(code)}</div>
  <script>
    try { mermaid.initialize({ startOnLoad: true, theme: 'default' }); } catch(e){}
  </script>
</body>
</html>`;
  }
  if (t === 'svg') {
    return code.includes('<svg')
      ? `<!DOCTYPE html><html><body style="margin:0;padding:24px;display:flex;justify-content:center;align-items:center;min-height:90vh;background:#fff;">${code}</body></html>`
      : `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#fff;"><pre>${esc(code)}</pre></body></html>`;
  }
  if (['html', 'htm', 'xml'].includes(t)) {
    return (code.includes('<html') || code.includes('<!DOCTYPE'))
      ? code
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:24px;background:#fff;color:#111;line-height:1.6;}</style></head><body>${code}</body></html>`;
  }
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;line-height:1.6;background:#fff;color:#111;"><pre style="white-space:pre-wrap;">${esc(code)}</pre></body></html>`;
}

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

  openArtifact(text, lang, title, tab);
}

function openArtifact(code, type, title, activeTab = 'preview') {
  let finalCode = '', finalType = 'html', finalTitle = title, finalTab = activeTab;

  const knownTypes = ['html', 'htm', 'xml', 'svg', 'mermaid', 'js', 'javascript', 'css', 'json'];
  if (typeof code === 'string' && typeof type === 'string' && knownTypes.includes(type.toLowerCase())) {
    finalCode = code;
    finalType = type.toLowerCase();
  } else if (typeof code === 'string' && typeof type === 'string' && knownTypes.includes(code.toLowerCase())) {
    finalType = code.toLowerCase();
    finalCode = type;
  } else {
    finalCode = code || '';
    finalType = (type || 'html').toLowerCase();
  }

  if (!finalTitle) finalTitle = finalType.toUpperCase() + ' Artifact';

  currentArtifact = { lang: finalType, content: finalCode, title: finalTitle };
  sandboxCode = finalCode;

  const panel = document.getElementById('artifactPanel');
  const toggleBtn = document.getElementById('btnArtifactToggle');
  if (!panel) return;

  const titleEl = document.getElementById('artifactTitle');
  if (titleEl) titleEl.textContent = finalTitle;
  const tagEl = document.getElementById('artifactTypeTag');
  if (tagEl) tagEl.textContent = finalType.toUpperCase();

  const isPreviewable = ['html', 'xml', 'svg', 'htm', 'mermaid'].includes(finalType);
  const tabsEl = document.getElementById('artifactTabs');
  if (tabsEl) tabsEl.style.display = isPreviewable ? 'flex' : 'none';

  const iframe = document.getElementById('artifactIframe');
  if (iframe) {
    iframe.srcdoc = buildArtifactSrcdoc(finalType, finalCode);
  }

  const codeEl = document.getElementById('artifactCodeContent');
  if (codeEl) {
    codeEl.textContent = finalCode;
    codeEl.className = 'language-' + (finalType || 'plaintext');
    if (window.hljs) hljs.highlightElement(codeEl);
  }

  panel.classList.add('open');
  if (toggleBtn) toggleBtn.style.display = 'flex';

  switchArtifactTab(isPreviewable ? finalTab : 'code');
}

function openArtifactPanel(code, type, title, activeTab) {
  if (code) {
    openArtifact(code, type, title, activeTab);
  } else if (currentArtifact) {
    openArtifact(currentArtifact.content, currentArtifact.lang, currentArtifact.title);
  } else {
    const panel = document.getElementById('artifactPanel');
    if (panel) panel.classList.add('open');
  }
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
    openArtifact(currentArtifact.content, currentArtifact.lang, currentArtifact.title);
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
      iframe.srcdoc = buildArtifactSrcdoc(currentArtifact.lang, currentArtifact.content);
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
    win.opener = null;
    const frame = win.document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
    frame.srcdoc = buildArtifactSrcdoc(currentArtifact.lang, currentArtifact.content);
    win.document.body.replaceChildren(frame);
  }
}

function runPreview(btn) {
  openArtifactFromBtn(btn, 'preview');
}

function reloadPreview() {
  reloadArtifact();
}

// ---- CHAT SEARCH & LIST RENDERING ----
function handleChatSearch(val) {
  chatSearchQuery = (val || '').trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = chatSearchQuery ? 'block' : 'none';
  renderChatList();
  searchInsideMessages(chatSearchQuery);
}

function clearChatSearch() {
  chatSearchQuery = '';
  const inp = document.getElementById('chatSearchInput');
  if (inp) inp.value = '';
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderChatList();
  searchInsideMessages('');
}

function searchInsideMessages(query) {
  const container = document.getElementById('messages');
  if (!container) return;

  container.querySelectorAll('mark.chat-search-highlight').forEach(m => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    }
  });
  container.querySelectorAll('.mrow.msg-search-match').forEach(row => {
    row.classList.remove('msg-search-match');
  });

  const q = (query || '').trim();
  if (!q) return;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  let firstMatchEl = null;

  container.querySelectorAll('.mrow').forEach(row => {
    const bubble = row.querySelector('.mbubble');
    if (!bubble) return;

    let matched = false;
    const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && regex.test(node.nodeValue)) {
        textNodes.push(node);
      }
      regex.lastIndex = 0;
    }

    textNodes.forEach(textNode => {
      const val = textNode.nodeValue;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      val.replace(regex, (match, offset) => {
        matched = true;
        if (offset > lastIdx) {
          frag.appendChild(document.createTextNode(val.slice(lastIdx, offset)));
        }
        const mark = document.createElement('mark');
        mark.className = 'chat-search-highlight';
        mark.style.backgroundColor = '#fef08a';
        mark.style.color = '#854d0e';
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 2px';
        mark.textContent = match;
        frag.appendChild(mark);
        lastIdx = offset + match.length;
      });
      if (lastIdx < val.length) {
        frag.appendChild(document.createTextNode(val.slice(lastIdx)));
      }
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });

    if (matched) {
      row.classList.add('msg-search-match');
      if (!firstMatchEl) firstMatchEl = row;
    }
  });

  if (firstMatchEl) {
    firstMatchEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
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

function updateStats() {
  const sSessions = document.getElementById('sSessions');
  const sMsgs = document.getElementById('sMsgs');
  if (sSessions) sSessions.textContent = chats.length;
  if (sMsgs) sMsgs.textContent = chats.reduce((a, c) => a + (c.msgs ? c.msgs.length : 0), 0);
}

// ---- MESSAGES & ATTACHMENT BAR RENDERING ----
function renderMessages() {
  const el = document.getElementById('messages');
  if (!el) return;
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
              <span class="ufb-icon">${esc(att.icon || '📎')}</span>
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
      statsHtml = `<div class="bot-meta-stats"><span class="tok-speed">⚡ ${esc(m.stats.tokPerSec)} tok/s</span> &bull; <span>⏱️ ${esc(m.stats.elapsed)}s</span> &bull; <span>${esc(m.stats.tokens)} tokens</span></div>`;
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
            ${m.searchSources.map(s => `<a href="${esc(safeLink(s.url))}" target="_blank" rel="noopener noreferrer" class="search-source-chip" title="${esc(s.snippet || s.title)}">🔗 ${esc(s.title || s.url)}</a>`).join('')}
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

function toggleExportMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('exportMenu');
  if (m) m.classList.toggle('show');
}

document.addEventListener('click', () => {
  document.getElementById('exportMenu')?.classList.remove('show');
});

// ---- KEYBOARD SHORTCUTS ----
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', e => {
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

    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      openModal('shortcutsModal');
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      newChat();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const sb = document.getElementById('sidebar');
      if (sb?.classList.contains('collapsed')) toggleSidebar(true);
      const searchInp = document.getElementById('chatSearchInput');
      searchInp?.focus();
      searchInp?.select();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      toggleWebSearch();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      toggleIncognito();
      return;
    }
  });
}
