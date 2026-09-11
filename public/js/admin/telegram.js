// ================================================================
// admin/telegram.js - Telegram Bot Controller
// ================================================================

function toggleTelegramTokenMask() {
  const inp = document.getElementById('cfgTelegramToken');
  const btn = document.getElementById('btnMaskTelegram');
  if (!inp || !btn) return;
  const isPassword = inp.type === 'password';
  inp.type = isPassword ? 'text' : 'password';
  btn.textContent = isPassword ? '🔒 Sembunyikan Token' : '👁️ Tampilkan Token';
}

function updateTelegramModelDropdown(selectedModel) {
  const sel = document.getElementById('cfgTelegramModel');
  if (!sel) return;
  const allModels = new Set();
  endpoints.forEach(ep => { if(ep.name) allModels.add(ep.name.trim()); });
  if (!allModels.size) allModels.add('Default Provider');
  allModels.delete('auto');
  sel.innerHTML = '<option value="auto">🌐 Otomatis ikuti Router AI (Rotasi)</option>' +
    Array.from(allModels).map(m => `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`).join('');
}

async function loadTelegramStatus() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'get_telegram_status' }) });
    if (!r.ok) return;
    const data = await r.json();
    const st = data.status || {};
    const badgeText = document.getElementById('tgBotBadgeText');
    const badgeLink = document.getElementById('tgBotLinkBadge');
    if (st.botInfo?.username) {
      if(badgeText) badgeText.textContent = `@${st.botInfo.username} (Buka Bot)`;
      if(badgeLink) badgeLink.href = `https://t.me/${st.botInfo.username}`;
    } else {
      if(badgeText) badgeText.textContent = 'Belum Terhubung (Token Kosong)';
      if(badgeLink) badgeLink.href = '#';
    }
  } catch(e) { console.error('loadTelegramStatus error:', e); }
}

function saveTelegramToLocalStorage() {
  try {
    const fields = { bre_tg_token: 'cfgTelegramToken', bre_tg_owner: 'cfgTelegramOwner', bre_tg_domain: 'cfgTelegramDomain', bre_tg_mode: 'cfgTelegramAccessMode', bre_tg_style: 'cfgTelegramStyle' };
    Object.entries(fields).forEach(([key, id]) => { const val = document.getElementById(id)?.value?.trim(); if(val) localStorage.setItem(key, val); });
    localStorage.setItem('bre_tg_lang', document.getElementById('cfgTelegramLanguage')?.value || 'id');
  } catch(e){}
}

function restoreTelegramFromLocalStorage() {
  try {
    const fields = { bre_tg_token: 'cfgTelegramToken', bre_tg_owner: 'cfgTelegramOwner', bre_tg_domain: 'cfgTelegramDomain' };
    Object.entries(fields).forEach(([key, id]) => { const el = document.getElementById(id); const val = localStorage.getItem(key); if(el && !el.value && val) el.value = val; });
    const selMod = document.getElementById('cfgTelegramAccessMode');
    const mod = localStorage.getItem('bre_tg_mode');
    if(selMod && mod) selMod.value = mod === 'whitelist' ? 'diizinkan' : mod;
    const selSty = document.getElementById('cfgTelegramStyle');
    const sty = localStorage.getItem('bre_tg_style');
    if(selSty && sty) selSty.value = sty;
    const selLng = document.getElementById('cfgTelegramLanguage');
    const lng = localStorage.getItem('bre_tg_lang');
    if(selLng && lng) selLng.value = lng;
  } catch(e){}
}

async function saveTelegramSetupOnly() {
  saveTelegramToLocalStorage();
  const enCheck = document.getElementById('cfgTelegramEnabled');
  if(enCheck) enCheck.checked = true;
  toast('💾 Konfigurasi Bot Telegram tersimpan!', 'ok');
  await saveAllConfig();
  await loadTelegramStatus();
}

async function restartTelegramBotService() {
  if (!adminToken) return toast('Admin token tidak ditemukan.', 'err');
  toast('♻️ Merestart service bot Telegram...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'restart_bot' }) });
    const data = await r.json();
    if(data.ok) { toast(`✅ ${data.message || 'Bot direstart'}`, 'ok'); await loadTelegramStatus(); }
    else toast(`❌ Gagal: ${data.error}`, 'err');
  } catch(e) { toast(`❌ Error: ${e.message}`, 'err'); }
}

async function stopTelegramBotService() {
  if (!adminToken) return toast('Admin token tidak ditemukan.', 'err');
  toast('🛑 Menghentikan service bot Telegram...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'stop_bot' }) });
    const data = await r.json();
    if(data.ok) { toast(`✅ ${data.message || 'Bot dihentikan'}`, 'ok'); await loadTelegramStatus(); }
    else toast(`❌ Gagal: ${data.error}`, 'err');
  } catch(e) { toast(`❌ Error: ${e.message}`, 'err'); }
}

async function setupTelegramWebhookFromDomain() {
  const token = document.getElementById('cfgTelegramToken')?.value.trim();
  if (!token) return toast('Harap masukkan TELEGRAM BOT TOKEN terlebih dahulu', 'err');
  let domain = document.getElementById('cfgTelegramDomain')?.value.trim() || window.location.host;
  domain = domain.replace(/^https?:\/\//i, '').replace(/\/api\/telegram\/?.*$/i, '').replace(/\/+$/, '');
  const domainInp = document.getElementById('cfgTelegramDomain');
  if(domainInp) domainInp.value = domain;
  const adminId = document.getElementById('cfgTelegramOwner')?.value.trim();
  const accessMode = document.getElementById('cfgTelegramAccessMode')?.value || 'public';
  saveTelegramToLocalStorage();
  let webhookUrl = `https://${domain}/api/telegram?t=${encodeURIComponent(token)}`;
  if(adminId) webhookUrl += `&o=${encodeURIComponent(adminId)}`;
  if(accessMode && accessMode !== 'public') webhookUrl += `&m=${encodeURIComponent(accessMode)}`;
  toast(`🔄 Memasang Webhook ke ${domain}...`, 'ok');
  const enCheck = document.getElementById('cfgTelegramEnabled');
  if(enCheck) enCheck.checked = true;
  await saveAllConfig();
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'setup_webhook', url: webhookUrl, token }) });
    const data = await r.json();
    if(data.ok) {
      toast(`🎉 Webhook 24/7 Berhasil Dipasang ke ${domain}!`, 'ok');
      if(data.status?.botInfo?.username) {
        const bt = document.getElementById('tgBotBadgeText'); const bl = document.getElementById('tgBotLinkBadge');
        if(bt) bt.textContent = `@${data.status.botInfo.username} (Buka Bot)`;
        if(bl) bl.href = `https://t.me/${data.status.botInfo.username}`;
      }
      loadTelegramStatus();
    } else { toast(`❌ Gagal pasang webhook: ${data.error || 'Periksa token/domain'}`, 'err'); }
  } catch(e) { toast(`Error pasang webhook: ${e.message}`, 'err'); }
}

async function testTelegramBotFlow() {
  const token = document.getElementById('cfgTelegramToken')?.value.trim();
  const adminId = document.getElementById('cfgTelegramOwner')?.value.trim();
  if (!token) return toast('Harap masukkan TELEGRAM BOT TOKEN terlebih dahulu', 'err');
  toast('⚡ Menguji koneksi bot & API...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'test_telegram', token, chatId: adminId }) });
    const data = await r.json();
    if(data.ok && data.bot) {
      const bt = document.getElementById('tgBotBadgeText'); const bl = document.getElementById('tgBotLinkBadge');
      if(bt) bt.textContent = `@${data.bot.username} (Buka Bot)`;
      if(bl) bl.href = `https://t.me/${data.bot.username}`;
      toast(data.messageSent ? `✅ Tes Berhasil! Terhubung ke @${data.bot.username} & pesan tes dikirim!` : `✅ Terhubung ke bot @${data.bot.username}`, 'ok');
      loadTelegramStatus();
    } else { toast(`❌ Tes Gagal: ${data.error || 'Token tidak valid'}`, 'err'); }
  } catch(e) { toast(`Error tes bot: ${e.message}`, 'err'); }
}

async function showDetailedTelegramStatusModal() {
  toast('🔍 Memeriksa status lengkap bot...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'get_telegram_status' }) });
    const data = await r.json();
    const st = data.status || {};
    if(st.botInfo?.username) {
      const bt = document.getElementById('tgBotBadgeText'); const bl = document.getElementById('tgBotLinkBadge');
      if(bt) bt.textContent = `@${st.botInfo.username} (Buka Bot)`;
      if(bl) bl.href = `https://t.me/${st.botInfo.username}`;
    }
    const modeText = (st.accessMode==='diizinkan'||st.accessMode==='whitelist') ? '🔒 Khusus Pengguna Diizinkan' : '🟢 Terbuka untuk Publik';
    const webhookText = st.isWebhookActive ? `🟢 Aktif 24/7 (${st.webhookUrl})` : '🟡 Belum Terhubung';
    alert(`📊 STATUS SISTEM BOT TELEGRAM BRE AI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Bot: ${st.botInfo?.username ? '@'+st.botInfo.username : '(Token belum valid)'}\n• Webhook 24/7: ${webhookText}\n• Pending Antrean: ${st.pendingUpdates||0} pesan\n• Admin ID: ${st.ownerId||'(Belum diatur)'}\n• Mode Akses: ${modeText}\n• Pengguna Terdaftar: ${st.userCount||0} akun\n• Percakapan Aktif: ${st.activeConversations||0} sesi\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${st.isWebhookActive ? '✅ Bot berjalan 24 jam nonstop.' : '💡 Klik "2. Set Webhook" untuk menghubungkan bot 24/7.'}`);
  } catch(e) { toast(`Gagal cek status: ${e.message}`, 'err'); }
}

// Backward compat aliases
async function setupTelegramWebhook() { return setupTelegramWebhookFromDomain(); }
async function testTelegramToken() { return testTelegramBotFlow(); }
async function restartTelegramBot() { return setupTelegramWebhookFromDomain(); }

// Telegram Users CRUD
let activeTgUserFilter = 'all';

function filterTelegramUsersUI(filterVal) {
  if (filterVal) {
    activeTgUserFilter = filterVal;
    ['btnTgUserAll','btnTgUserAllowed','btnTgUserBlocked'].forEach((id, idx) => {
      const modes = ['all','diizinkan','blocked'];
      const btn = document.getElementById(id);
      if (!btn) return;
      const isActive = activeTgUserFilter === modes[idx];
      btn.style.background = isActive ? '#0284c7' : 'transparent';
      btn.style.color = isActive ? '#fff' : (idx === 1 ? '#86efac' : idx === 2 ? '#fca5a5' : '#94a3b8');
    });
  }
  renderTelegramUsersTable();
}

function renderTelegramUsersTable() {
  const tbody = document.getElementById('telegramUsersTableBody');
  if (!tbody) return;
  const totalCount = telegramUsers.length;
  const allowedCount = telegramUsers.filter(u => u.role==='diizinkan'||u.role==='whitelist'||u.role==='owner').length;
  const blockedCount = telegramUsers.filter(u => u.role==='blocked').length;
  const setCount = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setCount('tgCountAll', totalCount); setCount('tgCountAllowed', allowedCount); setCount('tgCountBlocked', blockedCount);
  if (!telegramUsers.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:20px;">Belum ada daftar pengguna khusus.</td></tr>`; return; }
  const query = (document.getElementById('tgUserSearchInput')?.value || '').toLowerCase().trim();
  const filtered = telegramUsers.map((u, originalIndex) => ({ ...u, originalIndex })).filter(u => {
    if (activeTgUserFilter === 'diizinkan' && u.role === 'blocked') return false;
    if (activeTgUserFilter === 'blocked' && u.role !== 'blocked') return false;
    if (query) { const matchId=String(u.id||'').toLowerCase().includes(query); const matchUsername=String(u.username||'').toLowerCase().includes(query); const matchName=String(u.name||'').toLowerCase().includes(query); if(!matchId&&!matchUsername&&!matchName) return false; }
    return true;
  });
  if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:20px;">Tidak ada pengguna yang cocok.</td></tr>`; return; }
  tbody.innerHTML = filtered.map(u => {
    let roleBadge = '<span class="ping-badge ok">🟢 Diizinkan</span>';
    if (u.role === 'owner') roleBadge = '<span class="ping-badge ok" style="border-color:#38bdf8;color:#38bdf8;">👑 Owner</span>';
    else if (u.role === 'blocked') roleBadge = '<span class="ping-badge fail">🔴 Diblokir</span>';
    const dateStr = u.addedAt ? new Date(u.addedAt).toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'}) : '-';
    const userTag = u.username ? `@${u.username.replace(/^@/,'')}` : (u.id ? `ID: ${u.id}` : '-');
    const isAllowed = u.role === 'diizinkan' || u.role === 'whitelist';
    return `<tr>
      <td style="font-family:monospace;font-size:13px;color:#38bdf8;font-weight:600;">${userTag}</td>
      <td style="color:#f1f5f9;"><span>${u.name||'-'}</span>${u.role!=='owner'?`<button class="btn" onclick="editTelegramUserNote(${u.originalIndex})" title="Edit Catatan" style="background:transparent;border:none;color:#64748b;cursor:pointer;padding:0 4px;font-size:11px;">✏️</button>`:''}</td>
      <td>${roleBadge}</td>
      <td style="font-size:12px;color:#94a3b8;">${dateStr}</td>
      <td style="text-align:right;"><div style="display:inline-flex;gap:6px;">
        ${u.role!=='owner'?`<button class="btn btn-outline" style="font-size:11px;padding:4px 8px;${isAllowed?'color:#fca5a5;border-color:rgba(239,68,68,0.4);':'color:#86efac;border-color:rgba(34,197,94,0.4);'}" onclick="toggleTelegramUserRole(${u.originalIndex})">${isAllowed?'🔴 Blokir':'🟢 Izinkan'}</button><button class="btn btn-danger" style="font-size:11px;padding:4px 8px;" onclick="deleteTelegramUser(${u.originalIndex})">🗑️ Hapus</button>`:'<span style="font-size:12px;color:#64748b;padding:4px;">Utama</span>'}
      </div></td>
    </tr>`;
  }).join('');
}

function addTelegramUser() {
  const idInput = document.getElementById('newTgUserId');
  const nameInput = document.getElementById('newTgUserName');
  const roleSelect = document.getElementById('newTgUserRole');
  const rawVal = (idInput?.value || '').trim();
  if (!rawVal) return toast('Harap masukkan ID Telegram atau @username', 'err');
  let id = rawVal, username = '';
  if (rawVal.startsWith('@')) { username = rawVal.slice(1); id = rawVal; }
  else if (isNaN(rawVal)) { username = rawVal; }
  const name = (nameInput?.value || '').trim() || (username ? `@${username}` : `User ${id}`);
  let role = roleSelect?.value || 'diizinkan';
  if (role === 'whitelist') role = 'diizinkan';
  const existing = telegramUsers.find(u => String(u.id)===String(id)||(username&&u.username===username));
  if (existing) { existing.role = role; existing.name = name; }
  else telegramUsers.push({ id: String(id), username, name, role, addedAt: new Date().toISOString() });
  if(idInput) idInput.value = '';
  if(nameInput) nameInput.value = '';
  renderTelegramUsersTable(); saveAllConfig();
  toast(`Pengguna ${name} berhasil didaftarkan!`, 'ok');
}

function editTelegramUserNote(idx) {
  if (!telegramUsers[idx]) return;
  const current = telegramUsers[idx];
  const newName = prompt(`Ubah Nama / Catatan untuk "${current.username?'@'+current.username:current.id}":`, current.name||'');
  if (newName !== null) { telegramUsers[idx].name = newName.trim(); renderTelegramUsersTable(); saveAllConfig(); toast('Catatan pengguna diperbarui!', 'ok'); }
}

function toggleTelegramUserRole(idx) {
  if (!telegramUsers[idx]) return;
  const isAllowed = telegramUsers[idx].role === 'diizinkan' || telegramUsers[idx].role === 'whitelist';
  telegramUsers[idx].role = isAllowed ? 'blocked' : 'diizinkan';
  renderTelegramUsersTable(); saveAllConfig();
  toast(`Status ${telegramUsers[idx].name||telegramUsers[idx].id} diperbarui`, 'ok');
}

function deleteTelegramUser(idx) {
  if (!telegramUsers[idx]) return;
  const item = telegramUsers[idx];
  if (!confirm(`Hapus pengguna "${item.name||item.id}" dari daftar akses?`)) return;
  telegramUsers.splice(idx, 1);
  renderTelegramUsersTable(); saveAllConfig();
  toast('Pengguna dihapus dari daftar', 'ok');
}
