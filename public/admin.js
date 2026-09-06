let adminToken = '';
let endpoints = [];

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
  document.getElementById(tabId).style.display = 'block';
  
  if (tabId === 'tabTester') updateTestModelDropdown();
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
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('appContainer').style.display = 'flex';
      loadConfig();
      toast('Login berhasil!', 'ok');
    } else {
      let err = 'Password salah';
      try { const d = await r.json(); if (d.error) err = d.error; } catch(e){}
      toast(err, 'err');
    }
  } catch(e) {
    toast('Gagal menghubungi server', 'err');
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
          <div class="form-hint">Format 9router: Jika klien meminta model alias, diteruskan ke model asli.</div>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">API Keys (Multi-Key Round Robin - Satu key per baris)</label>
        <textarea class="input-textarea p-keys" rows="3" placeholder="sk_key_1&#10;sk_key_2">${(ep.keys || []).join('\n')}</textarea>
        <div class="form-hint">Server akan otomatis merotasi kunci (Round-Robin) untuk menghindari rate limit.</div>
      </div>
    </div>
  `).join('');
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
    systemPrompt: document.getElementById('cfgPrompt').value,
    temperature: parseFloat(document.getElementById('cfgTemp').value) || 0.7,
    topP: parseFloat(document.getElementById('cfgTopP').value) || 1.0,
    frequencyPenalty: parseFloat(document.getElementById('cfgFreqPenalty').value) || 0.0,
    presencePenalty: parseFloat(document.getElementById('cfgPresPenalty').value) || 0.0,
    maxTokens: parseInt(document.getElementById('cfgMaxTokens').value) || 16384,
    clientApiKey: document.getElementById('cfgClientKey').value.trim(),
    rateLimitMax: parseInt(document.getElementById('cfgRateMax').value) || 5,
    rateLimitWindow: parseInt(document.getElementById('cfgRateWin').value) || 30
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
      if (newPw) adminToken = newPw;
      document.getElementById('cfgNewPw').value = '';
      toast('✅ Seluruh konfigurasi proxy berhasil disimpan permanen!', 'ok');
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
    rateLimitWindow: 30
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
