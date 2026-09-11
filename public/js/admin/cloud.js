// ================================================================
// admin/cloud.js - Cloud storage, Upstash, GitHub sync
// ================================================================

async function loadCloudStorageStatus(interactive = false) {
  if (!adminToken) return;
  if (interactive) toast('🔍 Memeriksa status penyimpanan cloud...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'get_cloud_status' }) });
    if (!r.ok) return;
    const data = await r.json();
    if (data.status) {
      updateStorageBadges(data.status);
      if (interactive) {
        const st = data.status;
        if (st.upstashInvalidUrl) alert('⚠️ URL UPSTASH TIDAK VALID!\n\nGunakan URL REST API yang berakhiran .upstash.io, bukan URL browser console.');
        else if (st.upstashActive) alert('✅ Vercel KV / Upstash Redis Aktif 🟢\nSeluruh konfigurasi tersimpan permanen di cloud database.');
        else if (st.githubActive) alert('✅ GitHub Auto-Commit Aktif 🟢\nPerubahan di-commit otomatis ke repositori GitHub.');
        else alert('ℹ️ Local Disk & Browser Storage Aktif.\nBot Telegram berjalan 24/7 serverless tanpa database cloud.');
      }
    }
  } catch(e) { if(interactive) toast('Gagal memeriksa status: ' + e.message, 'err'); }
}

function updateStorageBadges(info) {
  const headerBadge = document.getElementById('storageHeaderBadge');
  const cardBadge = document.getElementById('cloudStatusBadge');
  const cardTitle = document.getElementById('cloudStatusTitle');
  const cardDesc = document.getElementById('cloudStatusExplanation');
  if (!info) return;
  const set = (badge, cls, txt, title, desc) => {
    if(badge) { badge.className = `ping-badge ${cls}`; badge.textContent = txt; }
    if(cardTitle) cardTitle.textContent = title;
    if(cardDesc) cardDesc.innerHTML = desc;
  };
  if (info.upstashInvalidUrl) {
    if(cardBadge) { cardBadge.className = 'ping-badge fail'; cardBadge.textContent = '🔴 URL Console (Bukan REST API)'; }
    if(cardTitle) cardTitle.textContent = 'URL Upstash Salah (Gunakan URL .upstash.io)';
    if(cardDesc) cardDesc.innerHTML = '<span style="color:#f87171;font-weight:600;">⚠️ URL yang dimasukkan adalah URL browser console.</span><br>Gunakan <code>UPSTASH_REDIS_REST_URL</code> yang berakhiran <code>.upstash.io</code>.';
  } else if (info.upstashActive) {
    if(headerBadge) { headerBadge.className = 'ping-badge ok'; headerBadge.textContent = '🟢 Vercel KV Aktif'; }
    if(cardBadge) { cardBadge.className = 'ping-badge ok'; cardBadge.textContent = '🟢 Vercel KV / Upstash Redis Aktif'; }
    if(cardTitle) cardTitle.textContent = 'Penyimpanan Permanen Cloud Aktif (Vercel KV / Redis)';
    if(cardDesc) cardDesc.innerHTML = 'Database Redis serverless terhubung. Seluruh konfigurasi tersimpan permanen (<20ms) dan tidak akan hilang meskipun Vercel restart.';
  } else if (info.githubActive) {
    if(headerBadge) { headerBadge.className = 'ping-badge ok'; headerBadge.textContent = '🟢 GitHub Sync Aktif'; }
    if(cardBadge) { cardBadge.className = 'ping-badge ok'; cardBadge.textContent = '🟢 GitHub Auto-Commit Aktif'; }
    if(cardTitle) cardTitle.textContent = 'Sinkronisasi Otomatis Repositori GitHub Aktif';
    if(cardDesc) cardDesc.innerHTML = 'Setiap klik <b>Simpan</b> langsung commit ke <code>config.json</code> di repositori GitHub Anda.';
  } else if (info.isServerless) {
    if(headerBadge) { headerBadge.className = 'ping-badge ok'; headerBadge.textContent = '🟢 Serverless 24/7 (Zero-DB)'; }
    if(cardBadge) { cardBadge.className = 'ping-badge ok'; cardBadge.textContent = '🟢 Serverless Mode Aktif (Tanpa DB)'; }
    if(cardTitle) cardTitle.textContent = 'Sistem Bot Berjalan 24 Jam Nonstop';
    if(cardDesc) cardDesc.innerHTML = '✅ Bot Telegram menggunakan arsitektur <b>Self-Contained Webhook</b>. Bot otomatis aktif 24 jam di Vercel tanpa database cloud!';
  } else {
    if(headerBadge) { headerBadge.className = 'ping-badge ok'; headerBadge.textContent = '💾 Local Disk (config.json)'; }
    if(cardBadge) { cardBadge.className = 'ping-badge ok'; cardBadge.textContent = '🟢 File Lokal (config.json)'; }
    if(cardTitle) cardTitle.textContent = 'Penyimpanan File Lokal Aktif';
    if(cardDesc) cardDesc.innerHTML = 'Berjalan di server lokal/VPS dengan akses tulis langsung ke <code>config.json</code>.';
  }
}

async function testUpstashConnection() {
  const url = document.getElementById('cfgUpstashUrl')?.value.trim();
  const token = document.getElementById('cfgUpstashToken')?.value.trim();
  if (!url || !token) return toast('Masukkan URL dan Token Upstash Redis terlebih dahulu', 'err');
  toast('⚡ Menguji koneksi ke Vercel KV / Upstash Redis...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'test_upstash', url, token }) });
    const data = await r.json();
    if (data.ok) { toast('🎉 ' + data.message, 'ok'); await saveAllConfig(); }
    else toast('❌ Gagal terhubung ke Upstash: ' + (data.error || 'Unknown error'), 'err');
  } catch(e) { toast('Error pengujian Upstash: ' + e.message, 'err'); }
}

async function testGitHubConnection() {
  const token = document.getElementById('cfgGithubToken')?.value.trim();
  const repo = document.getElementById('cfgGithubRepo')?.value.trim();
  const branch = document.getElementById('cfgGithubBranch')?.value.trim() || 'main';
  if (!token || !repo) return toast('Masukkan GitHub Token dan Nama Repositori (user/repo)', 'err');
  toast('⚡ Menguji koneksi ke GitHub API...', 'ok');
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken }, body: JSON.stringify({ action: 'test_github', token, repo, branch }) });
    const data = await r.json();
    if (data.ok) { toast('🎉 ' + data.message, 'ok'); await saveAllConfig(); }
    else toast('❌ Gagal terhubung ke GitHub: ' + (data.error || 'Periksa token & nama repo'), 'err');
  } catch(e) { toast('Error pengujian GitHub: ' + e.message, 'err'); }
}

function toggleUpstashTokenMask() {
  const inp = document.getElementById('cfgUpstashToken');
  const btn = document.getElementById('btnMaskUpstash');
  if (!inp || !btn) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.textContent = isPass ? '🔒 Sembunyikan' : '👁️ Tampilkan';
}

function toggleGithubTokenMask() {
  const inp = document.getElementById('cfgGithubToken');
  const btn = document.getElementById('btnMaskGithub');
  if (!inp || !btn) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.textContent = isPass ? '🔒 Sembunyikan' : '👁️ Tampilkan';
}
