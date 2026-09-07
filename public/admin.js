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
      toast('Login berhasil! Selamat datang di Bre AI Control Center.', 'ok');
    } else {
      let err = 'Password salah';
      try { const d = await r.json(); if (d.error) err = d.error; } catch(e){}
      toast(err, 'err');
    }
  } catch(e) {
    toast('Gagal menghubungi server', 'err');
  }
}

function initTimers() {
  if (document.getElementById('autoRefreshMetrics')?.checked) {
    if (!metricsTimer) metricsTimer = setInterval(loadMetrics, 5000);
  }
  if (document.getElementById('autoRefreshLogs')?.checked) {
    if (!logsTimer) logsTimer = setInterval(loadLogs, 5000);
  }
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config', {
      headers: { 'Authorization': 'Bearer ' + adminToken }
    });
    if (!r.ok) return toast('Gagal memuat konfigurasi', 'err');
    const data = await r.json();
    const c = data.config || {};
    
    endpoints = c.endpoints || [];
    
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

    // Engine
    document.getElementById('cfgPrompt').value = c.systemPrompt || '';
    document.getElementById('cfgTemp').value = c.temperature ?? 0.7;
    document.getElementById('cfgTopP').value = c.topP ?? 1.0;
    document.getElementById('cfgFreqPenalty').value = c.frequencyPenalty ?? 0.0;
    document.getElementById('cfgPresPenalty').value = c.presencePenalty ?? 0.0;
    document.getElementById('cfgMaxTokens').value = c.maxTokens || 16384;
    document.getElementById('cfgStream').value = c.forceStream === true ? 'true' : (c.forceStream === false ? 'false' : 'auto');
    
    // Security
    document.getElementById('cfgClientKey').value = c.clientApiKey || '';
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
    if (tgMode) tgMode.value = c.telegramAccessMode || 'public';
    const tgWl = document.getElementById('cfgTelegramWhitelist');
    if (tgWl) tgWl.value = c.telegramAllowedUsers || '';

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

    updateTelegramModelDropdown(c.telegramModel);
    loadTelegramStatus();

    renderProviders();
    updateTestModelDropdown();
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
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ping" onclick="pingProvider(${i})">⚡ Test Ping</button>
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
          <label class="form-label">Model Asli (Pisahkan dengan koma)</label>
          <input type="text" class="input-text p-models" value="${(ep.models || []).join(', ')}" placeholder="mercury-2, gpt-4o">
          <div class="form-hint">Model yang tersedia di upstream provider.</div>
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
          <td style="font-weight: 600; color: #f1f5f9;">${item.name}</td>
          <td style="color: #94a3b8; font-size: 12px;">${item.model}</td>
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

async function saveAllConfig() {
  syncProvidersFromUI();
  
  const newPw = document.getElementById('cfgNewPw').value.trim();
  const payload = {
    endpoints: endpoints,
    autoFailover: document.getElementById('cfgAutoFailover') ? document.getElementById('cfgAutoFailover').checked : true,
    cacheEnabled: document.getElementById('cfgCacheEnabled') ? document.getElementById('cfgCacheEnabled').checked : false,
    cacheTTL: parseInt(document.getElementById('cfgCacheTTL')?.value) || 3600,
    blacklist: document.getElementById('cfgBlacklist')?.value.split('\n').map(w => w.trim()).filter(Boolean) || [],
    clientKeys: clientKeys,
    systemPrompt: document.getElementById('cfgPrompt').value,
    temperature: parseFloat(document.getElementById('cfgTemp').value) || 0.7,
    topP: parseFloat(document.getElementById('cfgTopP').value) || 1.0,
    frequencyPenalty: parseFloat(document.getElementById('cfgFreqPenalty').value) || 0.0,
    presencePenalty: parseFloat(document.getElementById('cfgPresPenalty').value) || 0.0,
    maxTokens: parseInt(document.getElementById('cfgMaxTokens').value) || 16384,
    clientApiKey: document.getElementById('cfgClientKey').value.trim(),
    rateLimitMax: parseInt(document.getElementById('cfgRateMax').value) || 5,
    rateLimitWindow: parseInt(document.getElementById('cfgRateWin').value) || 30,
    telegramEnabled: document.getElementById('cfgTelegramEnabled') ? document.getElementById('cfgTelegramEnabled').checked : false,
    telegramBotToken: document.getElementById('cfgTelegramToken') ? document.getElementById('cfgTelegramToken').value.trim() : '',
    telegramOwnerId: document.getElementById('cfgTelegramOwner') ? document.getElementById('cfgTelegramOwner').value.trim() : '',
    telegramAccessMode: document.getElementById('cfgTelegramAccessMode') ? document.getElementById('cfgTelegramAccessMode').value : 'public',
    telegramAllowedUsers: document.getElementById('cfgTelegramWhitelist') ? document.getElementById('cfgTelegramWhitelist').value.trim() : '',
    telegramModel: document.getElementById('cfgTelegramModel') ? document.getElementById('cfgTelegramModel').value.trim() : '',
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
    (ep.models || []).forEach(m => allModels.add(m));
    (ep.mapping || []).forEach(map => {
      const alias = map.split(':')[0]?.trim();
      if (alias) allModels.add(alias);
    });
  });
  if (!allModels.size) allModels.add('mercury-2');
  
  sel.innerHTML = '<option value="">(Otomatis ikuti Router AI)</option>' +
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

    const dot = document.getElementById('telegramStatusDot');
    const title = document.getElementById('telegramStatusTitle');
    const desc = document.getElementById('telegramStatusDesc');
    const userTag = document.getElementById('telegramBotUsernameTag');

    if (st.isWebhookActive) {
      if (dot) { dot.className = 'ping-badge ok'; dot.textContent = '🟢 Aktif 24/7 (Cloud Webhook)'; }
      if (title) title.textContent = 'Bot Aktif 24 Jam Nonstop di Vercel';
      if (desc) desc.textContent = `Terkoneksi ke Webhook: ${st.webhookUrl}. Bot akan selalu merespon pesan otomatis tanpa perlu login atau membuka panel admin!`;
      if (userTag) userTag.textContent = st.botInfo?.username ? `@${st.botInfo.username}` : 'Cloud 24/7';
    } else if (st.running) {
      if (dot) { dot.className = 'ping-badge ok'; dot.textContent = '🟢 Aktif (Polling Lokal)'; }
      if (title) title.textContent = 'Bot Berhasil Terhubung & Siap Melayani';
      if (desc) desc.textContent = `Aktif polling Telegram API di server lokal. Sedang melayani ${st.activeConversations || 0} percakapan.`;
      if (userTag) userTag.textContent = st.botInfo?.username ? `@${st.botInfo.username}` : 'Online';
    } else if (st.enabled && st.hasToken) {
      if (dot) { dot.className = 'ping-badge testing'; dot.textContent = '🟡 Siap Dihubungkan'; }
      if (title) title.textContent = 'Token Tersimpan - Siap Dihubungkan';
      if (desc) desc.textContent = 'Klik tombol "🌐 Hubungkan Webhook Cloud (24/7)" agar bot aktif terus di Vercel tanpa perlu membuka panel admin.';
      if (userTag && st.botInfo?.username) userTag.textContent = `@${st.botInfo.username}`;
    } else {
      if (dot) { dot.className = 'ping-badge fail'; dot.textContent = '🔴 Nonaktif'; }
      if (title) title.textContent = 'Bot Sedang Tidak Aktif';
      if (desc) desc.textContent = 'Nyalakan switch "Aktifkan Integrasi Telegram Bot" dan masukkan token bot Anda.';
      if (userTag && st.botInfo?.username) userTag.textContent = `@${st.botInfo.username}`;
    }
  } catch (e) {
    console.error('loadTelegramStatus error:', e);
  }
}

async function setupTelegramWebhook() {
  const token = (document.getElementById('cfgTelegramToken')?.value || '').trim();
  if (!token) return toast('Harap masukkan token Telegram bot terlebih dahulu', 'err');

  toast('⏳ Menyimpan & mendaftarkan Webhook Cloud 24/7...', 'ok');
  await saveAllConfig();

  try {
    const origin = window.location.origin;
    const webhookUrl = `${origin}/api/telegram`;
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'setup_webhook', url: webhookUrl })
    });
    const data = await r.json();
    if (data.ok) {
      toast('🎉 Webhook Cloud Berhasil Diaktifkan! Bot aktif 24 jam nonstop tanpa perlu login admin.', 'ok');
      loadTelegramStatus();
    } else {
      toast('Gagal mengaktifkan webhook: ' + (data.error || 'Periksa token'), 'err');
    }
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function testTelegramToken() {
  const token = (document.getElementById('cfgTelegramToken')?.value || '').trim();
  if (!token) return toast('Harap masukkan token Telegram bot terlebih dahulu', 'err');

  toast('⏳ Menghubungi Telegram API (getMe)...', 'ok');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'test_telegram', token: token })
    });
    const data = await r.json();
    if (data.ok && data.bot) {
      const tag = document.getElementById('telegramBotUsernameTag');
      if (tag) tag.textContent = `@${data.bot.username}`;
      toast(`✅ Token Valid! Bot: @${data.bot.username} (${data.bot.first_name})`, 'ok');
    } else {
      toast(`❌ Token Tidak Valid: ${data.error || 'Gagal'}` , 'err');
    }
  } catch (e) {
    toast(`Gagal menguji token: ${e.message}`, 'err');
  }
}

async function restartTelegramBot() {
  toast('💾 Menyimpan pengaturan & mengaktifkan bot...', 'ok');
  await saveAllConfig();

  // If on HTTPS (e.g. Vercel / custom cloud domain), auto-setup webhook so bot runs 24/7 without login
  if (window.location.protocol === 'https:') {
    try {
      const origin = window.location.origin;
      const webhookUrl = `${origin}/api/telegram`;
      const wbRes = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ action: 'setup_webhook', url: webhookUrl })
      });
      const wbData = await wbRes.json();
      if (wbData.ok) {
        toast('🎉 Webhook Cloud Berhasil Diaktifkan! Bot aktif 24 jam nonstop tanpa perlu login admin.', 'ok');
        loadTelegramStatus();
        return;
      }
    } catch (e) {}
  }

  // Fallback for localhost (HTTP) -> start local polling loop
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'restart_telegram' })
    });
    const data = await r.json();
    if (data.ok) {
      if (data.running) {
        toast('✅ Bot Telegram berhasil aktif & berjalan!', 'ok');
      } else {
        const errDesc = data.status?.lastError || 'Periksa token bot & pastikan switch aktif';
        toast('⚠️ Bot tidak aktif: ' + errDesc, 'err');
      }
      loadTelegramStatus();
    } else {
      toast('Gagal restart bot: ' + data.error, 'err');
    }
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// Telegram User List CRUD Controllers
function renderTelegramUsersTable() {
  const tbody = document.getElementById('telegramUsersTableBody');
  if (!tbody) return;
  if (!telegramUsers.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Belum ada daftar pengguna khusus. Tambahkan di atas.</td></tr>`;
    return;
  }

  tbody.innerHTML = telegramUsers.map((u, i) => {
    let roleBadge = '<span class="ping-badge ok">🟢 Whitelist</span>';
    if (u.role === 'owner') roleBadge = '<span class="ping-badge ok" style="border-color:#38bdf8; color:#38bdf8;">👑 Owner</span>';
    else if (u.role === 'blocked') roleBadge = '<span class="ping-badge fail">🔴 Blocked</span>';

    const dateStr = u.addedAt ? new Date(u.addedAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const userTag = u.username ? `@${u.username.replace(/^@/, '')}` : (u.id ? `ID: ${u.id}` : '-');

    return `
      <tr>
        <td style="font-family: monospace; font-size: 13px; color: #38bdf8; font-weight: 600;">${userTag}</td>
        <td style="color: #f1f5f9;">${u.name || '-'}</td>
        <td>${roleBadge}</td>
        <td style="font-size: 12px; color: #94a3b8;">${dateStr}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            ${u.role !== 'owner' ? `
              <button class="btn btn-outline" style="font-size: 11px; padding: 4px 8px;" onclick="toggleTelegramUserRole(${i})">
                ${u.role === 'whitelist' ? 'Blokir' : 'Whitelist'}
              </button>
              <button class="btn btn-danger" style="font-size: 11px; padding: 4px 8px;" onclick="deleteTelegramUser(${i})">Hapus</button>
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
  const role = roleSelect?.value || 'whitelist';

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

function toggleTelegramUserRole(idx) {
  if (!telegramUsers[idx]) return;
  telegramUsers[idx].role = telegramUsers[idx].role === 'whitelist' ? 'blocked' : 'whitelist';
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

async function loadCloudStorageStatus() {
  if (!adminToken) return;
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
    }
  } catch(e) {
    console.error('loadCloudStorageStatus error:', e);
  }
}

function updateStorageBadges(info, cloudStatus = null) {
  const headerBadge = document.getElementById('storageHeaderBadge');
  const cardBadge = document.getElementById('cloudStatusBadge');
  const cardTitle = document.getElementById('cloudStatusTitle');
  const cardDesc = document.getElementById('cloudStatusExplanation');

  if (!info) return;

  if (info.upstashActive) {
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
      headerBadge.className = 'ping-badge testing';
      headerBadge.textContent = '🟡 Serverless /tmp Cache';
    }
    if (cardBadge) {
      cardBadge.className = 'ping-badge testing';
      cardBadge.textContent = '🟡 Cache Sementara (Vercel Read-Only)';
    }
    if (cardTitle) cardTitle.textContent = 'Sistem File Vercel Read-Only';
    if (cardDesc) {
      cardDesc.innerHTML = '⚠️ Anda saat ini mendeploy di Vercel tanpa cloud storage permanen. Pengaturan tersimpan di cache <code>/tmp</code> selama serverless container masih hangat, namun dapat kembali ke default saat container baru dimulai.<br><b>Saran:</b> Hubungkan <b>Vercel KV</b> (1-klik di Vercel Dashboard → Storage) atau isi <b>Token GitHub</b> di bawah agar konfigurasi tersimpan 100% permanen!';
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



