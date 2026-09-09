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

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  btn.classList.add('active');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
  
  if (tabId === 'tabTester') updateTestModelDropdown();
  if (tabId === 'tabAnalytics') loadMetrics();
  if (tabId === 'tabLogs') loadLogs();
  if (tabId === 'tabTelegram') loadTelegramStatus();
  if (tabId === 'tabCloud') loadCloudStorageStatus();
  if (tabId === 'tabSecurity') initIntegrationGuide();
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
      loadMetrics();
      loadLogs();
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
  if (document.getElementById('autoRefreshMetrics')?.checked) {
    if (!metricsTimer) metricsTimer = setInterval(loadMetrics, 5000);
  }
  if (document.getElementById('autoRefreshLogs')?.checked) {
    if (!logsTimer) logsTimer = setInterval(loadLogs, 5000);
  }
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
    renderClientKeys();

    // Endpoints & Providers
    endpoints = Array.isArray(c.endpoints) ? c.endpoints : [];
    renderProviders();

    // Engine
    document.getElementById('cfgPrompt').value = c.systemPrompt || '';
    document.getElementById('cfgTemp').value = c.temperature ?? 0.7;
    document.getElementById('cfgTopP').value = c.topP ?? 1.0;
    document.getElementById('cfgFreqPenalty').value = c.frequencyPenalty ?? 0.0;
    document.getElementById('cfgPresPenalty').value = c.presencePenalty ?? 0.0;
    document.getElementById('cfgMaxTokens').value = c.maxTokens || 16384;
    document.getElementById('cfgStream').value = c.forceStream === true ? 'true' : (c.forceStream === false ? 'false' : 'auto');
    const defStEl = document.getElementById('cfgDefaultStyle');
    if (defStEl) defStEl.value = c.defaultStyle || 'santai';
    
    // Security
    document.getElementById('cfgClientKey').value = c.clientKey || c.clientApiKey || '';
    document.getElementById('cfgRateMax').value = c.rateLimitMax || 5;
    document.getElementById('cfgRateWin').value = c.rateLimitWindow || 30;
    
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
    initIntegrationGuide();
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

async function loadMetrics() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_metrics' })
    });
    if (!r.ok) return;
    const data = await r.json();
    const m = data.metrics || {};

    const totalReq = m.totalRequests || 0;
    const successReq = m.successfulRequests || 0;
    const failReq = m.failedRequests || 0;

    const elTotal = document.getElementById('metricTotalReq');
    if (elTotal) elTotal.textContent = totalReq.toLocaleString();

    const elSuccessFail = document.getElementById('metricSuccessFail');
    if (elSuccessFail) elSuccessFail.textContent = `${successReq.toLocaleString()} sukses · ${failReq.toLocaleString()} gagal`;

    const elTokens = document.getElementById('metricTotalTokens');
    if (elTokens) elTokens.textContent = (m.totalTokens || 0).toLocaleString();

    const elErrRate = document.getElementById('metricErrorRate');
    if (elErrRate) elErrRate.textContent = m.errorRate || '0.0%';

    const elFailed = document.getElementById('metricFailedReq');
    if (elFailed) elFailed.textContent = `${failReq.toLocaleString()} error upstream`;

    const elAvgLat = document.getElementById('metricAvgLatency');
    if (elAvgLat) elAvgLat.textContent = `${m.avgLatencyMs || 0} ms`;

    const elCacheSize = document.getElementById('metricCacheSize');
    if (elCacheSize) elCacheSize.textContent = `${m.cacheSize || 0} item`;

    // Provider distribution
    const provContainer = document.getElementById('providerDistributionList');
    if (provContainer) {
      const pEntries = Object.entries(m.providerHits || {});
      if (pEntries.length === 0) {
        provContainer.innerHTML = '<div style="color: #64748b; font-size: 13px; text-align: center; padding: 20px;">Belum ada trafik upstream terekam.</div>';
      } else {
        provContainer.innerHTML = pEntries.map(([prov, count]) => {
          const pct = totalReq > 0 ? Math.round((count / totalReq) * 100) : 0;
          return `
            <div class="bar-row">
              <div class="bar-label" title="${prov}">${prov}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${pct}%;"></div>
              </div>
              <div class="bar-val">${count} (${pct}%)</div>
            </div>
          `;
        }).join('');
      }
    }

    // Model distribution
    const modelContainer = document.getElementById('modelDistributionList');
    if (modelContainer) {
      const mEntries = Object.entries(m.modelHits || {});
      if (mEntries.length === 0) {
        modelContainer.innerHTML = '<div style="color: #64748b; font-size: 13px; text-align: center; padding: 20px;">Belum ada query model terekam.</div>';
      } else {
        modelContainer.innerHTML = mEntries.map(([mod, count]) => {
          const pct = totalReq > 0 ? Math.round((count / totalReq) * 100) : 0;
          return `
            <div class="bar-row">
              <div class="bar-label" title="${mod}">${mod}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, #10b981, #06b6d4);"></div>
              </div>
              <div class="bar-val">${count} (${pct}%)</div>
            </div>
          `;
        }).join('');
      }
    }
  } catch(e) {
    console.error('loadMetrics error:', e);
  }
}

function toggleAutoRefreshMetrics(el) {
  if (el.checked) {
    if (!metricsTimer) metricsTimer = setInterval(loadMetrics, 5000);
  } else {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

async function loadLogs() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_logs' })
    });
    if (!r.ok) return;
    const data = await r.json();
    allLogs = Array.isArray(data.logs) ? data.logs : [];
    filterLogs();
  } catch(e) {
    console.error('loadLogs error:', e);
  }
}

function filterLogs() {
  const query = (document.getElementById('logSearchInput')?.value || '').toLowerCase().trim();
  const errorOnly = document.getElementById('logFilterErrorOnly')?.checked || false;

  let filtered = allLogs;
  if (errorOnly) {
    filtered = filtered.filter(l => l.status >= 400);
  }
  if (query) {
    filtered = filtered.filter(l => {
      return (l.ip && l.ip.toLowerCase().includes(query)) ||
             (l.provider && l.provider.toLowerCase().includes(query)) ||
             (l.model && l.model.toLowerCase().includes(query)) ||
             (l.error && l.error.toLowerCase().includes(query)) ||
             String(l.status).includes(query);
    });
  }
  renderLogsTable(filtered);
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;
  if (!logs || !logs.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 26px;">Tidak ada log yang sesuai dengan filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const d = new Date(l.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' +
                    d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    
    let statusClass = 'ok';
    if (l.status >= 500) statusClass = 'fail';
    else if (l.status >= 400) statusClass = 'testing';

    const cacheBadge = l.cached
      ? `<span class="ping-badge ok" style="font-size: 11px;">⚡ RAM</span>`
      : `<span style="color: #64748b;">-</span>`;

    const errDetail = l.error
      ? `<span style="color: #f87171; font-family: monospace; font-size: 11px;" title="${l.error}">${l.error.length > 50 ? l.error.slice(0, 50) + '...' : l.error}</span>`
      : `<span style="color: #4ade80; font-size: 11px;">OK</span>`;

    return `
      <tr>
        <td style="font-size: 11px; color: #94a3b8; font-family: monospace; white-space: nowrap;">${timeStr}</td>
        <td style="font-family: monospace; font-size: 12px; color: #cbd5e1;">${l.ip || '127.0.0.1'}</td>
        <td style="font-weight: 600; color: #38bdf8;">${l.provider || '-'}</td>
        <td style="font-size: 12px; color: #e2e8f0;">${l.model || '-'}</td>
        <td><span class="ping-badge ${statusClass}">${l.status}</span></td>
        <td style="font-family: monospace; font-size: 12px;">${l.latencyMs || 0}ms</td>
        <td style="font-family: monospace; font-size: 12px;">${l.tokens || 0}</td>
        <td>${cacheBadge}</td>
        <td>${errDetail}</td>
      </tr>
    `;
  }).join('');
}

async function clearAdminLogs() {
  if (!confirm('Hapus seluruh riwayat log permintaan sekarang?')) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'clear_logs' })
    });
    if (r.ok) {
      allLogs = [];
      filterLogs();
      toast('Semua log berhasil dibersihkan', 'ok');
    }
  } catch(e) {
    toast('Gagal membersihkan log: ' + e.message, 'err');
  }
}

function toggleAutoRefreshLogs(el) {
  if (el.checked) {
    if (!logsTimer) logsTimer = setInterval(loadLogs, 5000);
  } else {
    clearInterval(logsTimer);
    logsTimer = null;
  }
}

// Multi-Client Keys CRUD
function renderClientKeys() {
  const tbody = document.getElementById('clientKeysTableBody');
  if (!tbody) return;
  if (!clientKeys.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Belum ada Client API Key khusus. Buat di atas.</td></tr>`;
    updateGuideKeyDropdown();
    return;
  }

  tbody.innerHTML = clientKeys.map((item, i) => {
    const masked = item.key.slice(0, 10) + '••••••••' + item.key.slice(-4);
    const isAct = item.enabled !== false;
    const statusBadge = isAct
      ? `<span class="ping-badge ok">🟢 Aktif</span>`
      : `<span class="ping-badge fail">🔴 Dicabut (Revoked)</span>`;
    
    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    return `
      <tr>
        <td style="font-weight: 600; color: #f1f5f9;">${item.label || 'Klien ' + (i+1)}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <code style="font-family: monospace; color: #38bdf8; background: #06080e; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${masked}</code>
            <button class="btn btn-outline" style="font-size: 11px; padding: 3px 8px;" onclick="copyClientKey('${item.key}')" title="Salin Full API Key">📋 Salin</button>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td style="font-size: 12px; color: #94a3b8;">${dateStr}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-outline" style="font-size: 11px; padding: 4px 8px;" onclick="toggleClientKey(${i})">
              ${isAct ? 'Cabut Akses' : 'Aktifkan'}
            </button>
            <button class="btn btn-danger" style="font-size: 11px; padding: 4px 8px;" onclick="deleteClientKey(${i})">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updateGuideKeyDropdown();
}

function addNewClientKey() {
  const input = document.getElementById('newClientKeyLabel');
  const label = (input?.value || '').trim() || `Client App #${clientKeys.length + 1}`;
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = 'sk-bre-';
  for (let i = 0; i < 32; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));

  const newObj = {
    id: 'ck_' + Date.now(),
    label: label,
    key: rand,
    enabled: true,
    createdAt: new Date().toISOString()
  };

  clientKeys.unshift(newObj);
  if (input) input.value = '';
  renderClientKeys();
  saveAllConfig();
  toast(`API Key untuk "${label}" berhasil dibuat & disimpan!`, 'ok');
}

function toggleClientKey(idx) {
  if (!clientKeys[idx]) return;
  clientKeys[idx].enabled = !clientKeys[idx].enabled;
  renderClientKeys();
  saveAllConfig();
  toast(`Status key ${clientKeys[idx].label} diperbarui`, 'ok');
}

function deleteClientKey(idx) {
  if (!clientKeys[idx]) return;
  if (!confirm(`Hapus API Key untuk "${clientKeys[idx].label}"? Klien yang menggunakan key ini tidak dapat lagi mengakses API.`)) return;
  clientKeys.splice(idx, 1);
  renderClientKeys();
  saveAllConfig();
  toast('Client Key dihapus', 'ok');
}

function copyClientKey(key) {
  navigator.clipboard.writeText(key).then(() => {
    toast('API Key disalin ke clipboard!', 'ok');
  }).catch(() => {
    prompt('Salin API Key:', key);
  });
}

// ==========================================
// INTEGRATION GUIDE & ENDPOINT HELPER
// ==========================================
function initIntegrationGuide() {
  const origin = window.location.origin || 'https://www.breai.my.id';
  const baseUrl = origin + '/v1';
  const chatUrl = origin + '/v1/chat/completions';
  const modelsUrl = origin + '/v1/models';

  const gBase = document.getElementById('guideBaseUrl');
  if (gBase) gBase.value = baseUrl;
  const gChat = document.getElementById('guideChatUrl');
  if (gChat) gChat.value = chatUrl;
  const gModels = document.getElementById('guideModelsUrl');
  if (gModels) gModels.value = modelsUrl;

  // Update dynamic base URLs in HTML text
  document.querySelectorAll('.guide-dyn-base').forEach(el => {
    el.textContent = baseUrl;
  });

  updateGuideKeyDropdown();
}

function updateGuideKeyDropdown() {
  const sel = document.getElementById('guideKeySelect');
  if (!sel) return;

  const currentVal = sel.value;
  const masterKey = (document.getElementById('cfgClientKey')?.value || '').trim();

  let options = [];
  if (masterKey) {
    options.push({ key: masterKey, label: `Master Key (${masterKey.slice(0, 10)}...)` });
  }

  if (Array.isArray(clientKeys)) {
    clientKeys.forEach((k, idx) => {
      if (k.enabled !== false) {
        options.push({ key: k.key, label: `${k.label || 'Client ' + (idx + 1)} (${k.key.slice(0, 10)}...)` });
      }
    });
  }

  if (!options.length) {
    sel.innerHTML = '<option value="">Belum ada API Key (Buat di atas)</option>';
  } else {
    sel.innerHTML = options.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
    if (currentVal && options.some(o => o.key === currentVal)) {
      sel.value = currentVal;
    }
  }

  updateGuideCodeSnippets();
}

function getSelectedOrFirstKey() {
  const sel = document.getElementById('guideKeySelect');
  if (sel && sel.value) return sel.value;
  const masterKey = (document.getElementById('cfgClientKey')?.value || '').trim();
  if (masterKey) return masterKey;
  if (Array.isArray(clientKeys) && clientKeys.length > 0) {
    const active = clientKeys.find(k => k.enabled !== false);
    if (active) return active.key;
  }
  return 'sk-bre-xxxxxxxxx';
}

function updateGuideSelectedKey() {
  updateGuideCodeSnippets();
}

function updateGuideCodeSnippets() {
  const origin = window.location.origin || 'https://www.breai.my.id';
  const baseUrl = origin + '/v1';
  const chatUrl = origin + '/v1/chat/completions';
  const key = getSelectedOrFirstKey();

  const curlEl = document.getElementById('codeSnippetCurl');
  if (curlEl) {
    curlEl.textContent = `curl "${chatUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "model": "bre-ai",
    "messages": [
      { "role": "user", "content": "Halo Bre AI, tes koneksi!" }
    ],
    "temperature": 0.7
  }'`;
  }

  const pyEl = document.getElementById('codeSnippetPython');
  if (pyEl) {
    pyEl.textContent = `from openai import OpenAI

# Inisialisasi klien OpenAI dengan endpoint Bre AI
client = OpenAI(
    base_url="${baseUrl}",
    api_key="${key}"
)

response = client.chat.completions.create(
    model="bre-ai", # Bre AI Proxy akan auto-routing ke provider aktif
    messages=[
        {"role": "user", "content": "Halo Bre AI, perkenalkan dirimu!"}
    ]
)

print(response.choices[0].message.content)`;
  }

  const jsEl = document.getElementById('codeSnippetNodejs');
  if (jsEl) {
    jsEl.textContent = `import OpenAI from 'openai';

// Inisialisasi SDK OpenAI dengan endpoint proxy Bre AI
const openai = new OpenAI({
  baseURL: '${baseUrl}',
  apiKey: '${key}'
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'bre-ai',
    messages: [{ role: 'user', content: 'Halo Bre AI!' }]
  });

  console.log(completion.choices[0].message.content);
}

main();`;
  }
}

function copyInputText(inputId, successMsg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    toast(successMsg || 'Berhasil disalin!', 'ok');
  }).catch(() => {
    prompt('Salin teks:', input.value);
  });
}

function copyText(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    toast(successMsg || 'Disalin ke clipboard!', 'ok');
  }).catch(() => {
    prompt('Salin:', text);
  });
}

function copySelectedGuideKey() {
  const key = getSelectedOrFirstKey();
  if (!key || key.includes('xxxx')) {
    return toast('Belum ada API Key. Buat API Key baru di atas terlebih dahulu.', 'err');
  }
  copyText(key, 'Client API Key disalin!');
}

function copyCodeSnippet(snippetId) {
  const el = document.getElementById(snippetId);
  if (!el) return;
  copyText(el.textContent, 'Kode berhasil disalin!');
}

function switchGuideTab(tabId, btn) {
  document.querySelectorAll('.guide-app-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.guide-tab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById('guideTab_' + tabId);
  if (target) target.style.display = 'block';
}

async function runGuideConnectionTest() {
  const promptInput = document.getElementById('guideTestPrompt');
  const promptText = (promptInput?.value || '').trim() || 'Halo Bre AI, tes koneksi API!';
  const key = getSelectedOrFirstKey();
  const resBox = document.getElementById('guideTestResultBox');
  const btn = document.getElementById('btnRunGuideTest');

  if (!key || key.includes('xxxx')) {
    return toast('Buat Client API Key terlebih dahulu di tabel atas sebelum menguji.', 'err');
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Menguji...';
  }

  if (resBox) {
    resBox.style.display = 'block';
    resBox.innerHTML = '<span style="color: #94a3b8;">Sedang mengirim request POST ke <code>/v1/chat/completions</code>...</span>';
  }

  const startTime = Date.now();
  try {
    const res = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'bre-ai',
        messages: [{ role: 'user', content: promptText }],
        stream: false
      })
    });

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    if (res.ok) {
      const reply = data.choices?.[0]?.message?.content || JSON.stringify(data);
      resBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 6px;">
          <span style="color: #10b981; font-weight: 700;">🟢 HTTP 200 OK — Koneksi Berhasil!</span>
          <span style="color: #38bdf8;">Latensi: ${elapsed} ms</span>
        </div>
        <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">Model Response ID: <b style="color:#e2e8f0;">${data.model || 'bre-ai'}</b></div>
        <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; color: #f1f5f9; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; border-left: 3px solid #10b981;">${reply}</div>
      `;
      toast('Tes koneksi API berhasil!', 'ok');
    } else {
      resBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 6px;">
          <span style="color: #ef4444; font-weight: 700;">🔴 HTTP ${res.status} — Kendala Akses</span>
          <span style="color: #94a3b8;">${elapsed} ms</span>
        </div>
        <div style="color: #ef4444; white-space: pre-wrap; font-size: 12px;">${data.error || JSON.stringify(data)}</div>
      `;
      toast(`Gagal: ${data.error || 'HTTP ' + res.status}`, 'err');
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    if (resBox) {
      resBox.innerHTML = `
        <div style="color: #ef4444; font-weight: 700; margin-bottom: 4px;">🔴 Error Jaringan / Server (${elapsed} ms)</div>
        <div style="color: #94a3b8; font-size: 12px;">${err.message}</div>
      `;
    }
    toast('Error saat tes endpoint: ' + err.message, 'err');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀</span> Tes Koneksi Sekarang';
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
  document.getElementById('cfgClientKey').value = rand;
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
    clientApiKey: document.getElementById('cfgClientKey').value.trim(),
    rateLimitMax: parseInt(document.getElementById('cfgRateMax').value) || 5,
    rateLimitWindow: parseInt(document.getElementById('cfgRateWin').value) || 30,
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
      const parsed = JSON.parse(evt.target.result);
      if (!parsed.endpoints && !parsed.apiUrl) throw new Error('Format file config tidak valid');
      
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(parsed)
      });
      if (r.ok) {
        toast('✅ Konfigurasi berhasil dipulihkan dari file!', 'ok');
        loadConfig();
      } else {
        toast('Gagal menyimpan file restore', 'err');
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



