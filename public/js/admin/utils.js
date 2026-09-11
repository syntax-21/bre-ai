// ================================================================
// admin/utils.js - Shared utility helpers
// ================================================================

function toast(msg, type = 'ok') {
  const container = document.getElementById('toastHub');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3000);
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

function parseNum(val, def = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? def : n;
}

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'bre_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const ckEl = document.getElementById('cfgClientKey');
  if (ckEl) ckEl.value = result;
  toast('Master API Key baru di-generate!', 'ok');
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