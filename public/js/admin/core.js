// ================================================================
// admin/core.js - Login, Tab navigation, Config loader, Sidebar
// ================================================================

let adminToken = '';
let endpoints = [];
let clientKeys = [];
let telegramUsers = [];
let allLogs = [];
let metricsTimer = null;

const TAB_TITLES = {
  'tab9Router': '📊 Overview & Telemetry',
  'tabDetails': '📜 Request Inspector & Logs',
  'tabProviders': '🔌 Endpoints & Routing Strategy',
  'tabEngine': '⚙️ Global AI Engine & Fallback',
  'tabTools': '🛠️ AI Tools & Prompt Studio',
  'tabSecurity': '🛡️ Keamanan, Rate Limit & Access',
  'tabTelegram': '🤖 Telegram Bot Controller',
  'tabCloud': '☁️ Cloud Storage Database',
  'tabTester': '🧪 Live Model Tester & Benchmark',
  'tabBackup': '📦 Backup, Export & Restore'
};

function switchTab(tabId, btn) {
  document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  if (btn) { btn.classList.add('active'); } else {
    const m = document.querySelector(`.sidebar-nav-item[data-tab="${tabId}"]`);
    if (m) m.classList.add('active');
  }
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
  const titleEl = document.getElementById('activeViewTitle');
  if (titleEl && TAB_TITLES[tabId]) titleEl.innerHTML = TAB_TITLES[tabId];
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }
  if (tabId === 'tab9Router') load9RouterData();
  if (tabId === 'tabDetails') load9RouterDetails();
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
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
  });
}

function updateTopActiveEndpointsCount() {
  const countEl = document.getElementById('topActiveEpsCount');
  if (!countEl) return;
  const list = Array.isArray(endpoints) ? endpoints : [];
  const activeCount = list.filter(e => e && e.status !== false && e.enabled !== false).length;
  countEl.textContent = `${activeCount}/${list.length}`;
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
      if (!metricsTimer) metricsTimer = setInterval(load9RouterData, 10000);
      toast('Login berhasil! Selamat datang di Bre AI Settings.', 'ok');
    } else {
      let err = 'Password salah';
      try { const d = await r.json(); if (d.error) err = d.error; } catch(e){}
      toast(err, 'err');
    }
  } catch(e) { toast('Gagal menghubungi server', 'err'); }
}

function doLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari panel admin?')) return;
  adminToken = '';
  try { sessionStorage.removeItem('bre_admin_pw'); } catch(e){}
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null; }
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  const pwInput = document.getElementById('pwInput');
  if (pwInput) pwInput.value = '';
  toast('Berhasil keluar (logout)', 'ok');
}

function restoreFullConfigFromLocalStorage(c) {
  try {
    const raw = localStorage.getItem('bre_full_config');
    if (!raw) return c;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return c;
    const fields = ['systemPrompt','temperature','topP','frequencyPenalty','presencePenalty','maxTokens','forceStream','clientApiKey','upstashRedisUrl','upstashRedisToken','githubToken','githubRepo','githubBranch'];
    fields.forEach(f => { if (s[f] !== undefined && s[f] !== null) c[f] = s[f]; });
    ['endpoints','clientKeys','blacklist','telegramUsers'].forEach(f => {
      if ((!c[f] || !c[f].length) && s[f] && Array.isArray(s[f]) && s[f].length) c[f] = s[f];
    });
    const tgFields = ['telegramBotToken','telegramOwnerId','telegramDomain','telegramAccessMode','telegramModel','telegramStyle','defaultStyle'];
    tgFields.forEach(f => { if (s[f] && !c[f]) c[f] = s[f]; });
  } catch(e){}
  return c;
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config', { headers: { 'Authorization': 'Bearer ' + adminToken } });
    if (!r.ok) return toast('Gagal memuat konfigurasi', 'err');
    const data = await r.json();
    let c = data.config || {};
    c = restoreFullConfigFromLocalStorage(c);

    setRoutingModeUI(c.routingStrategy || c.providerRoutingMode || 'auto');

    const fields = {
      cfgAutoFailover: v => { const el = document.getElementById('cfgAutoFailover'); if(el) el.checked = v !== false; },
      cfgCacheEnabled: v => { const el = document.getElementById('cfgCacheEnabled'); if(el) el.checked = !!v; },
    };

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ''; };
    setVal('cfgCacheTTL', c.cacheTTL || 3600);
    setVal('cfgBlacklist', (c.blacklist || []).join('\n'));
    setVal('cfgPrompt', c.systemPrompt || '');
    setVal('cfgTemp', c.temperature ?? 0.7);
    setVal('cfgTopP', c.topP ?? 1.0);
    setVal('cfgFreqPenalty', c.frequencyPenalty ?? 0.0);
    setVal('cfgPresPenalty', c.presencePenalty ?? 0.0);
    setVal('cfgMaxTokens', c.maxTokens || 16384);
    setVal('cfgStream', c.forceStream === true ? 'true' : (c.forceStream === false ? 'false' : 'auto'));
    setVal('cfgDefaultStyle', c.defaultStyle || 'santai');
    setVal('cfgClientKey', c.clientKey || c.clientApiKey || '');
    setVal('cfgRateMax', c.rateLimitMax || 5);
    setVal('cfgRateWin', c.rateLimitWindow || 30);

    const afEl = document.getElementById('cfgAutoFailover'); if(afEl) afEl.checked = c.autoFailover !== false;
    const cacheEl = document.getElementById('cfgCacheEnabled'); if(cacheEl) cacheEl.checked = !!c.cacheEnabled;

    // Telegram
    const tgEn = document.getElementById('cfgTelegramEnabled'); if(tgEn) tgEn.checked = !!c.telegramEnabled;
    setVal('cfgTelegramToken', c.telegramBotToken || '');
    setVal('cfgTelegramOwner', c.telegramOwnerId || '');
    const tgMode = document.getElementById('cfgTelegramAccessMode');
    if(tgMode) tgMode.value = c.telegramAccessMode === 'whitelist' ? 'diizinkan' : (c.telegramAccessMode || 'public');
    setVal('cfgTelegramDomain', c.telegramDomain || (window.location.host || ''));
    setVal('cfgTelegramStyle', c.telegramStyle || 'santai');
    setVal('cfgTelegramLanguage', c.telegramLanguage || 'id');

    restoreTelegramFromLocalStorage();
    telegramUsers = Array.isArray(c.telegramUsers) ? c.telegramUsers : [];
    renderTelegramUsersTable();

    // Cloud
    setVal('cfgUpstashUrl', c.upstashRedisUrl || '');
    setVal('cfgUpstashToken', c.upstashRedisToken || '');
    setVal('cfgGithubToken', c.githubToken || '');
    setVal('cfgGithubRepo', c.githubRepo || '');
    setVal('cfgGithubBranch', c.githubBranch || 'main');

    if(data.cloudStorageInfo) updateStorageBadges(data.cloudStorageInfo);

    clientKeys = Array.isArray(c.clientKeys) ? c.clientKeys : [];
    endpoints = Array.isArray(c.endpoints) ? c.endpoints : [];
    renderProviders();
    updateTestModelDropdown();
    loadTelegramStatus();
  } catch(e) { toast('Error load config: ' + e.message, 'err'); }
}

// Auto-restore login session on page refresh
window.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = sessionStorage.getItem('bre_admin_pw');
    if (saved) {
      const inp = document.getElementById('pwInput');
      if(inp) inp.value = saved;
      doLogin();
    }
  } catch(e){}

  try {
    const isCollapsed = localStorage.getItem('bre_sidebar_collapsed') === '1';
    if(isCollapsed) {
      const sidebar = document.getElementById('adminSidebar');
      const mw = document.getElementById('adminMainWrapper');
      if(sidebar) sidebar.classList.add('sidebar-collapsed');
      if(mw) mw.classList.add('sidebar-collapsed');
      const tb = sidebar?.querySelector('.sidebar-toggle-btn');
      if(tb) tb.textContent = '›';
    }
  } catch(e){}
});

document.addEventListener('keydown', (e) => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const si = document.getElementById('sidebarSearchInput');
    if(si) { si.focus(); si.select(); }
  }
});
