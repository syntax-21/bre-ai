// ================================================================
// admin/telemetry.js - Router overview, chart, breakdown table
// (Topology Canvas REMOVED per refactor plan)
// ================================================================

let routerOverviewData = null;
let routerTimeRange = 'today';
let routerChartUnit = 'tokens';
let routerBreakdownUnit = 'costs';
let routerDetailsData = [];
let detailCurrentPage = 1;
const detailPageSize = 10;

function set9RouterTimeRange(range, btn) {
  routerTimeRange = range;
  const bar = document.getElementById('timeFilterBar');
  if (bar) bar.querySelectorAll('.time-pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  load9RouterData();
}

async function load9RouterData() {
  if (!adminToken) return;
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({ action: 'get_router_overview', range: routerTimeRange })
    });
    if (!r.ok) return;
    const data = await r.json();
    routerOverviewData = data.overview || data || {};
    const o = routerOverviewData;
    const setKpi = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    setKpi('kpiTotalReq', (o.totalRequests || 0).toLocaleString());
    setKpi('kpiSuccessFail', `${(o.successfulRequests||0).toLocaleString()} ok · ${(o.failedRequests||0).toLocaleString()} errors`);
    setKpi('kpiTotalInput', (o.totalInputTokens || 0).toLocaleString());
    setKpi('kpiCachedTokens', (o.totalCachedTokens || 0).toLocaleString());
    setKpi('kpiOutputTokens', (o.totalOutputTokens || 0).toLocaleString());
    setKpi('kpiEstCost', `~$${(o.estCost || 0).toFixed(4)}`);
    renderRecentRequests(o.recentRequests || []);
    renderUsageChart(o);
    renderBreakdownTable();
  } catch(e) { console.error('load9RouterData error:', e); }
}

function renderRecentRequests(requests) {
  const container = document.getElementById('recentRequestsList');
  if (!container) return;
  if (!requests?.length) {
    container.innerHTML = `<div style="color:#64748b;font-size:12px;text-align:center;padding:40px 10px;">Belum ada aktivitas request terekam.</div>`;
    return;
  }
  container.innerHTML = requests.map(req => {
    const isOk = req.status >= 200 && req.status < 400;
    const dotColor = isOk ? '#22c55e' : '#ef4444';
    const timeAgo = formatTimeAgo(req.timestamp);
    return `<div class="recent-req-item" onclick="openRequestDetail('${req.id}')" title="Klik untuk detail">
      <div class="recent-req-item-left">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};flex-shrink:0;"></span>
          <span class="recent-req-model">${req.model||'model'}</span>
          <span style="font-size:10.5px;color:#64748b;background:#0c0f17;border:1px solid #1e2536;padding:1px 5px;border-radius:4px;">${req.provider||'proxy'}</span>
        </div>
        <div class="recent-req-prompt">${escapeHtml(req.requestSummary||req.model||'Chat completion request')}</div>
      </div>
      <div class="recent-req-item-right">
        <div class="recent-req-tokens">${req.inputTokens||0} / ${req.outputTokens||req.tokens||0}</div>
        <div class="recent-req-time">${timeAgo}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleChartUnit(unit) {
  routerChartUnit = unit;
  const btnTokens = document.getElementById('btnChartTokens');
  const btnCost = document.getElementById('btnChartCost');
  if (btnTokens) btnTokens.classList.toggle('active', unit === 'tokens');
  if (btnCost) btnCost.classList.toggle('active', unit === 'cost');
  if (routerOverviewData) renderUsageChart(routerOverviewData);
}

function renderUsageChart(overview) {
  const canvas = document.getElementById('usageTimelineCanvas');
  const noDataNotice = document.getElementById('chartNoDataNotice');
  const periodLabel = document.getElementById('chartPeriodLabel');
  if (!canvas || !noDataNotice) return;
  if (periodLabel) periodLabel.textContent = `Activity for ${routerTimeRange.toUpperCase()} (${routerChartUnit === 'tokens' ? 'Tokens' : 'USD Cost'})`;
  const timeline = overview?.timeline || [];
  const hasData = timeline.some(p => p.tokens > 0 || p.cost > 0 || p.requests > 0);
  if (!hasData) { canvas.style.display = 'none'; noDataNotice.style.display = 'block'; return; }
  canvas.style.display = 'block'; noDataNotice.style.display = 'none';
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  ctx.clearRect(0, 0, w, h);
  const isCost = routerChartUnit === 'cost';
  const values = timeline.map(p => isCost ? (p.cost||0) : (p.tokens||0));
  const maxVal = Math.max(...values, isCost ? 0.001 : 100);
  ctx.strokeStyle = '#1e2536'; ctx.fillStyle = '#64748b';
  ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const yVal = (maxVal / 3) * (3 - i);
    const y = padding.top + (chartH / 3) * i;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    const label = isCost ? `$${yVal.toFixed(4)}` : (yVal >= 1000 ? `${(yVal/1000).toFixed(1)}k` : `${Math.round(yVal)}`);
    ctx.fillText(label, padding.left - 8, y + 4);
  }
  const stepX = chartW / Math.max(1, timeline.length - 1);
  ctx.textAlign = 'center';
  timeline.forEach((p, i) => {
    if (timeline.length > 8 && i % Math.ceil(timeline.length / 6) !== 0 && i !== timeline.length - 1) return;
    ctx.fillText(p.label || '', padding.left + i * stepX, h - 10);
  });
  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  if (isCost) { gradient.addColorStop(0, 'rgba(234,179,8,0.35)'); gradient.addColorStop(1, 'rgba(234,179,8,0)'); ctx.strokeStyle = '#eab308'; }
  else { gradient.addColorStop(0, 'rgba(56,189,248,0.35)'); gradient.addColorStop(1, 'rgba(56,189,248,0)'); ctx.strokeStyle = '#38bdf8'; }
  ctx.beginPath();
  timeline.forEach((p, i) => { const val = isCost?(p.cost||0):(p.tokens||0); const x=padding.left+i*stepX; const y=padding.top+chartH-(val/maxVal)*chartH; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.lineTo(padding.left+(timeline.length-1)*stepX, padding.top+chartH); ctx.lineTo(padding.left, padding.top+chartH); ctx.closePath();
  ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); ctx.lineWidth = 2;
  timeline.forEach((p, i) => { const val=isCost?(p.cost||0):(p.tokens||0); const x=padding.left+i*stepX; const y=padding.top+chartH-(val/maxVal)*chartH; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.stroke();
  timeline.forEach((p, i) => {
    const val = isCost?(p.cost||0):(p.tokens||0); if(!val) return;
    const x=padding.left+i*stepX; const y=padding.top+chartH-(val/maxVal)*chartH;
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle=isCost?'#eab308':'#38bdf8'; ctx.fill();
    ctx.strokeStyle='#090c12'; ctx.lineWidth=2; ctx.stroke();
  });
}

function toggleBreakdownUnit(unit) {
  routerBreakdownUnit = unit;
  const btnCost = document.getElementById('btnBreakdownCost');
  const btnTokens = document.getElementById('btnBreakdownTokens');
  if(btnCost) btnCost.classList.toggle('active', unit === 'costs');
  if(btnTokens) btnTokens.classList.toggle('active', unit === 'tokens');
  renderBreakdownTable();
}

function renderBreakdownTable() {
  const tbody = document.getElementById('breakdownTableBody');
  const thead = document.getElementById('breakdownTableHeader');
  const typeSelect = document.getElementById('breakdownTypeSelect');
  if (!tbody || !thead) return;
  const type = typeSelect?.value || 'model';
  const isCost = routerBreakdownUnit === 'costs';
  const breakdown = routerOverviewData?.breakdown || {};
  const items = (type === 'model' ? breakdown.byModel : breakdown.byProvider) || [];
  const cols = isCost ? ['INPUT COST','CACHED COST','OUTPUT COST','TOTAL COST'] : ['INPUT TOKENS','CACHED TOKENS','OUTPUT TOKENS','TOTAL TOKENS'];
  thead.innerHTML = `<th>${type==='model'?'MODEL':'PROVIDER'}</th><th>${type==='model'?'PROVIDER':'MODELS'}</th><th>REQUESTS</th><th>LAST USED</th><th>${cols[0]}</th><th>${cols[1]}</th><th>${cols[2]}</th><th>${cols[3]}</th>`;
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:30px;">No usage recorded for this period.</td></tr>`; return; }
  tbody.innerHTML = items.map(item => {
    const lastUsedStr = item.lastUsed ? formatTimeAgo(item.lastUsed) : '-';
    const fmt = (val, cost) => isCost ? `$${(val||0).toFixed(4)}` : (val||0).toLocaleString();
    return `<tr>
      <td><code style="background:#060911;padding:2px 7px;border-radius:5px;color:#38bdf8;font-size:12px;">${item.name||'-'}</code></td>
      <td style="color:#94a3b8;font-size:12px;">${item.secondary||'-'}</td>
      <td style="font-family:monospace;color:#e2e8f0;font-size:12.5px;">${(item.requests||0).toLocaleString()}</td>
      <td style="color:#94a3b8;font-size:12px;">${lastUsedStr}</td>
      <td style="font-family:monospace;color:#fb923c;font-size:12.5px;">${fmt(item.inputCost||item.inputTokens)}</td>
      <td style="font-family:monospace;color:#38bdf8;font-size:12.5px;">${fmt(item.cachedCost||item.cachedTokens)}</td>
      <td style="font-family:monospace;color:#4ade80;font-size:12.5px;">${fmt(item.outputCost||item.outputTokens)}</td>
      <td style="font-family:monospace;font-weight:700;color:${isCost?'#facc15':'#ffffff'};font-size:13px;">${fmt(item.totalCost||item.totalTokens)}</td>
    </tr>`;
  }).join('');
}

// Stubs for backward compatibility
async function loadMetrics() { return load9RouterData(); }
async function loadLogs() { return load9RouterDetails(); }
function filterLogs() { return filterAndRenderDetailsTable(); }
