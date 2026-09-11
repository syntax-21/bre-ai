// ================================================================
// admin/details.js - Request Inspector & Logs table
// ================================================================

async function load9RouterDetails() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_router_details' })
    });
    if (!r.ok) return;
    const data = await r.json();
    routerDetailsData = Array.isArray(data.requests) ? data.requests : [];
    allLogs = routerDetailsData;
    populateDetailProviderDropdown();
    filterAndRenderDetailsTable();
  } catch(e) { console.error('load9RouterDetails error:', e); }
}

function populateDetailProviderDropdown() {
  const sel = document.getElementById('detailProviderSelect');
  if (!sel) return;
  const currentVal = sel.value;
  const providers = new Set();
  routerDetailsData.forEach(req => { if(req.provider) providers.add(req.provider); });
  if (endpoints?.length) endpoints.forEach(ep => { if(ep.name) providers.add(ep.name); });
  sel.innerHTML = '<option value="all">All Providers</option>' +
    Array.from(providers).map(p => `<option value="${escapeHtml(p)}" ${p === currentVal ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
}

function setDetailDatePreset(preset) {
  const startInp = document.getElementById('detailStartDate');
  const endInp = document.getElementById('detailEndDate');
  if (!startInp || !endInp) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const toStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const offsets = { today: 0, '24h': 1, '7d': 7, '30d': 30 };
  const days = offsets[preset] || 0;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  startInp.value = toStr(start);
  endInp.value = toStr(now);
  detailCurrentPage = 1;
  filterAndRenderDetailsTable();
}

function clearDetailFilters() {
  ['detailProviderSelect','detailStartDate','detailEndDate','detailSearchInput'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { if(id === 'detailProviderSelect') el.value = 'all'; else el.value = ''; }
  });
  detailCurrentPage = 1;
  filterAndRenderDetailsTable();
}

function filterAndRenderDetailsTable() {
  const tbody = document.getElementById('detailsTableBody');
  const pageInfo = document.getElementById('detailPaginationInfo');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  if (!tbody) return;
  const provFilter = document.getElementById('detailProviderSelect')?.value || 'all';
  const startFilter = document.getElementById('detailStartDate')?.value;
  const endFilter = document.getElementById('detailEndDate')?.value;
  const query = (document.getElementById('detailSearchInput')?.value || '').toLowerCase().trim();
  let filtered = routerDetailsData;
  if (provFilter !== 'all') filtered = filtered.filter(r => (r.provider||'').toLowerCase() === provFilter.toLowerCase());
  if (startFilter) {
    let startD = new Date(startFilter); if(startFilter.length===10) startD.setHours(0,0,0,0);
    const st = startD.getTime(); if(!isNaN(st)) filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= st);
  }
  if (endFilter) {
    let endD = new Date(endFilter); if(endFilter.length===10) endD.setHours(23,59,59,999);
    const et = endD.getTime(); if(!isNaN(et)) filtered = filtered.filter(r => new Date(r.timestamp).getTime() <= et);
  }
  if (query) {
    filtered = filtered.filter(r =>
      (r.ip && r.ip.toLowerCase().includes(query)) || (r.provider && r.provider.toLowerCase().includes(query)) ||
      (r.model && r.model.toLowerCase().includes(query)) || (r.requestSummary && r.requestSummary.toLowerCase().includes(query)) ||
      (r.error && r.error.toLowerCase().includes(query)) || String(r.status).includes(query)
    );
  }
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / detailPageSize));
  if (detailCurrentPage > totalPages) detailCurrentPage = totalPages;
  if (detailCurrentPage < 1) detailCurrentPage = 1;
  const startIdx = (detailCurrentPage - 1) * detailPageSize;
  const pageItems = filtered.slice(startIdx, startIdx + detailPageSize);
  if (pageInfo) pageInfo.textContent = `Showing ${pageItems.length ? startIdx+1 : 0}-${startIdx+pageItems.length} of ${totalFiltered} requests`;
  if (btnPrev) btnPrev.disabled = detailCurrentPage <= 1;
  if (btnNext) btnNext.disabled = detailCurrentPage >= totalPages;
  if (!pageItems.length) { tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:35px;">Tidak ada request yang sesuai filter.</td></tr>`; return; }
  tbody.innerHTML = pageItems.map(req => {
    const d = new Date(req.timestamp);
    const dateStr = d.toLocaleDateString([],{month:'2-digit',day:'2-digit',year:'2-digit'})+', '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    const isOk = req.status >= 200 && req.status < 400;
    const cachedBadge = req.cached ? '<span class="ping-badge ok" style="font-size:11px;">⚡ RAM</span>' : '<span style="color:#64748b;">-</span>';
    const ttftStr = req.ttftMs ? ` (TTFT: ${req.ttftMs}ms)` : '';
    return `<tr>
      <td style="font-size:12px;color:#94a3b8;font-family:monospace;white-space:nowrap;">${dateStr}</td>
      <td><code style="background:#060911;padding:2px 7px;border-radius:4px;color:#38bdf8;font-size:12px;">${req.model||'-'}</code></td>
      <td style="font-weight:600;color:#f1f5f9;">${req.provider||'-'}</td>
      <td style="font-family:monospace;color:#fb923c;font-size:12.5px;">${(req.inputTokens||0).toLocaleString()}</td>
      <td>${cachedBadge}</td>
      <td style="color:#64748b;font-size:12px;">-</td>
      <td style="font-family:monospace;color:#4ade80;font-size:12.5px;">${(req.outputTokens||req.tokens||0).toLocaleString()}</td>
      <td style="font-family:monospace;font-size:12.5px;color:#38bdf8;">${req.latencyMs||0}ms<span style="font-size:10px;color:#64748b;">${ttftStr}</span></td>
      <td style="text-align:right;"><button class="btn btn-outline" style="padding:3px 10px;font-size:12px;border-color:#1e293b;" onclick="openRequestDetail('${req.id}')">Detail</button></td>
    </tr>`;
  }).join('');
}

function changeDetailPage(delta) {
  detailCurrentPage += delta;
  filterAndRenderDetailsTable();
}

function openRequestDetail(id) {
  const req = (routerDetailsData||[]).find(r=>r.id===id) || (routerOverviewData?.recentRequests||[]).find(r=>r.id===id) || (allLogs||[]).find(r=>r.id===id);
  if (!req) return toast('Data request tidak ditemukan', 'err');
  const modal = document.getElementById('requestDetailModal');
  if (!modal) return;
  const statusBadge = document.getElementById('modalReqStatusBadge');
  if (statusBadge) { const isOk=req.status>=200&&req.status<400; statusBadge.className=isOk?'ping-badge ok':'ping-badge fail'; statusBadge.textContent=`${req.status||200} ${isOk?'OK':'Error'}`; }
  const setTxt = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setTxt('modalReqTimestamp', `Timestamp: ${new Date(req.timestamp).toLocaleString()} (ID: ${req.id})`);
  setTxt('modalReqProvModel', `${req.provider||'Proxy'} · ${req.model||'model'}`);
  setTxt('modalReqLatency', `Total: ${req.latencyMs||0}ms ${req.ttftMs ? `| TTFT: ${req.ttftMs}ms` : ''}`);
  setTxt('modalReqTokens', `In: ${req.inputTokens||0} | Cached: ${req.cachedTokens||0} | Out: ${req.outputTokens||req.tokens||0}`);
  setTxt('modalReqCostIp', `~$${(req.cost||0).toFixed(5)} | IP: ${req.ip||'127.0.0.1'}`);
  setTxt('modalReqPrompt', req.requestSummary || '(Prompt tidak tersedia)');
  setTxt('modalReqResponse', req.responseSummary || req.error || '(Tidak ada response preview)');
  modal.style.display = 'flex';
}

function closeRequestModal() {
  const modal = document.getElementById('requestDetailModal');
  if (modal) modal.style.display = 'none';
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
      routerDetailsData = []; allLogs = [];
      filterAndRenderDetailsTable(); load9RouterData();
      toast('Semua log berhasil dibersihkan', 'ok');
    }
  } catch(e) { toast('Gagal membersihkan log: ' + e.message, 'err'); }
}
