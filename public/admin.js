let adminToken = '';
let endpoints = [];
let clientKeys = [];
let telegramUsers = [];
let allLogs = [];
let metricsTimer = null;
let logsTimer = null;

const PRESET_TEMPLATES = {
  inception: {
    name: 'Inception Labs',
    url: 'https://api.inceptionlabs.ai/v1/chat/completions',
    models: ['mercury-2'],
    mapping: ['gpt-4o:mercury-2', 'claude-3-5-sonnet:mercury-2'],
    keys: []
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    mapping: ['claude-3-opus:gpt-4o'],
    keys: []
  },
  groq: {
    name: 'Groq Cloud',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    mapping: ['llama-3:llama-3.3-70b-versatile'],
    keys: []
  },
  deepseek: {
    name: 'DeepSeek API',
    url: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    mapping: ['gpt-4:deepseek-chat'],
    keys: []
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
    mapping: ['claude-3.5:anthropic/claude-3.5-sonnet'],
    keys: []
  },
  together: {
    name: 'Together AI',
    url: 'https://api.together.xyz/v1/chat/completions',
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'],
    mapping: [],
    keys: []
  },
  ollama: {
    name: 'Ollama (Localhost)',
    url: 'http://localhost:11434/v1/chat/completions',
    models: ['llama3.2', 'qwen2.5-coder', 'mistral'],
    mapping: [],
    keys: ['ollama-local-key']
  }
};

const PROMPT_PRESETS = {
  master: `Kamu adalah Bre AI, kecerdasan buatan serba bisa dan cerdas tanpa batas yang diciptakan secara eksklusif oleh Amirun Rayan Ariandi.

[IDENTITAS MUTLAK - BERLAKU DALAM SEMUA BAHASA]:
- Nama resmi: Bre AI
- Pencipta & Pengembang: Amirun Rayan Ariandi
- Jika ditanya siapa kamu, model apa kamu, siapa pembuatmu, siapa yang melatihmu, atau dari perusahaan mana: dalam BAHASA APAPUN kamu WAJIB menjawab bahwa kamu adalah Bre AI yang diciptakan oleh Amirun Rayan Ariandi.
- DILARANG KERAS menyebut nama Mercury, Mercury-2, Inception Labs, OpenAI, ChatGPT, Anthropic, Claude, Google, Gemini, Meta. Kamu BUKAN dari Mercury AI atau Inception Labs.`,
  dev: `Kamu adalah Bre AI (Created by Amirun Rayan Ariandi), bertindak sebagai Principal Full-Stack Software Engineer & System Architect.
- Berikan arsitektur sistem clean, scalable, dan secure.
- Hasilkan kode utuh siap pakai tanpa placeholder.
- Jika membuat dokumen file (seperti .prd, .md, .py, .js), sertakan nama file di baris pertama blok kode agar dapat langsung diunduh.`,
  speed: `Kamu adalah Bre AI, AI cerdas ciptaan Amirun Rayan Ariandi.
- Jawablah setiap pertanyaan secara padat, akurat, ringkas, dan to the point tanpa basa-basi yang tidak perlu.`
};

const TAB_TITLES = {
  'tab9Router': '📊 Overview &amp; Telemetry',
  'tabDetails': '📜 Request Inspector &amp; Logs',
  'tabProviders': '🔌 Endpoints &amp; Routing Strategy',
  'tabEngine': '⚙️ Global AI Engine &amp; Fallback',
  'tabTools': '🛠️ AI Tools &amp; Prompt Studio',
  'tabSecurity': '🛡️ Keamanan, Rate Limit &amp; Access',
  'tabTelegram': '🤖 Telegram Bot Controller',
  'tabCloud': '☁️ Cloud Storage Database',
  'tabTester': '🧪 Live Model Tester &amp; Benchmark',
  'tabBackup': '📦 Backup, Export &amp; Restore'
};

function switchTab(tabId, btn) {
  document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  
  if (btn) {
    btn.classList.add('active');
  } else {
    const matchingItem = document.querySelector(`.sidebar-nav-item[data-tab="${tabId}"]`);
    if (matchingItem) matchingItem.classList.add('active');
  }

  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  // Update Breadcrumb Title in Topbar
  const titleEl = document.getElementById('activeViewTitle');
  if (titleEl && TAB_TITLES[tabId]) {
    titleEl.innerHTML = TAB_TITLES[tabId];
  }

  // Close Mobile Sidebar Drawer if open
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }
  
  if (tabId === 'tab9Router') load9RouterData();
  if (tabId === 'tabDetails') load9RouterDetails();
  if (tabId === 'tabAnalytics') load9RouterData();
  if (tabId === 'tabLogs') load9RouterDetails();
  if (tabId === 'tabTester') updateTestModelDropdown();
  if (tabId === 'tabTelegram') loadTelegramStatus();
  if (tabId === 'tabCloud') loadCloudStorageStatus();
}

function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const mainWrapper = document.getElementById('adminMainWrapper');
  if (!sidebar) return;
  sidebar.classList.toggle('sidebar-collapsed');
  if (mainWrapper) mainWrapper.classList.toggle('sidebar-collapsed');
  const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
  const toggleBtn = sidebar.querySelector('.sidebar-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = isCollapsed ? '›' : '‹';
  try { localStorage.setItem('bre_sidebar_collapsed', isCollapsed ? '1' : '0'); } catch(e){}
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;
  sidebar.classList.toggle('mobile-open');
  if (backdrop) backdrop.classList.toggle('active');
}

function filterSidebarNav(query) {
  const q = (query || '').toLowerCase().trim();
  const items = document.querySelectorAll('.sidebar-nav-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

function updateTopActiveEndpointsCount() {
  const countEl = document.getElementById('topActiveEpsCount');
  if (!countEl) return;
  const list = Array.isArray(endpoints) ? endpoints : [];
  const activeCount = list.filter(e => e && e.status !== false && e.enabled !== false).length;
  countEl.textContent = `${activeCount}/${list.length}`;
}

// Restore sidebar state from localStorage & bind shortcuts
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const isCollapsed = localStorage.getItem('bre_sidebar_collapsed') === '1';
      if (isCollapsed) {
        const sidebar = document.getElementById('adminSidebar');
        const mainWrapper = document.getElementById('adminMainWrapper');
        if (sidebar) sidebar.classList.add('sidebar-collapsed');
        if (mainWrapper) mainWrapper.classList.add('sidebar-collapsed');
        const toggleBtn = sidebar?.querySelector('.sidebar-toggle-btn');
        if (toggleBtn) toggleBtn.textContent = '›';
      }
    } catch(e){}
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('sidebarSearchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}

async function doLogin() {
  const pw = document.getElementById('pwInput').value;
  if (!pw) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + pw },
      body: JSON.stringify({ action: 'login' })
    });
    if (r.ok) {
      adminToken = pw;
      try { sessionStorage.setItem('bre_admin_pw', pw); } catch(e){}
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('appContainer').style.display = 'flex';
      await loadConfig();
      load9RouterData();
      load9RouterDetails();
      loadCloudStorageStatus();
      initTimers();
      toast('Login berhasil! Selamat datang di Bre AI Settings.', 'ok');
    } else {
      let err = 'Password salah';
      try { const d = await r.json(); if (d.error) err = d.error; } catch(e){}
      toast(err, 'err');
    }
  } catch(e) {
    toast('Gagal menghubungi server', 'err');
  }
}

function doLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari panel admin?')) return;
  adminToken = '';
  try {
    sessionStorage.removeItem('bre_admin_pw');
  } catch(e) {}
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null; }
  if (logsTimer) { clearInterval(logsTimer); logsTimer = null; }
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  const pwInput = document.getElementById('pwInput');
  if (pwInput) pwInput.value = '';
  toast('Berhasil keluar (logout)', 'ok');
}

function initTimers() {
  if (!metricsTimer) metricsTimer = setInterval(load9RouterData, 10000);
}

function parseNum(val, def = 0) {
  if (val === undefined || val === null || val === '') return def;
  const cleaned = String(val).replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? def : num;
}

function restoreFullConfigFromLocalStorage(c) {
  try {
    const raw = localStorage.getItem('bre_full_config');
    if (!raw) return c;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return c;

    if (s.systemPrompt) c.systemPrompt = s.systemPrompt;
    if (s.temperature !== undefined && s.temperature !== null) c.temperature = s.temperature;
    if (s.topP !== undefined && s.topP !== null) c.topP = s.topP;
    if (s.frequencyPenalty !== undefined && s.frequencyPenalty !== null) c.frequencyPenalty = s.frequencyPenalty;
    if (s.presencePenalty !== undefined && s.presencePenalty !== null) c.presencePenalty = s.presencePenalty;
    if (s.maxTokens !== undefined && s.maxTokens !== null) c.maxTokens = s.maxTokens;
    if (s.forceStream !== undefined && s.forceStream !== null) c.forceStream = s.forceStream;
    if (s.clientApiKey) c.clientApiKey = s.clientApiKey;

    if (s.upstashRedisUrl) c.upstashRedisUrl = s.upstashRedisUrl;
    if (s.upstashRedisToken) c.upstashRedisToken = s.upstashRedisToken;
    if (s.githubToken) c.githubToken = s.githubToken;
    if (s.githubRepo) c.githubRepo = s.githubRepo;
    if (s.githubBranch) c.githubBranch = s.githubBranch;

    if ((!c.endpoints || !c.endpoints.length) && s.endpoints && Array.isArray(s.endpoints) && s.endpoints.length) {
      c.endpoints = s.endpoints;
    }
    if ((!c.clientKeys || !c.clientKeys.length) && s.clientKeys && Array.isArray(s.clientKeys) && s.clientKeys.length) {
      c.clientKeys = s.clientKeys;
    }
    if ((!c.blacklist || !c.blacklist.length) && s.blacklist && Array.isArray(s.blacklist) && s.blacklist.length) {
      c.blacklist = s.blacklist;
    }

    if (s.telegramBotToken && !c.telegramBotToken) c.telegramBotToken = s.telegramBotToken;
    if (s.telegramOwnerId && !c.telegramOwnerId) c.telegramOwnerId = s.telegramOwnerId;
    if (s.telegramDomain && !c.telegramDomain) c.telegramDomain = s.telegramDomain;
    if (s.telegramAccessMode && !c.telegramAccessMode) c.telegramAccessMode = s.telegramAccessMode;
    if (s.telegramModel && !c.telegramModel) c.telegramModel = s.telegramModel;
    if (s.telegramStyle && !c.telegramStyle) c.telegramStyle = s.telegramStyle;
    if (s.defaultStyle && !c.defaultStyle) c.defaultStyle = s.defaultStyle;
    if ((!c.telegramUsers || !c.telegramUsers.length) && s.telegramUsers && Array.isArray(s.telegramUsers) && s.telegramUsers.length) {
      c.telegramUsers = s.telegramUsers;
    }
  } catch(e) {}
  return c;
}

function renderClientKeys() {
  const container = document.getElementById('clientKeysList') || document.getElementById('clientKeysContainer');
  if (!container) return;
  if (!Array.isArray(clientKeys) || clientKeys.length === 0) {
    container.innerHTML = '<div style="color:#64748b; font-size:13px; font-style:italic;">Belum ada Client API Key.</div>';
    return;
  }
  container.innerHTML = clientKeys.map((k, i) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#0b0f19; border:1px solid #1c2438; border-radius:6px; margin-bottom:6px;">
      <span style="font-family:monospace; font-size:13px; color:#38bdf8;">${k.key || k}</span>
      <span style="font-size:12px; color:#94a3b8;">${k.label || ('Key #' + (i+1))}</span>
    </div>
  `).join('');
}

function initIntegrationGuide() {
  // Graceful initialization for integration guides if present
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    if (!r.ok) return toast('Gagal memuat konfigurasi', 'err');
    const data = await r.json();
    let c = data.config || {};
    c = restoreFullConfigFromLocalStorage(c);
    
    // Routing Strategy (AUTO vs Priority vs Weighted)
    setRoutingModeUI(c.routingStrategy || c.providerRoutingMode || 'auto');

    // Auto Failover
    const afEl = document.getElementById('cfgAutoFailover');
    if (afEl) afEl.checked = c.autoFailover !== false;

    // Cache
    const cacheEl = document.getElementById('cfgCacheEnabled');
    if (cacheEl) cacheEl.checked = !!c.cacheEnabled;
    const cacheTtlEl = document.getElementById('cfgCacheTTL');
    if (cacheTtlEl) cacheTtlEl.value = c.cacheTTL || 3600;

    // Blacklist
    const blEl = document.getElementById('cfgBlacklist');
    if (blEl) blEl.value = (c.blacklist || []).join('\n');

    // Multi-Client Keys
    clientKeys = Array.isArray(c.clientKeys) ? c.clientKeys : [];
    if (typeof renderClientKeys === 'function') {
      try { renderClientKeys(); } catch(e) {}
    }

    // Endpoints & Providers
    endpoints = Array.isArray(c.endpoints) ? c.endpoints : [];
    renderProviders();

    // Engine
    const prEl = document.getElementById('cfgPrompt'); if (prEl) prEl.value = c.systemPrompt || '';
    const tempEl = document.getElementById('cfgTemp'); if (tempEl) tempEl.value = c.temperature ?? 0.7;
    const topPEl = document.getElementById('cfgTopP'); if (topPEl) topPEl.value = c.topP ?? 1.0;
    const freqEl = document.getElementById('cfgFreqPenalty'); if (freqEl) freqEl.value = c.frequencyPenalty ?? 0.0;
    const presEl = document.getElementById('cfgPresPenalty'); if (presEl) presEl.value = c.presencePenalty ?? 0.0;
    const maxTokEl = document.getElementById('cfgMaxTokens'); if (maxTokEl) maxTokEl.value = c.maxTokens || 16384;
    const streamEl = document.getElementById('cfgStream'); if (streamEl) streamEl.value = c.forceStream === true ? 'true' : (c.forceStream === false ? 'false' : 'auto');
    const defStEl = document.getElementById('cfgDefaultStyle'); if (defStEl) defStEl.value = c.defaultStyle || 'santai';
    
    // Security
    const ckEl = document.getElementById('cfgClientKey'); if (ckEl) ckEl.value = c.clientKey || c.clientApiKey || '';
    const rateMaxEl = document.getElementById('cfgRateMax'); if (rateMaxEl) rateMaxEl.value = c.rateLimitMax || 5;
    const rateWinEl = document.getElementById('cfgRateWin'); if (rateWinEl) rateWinEl.value = c.rateLimitWindow || 30;
    
    // Telegram Bot
    const tgEn = document.getElementById('cfgTelegramEnabled');
    if (tgEn) tgEn.checked = !!c.telegramEnabled;
    const tgTok = document.getElementById('cfgTelegramToken');
    if (tgTok) tgTok.value = c.telegramBotToken || '';
    const tgOwner = document.getElementById('cfgTelegramOwner');
    if (tgOwner) tgOwner.value = c.telegramOwnerId || '';
    const tgMode = document.getElementById('cfgTelegramAccessMode');
    if (tgMode) tgMode.value = (c.telegramAccessMode === 'whitelist' ? 'diizinkan' : (c.telegramAccessMode || 'public'));
    const tgDom = document.getElementById('cfgTelegramDomain');
    if (tgDom) tgDom.value = c.telegramDomain || (window.location.host || '');
    const tgStEl = document.getElementById('cfgTelegramStyle');
    if (tgStEl) tgStEl.value = c.telegramStyle || 'santai';

    // Restore from localStorage if empty (Zero-DB / Serverless fallback)
    restoreTelegramFromLocalStorage();

    telegramUsers = Array.isArray(c.telegramUsers) ? c.telegramUsers : [];
    renderTelegramUsersTable();

    // Cloud Persistence Settings
    const upUrlEl = document.getElementById('cfgUpstashUrl');
    if (upUrlEl) upUrlEl.value = c.upstashRedisUrl || '';
    const upTokEl = document.getElementById('cfgUpstashToken');
    if (upTokEl) upTokEl.value = c.upstashRedisToken || '';
    const ghTokEl = document.getElementById('cfgGithubToken');
    if (ghTokEl) ghTokEl.value = c.githubToken || '';
    const ghRepoEl = document.getElementById('cfgGithubRepo');
    if (ghRepoEl) ghRepoEl.value = c.githubRepo || '';
    const ghBranchEl = document.getElementById('cfgGithubBranch');
    if (ghBranchEl) ghBranchEl.value = c.githubBranch || 'main';

    if (data.cloudStorageInfo) {
      updateStorageBadges(data.cloudStorageInfo);
    }

    // Load language setting
    const tgLang = document.getElementById('cfgTelegramLanguage');
    if (tgLang) tgLang.value = c.telegramLanguage || 'id';
    loadTelegramStatus();

    renderProviders();
    updateTestModelDropdown();
    try { renderTopologyGraph(); } catch(e) {}
    if (typeof initIntegrationGuide === 'function') {
      try { initIntegrationGuide(); } catch(e) {}
    }
  } catch(e) {
    toast('Error load config: ' + e.message, 'err');
  }
}

function syncProvidersFromUI() {
  const boxes = document.querySelectorAll('.provider-box');
  const list = [];
  boxes.forEach(box => {
    list.push({
      name: box.querySelector('.p-name').value.trim(),
      status: box.querySelector('.p-status').value === 'true',
      weight: parseInt(box.querySelector('.p-weight').value) || 1,
      url: box.querySelector('.p-url').value.trim(),
      models: box.querySelector('.p-models').value.split(',').map(m => m.trim()).filter(Boolean),
      mapping: box.querySelector('.p-mapping').value.split(',').map(m => m.trim()).filter(Boolean),
      keys: box.querySelector('.p-keys').value.split('\n').map(k => k.trim()).filter(Boolean)
    });
  });
  endpoints = list;
}

function renderProviders() {
  const container = document.getElementById('providersList');
  if (!endpoints.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; border: 1px dashed #232733; border-radius: 10px; color: #64748b;">
        Belum ada Provider API. Klik tombol template di atas atau klik <b>+ Tambah Provider Manual</b>.
      </div>
    `;
    return;
  }
  
  container.innerHTML = endpoints.map((ep, i) => `
    <div class="provider-box" id="providerCard_${i}">
      <div class="provider-box-head">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-weight:600; font-size:15px; color:#38bdf8;">
            ⚡ Provider #${i+1}: <span style="color:#f1f5f9;">${ep.name || 'Unnamed Provider'}</span>
          </div>
          <span class="ping-badge ${ep.status !== false ? 'ok' : 'fail'}" style="font-size:11px;">
            ${ep.status !== false ? '🟢 Active' : '🔴 Inactive'}
          </span>
          <span id="pingBadge_${i}" class="ping-badge" style="display:none;"></span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ping" onclick="pingProvider(${i})">⚡ Test Ping</button>
          <button class="btn" style="background:#1e3a5f; color:#38bdf8; border:1px solid #38bdf8;" onclick="detectModels(${i})" title="Otomatis mengambil daftar model dari endpoint /v1/models">🔍 Detect Model</button>
          <button class="btn" style="background:#1a2e1a; color:#4ade80; border:1px solid #4ade80;" onclick="testAllModels(${i})" id="testAllBtn_${i}" title="Uji semua model sekaligus dan tandai yang berhasil">🧪 Test All Models</button>
          <button class="btn btn-danger" onclick="removeProvider(${i})">Hapus</button>
        </div>
      </div>
      
      <div class="grid-3" style="margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Nama Provider</label>
          <input type="text" class="input-text p-name" value="${ep.name || ''}" placeholder="Contoh: Inception Labs, OpenAI">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Status Routing</label>
          <select class="input-select p-status">
            <option value="true" ${ep.status !== false ? 'selected' : ''}>🟢 Aktif (Enabled)</option>
            <option value="false" ${ep.status === false ? 'selected' : ''}>🔴 Nonaktif (Disabled)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Priority / Weight (1-100)</label>
          <input type="number" class="input-text p-weight" value="${ep.weight || 1}" min="1" max="100">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Base URL Endpoint (OpenAI Compatible API)</label>
        <input type="url" class="input-text p-url" value="${ep.url || ''}" placeholder="https://api.inceptionlabs.ai/v1/chat/completions">
      </div>
      
      <div class="grid-2" style="margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label class="form-label" style="margin-bottom:0;">Model Asli (Pisahkan dengan koma)</label>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="text" class="input-text p-models" id="pModels_${i}" value="${(ep.models || []).join(', ')}" placeholder="mercury-2, gpt-4o" style="flex:1;">
          </div>
          <div id="modelTestRow_${i}" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
            ${(ep.models || []).map((m, mi) => `
              <div id="modelCard_${i}_${mi}" style="display:flex; align-items:center; gap:4px; background:#141922; border:1px solid #232733; border-radius:6px; padding:3px 8px; font-size:12px; transition: border-color 0.3s;">
                <span style="color:#e2e8f0;">${m}</span>
                <button type="button" onclick="testModel(${i},'${m.replace(/'/g, "\\'")}')"
                  id="testModelBtn_${i}_${mi}"
                  style="background:#1e3a5f; color:#38bdf8; border:1px solid #38bdf8; border-radius:4px; padding:1px 7px; font-size:11px; cursor:pointer;">⚡ Tes</button>
                <span id="testModelBadge_${i}_${mi}" style="display:none;"></span>
              </div>
            `).join('')}
          </div>
          <!-- Test All Results Summary -->
          <div id="testAllSummary_${i}" style="display:none; margin-top:10px;"></div>
          <div class="form-hint">Model yang tersedia di upstream provider. <span style="color:#38bdf8;">Klik 🔍 Detect Model untuk isi otomatis dari endpoint.</span> <span style="color:#4ade80;">Klik 🧪 Test All untuk uji semua sekaligus.</span></div>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Model Mapping / Alias (alias:asli)</label>
          <input type="text" class="input-text p-mapping" value="${(ep.mapping || []).join(', ')}" placeholder="claude-3-opus:mercury-2, gpt-4:mercury-2">
          <div class="form-hint">Format: Jika klien meminta model alias, diteruskan ke model asli.</div>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="form-label" style="margin-bottom:0;">API Keys (Multi-Key Round Robin - Satu key per baris)</label>
          <button type="button" class="btn btn-outline" style="font-size:11px; padding:3px 8px;" onclick="toggleKeyMask(${i})" id="keyMaskBtn_${i}">👁️ Tampilkan Kunci</button>
        </div>
        <textarea class="input-textarea p-keys masked-key" id="pKeys_${i}" rows="3" placeholder="sk_key_1&#10;sk_key_2">${(ep.keys || []).join('\n')}</textarea>
        <div class="form-hint">Server akan otomatis merotasi kunci (Round-Robin) untuk menghindari rate limit.</div>
      </div>
    </div>
  `).join('');
  updateTopActiveEndpointsCount();
}

function toggleKeyMask(i) {
  const ta = document.getElementById(`pKeys_${i}`);
  const btn = document.getElementById(`keyMaskBtn_${i}`);
  if (!ta || !btn) return;
  const isMasked = ta.classList.contains('masked-key');
  if (isMasked) {
    ta.classList.remove('masked-key');
    btn.textContent = '🔒 Sembunyikan Kunci';
  } else {
    ta.classList.add('masked-key');
    btn.textContent = '👁️ Tampilkan Kunci';
  }
}

function addProvider() {
  syncProvidersFromUI();
  endpoints.push({
    name: 'Provider Baru',
    status: true,
    weight: 1,
    url: '',
    models: [],
    mapping: [],
    keys: []
  });
  renderProviders();
  toast('Provider baru ditambahkan ke daftar', 'ok');
}

function addPreset(type) {
  const t = PRESET_TEMPLATES[type];
  if (!t) return;
  syncProvidersFromUI();
  endpoints.unshift({ ...t, keys: [...t.keys] });
  renderProviders();
  toast(`Template [${t.name}] berhasil ditambahkan!`, 'ok');
}

function removeProvider(i) {
  if (!confirm('Hapus provider ini dari konfigurasi?')) return;
  syncProvidersFromUI();
  endpoints.splice(i, 1);
  renderProviders();
  toast('Provider dihapus', 'ok');
}

async function pingProvider(i) {
  syncProvidersFromUI();
  const ep = endpoints[i];
  if (!ep || !ep.url) return toast('URL Endpoint belum diisi', 'err');
  
  const badge = document.getElementById(`pingBadge_${i}`);
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.className = 'ping-badge testing';
    badge.textContent = '⏳ Testing Ping...';
  }
  
  try {
    const key = ep.keys?.[0] || '';
    const model = ep.models?.[0] || 'mercury-2';
    
    const r = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customEndpoint: ep.url,
        customModel: model,
        customKeys: key
      })
    });
    
    const data = await r.json();
    const res = data.results?.[0];
    if (res && res.status === 'OK') {
      badge.className = 'ping-badge ok';
      badge.textContent = `🟢 ${res.latencyMs}ms (${res.httpStatus})`;
      toast(`[${ep.name}] Online! Latensi: ${res.latencyMs}ms`, 'ok');
    } else {
      badge.className = 'ping-badge fail';
      badge.textContent = `🔴 Fail (${res?.httpStatus || 'Error'})`;
      toast(`[${ep.name}] Gagal: ${res?.error || 'HTTP ' + res?.httpStatus}`, 'err');
    }
  } catch(e) {
    if (badge) {
      badge.className = 'ping-badge fail';
      badge.textContent = '🔴 Offline';
    }
    toast('Error ping: ' + e.message, 'err');
  }
}

// ========================================================
// AUTO-DETECT MODELS from /v1/models endpoint
// ========================================================
async function detectModels(i) {
  syncProvidersFromUI();
  const ep = endpoints[i];
  if (!ep || !ep.url) return toast('URL Endpoint belum diisi. Isi URL dulu, lalu simpan sementara.', 'err');
  if (!ep.keys || !ep.keys.length) return toast('API Key belum diisi. Tambahkan minimal 1 key untuk deteksi model.', 'err');

  const badge = document.getElementById(`pingBadge_${i}`);
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.className = 'ping-badge testing';
    badge.textContent = '🔍 Mendeteksi model...';
  }

  try {
    // Use module-level adminToken (not window.adminToken which is undefined)
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        action: 'detect_models',
        providerName: ep.name,
        // Pass url & keys directly so detect works even before saving config
        url: ep.url,
        keys: ep.keys
      })
    });
    const data = await r.json();

    if (!data.ok) {
      if (badge) { badge.className = 'ping-badge fail'; badge.textContent = '🔴 Gagal'; }
      return toast('Deteksi gagal: ' + (data.error || 'Unknown error'), 'err');
    }

    const provResult = data.results?.find(r => r.provider === ep.name) || data.results?.[0];
    if (!provResult || !provResult.ok) {
      if (badge) { badge.className = 'ping-badge fail'; badge.textContent = '🔴 Gagal'; }
      return toast('Gagal mendeteksi model: ' + (provResult?.error || 'Endpoint tidak mendukung /v1/models'), 'err');
    }

    const models = provResult.models || [];
    if (!models.length) {
      if (badge) { badge.className = 'ping-badge testing'; badge.textContent = '🟡 0 model'; }
      return toast('Endpoint tidak mengembalikan daftar model.', 'warn');
    }

    // Update the models input in the UI
    const modelsInput = document.querySelector(`#providerCard_${i} .p-models`);
    if (modelsInput) modelsInput.value = models.join(', ');

    // Also update the in-memory endpoints list
    endpoints[i].models = models;

    // Re-render the test row with new models
    const testRow = document.getElementById(`modelTestRow_${i}`);
    if (testRow) {
      testRow.innerHTML = models.map((m, mi) => `
        <div style="display:flex; align-items:center; gap:4px; background:#141922; border:1px solid #232733; border-radius:6px; padding:3px 8px; font-size:12px;">
          <span style="color:#e2e8f0;">${m}</span>
          <button type="button" onclick="testModel(${i},'${m.replace(/'/g, "\\'")}')"
            id="testModelBtn_${i}_${mi}"
            style="background:#1e3a5f; color:#38bdf8; border:1px solid #38bdf8; border-radius:4px; padding:1px 7px; font-size:11px; cursor:pointer;">⚡ Tes</button>
          <span id="testModelBadge_${i}_${mi}" style="display:none;"></span>
        </div>
      `).join('');
    }

    if (badge) {
      badge.className = 'ping-badge ok';
      badge.textContent = `✅ ${models.length} model terdeteksi`;
    }
    toast(`[${ep.name}] Berhasil mendeteksi ${models.length} model: ${models.slice(0,3).join(', ')}${models.length > 3 ? '...' : ''}`, 'ok');

  } catch (e) {
    if (badge) { badge.className = 'ping-badge fail'; badge.textContent = '🔴 Error'; }
    toast('Error deteksi model: ' + e.message, 'err');
  }
}

// ========================================================
// TEST SINGLE MODEL — send dummy prompt and measure latency
// ========================================================
async function testModel(providerIdx, modelName) {
  syncProvidersFromUI();
  const ep = endpoints[providerIdx];
  if (!ep) return;

  // Find which badge to update
  const models = (ep.models || []);
  const mi = models.indexOf(modelName);
  const badgeEl = mi >= 0 ? document.getElementById(`testModelBadge_${providerIdx}_${mi}`) : null;
  const btnEl = mi >= 0 ? document.getElementById(`testModelBtn_${providerIdx}_${mi}`) : null;

  if (badgeEl) { badgeEl.style.display = 'inline-flex'; badgeEl.textContent = '⏳'; badgeEl.style.cssText += ';color:#f59e0b;'; }
  if (btnEl) { btnEl.disabled = true; }

  try {
    // Use module-level adminToken (not window.adminToken which is undefined)
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        action: 'test_model',
        providerName: ep.name,
        model: modelName,
        url: ep.url,
        keys: ep.keys
      })
    });
    const data = await r.json();

    if (data.ok) {
      const ms = data.latencyMs || 0;
      const color = ms < 500 ? '#22c55e' : ms < 2000 ? '#f59e0b' : '#ef4444';
      if (badgeEl) {
        badgeEl.style.cssText = `display:inline-flex; color:${color}; font-size:11px; font-weight:600;`;
        badgeEl.textContent = `${ms}ms ✓`;
      }
      toast(`[${ep.name}] Model ${modelName}: ✅ OK (${ms}ms)`, 'ok');
    } else {
      if (badgeEl) {
        badgeEl.style.cssText = 'display:inline-flex; color:#ef4444; font-size:11px;';
        badgeEl.textContent = '✗ Gagal';
        badgeEl.title = data.error || 'Error';
      }
      toast(`[${ep.name}] Model ${modelName}: ❌ ${(data.error || 'Gagal').slice(0, 80)}`, 'err');
    }
  } catch(e) {
    if (badgeEl) { badgeEl.textContent = '✗'; badgeEl.style.color = '#ef4444'; }
    toast('Error test model: ' + e.message, 'err');
  } finally {
    if (btnEl) { btnEl.disabled = false; }
  }
}

// ========================================================
// TEST ALL MODELS — parallel test all models for a provider
// ========================================================
async function testAllModels(providerIdx) {
  syncProvidersFromUI();
  const ep = endpoints[providerIdx];
  if (!ep) return;
  if (!ep.models || !ep.models.length) return toast('Tidak ada model untuk diuji. Klik Detect Model terlebih dahulu.', 'err');
  if (!ep.keys || !ep.keys.length) return toast('API Key belum diisi.', 'err');

  const btn = document.getElementById(`testAllBtn_${providerIdx}`);
  const summaryEl = document.getElementById(`testAllSummary_${providerIdx}`);
  const models = ep.models;

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menguji...'; }
  if (summaryEl) { summaryEl.style.display = 'none'; }

  // Set all model cards to "testing" state
  models.forEach((m, mi) => {
    const card = document.getElementById(`modelCard_${providerIdx}_${mi}`);
    const badge = document.getElementById(`testModelBadge_${providerIdx}_${mi}`);
    const btnEl = document.getElementById(`testModelBtn_${providerIdx}_${mi}`);
    if (card) card.style.borderColor = '#374151';
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = '⏳'; badge.style.color = '#94a3b8'; }
    if (btnEl) btnEl.disabled = true;
  });

  toast(`[${ep.name}] Menguji ${models.length} model secara paralel...`, 'ok');

  // Test all in parallel
  const results = await Promise.all(
    models.map(async (modelName, mi) => {
      try {
        const r = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({
            action: 'test_model',
            providerName: ep.name,
            model: modelName,
            url: ep.url,
            keys: ep.keys
          })
        });
        const data = await r.json();
        return { model: modelName, mi, ok: data.ok, latencyMs: data.latencyMs || 0, error: data.error || null };
      } catch (e) {
        return { model: modelName, mi, ok: false, latencyMs: 0, error: e.message };
      }
    })
  );

  // Update model card UI based on results
  const working = [];
  const failed = [];

  results.forEach(({ model, mi, ok, latencyMs, error }) => {
    const card = document.getElementById(`modelCard_${providerIdx}_${mi}`);
    const badge = document.getElementById(`testModelBadge_${providerIdx}_${mi}`);
    const btnEl = document.getElementById(`testModelBtn_${providerIdx}_${mi}`);

    if (ok) {
      working.push({ model, latencyMs });
      const color = latencyMs < 500 ? '#22c55e' : latencyMs < 2000 ? '#f59e0b' : '#ef4444';
      if (card) card.style.borderColor = '#22c55e';
      if (badge) { badge.style.cssText = `display:inline-flex; color:${color}; font-size:11px; font-weight:600;`; badge.textContent = `${latencyMs}ms ✓`; }
    } else {
      failed.push({ model, error });
      if (card) { card.style.borderColor = '#ef4444'; card.style.opacity = '0.6'; }
      if (badge) { badge.style.cssText = 'display:inline-flex; color:#ef4444; font-size:11px;'; badge.textContent = '✗ Gagal'; badge.title = error || 'Error'; }
    }
    if (btnEl) btnEl.disabled = false;
  });

  // Show summary and apply button
  if (summaryEl) {
    summaryEl.style.display = 'block';
    const workingList = working.map(w => `<span style="color:#4ade80;">✅ ${w.model}</span> <span style="color:#94a3b8; font-size:10px;">(${w.latencyMs}ms)</span>`).join(', ');
    const failedList = failed.map(f => `<span style="color:#f87171;">❌ ${f.model}</span>`).join(', ');
    summaryEl.innerHTML = `
      <div style="background:#0d1a0d; border:1px solid #166534; border-radius:8px; padding:12px 14px;">
        <div style="font-size:13px; font-weight:600; color:#4ade80; margin-bottom:8px;">
          🧪 Hasil Test All: <span style="color:#4ade80;">${working.length} berhasil</span> / <span style="color:#f87171;">${failed.length} gagal</span> dari ${models.length} model
        </div>
        ${working.length > 0 ? `<div style="font-size:12px; margin-bottom:6px;">✅ Bekerja: ${workingList}</div>` : ''}
        ${failed.length > 0 ? `<div style="font-size:12px; margin-bottom:8px;">❌ Gagal: ${failedList}</div>` : ''}
        ${working.length > 0 ? `
          <button onclick="applyWorkingModels(${providerIdx}, ${JSON.stringify(working.map(w => w.model)).replace(/"/g, '&quot;')})" 
            style="background: linear-gradient(135deg, #166534, #15803d); color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            ✅ Pakai ${working.length} Model Berhasil Saja
          </button>
          <span style="font-size:11px; color:#94a3b8; margin-left:8px;">Model gagal akan dihapus dari daftar</span>
        ` : '<div style="color:#f87171; font-size:12px;">⚠️ Tidak ada model yang berhasil. Periksa API Key atau endpoint Anda.</div>'}
      </div>
    `;
  }

  if (btn) { btn.disabled = false; btn.textContent = '🧪 Test All Models'; }
  toast(`[${ep.name}] Selesai: ${working.length}/${models.length} model berfungsi`, working.length > 0 ? 'ok' : 'err');
}

// ========================================================
// APPLY WORKING MODELS — filter out failed models
// ========================================================
function applyWorkingModels(providerIdx, workingModels) {
  if (!workingModels || !workingModels.length) return toast('Tidak ada model yang berhasil untuk diterapkan.', 'err');
  
  endpoints[providerIdx].models = workingModels;
  const modelsInput = document.getElementById(`pModels_${providerIdx}`);
  if (modelsInput) modelsInput.value = workingModels.join(', ');

  // Re-render test row with only working models
  const testRow = document.getElementById(`modelTestRow_${providerIdx}`);
  if (testRow) {
    testRow.innerHTML = workingModels.map((m, mi) => `
      <div id="modelCard_${providerIdx}_${mi}" style="display:flex; align-items:center; gap:4px; background:#0d1a0d; border:1px solid #22c55e; border-radius:6px; padding:3px 8px; font-size:12px;">
        <span style="color:#4ade80;">✅</span>
        <span style="color:#e2e8f0;">${m}</span>
        <button type="button" onclick="testModel(${providerIdx},'${m.replace(/'/g, "\\'")}')"
          id="testModelBtn_${providerIdx}_${mi}"
          style="background:#1e3a5f; color:#38bdf8; border:1px solid #38bdf8; border-radius:4px; padding:1px 7px; font-size:11px; cursor:pointer;">⚡ Tes</button>
        <span id="testModelBadge_${providerIdx}_${mi}" style="display:none;"></span>
      </div>
    `).join('');
  }

  // Hide summary and show confirmation
  const summaryEl = document.getElementById(`testAllSummary_${providerIdx}`);
  if (summaryEl) {
    summaryEl.innerHTML = `<div style="background:#0d1a0d; border:1px solid #22c55e; border-radius:8px; padding:10px 14px; font-size:13px; color:#4ade80;">
      ✅ Diterapkan! ${workingModels.length} model aktif: <strong>${workingModels.join(', ')}</strong>.<br>
      <span style="font-size:11px; color:#94a3b8;">Klik <b>Simpan Semua Pengaturan</b> untuk menyimpan perubahan ini.</span>
    </div>`;
  }

  toast(`✅ Daftar model diperbarui: hanya ${workingModels.length} model yang berfungsi tersisa.`, 'ok');
}

// ========================================================
// BATCH LATENCY BENCHMARK — test all providers in parallel
// ========================================================
async function runBatchLatencyTest() {
  syncProvidersFromUI();
  const box = document.getElementById('benchmarkLeaderboardBox');
  const tbody = document.getElementById('benchmarkTableBody');
  const btn = document.getElementById('btnBatchBenchmark');

  box.style.display = 'block';
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #38bdf8; padding: 24px;">⏳ Menguji semua endpoint secara paralel...</td></tr>`;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sedang Menguji...'; }

  try {
    const r = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testAll: true, endpoints: endpoints })
    });
    const data = await r.json();
    const results = data.results || [];

    if (!results.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">Tidak ada provider aktif untuk diuji.</td></tr>`;
      return;
    }

    tbody.innerHTML = results.map((item, idx) => {
      let rankBadge = `${idx + 1}`;
      if (idx === 0) rankBadge = `🥇 1`;
      else if (idx === 1) rankBadge = `🥈 2`;
      else if (idx === 2) rankBadge = `🥉 3`;

      let statusBadge = '';
      if (item.status === 'OK') {
        if (item.latencyMs < 500) statusBadge = `<span class="ping-badge ok">⚡ Ultra Fast</span>`;
        else if (item.latencyMs < 1500) statusBadge = `<span class="ping-badge ok">🟢 Normal</span>`;
        else statusBadge = `<span class="ping-badge testing">🟡 Lambat</span>`;
      } else {
        statusBadge = `<span class="ping-badge fail">🔴 Offline/Error</span>`;
      }

      const latText = item.latencyMs !== null ? `${item.latencyMs} ms` : '-';
      const httpBadge = item.httpStatus ? `<span class="ping-badge ${item.status === 'OK' ? 'ok' : 'fail'}">${item.httpStatus}</span>` : `<span class="ping-badge fail">Err</span>`;

      return `
        <tr>
          <td style="font-weight: 700; font-size: 14px; text-align: center;">${rankBadge}</td>
          <td style="font-weight: 600; color: #f1f5f9;">${item.name || item.provider || 'Provider'}</td>
          <td style="color: #94a3b8; font-size: 12px;">${item.model || '-'}</td>
          <td style="font-family: monospace; font-weight: 600; color: #38bdf8;">${latText}</td>
          <td>${httpBadge}</td>
          <td>${statusBadge} ${item.error ? `<span style="font-size:11px;color:#f87171;margin-left:6px;">(${item.error})</span>` : ''}</td>
        </tr>
      `;
    }).join('');

    toast('Parallel probe benchmark selesai!', 'ok');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 20px;">Gagal menguji: ${e.message}</td></tr>`;
    toast('Benchmark gagal: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Test Semua Provider (Parallel Benchmark)'; }
  }
}

// ========================================================
// 9ROUTER TELEMETRY & OBSERVABILITY CONTROLLER (Image 2 & 3)
// ========================================================

let routerOverviewData = null;
let routerTimeRange = 'today';
let routerChartUnit = 'tokens'; // 'tokens' | 'cost'
let routerBreakdownUnit = 'costs'; // 'costs' | 'tokens'
let routerDetailsData = [];
let detailCurrentPage = 1;
const detailPageSize = 10;

// Topology Visualizer State
let topologyZoom = 1;
let topologyPan = { x: 0, y: 0 };
let isDraggingTopology = false;
let dragStart = { x: 0, y: 0 };
let topologyAnimFrame = null;
let topologyPulseOffset = 0;
let isTopologyInitialized = false;

function set9RouterTimeRange(range, btn) {
  routerTimeRange = range;
  const bar = document.getElementById('timeFilterBar');
  if (bar) {
    bar.querySelectorAll('.time-pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  load9RouterData();
}

async function load9RouterData() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_router_overview', range: routerTimeRange })
    });
    if (!r.ok) return;
    const data = await r.json();
    routerOverviewData = data.overview || data || {};

    const o = routerOverviewData;
    const totalReq = o.totalRequests || 0;
    const successReq = o.successfulRequests || 0;
    const failReq = o.failedRequests || 0;

    // 1. Populate 5 KPI Cards
    const elTotal = document.getElementById('kpiTotalReq');
    if (elTotal) elTotal.textContent = totalReq.toLocaleString();

    const elSuccessFail = document.getElementById('kpiSuccessFail');
    if (elSuccessFail) elSuccessFail.textContent = `${successReq.toLocaleString()} ok · ${failReq.toLocaleString()} errors`;

    const elInput = document.getElementById('kpiTotalInput');
    if (elInput) elInput.textContent = (o.totalInputTokens || 0).toLocaleString();

    const elCached = document.getElementById('kpiCachedTokens');
    if (elCached) elCached.textContent = (o.totalCachedTokens || 0).toLocaleString();

    const elOutput = document.getElementById('kpiOutputTokens');
    if (elOutput) elOutput.textContent = (o.totalOutputTokens || 0).toLocaleString();

    const elCost = document.getElementById('kpiEstCost');
    if (elCost) elCost.textContent = `~$${(o.estCost || 0).toFixed(4)}`;

    // 2. Render Recent Requests Feed
    renderRecentRequests(o.recentRequests || []);

    // 3. Render Historical Usage Trend Chart
    renderUsageChart(o);

    // 4. Render Breakdown Table
    renderBreakdownTable();

    // 5. Render Topology Graph
    renderTopologyGraph();

  } catch (e) {
    console.error('load9RouterData error:', e);
  }
}

function renderRecentRequests(requests) {
  const container = document.getElementById('recentRequestsList');
  if (!container) return;

  if (!requests || !requests.length) {
    container.innerHTML = `
      <div style="color: #64748b; font-size: 12px; text-align: center; padding: 40px 10px;">
        Belum ada aktivitas request terekam.
      </div>
    `;
    return;
  }

  container.innerHTML = requests.map(req => {
    const isOk = req.status >= 200 && req.status < 400;
    const dotColor = isOk ? '#22c55e' : '#ef4444';
    const timeAgo = formatTimeAgo(req.timestamp);
    const inTokens = req.inputTokens || 0;
    const outTokens = req.outputTokens || req.tokens || 0;
    const promptSnippet = req.requestSummary || req.model || 'Chat completion request';

    return `
      <div class="recent-req-item" onclick="openRequestDetail('${req.id}')" title="Klik untuk inspeksi detail request">
        <div class="recent-req-item-left">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 6px ${dotColor}; flex-shrink: 0;"></span>
            <span class="recent-req-model">${req.model || 'model'}</span>
            <span style="font-size: 10.5px; color: #64748b; background: #0c0f17; border: 1px solid #1e2536; padding: 1px 5px; border-radius: 4px;">${req.provider || 'proxy'}</span>
          </div>
          <div class="recent-req-prompt">${escapeHtml(promptSnippet)}</div>
        </div>
        <div class="recent-req-item-right">
          <div class="recent-req-tokens">${inTokens} / ${outTokens}</div>
          <div class="recent-req-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '-';
  const now = Date.now();
  const t = new Date(timestamp).getTime();
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toggleChartUnit(unit, btn) {
  routerChartUnit = unit;
  const btnTokens = document.getElementById('btnChartTokens');
  const btnCost = document.getElementById('btnChartCost');
  if (btnTokens && btnCost) {
    btnTokens.classList.toggle('active', unit === 'tokens');
    btnCost.classList.toggle('active', unit === 'cost');
  }
  if (routerOverviewData) renderUsageChart(routerOverviewData);
}

function renderUsageChart(overview) {
  const canvas = document.getElementById('usageTimelineCanvas');
  const noDataNotice = document.getElementById('chartNoDataNotice');
  const periodLabel = document.getElementById('chartPeriodLabel');
  if (!canvas || !noDataNotice) return;

  if (periodLabel) {
    periodLabel.textContent = `Activity for ${routerTimeRange.toUpperCase()} (${routerChartUnit === 'tokens' ? 'Tokens' : 'USD Cost'})`;
  }

  const timeline = overview?.timeline || [];
  const hasData = timeline.some(p => p.tokens > 0 || p.cost > 0 || p.requests > 0);

  if (!hasData) {
    canvas.style.display = 'none';
    noDataNotice.style.display = 'block';
    return;
  }

  canvas.style.display = 'block';
  noDataNotice.style.display = 'none';

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);

  // Determine Max Value for Y Axis
  const isCost = routerChartUnit === 'cost';
  const values = timeline.map(p => isCost ? (p.cost || 0) : (p.tokens || 0));
  const maxVal = Math.max(...values, isCost ? 0.001 : 100);

  // Draw Horizontal Gridlines
  const gridSteps = 3;
  ctx.strokeStyle = '#1e2536';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (maxVal / gridSteps) * (gridSteps - i);
    const y = padding.top + (chartH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    const label = isCost ? `$${yVal.toFixed(4)}` : (yVal >= 1000 ? `${(yVal/1000).toFixed(1)}k` : `${Math.round(yVal)}`);
    ctx.fillText(label, padding.left - 8, y + 4);
  }

  // Draw Time Axis Labels
  const stepX = chartW / Math.max(1, timeline.length - 1);
  ctx.textAlign = 'center';
  timeline.forEach((p, i) => {
    if (timeline.length > 8 && i % Math.ceil(timeline.length / 6) !== 0 && i !== timeline.length - 1) return;
    const x = padding.left + i * stepX;
    ctx.fillText(p.label || '', x, h - 10);
  });

  // Draw Smooth Gradient Area & Line
  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  if (isCost) {
    gradient.addColorStop(0, 'rgba(234, 179, 8, 0.35)');
    gradient.addColorStop(1, 'rgba(234, 179, 8, 0.0)');
    ctx.strokeStyle = '#eab308';
  } else {
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.strokeStyle = '#38bdf8';
  }

  ctx.beginPath();
  timeline.forEach((p, i) => {
    const val = isCost ? (p.cost || 0) : (p.tokens || 0);
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // Area fill
  ctx.lineTo(padding.left + (timeline.length - 1) * stepX, padding.top + chartH);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line stroke
  ctx.beginPath();
  ctx.lineWidth = 2;
  timeline.forEach((p, i) => {
    const val = isCost ? (p.cost || 0) : (p.tokens || 0);
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Glowing Nodes
  timeline.forEach((p, i) => {
    const val = isCost ? (p.cost || 0) : (p.tokens || 0);
    if (val === 0) return;
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = isCost ? '#eab308' : '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#090c12';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function toggleBreakdownUnit(unit, btn) {
  routerBreakdownUnit = unit;
  const btnCost = document.getElementById('btnBreakdownCost');
  const btnTokens = document.getElementById('btnBreakdownTokens');
  if (btnCost && btnTokens) {
    btnCost.classList.toggle('active', unit === 'costs');
    btnTokens.classList.toggle('active', unit === 'tokens');
  }
  renderBreakdownTable();
}

function renderBreakdownTable() {
  const tbody = document.getElementById('breakdownTableBody');
  const thead = document.getElementById('breakdownTableHeader');
  const typeSelect = document.getElementById('breakdownTypeSelect');
  if (!tbody || !thead) return;

  const type = typeSelect?.value || 'model';
  const isCost = routerBreakdownUnit === 'costs';
  const breakdown = routerOverviewData?.breakdown || {};
  const items = (type === 'model' ? breakdown.byModel : breakdown.byProvider) || [];

  // Update Header Labels
  if (type === 'model') {
    thead.innerHTML = `
      <th>MODEL ↑</th>
      <th>PROVIDER ↕</th>
      <th>REQUESTS ↕</th>
      <th>LAST USED ↕</th>
      <th>${isCost ? 'INPUT COST' : 'INPUT TOKENS'} ↕</th>
      <th>${isCost ? 'CACHED COST' : 'CACHED TOKENS'} ↕</th>
      <th>${isCost ? 'OUTPUT COST' : 'OUTPUT TOKENS'} ↕</th>
      <th>${isCost ? 'TOTAL COST' : 'TOTAL TOKENS'} ↕</th>
    `;
  } else {
    thead.innerHTML = `
      <th>PROVIDER ↑</th>
      <th>MODELS ↕</th>
      <th>REQUESTS ↕</th>
      <th>LAST USED ↕</th>
      <th>${isCost ? 'INPUT COST' : 'INPUT TOKENS'} ↕</th>
      <th>${isCost ? 'CACHED COST' : 'CACHED TOKENS'} ↕</th>
      <th>${isCost ? 'OUTPUT COST' : 'OUTPUT TOKENS'} ↕</th>
      <th>${isCost ? 'TOTAL COST' : 'TOTAL TOKENS'} ↕</th>
    `;
  }

  if (!items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #64748b; padding: 30px;">
          No usage recorded for this period.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const lastUsedStr = item.lastUsed ? formatTimeAgo(item.lastUsed) : '-';
    const inVal = isCost ? `$${(item.inputCost || 0).toFixed(4)}` : (item.inputTokens || 0).toLocaleString();
    const cachedVal = isCost ? `$${(item.cachedCost || 0).toFixed(4)}` : (item.cachedTokens || 0).toLocaleString();
    const outVal = isCost ? `$${(item.outputCost || 0).toFixed(4)}` : (item.outputTokens || 0).toLocaleString();
    const totalVal = isCost ? `$${(item.totalCost || 0).toFixed(4)}` : (item.totalTokens || 0).toLocaleString();

    return `
      <tr>
        <td style="font-weight: 600; color: #f1f5f9;">
          <code style="background: #060911; padding: 2px 7px; border-radius: 5px; color: #38bdf8; font-size: 12px;">${item.name || '-'}</code>
        </td>
        <td style="color: #94a3b8; font-size: 12px;">${item.secondary || '-'}</td>
        <td style="font-family: monospace; color: #e2e8f0; font-size: 12.5px;">${(item.requests || 0).toLocaleString()}</td>
        <td style="color: #94a3b8; font-size: 12px;">${lastUsedStr}</td>
        <td style="font-family: monospace; color: #fb923c; font-size: 12.5px;">${inVal}</td>
        <td style="font-family: monospace; color: #38bdf8; font-size: 12.5px;">${cachedVal}</td>
        <td style="font-family: monospace; color: #4ade80; font-size: 12.5px;">${outVal}</td>
        <td style="font-family: monospace; font-weight: 700; color: ${isCost ? '#facc15' : '#ffffff'}; font-size: 13px;">${totalVal}</td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// INTERACTIVE TOPOLOGY MESH VISUALIZER (HTML5 Canvas)
// ========================================================

function initTopologyVisualizer() {
  if (isTopologyInitialized) return;
  const canvas = document.getElementById('topologyCanvas');
  const container = document.getElementById('topologyContainer');
  if (!canvas || !container) return;

  canvas.addEventListener('mousedown', (e) => {
    isDraggingTopology = true;
    dragStart = { x: e.clientX - topologyPan.x, y: e.clientY - topologyPan.y };
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingTopology) return;
    topologyPan.x = e.clientX - dragStart.x;
    topologyPan.y = e.clientY - dragStart.y;
    renderTopologyGraph();
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingTopology) {
      isDraggingTopology = false;
      canvas.style.cursor = 'grab';
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    topologyZoom = Math.min(2.5, Math.max(0.4, topologyZoom * zoomFactor));
    renderTopologyGraph();
  }, { passive: false });

  isTopologyInitialized = true;
  startTopologyAnimation();
}

function startTopologyAnimation() {
  if (topologyAnimFrame) cancelAnimationFrame(topologyAnimFrame);
  function loop() {
    topologyPulseOffset = (topologyPulseOffset + 0.008) % 1;
    renderTopologyGraph();
    topologyAnimFrame = requestAnimationFrame(loop);
  }
  loop();
}

function zoomTopology(delta) {
  topologyZoom = Math.min(2.5, Math.max(0.4, topologyZoom + delta));
  renderTopologyGraph();
}

function resetTopology() {
  topologyZoom = 1;
  topologyPan = { x: 0, y: 0 };
  renderTopologyGraph();
}

function toggleTopologyFullscreen() {
  const container = document.getElementById('topologyContainer');
  if (!container) return;
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function drawSafeRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, width, height, r);
      return;
    } catch(e) {}
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function renderTopologyGraph() {
  const canvas = document.getElementById('topologyCanvas');
  if (!canvas) return;
  initTopologyVisualizer();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  try {
    ctx.clearRect(0, 0, w, h);

    // 1. Background subtle mesh grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    const gridSize = Math.max(16, 24 * topologyZoom);
    const offsetX = ((topologyPan.x % gridSize) + gridSize) % gridSize;
    const offsetY = ((topologyPan.y % gridSize) + gridSize) % gridSize;

    for (let x = offsetX; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = offsetY; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Center coordinates with pan & zoom
    const cx = w / 2 + topologyPan.x;
    const cy = h / 2 + topologyPan.y;

    // 2. Resolve Active Endpoints from all available sources
    let activeProviders = [];
    if (Array.isArray(endpoints) && endpoints.length > 0) {
      activeProviders = endpoints;
    } else if (Array.isArray(routerOverviewData?.topology?.endpoints) && routerOverviewData.topology.endpoints.length > 0) {
      activeProviders = routerOverviewData.topology.endpoints;
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem('bre_full_config') || '{}');
        if (Array.isArray(saved.endpoints) && saved.endpoints.length > 0) {
          activeProviders = saved.endpoints;
        }
      } catch(e) {}
    }

    if (!activeProviders || !activeProviders.length) {
      activeProviders = [
        { name: 'Inception Labs', models: ['mercury-2'], status: true },
        { name: 'OpenAI Upstream', models: ['gpt-4o'], status: true },
        { name: 'Groq Cloud', models: ['llama-3.3-70b'], status: true }
      ];
    }

    const count = activeProviders.length;
    const radius = Math.min(w, h) * 0.35 * topologyZoom;

    // Calculate Satellite Provider Node Positions
    const providerNodes = activeProviders.map((prov, i) => {
      let angle;
      if (count === 1) {
        angle = 0; // place directly to the right
      } else if (count === 2) {
        angle = i === 0 ? -Math.PI / 2 : Math.PI / 2; // top & bottom
      } else {
        angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      }
      return {
        name: prov.name || `Provider #${i + 1}`,
        models: (Array.isArray(prov.models) && prov.models.length) ? prov.models : ['default'],
        status: prov.status !== false,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle: angle
      };
    });

    // 3. Draw Curved Connecting Links & Animated Flow Pulses
    providerNodes.forEach((node, i) => {
      const isActive = node.status;
      const strokeColor = isActive ? 'rgba(56, 189, 248, 0.4)' : 'rgba(100, 116, 139, 0.25)';

      const midX = (cx + node.x) / 2;
      const midY = (cy + node.y) / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(midX, midY, node.x, node.y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(1, 2 * topologyZoom);
      ctx.stroke();

      // Animated Glowing Packets / Pulses
      if (isActive) {
        const pulseT = (topologyPulseOffset + (i / count)) % 1;
        const px = (1 - pulseT) * (1 - pulseT) * cx + 2 * (1 - pulseT) * pulseT * midX + pulseT * pulseT * node.x;
        const py = (1 - pulseT) * (1 - pulseT) * cy + 2 * (1 - pulseT) * pulseT * midY + pulseT * pulseT * node.y;

        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, 4.5 * topologyZoom), 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 4. Draw Center Hub Node (Router Core)
    const centerRadius = Math.max(20, 32 * topologyZoom);

    // Pulsing Outer Ripple
    const ringScale = 1 + (topologyPulseOffset * 0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius * ringScale, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 * (1 - topologyPulseOffset)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center Solid Core Circle
    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
    const coreGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, centerRadius);
    coreGrad.addColorStop(0, '#0284c7');
    coreGrad.addColorStop(1, '#091e3a');
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.5, 3 * topologyZoom);
    ctx.stroke();

    // Center Core Label
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, 13 * topologyZoom)}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Bre Router', cx, cy + Math.max(3, 4.5 * topologyZoom));

    // 5. Draw Satellite Provider Nodes
    providerNodes.forEach(node => {
      const nodeW = Math.max(80, 130 * topologyZoom);
      const nodeH = Math.max(32, 48 * topologyZoom);
      const nx = node.x - nodeW / 2;
      const ny = node.y - nodeH / 2;
      const r = Math.max(4, 8 * topologyZoom);

      // Node Card Box
      drawSafeRoundRect(ctx, nx, ny, nodeW, nodeH, r);
      ctx.fillStyle = node.status ? '#0f172a' : '#090d16';
      ctx.fill();
      ctx.strokeStyle = node.status ? '#38bdf8' : '#334155';
      ctx.lineWidth = Math.max(1, 1.5 * topologyZoom);
      ctx.stroke();

      // Status Indicator Dot
      const dotX = nx + Math.max(8, 14 * topologyZoom);
      const dotY = ny + Math.max(10, 16 * topologyZoom);
      const dotR = Math.max(2.5, 4 * topologyZoom);

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = node.status ? '#22c55e' : '#ef4444';
      ctx.shadowColor = node.status ? '#22c55e' : '#ef4444';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Provider Name Text
      ctx.fillStyle = '#f1f5f9';
      ctx.font = `600 ${Math.max(9, 12 * topologyZoom)}px 'Inter', sans-serif`;
      ctx.textAlign = 'left';
      const nameToDraw = node.name.length > 13 ? node.name.slice(0, 12) + '..' : node.name;
      ctx.fillText(nameToDraw, nx + Math.max(16, 24 * topologyZoom), ny + Math.max(12, 19 * topologyZoom));

      // Primary Model Badge Text
      ctx.fillStyle = '#38bdf8';
      ctx.font = `500 ${Math.max(8, 10 * topologyZoom)}px 'JetBrains Mono', monospace`;
      const primaryModel = node.models[0] || 'default';
      const modelToDraw = primaryModel.length > 16 ? primaryModel.slice(0, 15) + '..' : primaryModel;
      ctx.fillText(modelToDraw, nx + Math.max(8, 12 * topologyZoom), ny + Math.max(22, 36 * topologyZoom));
    });

  } catch (err) {
    console.error('Error rendering topology canvas:', err);
  }
}

// ========================================================
// 9ROUTER REQUEST DETAILS & LOG INSPECTOR (Image 3)
// ========================================================

async function load9RouterDetails() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_router_details' })
    });
    if (!r.ok) return;
    const data = await r.json();
    routerDetailsData = Array.isArray(data.requests) ? data.requests : [];
    allLogs = routerDetailsData;

    // Populate Provider Dropdown Options
    populateDetailProviderDropdown();

    // Render Filtered Table
    filterAndRenderDetailsTable();
  } catch (e) {
    console.error('load9RouterDetails error:', e);
  }
}

function populateDetailProviderDropdown() {
  const sel = document.getElementById('detailProviderSelect');
  if (!sel) return;
  const currentVal = sel.value;

  const providers = new Set();
  routerDetailsData.forEach(req => {
    if (req.provider) providers.add(req.provider);
  });
  if (endpoints && endpoints.length) {
    endpoints.forEach(ep => { if (ep.name) providers.add(ep.name); });
  }

  sel.innerHTML = '<option value="all">All Providers</option>' +
    Array.from(providers).map(p => `<option value="${escapeHtml(p)}" ${p === currentVal ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
}

function setDetailDatePreset(preset) {
  const startInp = document.getElementById('detailStartDate');
  const endInp = document.getElementById('detailEndDate');
  if (!startInp || !endInp) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const toDateInputStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    startInp.value = toDateInputStr(now);
    endInp.value = toDateInputStr(now);
  } else if (preset === '24h') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    startInp.value = toDateInputStr(yesterday);
    endInp.value = toDateInputStr(now);
  } else if (preset === '7d') {
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startInp.value = toDateInputStr(d7);
    endInp.value = toDateInputStr(now);
  } else if (preset === '30d') {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startInp.value = toDateInputStr(d30);
    endInp.value = toDateInputStr(now);
  }
  detailCurrentPage = 1;
  filterAndRenderDetailsTable();
}

function clearDetailFilters() {
  const provSel = document.getElementById('detailProviderSelect');
  if (provSel) provSel.value = 'all';
  const startInp = document.getElementById('detailStartDate');
  if (startInp) startInp.value = '';
  const endInp = document.getElementById('detailEndDate');
  if (endInp) endInp.value = '';
  const searchInp = document.getElementById('detailSearchInput');
  if (searchInp) searchInp.value = '';
  detailCurrentPage = 1;
  filterAndRenderDetailsTable();
}

function filterAndRenderDetailsTable() {
  const tbody = document.getElementById('detailsTableBody');
  const pageInfo = document.getElementById('detailPaginationInfo');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  if (!tbody) return;

  const provFilter = document.getElementById('detailProviderSelect')?.value || 'all';
  const startFilter = document.getElementById('detailStartDate')?.value;
  const endFilter = document.getElementById('detailEndDate')?.value;
  const query = (document.getElementById('detailSearchInput')?.value || '').toLowerCase().trim();

  let filtered = routerDetailsData;

  if (provFilter !== 'all') {
    filtered = filtered.filter(r => (r.provider || '').toLowerCase() === provFilter.toLowerCase());
  }

  if (startFilter) {
    let startD = new Date(startFilter);
    if (startFilter.length === 10) startD.setHours(0, 0, 0, 0);
    const startTime = startD.getTime();
    if (!isNaN(startTime)) filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= startTime);
  }

  if (endFilter) {
    let endD = new Date(endFilter);
    if (endFilter.length === 10) endD.setHours(23, 59, 59, 999);
    const endTime = endD.getTime();
    if (!isNaN(endTime)) filtered = filtered.filter(r => new Date(r.timestamp).getTime() <= endTime);
  }

  if (query) {
    filtered = filtered.filter(r => {
      return (r.ip && r.ip.toLowerCase().includes(query)) ||
             (r.provider && r.provider.toLowerCase().includes(query)) ||
             (r.model && r.model.toLowerCase().includes(query)) ||
             (r.requestSummary && r.requestSummary.toLowerCase().includes(query)) ||
             (r.responseSummary && r.responseSummary.toLowerCase().includes(query)) ||
             (r.error && r.error.toLowerCase().includes(query)) ||
             String(r.status).includes(query);
    });
  }

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / detailPageSize));
  if (detailCurrentPage > totalPages) detailCurrentPage = totalPages;
  if (detailCurrentPage < 1) detailCurrentPage = 1;

  const startIdx = (detailCurrentPage - 1) * detailPageSize;
  const pageItems = filtered.slice(startIdx, startIdx + detailPageSize);

  if (pageInfo) {
    pageInfo.textContent = `Showing ${pageItems.length ? startIdx + 1 : 0}-${startIdx + pageItems.length} of ${totalFiltered} requests`;
  }
  if (btnPrev) btnPrev.disabled = detailCurrentPage <= 1;
  if (btnNext) btnNext.disabled = detailCurrentPage >= totalPages;

  if (!pageItems.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: #64748b; padding: 35px;">
          Tidak ada request yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageItems.map(req => {
    const d = new Date(req.timestamp);
    const dateStr = d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' }) + ', ' +
                    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const isOk = req.status >= 200 && req.status < 400;
    const statusClass = isOk ? 'ok' : 'fail';
    const cachedBadge = req.cached ? '<span class="ping-badge ok" style="font-size: 11px;">⚡ RAM</span>' : '<span style="color:#64748b;">-</span>';
    const ttftStr = req.ttftMs ? ` (TTFT: ${req.ttftMs}ms)` : '';

    return `
      <tr>
        <td style="font-size: 12px; color: #94a3b8; font-family: monospace; white-space: nowrap;">${dateStr}</td>
        <td><code style="background: #060911; padding: 2px 7px; border-radius: 4px; color: #38bdf8; font-size: 12px;">${req.model || '-'}</code></td>
        <td style="font-weight: 600; color: #f1f5f9;">${req.provider || '-'}</td>
        <td style="font-family: monospace; color: #fb923c; font-size: 12.5px;">${(req.inputTokens || 0).toLocaleString()}</td>
        <td>${cachedBadge}</td>
        <td style="color: #64748b; font-size: 12px;">-</td>
        <td style="font-family: monospace; color: #4ade80; font-size: 12.5px;">${(req.outputTokens || req.tokens || 0).toLocaleString()}</td>
        <td style="font-family: monospace; font-size: 12.5px; color: #38bdf8;">${req.latencyMs || 0}ms<span style="font-size: 10px; color: #64748b;">${ttftStr}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-outline" style="padding: 3px 10px; font-size: 12px; border-color: #1e293b;" onclick="openRequestDetail('${req.id}')">
            Detail
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function changeDetailPage(delta) {
  detailCurrentPage += delta;
  filterAndRenderDetailsTable();
}

function openRequestDetail(id) {
  const req = (routerDetailsData || []).find(r => r.id === id) ||
              (routerOverviewData?.recentRequests || []).find(r => r.id === id) ||
              (allLogs || []).find(r => r.id === id);

  if (!req) return toast('Data request tidak ditemukan', 'err');

  const modal = document.getElementById('requestDetailModal');
  if (!modal) return;

  const statusBadge = document.getElementById('modalReqStatusBadge');
  if (statusBadge) {
    const isOk = req.status >= 200 && req.status < 400;
    statusBadge.className = isOk ? 'ping-badge ok' : 'ping-badge fail';
    statusBadge.textContent = `${req.status || 200} ${isOk ? 'OK' : 'Error'}`;
  }

  const tsEl = document.getElementById('modalReqTimestamp');
  if (tsEl) tsEl.textContent = `Timestamp: ${new Date(req.timestamp).toLocaleString()} (ID: ${req.id})`;

  const provModelEl = document.getElementById('modalReqProvModel');
  if (provModelEl) provModelEl.textContent = `${req.provider || 'Proxy'} · ${req.model || 'model'}`;

  const latEl = document.getElementById('modalReqLatency');
  if (latEl) latEl.textContent = `Total: ${req.latencyMs || 0}ms ${req.ttftMs ? `| TTFT: ${req.ttftMs}ms` : ''}`;

  const tokEl = document.getElementById('modalReqTokens');
  if (tokEl) tokEl.textContent = `In: ${req.inputTokens || 0} | Cached: ${req.cachedTokens || (req.cached ? req.inputTokens : 0)} | Out: ${req.outputTokens || req.tokens || 0}`;

  const costIpEl = document.getElementById('modalReqCostIp');
  if (costIpEl) costIpEl.textContent = `~$${(req.cost || 0).toFixed(5)} | IP: ${req.ip || '127.0.0.1'}`;

  const promptEl = document.getElementById('modalReqPrompt');
  if (promptEl) promptEl.textContent = req.requestSummary || '(Prompt tidak tersedia atau kosong)';

  const resEl = document.getElementById('modalReqResponse');
  if (resEl) resEl.textContent = req.responseSummary || req.error || '(Tidak ada response payload preview)';

  modal.style.display = 'flex';
}

function closeRequestModal() {
  const modal = document.getElementById('requestDetailModal');
  if (modal) modal.style.display = 'none';
}

// Backward Compatibility Aliases for metrics & logs
async function loadMetrics() { return load9RouterData(); }
async function loadLogs() { return load9RouterDetails(); }
function filterLogs() { return filterAndRenderDetailsTable(); }
async function clearAdminLogs() {
  if (!confirm('Hapus seluruh riwayat log permintaan sekarang?')) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'clear_logs' })
    });
    if (r.ok) {
      routerDetailsData = [];
      allLogs = [];
      filterAndRenderDetailsTable();
      load9RouterData();
      toast('Semua log berhasil dibersihkan', 'ok');
    }
  } catch (e) {
    toast('Gagal membersihkan log: ' + e.message, 'err');
  }
}

// ========================================================
// AI TOOLS & PROMPT STUDIO CONTROLLER
// ========================================================
const STUDIO_TOOLS = {
  search: {
    title: '🔍 Web Search & Riset Internet Live',
    cmd: '/search [kueri]',
    desc: 'Mencari informasi terkini dari internet dan merangkumnya secara akurat dengan sumber data valid.',
    label: 'Topik / Kueri Pencarian Web',
    placeholder: 'Masukkan kueri pencarian (contoh: perkembangan AI terkini 2026)...',
    buildPrompt: (input) => `[PENCARIAN WEB LIVE: "${input}"]\n\nSebagai Bre AI, carilah informasi akurat dan rangkum topik "${input}" secara komprehensif lengkap dengan poin penting dan sumber/referensi.`
  },
  code: {
    title: '💻 Code Assistant & Bug Fixer',
    cmd: '/code [deskripsi]',
    desc: 'Menghasilkan kode pemrograman berkualitas tinggi, bersih, optimal, dan terstruktur siap pakai.',
    label: 'Deskripsi Program / Bug yang Ingin Diperbaiki',
    placeholder: 'Contoh: Buatkan script scraper website dengan Python BeautifulSoup dan simpan ke CSV...',
    buildPrompt: (input) => `Bertindaklah sebagai Principal Software Engineer. Buatkan kode pemrograman berkualitas tinggi, bersih, optimal, dan aman untuk: "${input}". Berikan penjelasan ringkas dan letakkan seluruh kode lengkap di dalam blok kode dengan nama file di baris pertama.`
  },
  summary: {
    title: '📝 Smart Document Summarizer',
    cmd: '/summary [teks]',
    desc: 'Merangkum artikel atau teks panjang menjadi ringkasan eksekutif, Key Takeaways, dan Action Items.',
    label: 'Teks / Dokumen yang Ingin Dirangkum',
    placeholder: 'Tempelkan artikel, laporan, atau teks panjang yang ingin dirangkum di sini...',
    buildPrompt: (input) => `Tolong buatkan ringkasan eksekutif, poin-poin penting (Key Takeaways), dan Action Items yang terstruktur dan mudah dipahami dari teks berikut:\n\n${input}`
  },
  prd: {
    title: '📋 Product Requirement Document (PRD) Builder',
    cmd: '/prd [nama fitur]',
    desc: 'Menyusun dokumen PRD lengkap standar industri dengan User Stories dan Acceptance Criteria.',
    label: 'Nama Fitur / Konsep Produk',
    placeholder: 'Contoh: Fitur Multi-Tenant Booking & Pembayaran Otomatis QRIS...',
    buildPrompt: (input) => `Bertindaklah sebagai Senior Product Manager (PRD Specialist). Susun dokumen PRD (Product Requirement Document) lengkap dan terstruktur rapi untuk: "${input}". Format: 1. Overview, 2. Problem Statement & Goals, 3. User Stories, 4. Functional Specs, 5. Acceptance Criteria, 6. Edge Cases, 7. Success Metrics (KPIs).`
  },
  copy: {
    title: '✍️ Viral Copywriting & Marketing Content',
    cmd: '/copy [topik]',
    desc: 'Meracik formula copywriting persuasif berkonversi tinggi (Headline, Hook, Benefit, CTA).',
    label: 'Produk / Topik Promosi Iklan',
    placeholder: 'Contoh: Layanan Konsultasi Bisnis Digital Marketing UMKM...',
    buildPrompt: (input) => `Bertindaklah sebagai Master Copywriter kelas dunia (AIDA & PAS framework). Buatkan materi copywriting persuasif dan berkonversi tinggi untuk topik/produk: "${input}". Berikan: 1. 3 Pilihan Hook/Headline menarik, 2. Emotional & Functional Benefits, 3. Value Proposition, 4. Call to Action (CTA) persuasif.`
  },
  think: {
    title: '🧠 Deep Analytical Reasoning (Chain of Thought)',
    cmd: '/think [masalah]',
    desc: 'Memecahkan masalah analitis kompleks dengan penalaran sistematis langkah demi langkah.',
    label: 'Pertanyaan / Masalah Analitis',
    placeholder: 'Contoh: Analisis perbandingan arsitektur Monolith vs Microservices untuk startup skala awal...',
    buildPrompt: (input) => `Analisis dan pecahkan pertanyaan/masalah berikut dengan penalaran sistematis langkah demi langkah (Deep Analytical Reasoning / Chain of Thought):\n\n"${input}"\n\nSajikan analisis komparatif, trade-offs, mitigasi risiko, dan rekomendasi konkrit.`
  },
  translate: {
    title: '🌐 Smart Polyglot Translator',
    cmd: '/translate [bahasa] [teks]',
    desc: 'Menerjemahkan teks secara natural, profesional, dan memperbaiki tata bahasa.',
    label: 'Bahasa Target & Teks Sumber',
    placeholder: 'english Selamat pagi rekan-rekan, mari kita review progress sprint minggu ini.',
    buildPrompt: (input) => {
      const parts = input.trim().split(/\s+/);
      const target = parts[0] || 'English';
      const text = parts.slice(1).join(' ') || input;
      return `Terjemahkan teks berikut ke dalam bahasa ${target} dengan nada profesional, natural, dan akurat secara tata bahasa:\n\n"${text}"\n\nSertakan juga opsi alternatif santai jika ada.`;
    }
  }
};

let currentStudioToolKey = 'search';

function selectStudioTool(toolKey, btn) {
  currentStudioToolKey = toolKey;
  const tool = STUDIO_TOOLS[toolKey];
  if (!tool) return;

  document.querySelectorAll('#tabTools .guide-app-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const titleEl = document.getElementById('studioToolTitle');
  if (titleEl) titleEl.textContent = tool.title;
  const badgeEl = document.getElementById('studioTelegramCommandBadge');
  if (badgeEl) badgeEl.textContent = `Perintah Bot: ${tool.cmd}`;
  const descEl = document.getElementById('studioToolDesc');
  if (descEl) descEl.textContent = tool.desc;
  const labelEl = document.getElementById('studioInputLabel');
  if (labelEl) labelEl.textContent = tool.label;
  const inputEl = document.getElementById('studioInputText');
  if (inputEl) {
    inputEl.placeholder = tool.placeholder;
    inputEl.value = '';
  }

  const resContainer = document.getElementById('studioResultContainer');
  if (resContainer) resContainer.style.display = 'none';
}

async function executeStudioTool() {
  const tool = STUDIO_TOOLS[currentStudioToolKey];
  const inputEl = document.getElementById('studioInputText');
  const input = (inputEl?.value || '').trim();
  const resContainer = document.getElementById('studioResultContainer');
  const resContent = document.getElementById('studioResultContent');
  const latencyEl = document.getElementById('studioExecutionLatency');
  const btn = document.getElementById('btnExecuteStudioTool');

  if (!input) {
    return toast('Silakan masukkan input teks untuk menjalankan alat ini.', 'err');
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Menjalankan...';
  }

  if (resContainer) {
    resContainer.style.display = 'block';
    if (resContent) resContent.innerHTML = '<span style="color: #94a3b8;">Sedang menghubungi engine AI Bre AI...</span>';
  }

  const startTime = Date.now();
  try {
    const promptToSend = tool.buildPrompt(input);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: promptToSend }],
        stream: false
      })
    });

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    if (res.ok) {
      if (latencyEl) latencyEl.textContent = `Latensi: ${elapsed} ms`;
      const reply = data.choices?.[0]?.message?.content || JSON.stringify(data);
      if (resContent) resContent.textContent = reply;
      toast('Alat AI berhasil dieksekusi!', 'ok');
    } else {
      if (latencyEl) latencyEl.textContent = `Error (${elapsed} ms)`;
      if (resContent) resContent.innerHTML = `<span style="color: #ef4444;">${data.error || 'Gagal mengeksekusi alat'}</span>`;
      toast(data.error || 'Eksekusi gagal', 'err');
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    if (latencyEl) latencyEl.textContent = `Error (${elapsed} ms)`;
    if (resContent) resContent.innerHTML = `<span style="color: #ef4444;">${err.message}</span>`;
    toast('Error: ' + err.message, 'err');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Jalankan Alat AI Ini';
    }
  }
}

// ========================================================
// MULTI-PROVIDER REAL-TIME HEALTH BENCHMARK
// ========================================================
async function runMultiProviderBenchmark() {
  syncProvidersFromUI();
  const tbody = document.getElementById('healthBenchmarkTableBody');
  const btn = document.getElementById('btnBenchmarkAll');

  if (!endpoints.length) {
    return toast('Belum ada provider yang terdaftar di konfigurasi.', 'err');
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Menguji Semua Provider...';
  }

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #38bdf8; padding: 25px;">
          ⏳ Sedang mengirim permintaan uji latensi paralel ke ${endpoints.length} provider...
        </td>
      </tr>
    `;
  }

  try {
    const results = await Promise.all(
      endpoints.map(async (ep, idx) => {
        const primaryModel = ep.models?.[0] || 'default';
        const start = Date.now();
        try {
          const r = await fetch('/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customEndpoint: ep.url,
              customKeys: (ep.keys || []).join('\n'),
              customModel: primaryModel,
              prompt: 'Ping'
            })
          });
          const elapsed = Date.now() - start;
          const data = await r.json();
          return {
            idx: idx + 1,
            name: ep.name || `Provider #${idx + 1}`,
            url: ep.url || '-',
            model: primaryModel,
            ok: r.ok && !data.error,
            status: r.status,
            latency: data.latencyMs || elapsed,
            error: data.error || (r.ok ? null : 'HTTP ' + r.status),
            active: ep.status !== false
          };
        } catch (e) {
          const elapsed = Date.now() - start;
          return {
            idx: idx + 1,
            name: ep.name || `Provider #${idx + 1}`,
            url: ep.url || '-',
            model: primaryModel,
            ok: false,
            status: 0,
            latency: elapsed,
            error: e.message,
            active: ep.status !== false
          };
        }
      })
    );

    if (tbody) {
      tbody.innerHTML = results.map(r => {
        const badge = r.active
          ? (r.ok ? `<span class="ping-badge ok">🟢 200 OK</span>` : `<span class="ping-badge fail">🔴 ${r.error ? r.error.slice(0, 30) : 'Error'}</span>`)
          : `<span class="ping-badge" style="background:#1e293b; color:#94a3b8;">⚪ Nonaktif</span>`;

        const failoverStatus = r.ok
          ? `<span style="color:#10b981; font-size:12px;">✅ Siap Melayani</span>`
          : `<span style="color:#ef4444; font-size:12px;">⚠️ Auto-Skipped</span>`;

        return `
          <tr>
            <td>${r.idx}</td>
            <td style="font-weight: 600; color: #f1f5f9;">${r.name}</td>
            <td style="font-family: monospace; font-size: 11.5px; color: #94a3b8;">${r.url}</td>
            <td><code style="background: #060911; padding: 2px 6px; border-radius: 4px; font-size: 11.5px; color: #38bdf8;">${r.model}</code></td>
            <td>${badge}</td>
            <td style="font-weight: 600; color: ${r.ok ? '#38bdf8' : '#ef4444'};">${r.latency} ms</td>
            <td>${failoverStatus}</td>
          </tr>
        `;
      }).join('');
    }

    toast(`Benchmark selesai! ${results.filter(r => r.ok).length}/${results.length} provider sehat.`, 'ok');
  } catch (err) {
    toast('Gagal menjalankan benchmark: ' + err.message, 'err');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '⚡ Uji Semua Provider Bersamaan';
    }
  }
}

function applyPromptPreset(type) {
  const p = PROMPT_PRESETS[type];
  if (p) {
    document.getElementById('cfgPrompt').value = p;
    toast('Prompt preset diterapkan', 'ok');
  }
}

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = 'sk-bre-';
  for (let i = 0; i < 32; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  const ckEl = document.getElementById('cfgClientKey');
  if (ckEl) ckEl.value = rand;
  toast('Master API Key baru di-generate!', 'ok');
}

function updateTestModelDropdown() {
  syncProvidersFromUI();
  const sel = document.getElementById('testModelSelect');
  if (!sel) return;
  
  const allModels = new Set();
  endpoints.forEach(ep => {
    (ep.models || []).forEach(m => allModels.add(m));
    (ep.mapping || []).forEach(map => {
      const alias = map.split(':')[0]?.trim();
      if (alias) allModels.add(alias);
    });
  });
  
  if (!allModels.size) allModels.add('mercury-2');
  sel.innerHTML = Array.from(allModels).map(m => `<option value="${m}">${m}</option>`).join('');
}

async function runLiveTest() {
  const sel = document.getElementById('testModelSelect');
  const model = sel ? sel.value : 'mercury-2';
  const prompt = document.getElementById('testPromptInput').value.trim() || 'Hi';
  const out = document.getElementById('testOutputArea');
  const btn = document.getElementById('btnRunTest');
  
  btn.disabled = true;
  out.textContent = '⏳ Mengirim permintaan ke endpoint upstream...';
  
  const start = Date.now();
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
    
    const elapsed = Date.now() - start;
    if (r.ok) {
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
      out.textContent = `[HTTP 200 OK | Latency: ${elapsed}ms | Model: ${model}]\n\n${content}`;
      toast(`Query sukses (${elapsed}ms)`, 'ok');
    } else {
      const err = await r.text();
      out.textContent = `[HTTP ${r.status} Error | ${elapsed}ms]\n\n${err}`;
      toast(`Gagal (HTTP ${r.status})`, 'err');
    }
  } catch(e) {
    out.textContent = `[Network Error]\n\n${e.message}`;
    toast('Network Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

function clearLiveOutput() {
  document.getElementById('testOutputArea').textContent = 'Output dibersihkan.';
}

function setRoutingModeUI(mode) {
  const m = (mode || 'auto').toLowerCase();
  const hiddenInput = document.getElementById('cfgRoutingStrategy');
  if (hiddenInput) hiddenInput.value = m;

  const btnAuto = document.getElementById('btnRoutingAuto');
  const btnPriority = document.getElementById('btnRoutingPriority');
  const btnWeighted = document.getElementById('btnRoutingWeighted');
  const desc = document.getElementById('routingModeDescription');

  if (btnAuto) {
    btnAuto.style.background = m === 'auto' ? '#0284c7' : 'transparent';
    btnAuto.style.color = m === 'auto' ? '#ffffff' : '#94a3b8';
    btnAuto.style.borderColor = m === 'auto' ? '#38bdf8' : '#334155';
    btnAuto.style.fontWeight = m === 'auto' ? '600' : 'normal';
  }
  if (btnPriority) {
    btnPriority.style.background = m === 'priority' ? '#0284c7' : 'transparent';
    btnPriority.style.color = m === 'priority' ? '#ffffff' : '#94a3b8';
    btnPriority.style.borderColor = m === 'priority' ? '#38bdf8' : '#334155';
    btnPriority.style.fontWeight = m === 'priority' ? '600' : 'normal';
  }
  if (btnWeighted) {
    btnWeighted.style.background = m === 'weighted' ? '#0284c7' : 'transparent';
    btnWeighted.style.color = m === 'weighted' ? '#ffffff' : '#94a3b8';
    btnWeighted.style.borderColor = m === 'weighted' ? '#38bdf8' : '#334155';
    btnWeighted.style.fontWeight = m === 'weighted' ? '600' : 'normal';
  }

  if (desc) {
    if (m === 'auto') {
      desc.style.color = '#38bdf8';
      desc.style.background = 'rgba(56, 189, 248, 0.08)';
      desc.style.borderLeftColor = '#38bdf8';
      desc.innerHTML = '🔄 <b>Mode AUTO Aktif:</b> Setiap permintaan baru yang masuk akan dieksekusi secara <b>bergantian (bergilir/round-robin)</b> ke seluruh provider yang aktif ON untuk membagi beban secara merata dan mencegah limit API.';
    } else if (m === 'priority') {
      desc.style.color = '#fbbf24';
      desc.style.background = 'rgba(251, 191, 36, 0.08)';
      desc.style.borderLeftColor = '#fbbf24';
      desc.innerHTML = '🥇 <b>Mode Prioritas Tunggal Aktif:</b> Permintaan selalu diarahkan ke provider pertama yang aktif. Provider lainnya hanya digunakan sebagai cadangan jika provider utama error/down.';
    } else if (m === 'weighted') {
      desc.style.color = '#a78bfa';
      desc.style.background = 'rgba(167, 139, 250, 0.08)';
      desc.style.borderLeftColor = '#a78bfa';
      desc.innerHTML = '⚖️ <b>Mode Berdasarkan Bobot (Weight) Aktif:</b> Permintaan didistribusikan secara proporsional sesuai nilai bobot (Weight) masing-masing provider.';
    }
  }
}

async function saveAllConfig() {
  syncProvidersFromUI();
  
  const newPw = document.getElementById('cfgNewPw').value.trim();
  const routingMode = document.getElementById('cfgRoutingStrategy')?.value || 'auto';

  const payload = {
    endpoints: endpoints,
    routingStrategy: routingMode,
    providerRoutingMode: routingMode,
    autoFailover: document.getElementById('cfgAutoFailover') ? document.getElementById('cfgAutoFailover').checked : true,
    cacheEnabled: document.getElementById('cfgCacheEnabled') ? document.getElementById('cfgCacheEnabled').checked : false,
    cacheTTL: parseInt(document.getElementById('cfgCacheTTL')?.value) || 3600,
    blacklist: document.getElementById('cfgBlacklist')?.value.split('\n').map(w => w.trim()).filter(Boolean) || [],
    clientKeys: clientKeys,
    systemPrompt: document.getElementById('cfgPrompt').value,
    temperature: parseNum(document.getElementById('cfgTemp')?.value, 0.7),
    topP: parseNum(document.getElementById('cfgTopP')?.value, 1.0),
    frequencyPenalty: parseNum(document.getElementById('cfgFreqPenalty')?.value, 0.0),
    presencePenalty: parseNum(document.getElementById('cfgPresPenalty')?.value, 0.0),
    maxTokens: parseInt(document.getElementById('cfgMaxTokens')?.value) || 16384,
    defaultStyle: document.getElementById('cfgDefaultStyle') ? document.getElementById('cfgDefaultStyle').value : 'santai',
    clientApiKey: (document.getElementById('cfgClientKey')?.value || '').trim(),
    rateLimitMax: parseInt(document.getElementById('cfgRateMax')?.value) || 5,
    rateLimitWindow: parseInt(document.getElementById('cfgRateWin')?.value) || 30,
    telegramEnabled: document.getElementById('cfgTelegramEnabled') ? document.getElementById('cfgTelegramEnabled').checked : false,
    telegramBotToken: document.getElementById('cfgTelegramToken') ? document.getElementById('cfgTelegramToken').value.trim() : '',
    telegramOwnerId: document.getElementById('cfgTelegramOwner') ? document.getElementById('cfgTelegramOwner').value.trim() : '',
    telegramAccessMode: document.getElementById('cfgTelegramAccessMode') ? document.getElementById('cfgTelegramAccessMode').value : 'public',
    telegramAllowedUsers: document.getElementById('cfgTelegramWhitelist') ? document.getElementById('cfgTelegramWhitelist').value.trim() : '',
    telegramDomain: document.getElementById('cfgTelegramDomain') ? document.getElementById('cfgTelegramDomain').value.trim() : '',
    telegramStyle: document.getElementById('cfgTelegramStyle') ? document.getElementById('cfgTelegramStyle').value : 'santai',
    telegramLanguage: document.getElementById('cfgTelegramLanguage') ? document.getElementById('cfgTelegramLanguage').value : 'id',
    telegramUsers: telegramUsers,
    // Cloud Persistence Settings
    upstashRedisUrl: document.getElementById('cfgUpstashUrl') ? document.getElementById('cfgUpstashUrl').value.trim() : '',
    upstashRedisToken: document.getElementById('cfgUpstashToken') ? document.getElementById('cfgUpstashToken').value.trim() : '',
    githubToken: document.getElementById('cfgGithubToken') ? document.getElementById('cfgGithubToken').value.trim() : '',
    githubRepo: document.getElementById('cfgGithubRepo') ? document.getElementById('cfgGithubRepo').value.trim() : '',
    githubBranch: document.getElementById('cfgGithubBranch') ? document.getElementById('cfgGithubBranch').value.trim() : 'main'
  };
  
  const streamMode = document.getElementById('cfgStream').value;
  if (streamMode === 'true') payload.forceStream = true;
  else if (streamMode === 'false') payload.forceStream = false;
  else payload.forceStream = 'auto';
  
  if (newPw) payload.adminPassword = newPw;

  // Simpan seluruh konfigurasi ke browser localStorage sebagai jaminan permanen klien
  try {
    localStorage.setItem('bre_full_config', JSON.stringify(payload));
  } catch(e) {}
  
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify(payload)
    });
    
    if (r.ok) {
      let data = {};
      try { data = await r.json(); } catch(e){}
      if (newPw) {
        adminToken = newPw;
        try { sessionStorage.setItem('bre_admin_pw', newPw); } catch(e){}
      }
      document.getElementById('cfgNewPw').value = '';
      loadTelegramStatus();

      // Perbarui localStorage dengan data server yang telah dimerge
      try {
        localStorage.setItem('bre_full_config', JSON.stringify(payload));
      } catch(e) {}

      if (data.cloudStorageInfo) {
        updateStorageBadges(data.cloudStorageInfo, data.cloudStatus);
      }

      if (data.cloudStatus && data.cloudStatus.synced) {
        toast(`✅ Seluruh konfigurasi tersimpan PERMANEN! (${data.cloudStatus.message})`, 'ok');
      } else if (data.isReadOnlyFS) {
        toast('⚠️ Disimpan di cache serverless container. Hubungkan Vercel KV atau GitHub Sync di tab "Cloud Storage" agar tersimpan permanen.', 'ok');
      } else {
        toast('✅ Seluruh konfigurasi berhasil disimpan permanen ke config.json!', 'ok');
      }
    } else {
      toast('❌ Gagal menyimpan konfigurasi', 'err');
    }
  } catch(e) {
    toast('❌ Error: ' + e.message, 'err');
  }
}

async function exportConfigJSON() {
  syncProvidersFromUI();
  const r = await fetch('/api/config', { headers: { 'Authorization': 'Bearer ' + adminToken } });
  if (!r.ok) return toast('Gagal mengambil data', 'err');
  const d = await r.json();
  const blob = new Blob([JSON.stringify(d.config, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bre_ai_proxy_config.json';
  a.click();
  toast('Backup JSON berhasil didownload', 'ok');
}

function importConfigFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async evt => {
    try {
      let parsed = JSON.parse(evt.target.result);
      if (parsed.config && typeof parsed.config === 'object') {
        parsed = parsed.config;
      }
      if (!parsed.endpoints && !parsed.apiUrl) throw new Error('Format file config tidak valid');
      
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(parsed)
      });
      if (r.ok) {
        try {
          localStorage.setItem('bre_full_config', JSON.stringify(parsed));
        } catch(e) {}
        toast('✅ Konfigurasi berhasil dipulihkan dari file!', 'ok');
        await loadConfig();
      } else {
        const errData = await r.json().catch(() => ({}));
        toast('Gagal menyimpan file restore: ' + (errData.error || r.statusText), 'err');
      }
    } catch(err) {
      toast('Error file JSON: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
}

async function resetToFactoryDefault() {
  if (!confirm('Apakah Anda yakin ingin mereset seluruh konfigurasi ke pengaturan awal?')) return;
  const def = {
    endpoints: [{
      name: "Inception Labs",
      url: "https://api.inceptionlabs.ai/v1/chat/completions",
      keys: ["sk_5a39b7fd486bf03ef255b475595bd7c9"],
      models: ["mercury-2"]
    }],
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 16384,
    rateLimitMax: 5,
    rateLimitWindow: 30,
    autoFailover: true,
    cacheEnabled: false,
    cacheTTL: 3600,
    blacklist: [],
    clientKeys: []
  };
  
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
    body: JSON.stringify(def)
  });
  if (r.ok) {
    toast('Pengaturan berhasil direset ke Default', 'ok');
    loadConfig();
  }
}

function toast(msg, type='ok') {
  const container = document.getElementById('toastHub');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// Telegram Bot Controller Functions
function toggleTelegramTokenMask() {
  const inp = document.getElementById('cfgTelegramToken');
  const btn = document.getElementById('btnMaskTelegram');
  if (!inp || !btn) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🔒 Sembunyikan Token';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️ Tampilkan Token';
  }
}

function updateTelegramModelDropdown(selectedModel) {
  const sel = document.getElementById('cfgTelegramModel');
  if (!sel) return;
  const allModels = new Set();
  endpoints.forEach(ep => {
    if (ep.name) allModels.add(ep.name.trim());
  });
  if (!allModels.size) allModels.add('Default Provider');
  
  allModels.delete('auto');

  sel.innerHTML = '<option value="auto">🌐 Otomatis ikuti Router AI (Rotasi)</option>' +
    Array.from(allModels).map(m => `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`).join('');
}

async function loadTelegramStatus() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_telegram_status' })
    });
    if (!r.ok) return;
    const data = await r.json();
    const st = data.status || {};

    const badgeText = document.getElementById('tgBotBadgeText');
    const badgeLink = document.getElementById('tgBotLinkBadge');

    if (st.botInfo?.username) {
      if (badgeText) badgeText.textContent = `@${st.botInfo.username} (Buka Bot)`;
      if (badgeLink) badgeLink.href = `https://t.me/${st.botInfo.username}`;
    } else {
      if (badgeText) badgeText.textContent = 'Belum Terhubung (Token Kosong)';
      if (badgeLink) badgeLink.href = '#';
    }
  } catch (e) {
    console.error('loadTelegramStatus error:', e);
  }
}

function saveTelegramToLocalStorage() {
  try {
    const tok = (document.getElementById('cfgTelegramToken')?.value || '').trim();
    const own = (document.getElementById('cfgTelegramOwner')?.value || '').trim();
    const dom = (document.getElementById('cfgTelegramDomain')?.value || '').trim();
    const mod = document.getElementById('cfgTelegramAccessMode')?.value || 'public';
    const sty = document.getElementById('cfgTelegramStyle')?.value || 'santai';
    const lng = document.getElementById('cfgTelegramLanguage')?.value || 'id';
    if (tok) localStorage.setItem('bre_tg_token', tok);
    if (own) localStorage.setItem('bre_tg_owner', own);
    if (dom) localStorage.setItem('bre_tg_domain', dom);
    if (mod) localStorage.setItem('bre_tg_mode', mod);
    if (sty) localStorage.setItem('bre_tg_style', sty);
    localStorage.setItem('bre_tg_lang', lng);
  } catch (e) {}
}

function restoreTelegramFromLocalStorage() {
  try {
    const tok = localStorage.getItem('bre_tg_token');
    const own = localStorage.getItem('bre_tg_owner');
    const dom = localStorage.getItem('bre_tg_domain');
    const mod = localStorage.getItem('bre_tg_mode');
    const sty = localStorage.getItem('bre_tg_style');

    const inpTok = document.getElementById('cfgTelegramToken');
    if (inpTok && !inpTok.value && tok) inpTok.value = tok;

    const inpOwn = document.getElementById('cfgTelegramOwner');
    if (inpOwn && !inpOwn.value && own) inpOwn.value = own;

    const inpDom = document.getElementById('cfgTelegramDomain');
    if (inpDom && !inpDom.value && dom) inpDom.value = dom;

    const selMod = document.getElementById('cfgTelegramAccessMode');
    if (selMod && mod) selMod.value = (mod === 'whitelist' ? 'diizinkan' : mod);

    const selSty = document.getElementById('cfgTelegramStyle');
    if (selSty && sty) selSty.value = sty;

    const selLng = document.getElementById('cfgTelegramLanguage');
    const lng = localStorage.getItem('bre_tg_lang');
    if (selLng && lng) selLng.value = lng;
  } catch (e) {}
}

// Button 1: 1. Simpan
async function saveTelegramSetupOnly() {
  saveTelegramToLocalStorage();
  const enCheck = document.getElementById('cfgTelegramEnabled');
  if (enCheck) enCheck.checked = true;
  toast('💾 Konfigurasi Bot Telegram tersimpan di browser & memori!', 'ok');
  await saveAllConfig();
  await loadTelegramStatus();
}

async function restartTelegramBotService() {
  if (!adminToken) return toast('Admin token tidak ditemukan, harap login ulang.', 'err');
  toast('♻️ Merestart service bot Telegram...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'restart_bot' })
    });
    const data = await r.json();
    if (data.ok) {
      toast(`✅ ${data.message || 'Bot direstart'}`, 'ok');
      await loadTelegramStatus();
    } else {
      toast(`❌ Gagal: ${data.error}`, 'err');
    }
  } catch(e) {
    toast(`❌ Error: ${e.message}`, 'err');
  }
}

async function stopTelegramBotService() {
  if (!adminToken) return toast('Admin token tidak ditemukan, harap login ulang.', 'err');
  toast('🛑 Menghentikan service bot Telegram...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'stop_bot' })
    });
    const data = await r.json();
    if (data.ok) {
      toast(`✅ ${data.message || 'Bot dihentikan'}`, 'ok');
      await loadTelegramStatus();
    } else {
      toast(`❌ Gagal: ${data.error}`, 'err');
    }
  } catch(e) {
    toast(`❌ Error: ${e.message}`, 'err');
  }
}

// Button 2: 🔄 2. Set Webhook
async function setupTelegramWebhookFromDomain() {
  const token = (document.getElementById('cfgTelegramToken')?.value || '').trim();
  if (!token) return toast('Harap masukkan TELEGRAM BOT TOKEN terlebih dahulu', 'err');
  
  let domain = (document.getElementById('cfgTelegramDomain')?.value || '').trim();
  if (!domain) {
    domain = window.location.host;
  }
  
  // Bersihkan format domain
  domain = domain.replace(/^https?:\/\//i, '').replace(/\/api\/telegram\/?.*$/i, '').replace(/\/+$/, '');
  const domainInp = document.getElementById('cfgTelegramDomain');
  if (domainInp) domainInp.value = domain;

  const adminId = (document.getElementById('cfgTelegramOwner')?.value || '').trim();
  const accessMode = document.getElementById('cfgTelegramAccessMode')?.value || 'public';

  saveTelegramToLocalStorage();

  // URL Webhook Self-Contained (Persis seperti temp-email: Token & Admin ID dibawa langsung oleh Telegram)
  let webhookUrl = `https://${domain}/api/telegram?t=${encodeURIComponent(token)}`;
  if (adminId) webhookUrl += `&o=${encodeURIComponent(adminId)}`;
  if (accessMode && accessMode !== 'public') webhookUrl += `&m=${encodeURIComponent(accessMode)}`;

  toast(`🔄 Memasang Webhook Cloud 24/7 ke ${domain}...`, 'ok');

  const enCheck = document.getElementById('cfgTelegramEnabled');
  if (enCheck) enCheck.checked = true;
  await saveAllConfig();

  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'setup_webhook', url: webhookUrl, token: token })
    });
    const data = await r.json();
    if (data.ok) {
      toast(`🎉 Webhook 24/7 Berhasil Dipasang ke ${domain}!`, 'ok');
      if (data.status?.botInfo?.username) {
        const badgeText = document.getElementById('tgBotBadgeText');
        const badgeLink = document.getElementById('tgBotLinkBadge');
        if (badgeText) badgeText.textContent = `@${data.status.botInfo.username} (Buka Bot)`;
        if (badgeLink) badgeLink.href = `https://t.me/${data.status.botInfo.username}`;
      }
      loadTelegramStatus();
    } else {
      toast(`❌ Gagal pasang webhook: ${data.error || 'Periksa token/domain'}`, 'err');
    }
  } catch (e) {
    toast(`Error pasang webhook: ${e.message}`, 'err');
  }
}

// Button 3: ⚡ 3. Tes Bot
async function testTelegramBotFlow() {
  const token = (document.getElementById('cfgTelegramToken')?.value || '').trim();
  const adminId = (document.getElementById('cfgTelegramOwner')?.value || '').trim();

  if (!token) return toast('Harap masukkan TELEGRAM BOT TOKEN terlebih dahulu', 'err');

  toast('⚡ Menghubungi bot & menguji koneksi API...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'test_telegram', token: token, chatId: adminId })
    });
    const data = await r.json();
    if (data.ok && data.bot) {
      const badgeText = document.getElementById('tgBotBadgeText');
      const badgeLink = document.getElementById('tgBotLinkBadge');
      if (badgeText) badgeText.textContent = `@${data.bot.username} (Buka Bot)`;
      if (badgeLink) badgeLink.href = `https://t.me/${data.bot.username}`;

      if (data.messageSent) {
        toast(`✅ Tes Berhasil! Terhubung ke @${data.bot.username} & pesan tes dikirim ke Telegram Chat ID ${adminId}!`, 'ok');
      } else {
        toast(`✅ Tes Berhasil! Terhubung ke bot @${data.bot.username} (${data.bot.first_name})`, 'ok');
      }
      loadTelegramStatus();
    } else {
      toast(`❌ Tes Gagal: ${data.error || 'Token tidak valid'}`, 'err');
    }
  } catch (e) {
    toast(`Error tes bot: ${e.message}`, 'err');
  }
}

// Button 4: 🔍 Cek Status
async function showDetailedTelegramStatusModal() {
  toast('🔍 Memeriksa status lengkap bot Telegram...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_telegram_status' })
    });
    const data = await r.json();
    const st = data.status || {};

    if (st.botInfo?.username) {
      const badgeText = document.getElementById('tgBotBadgeText');
      const badgeLink = document.getElementById('tgBotLinkBadge');
      if (badgeText) badgeText.textContent = `@${st.botInfo.username} (Buka Bot)`;
      if (badgeLink) badgeLink.href = `https://t.me/${st.botInfo.username}`;
    }

    const modeText = (st.accessMode === 'diizinkan' || st.accessMode === 'whitelist') ? '🔒 Khusus Pengguna Diizinkan (Akses Terbatas)' : '🟢 Terbuka untuk Publik';
    const webhookText = st.isWebhookActive ? `🟢 Aktif 24/7 (${st.webhookUrl})` : '🟡 Belum Terhubung (Klik "2. Set Webhook")';
    const botName = st.botInfo?.username ? `@${st.botInfo.username} (${st.botInfo.first_name || 'Bot'})` : '(Token belum valid)';

    alert(
      `📊 STATUS SISTEM BOT TELEGRAM BRE AI\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Bot: ${botName}\n` +
      `• Webhook 24/7: ${webhookText}\n` +
      `• Pending Antrean: ${st.pendingUpdates || 0} pesan\n` +
      `• Admin ID (Chat ID): ${st.ownerId || '(Belum diatur)'}\n` +
      `• Mode Akses: ${modeText}\n` +
      `• Pengguna Terdaftar: ${st.userCount || 0} akun\n` +
      `• Percakapan Aktif: ${st.activeConversations || 0} sesi\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (st.isWebhookActive ? '✅ Bot berjalan 24 jam nonstop secara serverless di cloud.' : '💡 Tips: Klik tombol "2. Set Webhook" untuk menghubungkan bot 24/7.')
    );
  } catch (e) {
    toast(`Gagal cek status: ${e.message}`, 'err');
  }
}

// Backward Compatibility Helpers
async function setupTelegramWebhook() { return setupTelegramWebhookFromDomain(); }
async function testTelegramToken() { return testTelegramBotFlow(); }
async function restartTelegramBot() { return setupTelegramWebhookFromDomain(); }

// Telegram User List CRUD Controllers with Live Search & Tabs
let activeTgUserFilter = 'all';

function filterTelegramUsersUI(filterVal) {
  if (filterVal) {
    activeTgUserFilter = filterVal;
    const btnAll = document.getElementById('btnTgUserAll');
    const btnAllowed = document.getElementById('btnTgUserAllowed');
    const btnBlocked = document.getElementById('btnTgUserBlocked');
    if (btnAll) {
      btnAll.style.background = activeTgUserFilter === 'all' ? '#0284c7' : 'transparent';
      btnAll.style.color = activeTgUserFilter === 'all' ? '#fff' : '#94a3b8';
    }
    if (btnAllowed) {
      btnAllowed.style.background = activeTgUserFilter === 'diizinkan' ? '#0284c7' : 'transparent';
      btnAllowed.style.color = activeTgUserFilter === 'diizinkan' ? '#fff' : '#86efac';
    }
    if (btnBlocked) {
      btnBlocked.style.background = activeTgUserFilter === 'blocked' ? '#0284c7' : 'transparent';
      btnBlocked.style.color = activeTgUserFilter === 'blocked' ? '#fff' : '#fca5a5';
    }
  }
  renderTelegramUsersTable();
}

function renderTelegramUsersTable() {
  const tbody = document.getElementById('telegramUsersTableBody');
  if (!tbody) return;

  // Calculate counts
  const totalCount = telegramUsers.length;
  const allowedCount = telegramUsers.filter(u => u.role === 'diizinkan' || u.role === 'whitelist' || u.role === 'owner').length;
  const blockedCount = telegramUsers.filter(u => u.role === 'blocked').length;

  const countAllEl = document.getElementById('tgCountAll');
  if (countAllEl) countAllEl.textContent = totalCount;
  const countAllowedEl = document.getElementById('tgCountAllowed');
  if (countAllowedEl) countAllowedEl.textContent = allowedCount;
  const countBlockedEl = document.getElementById('tgCountBlocked');
  if (countBlockedEl) countBlockedEl.textContent = blockedCount;

  if (!telegramUsers.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Belum ada daftar pengguna khusus. Tambahkan pengguna di atas.</td></tr>`;
    return;
  }

  const query = (document.getElementById('tgUserSearchInput')?.value || '').toLowerCase().trim();

  // Filter list
  const filtered = telegramUsers.map((u, originalIndex) => ({ ...u, originalIndex })).filter(u => {
    // Filter by tab
    if (activeTgUserFilter === 'diizinkan' && u.role === 'blocked') return false;
    if (activeTgUserFilter === 'blocked' && u.role !== 'blocked') return false;

    // Filter by search query
    if (query) {
      const matchId = String(u.id || '').toLowerCase().includes(query);
      const matchUsername = String(u.username || '').toLowerCase().includes(query);
      const matchName = String(u.name || '').toLowerCase().includes(query);
      if (!matchId && !matchUsername && !matchName) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Tidak ada pengguna yang cocok dengan filter / pencarian.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    let roleBadge = '<span class="ping-badge ok">🟢 Diizinkan</span>';
    if (u.role === 'owner') roleBadge = '<span class="ping-badge ok" style="border-color:#38bdf8; color:#38bdf8;">👑 Owner</span>';
    else if (u.role === 'blocked') roleBadge = '<span class="ping-badge fail">🔴 Diblokir</span>';

    const dateStr = u.addedAt ? new Date(u.addedAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const userTag = u.username ? `@${u.username.replace(/^@/, '')}` : (u.id ? `ID: ${u.id}` : '-');
    const isAllowed = u.role === 'diizinkan' || u.role === 'whitelist';

    return `
      <tr>
        <td style="font-family: monospace; font-size: 13px; color: #38bdf8; font-weight: 600;">${userTag}</td>
        <td style="color: #f1f5f9;">
          <span>${u.name || '-'}</span>
          ${u.role !== 'owner' ? `<button class="btn" onclick="editTelegramUserNote(${u.originalIndex})" title="Edit Catatan/Nama" style="background:transparent; border:none; color:#64748b; cursor:pointer; padding:0 4px; font-size:11px;">✏️</button>` : ''}
        </td>
        <td>${roleBadge}</td>
        <td style="font-size: 12px; color: #94a3b8;">${dateStr}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            ${u.role !== 'owner' ? `
              <button class="btn btn-outline" style="font-size: 11px; padding: 4px 8px; ${isAllowed ? 'color:#fca5a5; border-color:rgba(239,68,68,0.4);' : 'color:#86efac; border-color:rgba(34,197,94,0.4);'}" onclick="toggleTelegramUserRole(${u.originalIndex})">
                ${isAllowed ? '🔴 Blokir' : '🟢 Izinkan'}
              </button>
              <button class="btn btn-danger" style="font-size: 11px; padding: 4px 8px;" onclick="deleteTelegramUser(${u.originalIndex})">🗑️ Hapus</button>
            ` : '<span style="font-size: 12px; color: #64748b; padding: 4px;">Utama</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function addTelegramUser() {
  const idInput = document.getElementById('newTgUserId');
  const nameInput = document.getElementById('newTgUserName');
  const roleSelect = document.getElementById('newTgUserRole');

  const rawVal = (idInput?.value || '').trim();
  if (!rawVal) return toast('Harap masukkan ID Telegram atau @username', 'err');

  let id = rawVal;
  let username = '';
  if (rawVal.startsWith('@')) {
    username = rawVal.slice(1);
    id = rawVal;
  } else if (isNaN(rawVal)) {
    username = rawVal;
  }

  const name = (nameInput?.value || '').trim() || (username ? `@${username}` : `User ${id}`);
  let role = roleSelect?.value || 'diizinkan';
  if (role === 'whitelist') role = 'diizinkan';

  const existing = telegramUsers.find(u => String(u.id) === String(id) || (username && u.username === username));
  if (existing) {
    existing.role = role;
    existing.name = name;
  } else {
    telegramUsers.push({
      id: String(id),
      username: username,
      name: name,
      role: role,
      addedAt: new Date().toISOString()
    });
  }

  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';

  renderTelegramUsersTable();
  saveAllConfig();
  toast(`Pengguna ${name} berhasil didaftarkan!`, 'ok');
}

function editTelegramUserNote(idx) {
  if (!telegramUsers[idx]) return;
  const current = telegramUsers[idx];
  const newName = prompt(`Ubah Nama / Catatan untuk "${current.username ? '@' + current.username : current.id}":`, current.name || '');
  if (newName !== null) {
    telegramUsers[idx].name = newName.trim();
    renderTelegramUsersTable();
    saveAllConfig();
    toast(`Catatan pengguna diperbarui!`, 'ok');
  }
}

function toggleTelegramUserRole(idx) {
  if (!telegramUsers[idx]) return;
  const isAllowed = telegramUsers[idx].role === 'diizinkan' || telegramUsers[idx].role === 'whitelist';
  telegramUsers[idx].role = isAllowed ? 'blocked' : 'diizinkan';
  renderTelegramUsersTable();
  saveAllConfig();
  toast(`Status ${telegramUsers[idx].name || telegramUsers[idx].id} diperbarui`, 'ok');
}

function deleteTelegramUser(idx) {
  if (!telegramUsers[idx]) return;
  const item = telegramUsers[idx];
  if (!confirm(`Hapus pengguna "${item.name || item.id}" dari daftar akses?`)) return;
  telegramUsers.splice(idx, 1);
  renderTelegramUsersTable();
  saveAllConfig();
  toast('Pengguna dihapus dari daftar', 'ok');
}

// Auto-restore login session on page refresh
window.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = sessionStorage.getItem('bre_admin_pw');
    if (saved) {
      const inp = document.getElementById('pwInput');
      if (inp) inp.value = saved;
      doLogin();
    }
  } catch(e) {}
});

// ========================================================
// CLOUD STORAGE & PERSISTENCE CONTROLLER (VERCEL & GITHUB)
// ========================================================

async function loadCloudStorageStatus(interactive = false) {
  if (!adminToken) return;
  if (interactive) toast('🔍 Memeriksa status penyimpanan cloud...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_cloud_status' })
    });
    if (!r.ok) return;
    const data = await r.json();
    if (data.status) {
      updateStorageBadges(data.status);
      if (interactive) {
        const st = data.status;
        if (st.upstashInvalidUrl) {
          alert('⚠️ PERHATIAN: URL UPSTASH TIDAK VALID!\n\nAnda memasukkan URL Web Browser Console (console.upstash.com), bukan URL REST API.\n\nCara Memperbaiki:\n1. Buka console Upstash Anda di browser.\n2. Scroll ke bagian bawah ke tabel "REST API".\n3. Salin UPSTASH_REDIS_REST_URL yang berakhiran .upstash.io (contoh: https://humble-cat-12345.upstash.io).\n4. Tempelkan ke kolom URL di bawah, lalu klik Simpan.');
        } else if (st.upstashActive) {
          alert('✅ STATUS PENYIMPANAN CLOUD:\n\n• Provider: Vercel KV / Upstash Redis Aktif 🟢\n• Latensi: <20ms\n• Seluruh konfigurasi tersimpan permanen di cloud database.');
        } else if (st.githubActive) {
          alert('✅ STATUS PENYIMPANAN CLOUD:\n\n• Provider: GitHub Auto-Commit Aktif 🟢\n• Seluruh perubahan di-commit otomatis ke repositori GitHub.');
        } else {
          alert('ℹ️ STATUS PENYIMPANAN:\n\n• Mode: Local Disk & Browser Storage Aktif.\n• Bot Telegram: Berjalan 24/7 serverless tanpa perlu database cloud.\n• Catatan: Untuk Vercel KV, pastikan menggunakan URL REST API (.upstash.io).');
        }
      }
    }
  } catch(e) {
    if (interactive) toast('Gagal memeriksa status: ' + e.message, 'err');
  }
}

function updateStorageBadges(info, cloudStatus = null) {
  const headerBadge = document.getElementById('storageHeaderBadge');
  const cardBadge = document.getElementById('cloudStatusBadge');
  const cardTitle = document.getElementById('cloudStatusTitle');
  const cardDesc = document.getElementById('cloudStatusExplanation');

  if (!info) return;

  if (info.upstashInvalidUrl) {
    if (cardBadge) {
      cardBadge.className = 'ping-badge fail';
      cardBadge.textContent = '🔴 URL Console (Bukan REST API)';
    }
    if (cardTitle) cardTitle.textContent = 'URL Upstash Salah (Gunakan URL .upstash.io)';
    if (cardDesc) {
      cardDesc.innerHTML = '<span style="color:#f87171; font-weight:600;">⚠️ URL yang dimasukkan adalah URL browser console (console.upstash.com).</span><br>Harap buka console Upstash di browser Anda, scroll ke bagian bawah ke tabel <b>REST API</b>, lalu salin <code>UPSTASH_REDIS_REST_URL</code> yang berakhiran <code>.upstash.io</code> (contoh: <code>https://humble-cat-12345.upstash.io</code>) beserta tokennya.';
    }
  } else if (info.upstashActive) {
    if (headerBadge) {
      headerBadge.className = 'ping-badge ok';
      headerBadge.textContent = '🟢 Vercel KV Aktif';
    }
    if (cardBadge) {
      cardBadge.className = 'ping-badge ok';
      cardBadge.textContent = '🟢 Vercel KV / Upstash Redis Aktif';
    }
    if (cardTitle) cardTitle.textContent = 'Penyimpanan Permanen Cloud Aktif (Vercel KV / Redis)';
    if (cardDesc) {
      cardDesc.innerHTML = 'Database Redis serverless terhubung. Seluruh perubahan konfigurasi di panel web ini langsung tersimpan permanen di cloud (&lt;20ms) dan tidak akan pernah hilang meskipun Vercel cold start atau restart deployment.';
    }
  } else if (info.githubActive) {
    if (headerBadge) {
      headerBadge.className = 'ping-badge ok';
      headerBadge.textContent = '🟢 GitHub Sync Aktif';
    }
    if (cardBadge) {
      cardBadge.className = 'ping-badge ok';
      cardBadge.textContent = '🟢 GitHub Auto-Commit Aktif';
    }
    if (cardTitle) cardTitle.textContent = 'Sinkronisasi Otomatis Repositori GitHub Aktif';
    if (cardDesc) {
      cardDesc.innerHTML = 'Setiap kali Anda klik <b>Simpan Semua Pengaturan</b>, Bre AI akan langsung membuat commit baru ke file <code>config.json</code> di repositori GitHub Anda. Vercel akan otomatis mendapatkan versi terbaru!';
    }
  } else if (info.isServerless) {
    if (headerBadge) {
      headerBadge.className = 'ping-badge ok';
      headerBadge.textContent = '🟢 Serverless 24/7 (Zero-DB)';
    }
    if (cardBadge) {
      cardBadge.className = 'ping-badge ok';
      cardBadge.textContent = '🟢 Serverless Mode Aktif (Tanpa DB)';
    }
    if (cardTitle) cardTitle.textContent = 'Sistem Bot Berjalan 24 Jam Nonstop';
    if (cardDesc) {
      cardDesc.innerHTML = '✅ Bot Telegram Anda menggunakan arsitektur <b>Self-Contained Webhook</b> (persis seperti temp-email). Bot otomatis aktif 24 jam di Vercel tanpa perlu database cloud atau Redis!';
    }
  } else {
    if (headerBadge) {
      headerBadge.className = 'ping-badge ok';
      headerBadge.textContent = '💾 Local Disk (config.json)';
    }
    if (cardBadge) {
      cardBadge.className = 'ping-badge ok';
      cardBadge.textContent = '🟢 File Lokal (config.json)';
    }
    if (cardTitle) cardTitle.textContent = 'Penyimpanan File Lokal Aktif';
    if (cardDesc) {
      cardDesc.innerHTML = 'Aplikasi berjalan di server lokal / VPS dengan akses tulis langsung ke <code>config.json</code>. Semua perubahan langsung tersimpan permanen ke hard drive server.';
    }
  }
}

async function testUpstashConnection() {
  const url = (document.getElementById('cfgUpstashUrl')?.value || '').trim();
  const token = (document.getElementById('cfgUpstashToken')?.value || '').trim();

  if (!url || !token) {
    return toast('Masukkan URL dan Token Upstash Redis terlebih dahulu', 'err');
  }

  toast('⚡ Menguji koneksi ke Vercel KV / Upstash Redis...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'test_upstash', url, token })
    });
    const data = await r.json();
    if (data.ok) {
      toast('🎉 ' + data.message, 'ok');
      await saveAllConfig();
    } else {
      toast('❌ Gagal terhubung ke Upstash: ' + (data.error || 'Unknown error'), 'err');
    }
  } catch(e) {
    toast('Error pengujian Upstash: ' + e.message, 'err');
  }
}

async function testGitHubConnection() {
  const token = (document.getElementById('cfgGithubToken')?.value || '').trim();
  const repo = (document.getElementById('cfgGithubRepo')?.value || '').trim();
  const branch = (document.getElementById('cfgGithubBranch')?.value || '').trim() || 'main';

  if (!token || !repo) {
    return toast('Masukkan GitHub Token dan Nama Repositori (contoh: user/repo)', 'err');
  }

  toast('⚡ Menguji koneksi ke GitHub API...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'test_github', token, repo, branch })
    });
    const data = await r.json();
    if (data.ok) {
      toast('🎉 ' + data.message, 'ok');
      await saveAllConfig();
    } else {
      toast('❌ Gagal terhubung ke GitHub: ' + (data.error || 'Periksa token & nama repo'), 'err');
    }
  } catch(e) {
    toast('Error pengujian GitHub: ' + e.message, 'err');
  }
}

function toggleUpstashTokenMask() {
  const inp = document.getElementById('cfgUpstashToken');
  const btn = document.getElementById('btnMaskUpstash');
  if (!inp || !btn) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🔒 Sembunyikan';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️ Tampilkan';
  }
}

function toggleGithubTokenMask() {
  const inp = document.getElementById('cfgGithubToken');
  const btn = document.getElementById('btnMaskGithub');
  if (!inp || !btn) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🔒 Sembunyikan';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️ Tampilkan';
  }
}



