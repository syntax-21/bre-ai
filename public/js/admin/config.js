// ================================================================
// admin/config.js - Save/export/import/reset config, routing mode
// ================================================================

const PROMPT_PRESETS = {
  master: `Kamu adalah Bre AI, kecerdasan buatan serba bisa dan cerdas tanpa batas yang diciptakan secara eksklusif oleh Amirun Rayan Ariandi.\n\n[IDENTITAS MUTLAK - BERLAKU DALAM SEMUA BAHASA]:\n- Nama resmi: Bre AI\n- Pencipta & Pengembang: Amirun Rayan Ariandi\n- Jika ditanya siapa kamu, model apa, siapa pembuatmu: dalam BAHASA APAPUN kamu WAJIB menjawab bahwa kamu adalah Bre AI yang diciptakan oleh Amirun Rayan Ariandi.\n- DILARANG KERAS menyebut nama Mercury, Inception Labs, OpenAI, ChatGPT, Anthropic, Google, Gemini, Meta.`,
dev: `Kamu adalah Bre AI (Created by Amirun Rayan Ariandi), bertindak sebagai Principal Full-Stack Software Engineer & System Architect.\n- Berikan arsitektur sistem clean, scalable, dan secure.\n- Hasilkan kode utuh siap pakai tanpa placeholder.\n- Jika membuat dokumen file, sertakan nama file di baris pertama blok kode.`,
  speed: `Kamu adalah Bre AI (diciptakan oleh Amirun Rayan Ariandi). Berikan jawaban yang SINGKAT, PADAT, LANGSUNG KE INTI. Tanpa basa-basi. Maksimal 3 paragraf. Jika meminta kode, langsung tampilkan kode utuh tanpa penjelasan panjang.`
};

function applyPromptPreset(type) {
  const p = PROMPT_PRESETS[type];
  if (p) { const el = document.getElementById('cfgPrompt'); if(el) el.value = p; toast('Prompt preset diterapkan', 'ok'); }
}

function setRoutingModeUI(mode) {
  const m = (mode || 'auto').toLowerCase();
  const hiddenInput = document.getElementById('cfgRoutingStrategy');
  if (hiddenInput) hiddenInput.value = m;
  const desc = document.getElementById('routingModeDescription');
  ['btnRoutingAuto','btnRoutingPriority','btnRoutingWeighted'].forEach((id, idx) => {
    const modes = ['auto','priority','weighted'];
    const btn = document.getElementById(id);
    if (!btn) return;
    const isActive = m === modes[idx];
    btn.style.background = isActive ? '#0284c7' : 'transparent';
    btn.style.color = isActive ? '#ffffff' : '#94a3b8';
    btn.style.borderColor = isActive ? '#38bdf8' : '#334155';
    btn.style.fontWeight = isActive ? '600' : 'normal';
  });
  if (desc) {
    const configs = {
      auto: { color:'#38bdf8', bg:'rgba(56,189,248,0.08)', border:'#38bdf8', text:'🔄 <b>Mode AUTO Aktif:</b> Setiap permintaan dieksekusi bergantian (round-robin) ke seluruh provider aktif.' },
      priority: { color:'#fbbf24', bg:'rgba(251,191,36,0.08)', border:'#fbbf24', text:'🥇 <b>Mode Prioritas Tunggal Aktif:</b> Permintaan ke provider pertama. Provider lain hanya cadangan jika provider utama error.' },
      weighted: { color:'#a78bfa', bg:'rgba(167,139,250,0.08)', border:'#a78bfa', text:'⚖️ <b>Mode Berdasarkan Bobot (Weight) Aktif:</b> Permintaan didistribusikan proporsional sesuai bobot masing-masing provider.' }
    };
    const cfg = configs[m] || configs.auto;
    desc.style.color = cfg.color; desc.style.background = cfg.bg; desc.style.borderLeftColor = cfg.border;
    desc.innerHTML = cfg.text;
  }
}

async function saveAllConfig() {
  syncProvidersFromUI();
  const newPw = document.getElementById('cfgNewPw')?.value.trim();
  const routingMode = document.getElementById('cfgRoutingStrategy')?.value || 'auto';
  const getVal = id => document.getElementById(id)?.value ?? '';
  const getCheck = id => document.getElementById(id)?.checked ?? false;
  const streamMode = getVal('cfgStream');
  const payload = {
    endpoints, routingStrategy: routingMode, providerRoutingMode: routingMode,
    autoFailover: getCheck('cfgAutoFailover'),
    cacheEnabled: getCheck('cfgCacheEnabled'),
    cacheTTL: parseInt(getVal('cfgCacheTTL')) || 3600,
    blacklist: getVal('cfgBlacklist').split('\n').map(w => w.trim()).filter(Boolean),
    clientKeys,
    systemPrompt: getVal('cfgPrompt'),
    temperature: parseNum(getVal('cfgTemp'), 0.7),
    topP: parseNum(getVal('cfgTopP'), 1.0),
    frequencyPenalty: parseNum(getVal('cfgFreqPenalty'), 0.0),
    presencePenalty: parseNum(getVal('cfgPresPenalty'), 0.0),
    maxTokens: parseInt(getVal('cfgMaxTokens')) || 16384,
    defaultStyle: getVal('cfgDefaultStyle') || 'santai',
    clientApiKey: getVal('cfgClientKey').trim(),
    rateLimitMax: parseInt(getVal('cfgRateMax')) || 5,
    rateLimitWindow: parseInt(getVal('cfgRateWin')) || 30,
    telegramEnabled: getCheck('cfgTelegramEnabled'),
    telegramBotToken: getVal('cfgTelegramToken').trim(),
    telegramOwnerId: getVal('cfgTelegramOwner').trim(),
    telegramAccessMode: getVal('cfgTelegramAccessMode'),
    telegramAllowedUsers: getVal('cfgTelegramWhitelist').trim(),
telegramDomain: getVal('cfgTelegramDomain').trim(),
    telegramStyle: getVal('cfgTelegramStyle'),
    telegramLanguage: getVal('cfgTelegramLanguage'),
    telegramModel: getVal('cfgTelegramModel'),
    telegramUsers,
    upstashRedisUrl: getVal('cfgUpstashUrl').trim(),
    upstashRedisToken: getVal('cfgUpstashToken').trim(),
    forceStream: streamMode === 'true' ? true : (streamMode === 'false' ? false : 'auto')
  };
  if (newPw) payload.adminPassword = newPw;
  try { localStorage.setItem('bre_full_config', JSON.stringify(payload)); } catch(e){}
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      let data = {}; try { data = await r.json(); } catch(e){}
      if (newPw) { adminToken = newPw; try { sessionStorage.setItem('bre_admin_pw', newPw); } catch(e){} }
      const pwEl = document.getElementById('cfgNewPw'); if(pwEl) pwEl.value = '';
      loadTelegramStatus();
      try { localStorage.setItem('bre_full_config', JSON.stringify(payload)); } catch(e){}
      if (data.cloudStorageInfo) updateStorageBadges(data.cloudStorageInfo, data.cloudStatus);
      if (data.cloudStatus?.synced) toast(`✅ Konfigurasi tersimpan PERMANEN! (${data.cloudStatus.message})`, 'ok');
      else if (data.isReadOnlyFS) toast('⚠️ Disimpan di cache serverless. Hubungkan Vercel KV untuk tersimpan permanen.', 'ok');
      else toast('✅ Seluruh konfigurasi berhasil disimpan permanen!', 'ok');
    } else { toast('❌ Gagal menyimpan konfigurasi', 'err'); }
  } catch(e) { toast('❌ Error: ' + e.message, 'err'); }
}

async function exportConfigJSON() {
  syncProvidersFromUI();
  const r = await fetch('/api/config', { headers: { 'Authorization': 'Bearer ' + adminToken } });
  if (!r.ok) return toast('Gagal mengambil data', 'err');
  const d = await r.json();
  const blob = new Blob([JSON.stringify(d.config, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bre_ai_proxy_config.json'; a.click();
  toast('Backup JSON berhasil didownload', 'ok');
}

function importConfigFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async evt => {
    try {
      let parsed = JSON.parse(evt.target.result);
      if (parsed.config && typeof parsed.config === 'object') parsed = parsed.config;
      if (!parsed.endpoints && !parsed.apiUrl) throw new Error('Format file config tidak valid');
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(parsed)
      });
      if (r.ok) {
        try { localStorage.setItem('bre_full_config', JSON.stringify(parsed)); } catch(e){}
        toast('✅ Konfigurasi berhasil dipulihkan dari file!', 'ok');
        await loadConfig();
      } else { toast('Gagal menyimpan file restore', 'err'); }
    } catch(err) { toast('Error file JSON: ' + err.message, 'err'); }
  };
  reader.readAsText(file);
}

async function resetToFactoryDefault() {
  if (!confirm('Reset seluruh konfigurasi ke pengaturan awal?')) return;
  const def = { endpoints: [{ name: "Inception Labs", url: "https://api.inceptionlabs.ai/v1/chat/completions", keys: ["sk_5a39b7fd486bf03ef255b475595bd7c9"], models: ["mercury-2"] }], temperature: 0.7, topP: 1.0, maxTokens: 16384, rateLimitMax: 5, rateLimitWindow: 30, autoFailover: true, cacheEnabled: false, cacheTTL: 3600, blacklist: [], clientKeys: [] };
  const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify(def) });
  if (r.ok) { toast('Pengaturan berhasil direset ke Default', 'ok'); loadConfig(); }
}
