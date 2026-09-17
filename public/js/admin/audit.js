// ========================================================
// Bre AI v3.0 - Admin Audit Log Module
// File: public/js/admin/audit.js
// ========================================================

function fmtAuditTime(ts) {
  try {
    return new Date(ts).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
  } catch (e) {
    return new Date(ts).toISOString();
  }
}

function fmtAuditDetails(details) {
  if (!details) return '-';
  if (typeof details === 'string') return esc(details);
  if (details.keysUpdated && Array.isArray(details.keysUpdated)) {
    return 'Kunci diubah: ' + details.keysUpdated.map(k => `<code>${esc(k)}</code>`).join(', ');
  }
  try {
    return `<code>${esc(JSON.stringify(details).slice(0, 300))}</code>`;
  } catch (e) { return '-'; }
}

async function loadAuditLogs() {
  const body = document.getElementById('auditLogsBody');
  if (!body) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_audit_logs' })
    });
    if (!r.ok) throw new Error('Gagal memuat');
    const d = await r.json();
    const logs = Array.isArray(d.auditLogs) ? d.auditLogs : [];
    if (!logs.length) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">Belum ada aktivitas admin tercatat.</td></tr>';
      return;
    }
    body.innerHTML = logs.map(l => {
      const badgeColor = String(l.action).startsWith('save') ? '#34d399' : (String(l.action).includes('clear') ? '#f87171' : '#38bdf8');
      return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <td style="padding: 8px; color: #94a3b8; white-space: nowrap;">${fmtAuditTime(l.timeMs)}</td>
        <td style="padding: 8px;"><span style="color:${badgeColor};font-weight:600;">${esc(l.action)}</span></td>
        <td style="padding: 8px; color: #cbd5e1;">${esc(l.user)} <span style="color:#64748b;font-size:11px;">(${esc(l.ip)})</span></td>
        <td style="padding: 8px; color: #94a3b8;">${fmtAuditDetails(l.details)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#f87171;">Error: ${esc(e.message)}</td></tr>`;
  }
}

function clearAuditLogsConfirm() {
  if (!confirm('Hapus semua riwayat audit log? Tindakan ini permanen.')) return;
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
    body: JSON.stringify({ action: 'clear_audit_logs' })
  }).then(r => r.json()).then(() => {
    loadAuditLogs();
    toast('Audit log dibersihkan', 'ok');
  }).catch(() => toast('Gagal membersihkan audit log', 'err'));
}
