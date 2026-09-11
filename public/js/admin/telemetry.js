// ================================================================
// admin/telemetry.js - Router overview, Topology Canvas, chart, breakdown
// ================================================================

let routerOverviewData = null;
let routerTimeRange = 'today';
let routerChartUnit = 'tokens';
let routerBreakdownUnit = 'costs';
let routerDetailsData = [];
let detailCurrentPage = 1;
const detailPageSize = 10;

// Topology Visualizer State
let topologyZoom = 1;
let topologyPan = { x: 0, y: 0 };
let topologyIsDragging = false;
let topologyDragStart = { x: 0, y: 0 };
let topologyPulseOffset = 0;
let topologyAnimFrame = null;
let topologyInitialized = false;

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
    renderTopologyGraph();
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

// ================================================================
// TOPOLOGY VISUALIZER
// ================================================================

function drawSafeRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, width, height, r);
      return;
    } catch(e) {}
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function initTopologyVisualizer() {
  if (topologyInitialized) return;
  const canvas = document.getElementById('topologyCanvas');
  const container = document.getElementById('topologyContainer');
  if (!canvas || !container) return;
  topologyInitialized = true;

  canvas.addEventListener('mousedown', (e) => {
    topologyIsDragging = true;
    topologyDragStart = { x: e.clientX - topologyPan.x, y: e.clientY - topologyPan.y };
  });

  window.addEventListener('mousemove', (e) => {
    if (!topologyIsDragging) return;
    topologyPan.x = e.clientX - topologyDragStart.x;
    topologyPan.y = e.clientY - topologyDragStart.y;
    renderTopologyGraph();
  });

  window.addEventListener('mouseup', () => { topologyIsDragging = false; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomTopology(delta);
  }, { passive: false });

  window.addEventListener('resize', () => { renderTopologyGraph(); });
  startTopologyAnimation();
}

function startTopologyAnimation() {
  if (topologyAnimFrame) cancelAnimationFrame(topologyAnimFrame);
  function loop() {
    topologyPulseOffset = (topologyPulseOffset + 0.008) % 1;
    const tabOverview = document.getElementById('tab9Router');
    if (tabOverview && tabOverview.style.display !== 'none') {
      renderTopologyGraph();
    }
    topologyAnimFrame = requestAnimationFrame(loop);
  }
  topologyAnimFrame = requestAnimationFrame(loop);
}

function zoomTopology(delta) {
  topologyZoom = Math.max(0.5, Math.min(2.5, topologyZoom + delta));
  renderTopologyGraph();
}

function resetTopology() {
  topologyZoom = 1;
  topologyPan = { x: 0, y: 0 };
  renderTopologyGraph();
}

function toggleTopologyFullscreen() {
  const container = document.getElementById('topologyContainer');
  if (!container) return;
  if (!document.fullscreenElement) {
    container.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

function renderTopologyGraph() {
  const canvas = document.getElementById('topologyCanvas');
  if (!canvas) return;
  initTopologyVisualizer();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  try {
    ctx.clearRect(0, 0, w, h);

    // 1. Background subtle mesh grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    const gridSize = Math.max(16, 24 * topologyZoom);
    const offsetX = ((topologyPan.x % gridSize) + gridSize) % gridSize;
    const offsetY = ((topologyPan.y % gridSize) + gridSize) % gridSize;

    for (let x = offsetX; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = offsetY; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Center coordinates with pan & zoom
    const cx = w / 2 + topologyPan.x;
    const cy = h / 2 + topologyPan.y;

    // 2. Resolve Active Endpoints from all available sources
    let activeProviders = [];
    if (typeof endpoints !== 'undefined' && Array.isArray(endpoints) && endpoints.length > 0) {
      activeProviders = endpoints;
    } else if (Array.isArray(routerOverviewData?.topology?.endpoints) && routerOverviewData.topology.endpoints.length > 0) {
      activeProviders = routerOverviewData.topology.endpoints;
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem('bre_full_config') || '{}');
        if (Array.isArray(saved.endpoints) && saved.endpoints.length > 0) {
          activeProviders = saved.endpoints;
        }
      } catch(e) {}
    }

    if (!activeProviders || !activeProviders.length) {
      activeProviders = [
        { name: 'Inception Labs', models: ['mercury-2'], status: true },
        { name: 'OpenAI Upstream', models: ['gpt-4o'], status: true },
        { name: 'Groq Cloud', models: ['llama-3.3-70b'], status: true }
      ];
    }

    const count = activeProviders.length;
    const radius = Math.min(w, h) * 0.35 * topologyZoom;

    // Calculate Satellite Provider Node Positions
    const providerNodes = activeProviders.map((prov, i) => {
      let angle;
      if (count === 1) {
        angle = 0;
      } else if (count === 2) {
        angle = i === 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      }
      return {
        name: prov.name || `Provider #${i + 1}`,
        models: (Array.isArray(prov.models) && prov.models.length) ? prov.models : ['default'],
        status: prov.status !== false,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle: angle
      };
    });

    // 3. Draw Curved Connecting Links & Animated Flow Pulses
    providerNodes.forEach((node, i) => {
      const isActive = node.status;
      const strokeColor = isActive ? 'rgba(56, 189, 248, 0.4)' : 'rgba(100, 116, 139, 0.25)';

      const midX = (cx + node.x) / 2;
      const midY = (cy + node.y) / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(midX, midY, node.x, node.y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(1, 2 * topologyZoom);
      ctx.stroke();

      // Animated Glowing Packets / Pulses
      if (isActive) {
        const pulseT = (topologyPulseOffset + (i / count)) % 1;
        const px = (1 - pulseT) * (1 - pulseT) * cx + 2 * (1 - pulseT) * pulseT * midX + pulseT * pulseT * node.x;
        const py = (1 - pulseT) * (1 - pulseT) * cy + 2 * (1 - pulseT) * pulseT * midY + pulseT * pulseT * node.y;

        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, 4.5 * topologyZoom), 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 4. Draw Center Hub Node (Router Core)
    const centerRadius = Math.max(20, 32 * topologyZoom);

    // Pulsing Outer Ripple
    const ringScale = 1 + (topologyPulseOffset * 0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius * ringScale, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 * (1 - topologyPulseOffset)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center Solid Core Circle
    ctx.beginPath();
    ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
    const coreGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, centerRadius);
    coreGrad.addColorStop(0, '#0284c7');
    coreGrad.addColorStop(1, '#091e3a');
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.5, 3 * topologyZoom);
    ctx.stroke();

    // Center Core Label
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, 13 * topologyZoom)}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Bre Router', cx, cy + Math.max(3, 4.5 * topologyZoom));

    // 5. Draw Satellite Provider Nodes
    providerNodes.forEach(node => {
      const nodeW = Math.max(80, 130 * topologyZoom);
      const nodeH = Math.max(32, 48 * topologyZoom);
      const nx = node.x - nodeW / 2;
      const ny = node.y - nodeH / 2;
      const r = Math.max(4, 8 * topologyZoom);

      // Node Card Box
      drawSafeRoundRect(ctx, nx, ny, nodeW, nodeH, r);
      ctx.fillStyle = node.status ? '#0f172a' : '#090d16';
      ctx.fill();
      ctx.strokeStyle = node.status ? '#38bdf8' : '#334155';
      ctx.lineWidth = Math.max(1, 1.5 * topologyZoom);
      ctx.stroke();

      // Status Indicator Dot
      const dotX = nx + Math.max(8, 14 * topologyZoom);
      const dotY = ny + Math.max(10, 16 * topologyZoom);
      const dotR = Math.max(2.5, 4 * topologyZoom);

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = node.status ? '#22c55e' : '#ef4444';
      ctx.shadowColor = node.status ? '#22c55e' : '#ef4444';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Provider Name Text
      ctx.fillStyle = '#f1f5f9';
      ctx.font = `600 ${Math.max(9, 12 * topologyZoom)}px 'Inter', sans-serif`;
      ctx.textAlign = 'left';
      const nameToDraw = node.name.length > 13 ? node.name.slice(0, 12) + '..' : node.name;
      ctx.fillText(nameToDraw, nx + Math.max(16, 24 * topologyZoom), ny + Math.max(12, 19 * topologyZoom));

      // Primary Model Badge Text
      ctx.fillStyle = '#38bdf8';
      ctx.font = `500 ${Math.max(8, 10 * topologyZoom)}px 'JetBrains Mono', monospace`;
      const primaryModel = node.models[0] || 'default';
      const modelToDraw = primaryModel.length > 16 ? primaryModel.slice(0, 15) + '..' : primaryModel;
      ctx.fillText(modelToDraw, nx + Math.max(8, 12 * topologyZoom), ny + Math.max(22, 36 * topologyZoom));
    });

  } catch (err) {
    console.error('Error rendering topology canvas:', err);
  }
}

// ================================================================
// USAGE CHART & BREAKDOWN
// ================================================================

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
