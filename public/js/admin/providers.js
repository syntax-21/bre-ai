// ================================================================
// admin/providers.js - Provider cards, ping, detect models
// ================================================================

const PRESET_TEMPLATES = {
  inception: { name: 'Inception Labs', url: 'https://api.inceptionlabs.ai/v1/chat/completions', models: ['mercury-2'], mapping: ['gpt-4o:mercury-2'], keys: [] },
  openai: { name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'], mapping: [], keys: [] },
  groq: { name: 'Groq Cloud', url: 'https://api.groq.com/openai/v1/chat/completions', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'], mapping: [], keys: [] },
  deepseek: { name: 'DeepSeek API', url: 'https://api.deepseek.com/chat/completions', models: ['deepseek-chat', 'deepseek-reasoner'], mapping: [], keys: [] },
  openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', models: ['anthropic/claude-3.5-sonnet'], mapping: [], keys: [] },
  together: { name: 'Together AI', url: 'https://api.together.xyz/v1/chat/completions', models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'], mapping: [], keys: [] },
  ollama: { name: 'Ollama (Localhost)', url: 'http://localhost:11434/v1/chat/completions', models: ['llama3.2', 'qwen2.5-coder'], mapping: [], keys: ['ollama-local-key'] }
};

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
  if (!container) return;
  if (!endpoints.length) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; border: 1px dashed #232733; border-radius: 10px; color: #64748b;">Belum ada Provider API. Klik template di atas atau klik <b>+ Tambah Provider Manual</b>.</div>`;
    return;
  }
  container.innerHTML = endpoints.map((ep, i) => `
    <div class="provider-box" id="providerCard_${i}">
      <div class="provider-box-head">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-weight:600; font-size:15px; color:#38bdf8;">⚡ Provider #${i+1}: <span style="color:#f1f5f9;">${escapeHtml(ep.name) || 'Unnamed'}</span></div>
          <span class="ping-badge ${ep.status !== false ? 'ok' : 'fail'}">${ep.status !== false ? '🟢 Active' : '🔴 Inactive'}</span>
          <span id="pingBadge_${i}" class="ping-badge" style="display:none;"></span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ping" onclick="pingProvider(${i})">⚡ Test Ping</button>
          <button class="btn" style="background:#1e3a5f; color:#38bdf8; border:1px solid #38bdf8;" onclick="detectModels(${i})">🔍 Detect Model</button>
          <button class="btn" style="background:#1a2e1a; color:#4ade80; border:1px solid #4ade80;" onclick="testAllModels(${i})" id="testAllBtn_${i}">🧪 Test All Models</button>
          <button class="btn btn-danger" onclick="removeProvider(${i})">Hapus</button>
        </div>
      </div>
      <div class="grid-3" style="margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;"><label class="form-label">Nama Provider</label><input type="text" class="input-text p-name" value="${escapeHtml(ep.name) || ''}" placeholder="Contoh: Inception Labs"></div>
        <div class="form-group" style="margin-bottom:0;"><label class="form-label">Status Routing</label><select class="input-select p-status"><option value="true" ${ep.status !== false ? 'selected' : ''}>🟢 Aktif</option><option value="false" ${ep.status === false ? 'selected' : ''}>🔴 Nonaktif</option></select></div>
        <div class="form-group" style="margin-bottom:0;"><label class="form-label">Priority / Weight (1-100)</label><input type="number" class="input-text p-weight" value="${ep.weight || 1}" min="1" max="100"></div>
      </div>
      <div class="form-group"><label class="form-label">Base URL Endpoint</label><input type="url" class="input-text p-url" value="${escapeHtml(ep.url) || ''}" placeholder="https://api.inceptionlabs.ai/v1/chat/completions"></div>
      <div class="grid-2" style="margin-bottom:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Model Asli (pisahkan koma)</label>
          <input type="text" class="input-text p-models" id="pModels_${i}" value="${escapeHtml((ep.models || []).join(', '))}" placeholder="mercury-2, gpt-4o">
          <div id="modelTestRow_${i}" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
            ${(ep.models || []).map((m, mi) => `<div id="modelCard_${i}_${mi}" style="display:flex; align-items:center; gap:4px; background:#141922; border:1px solid #232733; border-radius:6px; padding:3px 8px; font-size:12px;"><span style="color:#e2e8f0;">${escapeHtml(m)}</span><button type="button" onclick="testModel(${i},'${m.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" id="testModelBtn_${i}_${mi}" style="background:#1e3a5f; color:#38bdf8; border:1px solid #38bdf8; border-radius:4px; padding:1px 7px; font-size:11px; cursor:pointer;">⚡ Tes</button><span id="testModelBadge_${i}_${mi}" style="display:none;"></span></div>`).join('')}
          </div>
          <div id="testAllSummary_${i}" style="display:none; margin-top:10px;"></div>
          <div class="form-hint">Klik 🔍 Detect Model untuk isi otomatis. Klik 🧪 Test All untuk uji semua.</div>
        </div>
        <div class="form-group" style="margin-bottom:0;"><label class="form-label">Model Mapping / Alias (alias:asli)</label><input type="text" class="input-text p-mapping" value="${escapeHtml((ep.mapping || []).join(', '))}" placeholder="claude-3-opus:mercury-2"></div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="form-label" style="margin-bottom:0;">API Keys (Multi-Key Round Robin)</label>
          <button type="button" class="btn btn-outline" style="font-size:11px; padding:3px 8px;" onclick="toggleKeyMask(${i})" id="keyMaskBtn_${i}">👁️ Tampilkan Kunci</button>
        </div>
        <textarea class="input-textarea p-keys masked-key" id="pKeys_${i}" rows="3" placeholder="sk_key_1&#10;sk_key_2">${escapeHtml((ep.keys || []).join('\n'))}</textarea>
        <div class="form-hint">Server otomatis merotasi kunci (Round-Robin) untuk menghindari rate limit.</div>
      </div>
    </div>
  `).join('');
  updateTopActiveEndpointsCount();
  if (typeof updateTelegramModelDropdown === 'function') updateTelegramModelDropdown(document.getElementById('cfgTelegramModel')?.value);
}

function toggleKeyMask(i) {
  const ta = document.getElementById(`pKeys_${i}`);
  const btn = document.getElementById(`keyMaskBtn_${i}`);
  if (!ta || !btn) return;
  const isMasked = ta.classList.contains('masked-key');
  ta.classList.toggle('masked-key', !isMasked);
  btn.textContent = isMasked ? '🔒 Sembunyikan Kunci' : '👁️ Tampilkan Kunci';
}

function addProvider() {
  syncProvidersFromUI();
  endpoints.push({ name: 'Provider Baru', status: true, weight: 1, url: '', models: [], mapping: [], keys: [] });
  renderProviders();
  toast('Provider baru ditambahkan', 'ok');
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
  if (badge) { badge.style.display = 'inline-flex'; badge.className = 'ping-badge testing'; badge.textContent = '⏳ Testing Ping...'; }
  try {
    const key = ep.keys?.[0] || '';
const model = ep.models?.[0] || 'mercury-2';
    const r = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ customEndpoint: ep.url, customModel: model, customKeys: key })
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
    if (badge) { badge.className = 'ping-badge fail'; badge.textContent = '🔴 Offline'; }
    toast('Error ping: ' + e.message, 'err');
  }
}

async function detectModels(i) {
  syncProvidersFromUI();
  const ep = endpoints[i];
  if (!ep || !ep.url) return toast('URL Endpoint belum diisi', 'err');
  if (!ep.keys || !ep.keys.length) return toast('API Key belum diisi', 'err');
  const badge = document.getElementById(`pingBadge_${i}`);
  if (badge) { badge.style.display = 'inline-flex'; badge.className = 'ping-badge testing'; badge.textContent = '🔍 Mendeteksi model...'; }
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'detect_models', providerName: ep.name, url: ep.url, keys: ep.keys })
    });
    const data = await r.json();
    if (!data.ok) { if(badge){badge.className='ping-badge fail';badge.textContent='🔴 Gagal';} return toast('Deteksi gagal: ' + (data.error || 'Unknown error'), 'err'); }
    const provResult = data.results?.find(r => r.provider === ep.name) || data.results?.[0];
    if (!provResult || !provResult.ok) { if(badge){badge.className='ping-badge fail';badge.textContent='🔴 Gagal';} return toast('Gagal mendeteksi model', 'err'); }
    const models = provResult.models || [];
    const modelsInput = document.querySelector(`#providerCard_${i} .p-models`);
    if (modelsInput) modelsInput.value = models.join(', ');
    endpoints[i].models = models;
    if (badge) { badge.className = 'ping-badge ok'; badge.textContent = `✅ ${models.length} model terdeteksi`; }
    toast(`[${ep.name}] Berhasil mendeteksi ${models.length} model`, 'ok');
  } catch(e) {
    if (badge) { badge.className = 'ping-badge fail'; badge.textContent = '🔴 Error'; }
    toast('Error deteksi model: ' + e.message, 'err');
  }
}

async function testModel(providerIdx, modelName) {
  syncProvidersFromUI();
  const ep = endpoints[providerIdx];
  if (!ep) return;
  const models = ep.models || [];
  const mi = models.indexOf(modelName);
  const badgeEl = mi >= 0 ? document.getElementById(`testModelBadge_${providerIdx}_${mi}`) : null;
  const btnEl = mi >= 0 ? document.getElementById(`testModelBtn_${providerIdx}_${mi}`) : null;
  if (badgeEl) { badgeEl.style.display = 'inline-flex'; badgeEl.textContent = '⏳'; badgeEl.style.cssText += ';color:#f59e0b;'; }
  if (btnEl) btnEl.disabled = true;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'test_model', providerName: ep.name, model: modelName, url: ep.url, keys: ep.keys })
    });
    const data = await r.json();
    if (data.ok) {
      const ms = data.latencyMs || 0;
      const color = ms < 500 ? '#22c55e' : ms < 2000 ? '#f59e0b' : '#ef4444';
      if (badgeEl) { badgeEl.style.cssText = `display:inline-flex; color:${color}; font-size:11px; font-weight:600;`; badgeEl.textContent = `${ms}ms ✓`; }
      toast(`[${ep.name}] Model ${modelName}: ✅ OK (${ms}ms)`, 'ok');
    } else {
      if (badgeEl) { badgeEl.style.cssText = 'display:inline-flex; color:#ef4444; font-size:11px;'; badgeEl.textContent = '✗ Gagal'; }
      toast(`[${ep.name}] Model ${modelName}: ❌ ${(data.error || 'Gagal').slice(0, 80)}`, 'err');
    }
  } catch(e) {
    if (badgeEl) { badgeEl.textContent = '✗'; badgeEl.style.color = '#ef4444'; }
    toast('Error test model: ' + e.message, 'err');
  } finally { if (btnEl) btnEl.disabled = false; }
}

async function testAllModels(providerIdx) {
  syncProvidersFromUI();
  const ep = endpoints[providerIdx];
  if (!ep || !ep.models?.length) return toast('Tidak ada model. Klik Detect Model dulu.', 'err');
  const btn = document.getElementById(`testAllBtn_${providerIdx}`);
  const summaryEl = document.getElementById(`testAllSummary_${providerIdx}`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menguji...'; }
  if (summaryEl) summaryEl.style.display = 'none';
  ep.models.forEach((m, mi) => {
    const badge = document.getElementById(`testModelBadge_${providerIdx}_${mi}`);
    const btnEl = document.getElementById(`testModelBtn_${providerIdx}_${mi}`);
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = '⏳'; badge.style.color = '#94a3b8'; }
    if (btnEl) btnEl.disabled = true;
  });
  const results = await Promise.all(ep.models.map(async (modelName, mi) => {
    try {
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'test_model', providerName: ep.name, model: modelName, url: ep.url, keys: ep.keys })
      });
      const data = await r.json();
      return { model: modelName, mi, ok: data.ok, latencyMs: data.latencyMs || 0, error: data.error || null };
    } catch(e) { return { model: modelName, mi, ok: false, latencyMs: 0, error: e.message }; }
  }));
  const working = [], failed = [];
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
      if (badge) { badge.style.cssText = 'display:inline-flex; color:#ef4444; font-size:11px;'; badge.textContent = '✗ Gagal'; }
    }
    if (btnEl) btnEl.disabled = false;
  });
  if (summaryEl) {
    summaryEl.style.display = 'block';
    summaryEl.innerHTML = `<div style="background:#0d1a0d; border:1px solid #166534; border-radius:8px; padding:12px 14px;"><div style="font-size:13px; font-weight:600; color:#4ade80; margin-bottom:8px;">🧪 Hasil: <span style="color:#4ade80;">${working.length} berhasil</span> / <span style="color:#f87171;">${failed.length} gagal</span></div>${working.length > 0 ? `<button onclick="applyWorkingModels(${providerIdx}, ${escapeHtml(JSON.stringify(working.map(w => w.model)))})" style="background:linear-gradient(135deg,#166534,#15803d);color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">✅ Pakai ${working.length} Model Berhasil Saja</button>` : '<div style="color:#f87171; font-size:12px;">⚠️ Tidak ada model yang berhasil.</div>'}</div>`;
  }
  if (btn) { btn.disabled = false; btn.textContent = '🧪 Test All Models'; }
  toast(`[${ep.name}] Selesai: ${working.length}/${ep.models.length} model berfungsi`, working.length > 0 ? 'ok' : 'err');
}

function applyWorkingModels(providerIdx, workingModels) {
  if (!workingModels?.length) return toast('Tidak ada model yang berhasil.', 'err');
  endpoints[providerIdx].models = workingModels;
  const modelsInput = document.getElementById(`pModels_${providerIdx}`);
  if (modelsInput) modelsInput.value = workingModels.join(', ');
  const summaryEl = document.getElementById(`testAllSummary_${providerIdx}`);
  if (summaryEl) summaryEl.innerHTML = `<div style="background:#0d1a0d; border:1px solid #22c55e; border-radius:8px; padding:10px 14px; font-size:13px; color:#4ade80;">✅ Diterapkan! ${workingModels.length} model aktif. Klik <b>Simpan Semua Pengaturan</b> untuk menyimpan.</div>`;
  toast(`✅ Daftar model diperbarui: ${workingModels.length} model aktif.`, 'ok');
}

async function runBatchLatencyTest() {
  syncProvidersFromUI();
  const box = document.getElementById('benchmarkLeaderboardBox');
  const tbody = document.getElementById('benchmarkTableBody');
  const btn = document.getElementById('btnBatchBenchmark');
  if (box) box.style.display = 'block';
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#38bdf8;padding:24px;">⏳ Menguji semua endpoint...</td></tr>`;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sedang Menguji...'; }
  try {
    const r = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ testAll: true, endpoints }) });
    const data = await r.json();
    const results = data.results || [];
    if (!results.length) { if(tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:20px;">Tidak ada provider aktif.</td></tr>`; return; }
    if (tbody) tbody.innerHTML = results.map((item, idx) => {
      let rank = idx < 3 ? ['🥇 1','🥈 2','🥉 3'][idx] : idx+1;
      const latText = item.latencyMs !== null ? `${item.latencyMs} ms` : '-';
      const badge = item.status === 'OK' ? `<span class="ping-badge ok">🟢 OK</span>` : `<span class="ping-badge fail">🔴 Error</span>`;
      return `<tr><td style="font-weight:700;text-align:center;">${rank}</td><td style="font-weight:600;color:#f1f5f9;">${item.name||item.provider||'Provider'}</td><td style="color:#94a3b8;font-size:12px;">${item.model||'-'}</td><td style="font-family:monospace;font-weight:600;color:#38bdf8;">${latText}</td><td>${badge}</td><td>${item.error?`<span style="font-size:11px;color:#f87171;">${item.error}</span>`:'–'}</td></tr>`;
    }).join('');
    toast('Benchmark selesai!', 'ok');
  } catch(e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f87171;padding:20px;">Gagal: ${e.message}</td></tr>`;
    toast('Benchmark gagal: ' + e.message, 'err');
  } finally { if (btn) { btn.disabled = false; btn.textContent = '⚡ Test Semua Provider (Parallel Benchmark)'; } }
}
