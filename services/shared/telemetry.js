// ========================================================
// Bre AI - 9Router Observability, Telemetry & Cost Engine
// Dipisah dari api/_shared.js agar berkas inti lebih ringan.
// ========================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const { sanitizeErrorMessage } = require('./prompt');

const LOGS_PATH = path.join(process.env.BRE_DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'bre-data') : path.join(process.cwd(), 'data')), 'request_logs.json');
const MAX_LOGS = 500;
let requestLogs = [];
let saveLogsTimeout = null;

const metricsStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokens: 0,
  totalLatencyMs: 0,
  providerHits: Object.create(null),
  modelHits: Object.create(null)
};

function loadPersistedLogs() {
  try {
    if (fs.existsSync(LOGS_PATH)) {
      const raw = fs.readFileSync(LOGS_PATH, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        requestLogs = data.slice(0, MAX_LOGS);
        requestLogs.forEach(logItem => {
          metricsStats.totalRequests++;
          if (logItem.status >= 200 && logItem.status < 400) {
            metricsStats.successfulRequests++;
          } else {
            metricsStats.failedRequests++;
          }
          metricsStats.totalTokens += (logItem.totalTokens || logItem.tokens || 0);
          metricsStats.totalLatencyMs += (logItem.latencyMs || 0);
          const prov = logItem.provider || 'unknown';
          metricsStats.providerHits[prov] = (metricsStats.providerHits[prov] || 0) + 1;
          const mod = logItem.model || 'unknown';
          metricsStats.modelHits[mod] = (metricsStats.modelHits[mod] || 0) + 1;
        });
      }
    }
  } catch (e) {
    console.warn('[Telemetry] Error loading request_logs.json:', e.message);
  }
}
loadPersistedLogs();

function savePersistedLogs() {
  if (saveLogsTimeout) clearTimeout(saveLogsTimeout);
  saveLogsTimeout = setTimeout(() => {
    try {
      const dataDir = path.dirname(LOGS_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(LOGS_PATH, JSON.stringify(requestLogs.slice(0, MAX_LOGS), null, 2), 'utf8');
    } catch (e) {
      console.warn('[Telemetry] Error saving request_logs.json:', e.message);
    }
  }, 500);
}

const MODEL_PRICING = {
  'mercury-2': { input: 0.15, output: 0.60, cached: 0.05 },
  'mercury-preview': { input: 0.15, output: 0.60, cached: 0.05 },
  'gpt-4o': { input: 2.50, output: 10.00, cached: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, cached: 0.075 },
  'gpt-5': { input: 3.00, output: 12.00, cached: 1.50 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00, cached: 0.30 },
  'claude-3-opus': { input: 15.00, output: 75.00, cached: 1.50 },
  'deepseek-chat': { input: 0.14, output: 0.28, cached: 0.014 },
  'deepseek-v3': { input: 0.14, output: 0.28, cached: 0.014 },
  'deepseek-ai/deepseek-v4': { input: 0.18, output: 0.36, cached: 0.018 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, cached: 0.14 },
  'deepseek-r1': { input: 0.55, output: 2.19, cached: 0.14 },
  'gemini-2.5-flash': { input: 0.10, output: 0.40, cached: 0.025 },
  'gemini-3.6-flash-medium': { input: 0.15, output: 0.60, cached: 0.035 },
  'qwen/qwen3.8-27b': { input: 0.20, output: 0.60, cached: 0.05 },
  'minimax-m3': { input: 0.20, output: 0.80, cached: 0.05 },
  'minimax-m2.7': { input: 0.20, output: 0.80, cached: 0.05 },
  'kimi-k2.6': { input: 0.30, output: 1.00, cached: 0.08 },
  'kat-coder-pro-v2.5': { input: 0.25, output: 0.90, cached: 0.06 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79, cached: 0.10 },
  'blackboxai/blackbox-pro': { input: 0.20, output: 0.60, cached: 0.05 },
  'default': { input: 0.20, output: 0.60, cached: 0.05 }
};

function calculateCost(modelName, inTok = 0, outTok = 0, cacheTok = 0) {
  const m = String(modelName || '').toLowerCase();
  let pricing = MODEL_PRICING['default'];
  const sortedKeys = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (m.includes(key.toLowerCase())) {
      pricing = MODEL_PRICING[key];
      break;
    }
  }
  const inputCost = (Math.max(0, inTok - cacheTok) / 1_000_000) * pricing.input;
  const outputCost = (outTok / 1_000_000) * pricing.output;
  const cachedCost = (cacheTok / 1_000_000) * pricing.cached;
  const totalCost = inputCost + outputCost + cachedCost;
  return {
    inputCost: Number(inputCost.toFixed(6)),
    outputCost: Number(outputCost.toFixed(6)),
    cachedCost: Number(cachedCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6))
  };
}

const responseCache = new Map();

function sanitizeLogSummary(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(password|passwd|pass|secret|token|api_key|apikey)["']?\s*[:=]\s*["']?[^"'\s,]+/gi, '$1: [REDACTED]')
    .slice(0, 150);
}

function logRequest(entry) {
  const inTok = Number(entry.inputTokens || entry.promptTokens || (entry.tokens ? Math.round(entry.tokens * 0.4) : 0)) || 0;
  const outTok = Number(entry.outputTokens || entry.completionTokens || (entry.tokens ? Math.round(entry.tokens * 0.6) : 0)) || 0;
  const cacheTok = Number(entry.cachedTokens || (entry.cached ? inTok : 0)) || 0;
  const cacheCreateTok = Number(entry.cacheCreationTokens || 0);
  const totalTok = (inTok + outTok) || Number(entry.tokens || 0);
  const costs = calculateCost(entry.model, inTok, outTok, cacheTok);
  const nowMs = entry.timeMs || Date.now();

  const logItem = {
    id: entry.id || ('req_' + nowMs + '_' + Math.random().toString(36).slice(2, 7)),
    timestamp: entry.timestamp || new Date(nowMs).toISOString(),
    timeStr: new Date(nowMs).toLocaleTimeString('id-ID'),
    timeMs: nowMs,
    ip: entry.ip || '127.0.0.1',
    provider: entry.provider || 'Inception Labs',
    model: entry.model || 'mercury-2',
    status: entry.status || 200,
    latencyMs: Number(entry.latencyMs || 0),
    ttftMs: Number(entry.ttftMs || Math.round((entry.latencyMs || 0) * 0.3)),
    inputTokens: inTok,
    outputTokens: outTok,
    cachedTokens: cacheTok,
    cacheCreationTokens: cacheCreateTok,
    tokens: totalTok,
    totalTokens: totalTok,
    inputCost: costs.inputCost,
    outputCost: costs.outputCost,
    cachedCost: costs.cachedCost,
    totalCost: costs.totalCost,
    failover: Boolean(entry.failover),
    cached: Boolean(entry.cached || cacheTok > 0),
    error: entry.error ? sanitizeErrorMessage(entry.error) : null,
    requestSummary: sanitizeLogSummary(entry.requestSummary || ''),
    responseSummary: sanitizeLogSummary(entry.responseSummary || ''),
    clientKeyName: entry.clientKeyName || 'Direct Web'
  };

  requestLogs.unshift(logItem);
  if (requestLogs.length > MAX_LOGS) requestLogs.pop();

  metricsStats.totalRequests++;
  if (logItem.status >= 200 && logItem.status < 400) {
    metricsStats.successfulRequests++;
  } else {
    metricsStats.failedRequests++;
  }
  metricsStats.totalTokens += totalTok;
  metricsStats.totalLatencyMs += logItem.latencyMs;

  const prov = logItem.provider;
  metricsStats.providerHits[prov] = (metricsStats.providerHits[prov] || 0) + 1;

  const mod = logItem.model;
  metricsStats.modelHits[mod] = (metricsStats.modelHits[mod] || 0) + 1;

  savePersistedLogs();
  return logItem;
}

function getLogs() {
  return requestLogs.map(l => ({ ...l }));
}

function clearLogs() {
  requestLogs.length = 0;
  metricsStats.totalRequests = 0;
  metricsStats.successfulRequests = 0;
  metricsStats.failedRequests = 0;
  metricsStats.totalTokens = 0;
  metricsStats.totalLatencyMs = 0;
  metricsStats.providerHits = Object.create(null);
  metricsStats.modelHits = Object.create(null);
  savePersistedLogs();
}

function getMetrics() {
  const avgLatency = metricsStats.totalRequests > 0
    ? Math.round(metricsStats.totalLatencyMs / metricsStats.totalRequests)
    : 0;
  const errorRate = metricsStats.totalRequests > 0
    ? ((metricsStats.failedRequests / metricsStats.totalRequests) * 100).toFixed(1)
    : '0.0';

  return {
    totalRequests: metricsStats.totalRequests,
    successfulRequests: metricsStats.successfulRequests,
    failedRequests: metricsStats.failedRequests,
    errorRate: errorRate + '%',
    totalTokens: metricsStats.totalTokens,
    avgLatencyMs: avgLatency,
    providerHits: metricsStats.providerHits,
    modelHits: metricsStats.modelHits,
    cacheSize: responseCache.size
  };
}

function generateTimelineBuckets(logs, timeRange, now) {
  const is24hOrToday = timeRange === 'today' || timeRange === '24h';
  const buckets = [];

  if (is24hOrToday) {
    const startOfPeriod = timeRange === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : now - 24 * 60 * 60 * 1000;
    const bucketDurationMs = (now - startOfPeriod) / 12 || 2 * 3600 * 1000;

    for (let i = 0; i < 12; i++) {
      const bStart = startOfPeriod + i * bucketDurationMs;
      const bEnd = bStart + bucketDurationMs;
      const d = new Date(bStart);
      const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let tokens = 0;
      let cost = 0;
      let requests = 0;

      logs.forEach(r => {
        if (r.timeMs >= bStart && r.timeMs < bEnd) {
          tokens += (r.totalTokens || (r.inputTokens + r.outputTokens) || 0);
          cost += (r.totalCost || 0);
          requests++;
        }
      });

      buckets.push({ label, tokens, cost: Number(cost.toFixed(6)), requests });
    }
  } else {
    const days = timeRange.toLowerCase() === '7d' ? 7 : (timeRange.toLowerCase() === '30d' ? 30 : 60);
    const dayMs = 24 * 3600 * 1000;
    for (let i = days - 1; i >= 0; i--) {
      const bStart = now - (i + 1) * dayMs;
      const bEnd = now - i * dayMs;
      const d = new Date(bStart);
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      let tokens = 0;
      let cost = 0;
      let requests = 0;

      logs.forEach(r => {
        if (r.timeMs >= bStart && r.timeMs < bEnd) {
          tokens += (r.totalTokens || (r.inputTokens + r.outputTokens) || 0);
          cost += (r.totalCost || 0);
          requests++;
        }
      });

      buckets.push({ label, tokens, cost: Number(cost.toFixed(6)), requests });
    }
  }

  return buckets;
}

function getRouterOverview(opts = {}) {
  const { getConfig } = require('./configStore');
  const options = typeof opts === 'string' ? { timeRange: opts } : (opts || {});
  const timeRange = options.timeRange || options.range || 'today';
  const provider = options.provider || 'all';
  const model = options.model || 'all';

  const now = Date.now();
  let timeLimitMs = 0;
  if (timeRange === 'today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    timeLimitMs = todayStart.getTime();
  } else if (timeRange === '24h') {
    timeLimitMs = now - (24 * 60 * 60 * 1000);
  } else if (timeRange === '7d' || timeRange === '7D') {
    timeLimitMs = now - (7 * 24 * 60 * 60 * 1000);
  } else if (timeRange === '30d' || timeRange === '30D') {
    timeLimitMs = now - (30 * 24 * 60 * 60 * 1000);
  } else if (timeRange === '60d' || timeRange === '60D') {
    timeLimitMs = now - (60 * 24 * 60 * 60 * 1000);
  }

  const filtered = requestLogs.filter(item => {
    if (timeLimitMs && item.timeMs < timeLimitMs) return false;
    if (provider !== 'all' && (item.provider || '').toLowerCase() !== provider.toLowerCase()) return false;
    if (model !== 'all' && (item.model || '').toLowerCase() !== model.toLowerCase()) return false;
    return true;
  });

  let totalRequests = filtered.length;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalCost = 0;
  let totalLatency = 0;
  let totalTtft = 0;
  let errorCount = 0;

  const modelMap = new Map();
  const providerMap = new Map();

  filtered.forEach(r => {
    totalInputTokens += (r.inputTokens || 0);
    totalOutputTokens += (r.outputTokens || 0);
    totalCachedTokens += (r.cachedTokens || 0);
    totalCost += (r.totalCost || 0);
    totalLatency += (r.latencyMs || 0);
    totalTtft += (r.ttftMs || 0);
    if (r.status >= 400) errorCount++;

    const mKey = r.model || 'unknown';
    if (!modelMap.has(mKey)) {
      modelMap.set(mKey, {
        model: mKey,
        name: mKey,
        provider: r.provider,
        secondary: r.provider,
        requests: 0,
        lastUsed: r.timestamp,
        lastUsedMs: r.timeMs,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        inputCost: 0,
        cachedCost: 0,
        outputCost: 0,
        totalCost: 0
      });
    }
    const mStat = modelMap.get(mKey);
    mStat.requests++;
    if (r.timeMs > mStat.lastUsedMs) {
      mStat.lastUsed = r.timestamp;
      mStat.lastUsedMs = r.timeMs;
      mStat.provider = r.provider;
      mStat.secondary = r.provider;
    }
    mStat.inputTokens += (r.inputTokens || 0);
    mStat.outputTokens += (r.outputTokens || 0);
    mStat.cachedTokens += (r.cachedTokens || 0);
    mStat.totalTokens += (r.totalTokens || 0);
    mStat.inputCost += (r.inputCost || 0);
    mStat.cachedCost += (r.cachedCost || 0);
    mStat.outputCost += (r.outputCost || 0);
    mStat.totalCost += (r.totalCost || 0);

    const pKey = r.provider || 'unknown';
    if (!providerMap.has(pKey)) {
      providerMap.set(pKey, {
        provider: pKey,
        name: pKey,
        requests: 0,
        lastUsed: r.timestamp,
        lastUsedMs: r.timeMs,
        models: new Set(),
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        inputCost: 0,
        cachedCost: 0,
        outputCost: 0,
        totalCost: 0
      });
    }
    const pStat = providerMap.get(pKey);
    pStat.requests++;
    pStat.models.add(r.model);
    if (r.timeMs > pStat.lastUsedMs) {
      pStat.lastUsed = r.timestamp;
      pStat.lastUsedMs = r.timeMs;
    }
    pStat.inputTokens += (r.inputTokens || 0);
    pStat.outputTokens += (r.outputTokens || 0);
    pStat.cachedTokens += (r.cachedTokens || 0);
    pStat.totalTokens += (r.totalTokens || 0);
    pStat.inputCost += (r.inputCost || 0);
    pStat.cachedCost += (r.cachedCost || 0);
    pStat.outputCost += (r.outputCost || 0);
    pStat.totalCost += (r.totalCost || 0);
  });

  const usageByModel = Array.from(modelMap.values()).sort((a, b) => b.requests - a.requests);
  const usageByProvider = Array.from(providerMap.values()).map(p => ({
    ...p,
    secondary: `${p.models.size} model${p.models.size > 1 ? 's' : ''} (${Array.from(p.models).slice(0, 2).join(', ')})`,
    modelsCount: p.models.size,
    models: Array.from(p.models)
  })).sort((a, b) => b.requests - a.requests);

  const recentRequests = filtered.slice(0, 25).map(r => {
    const diffSec = Math.max(0, Math.floor((now - r.timeMs) / 1000));
    let when = 'just now';
    if (diffSec >= 86400) when = Math.floor(diffSec / 86400) + 'd ago';
    else if (diffSec >= 3600) when = Math.floor(diffSec / 3600) + 'h ago';
    else if (diffSec >= 60) when = Math.floor(diffSec / 60) + 'm ago';
    else if (diffSec > 5) when = diffSec + 's ago';

    return {
      id: r.id,
      timestamp: r.timestamp,
      model: r.model,
      provider: r.provider,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cachedTokens: r.cachedTokens,
      status: r.status,
      latencyMs: r.latencyMs,
      ttftMs: r.ttftMs,
      requestSummary: r.requestSummary,
      responseSummary: r.responseSummary,
      cost: r.totalCost,
      ip: r.ip,
      when
    };
  });

  const cfg = getConfig();
  const configuredEndpoints = (cfg.endpoints || []).map((ep, idx) => ({
    id: 'ep_' + idx,
    name: ep.name || ('Provider ' + (idx + 1)),
    url: ep.url,
    status: ep.status !== false,
    weight: ep.weight || 1,
    models: ep.models || [],
    keysCount: (ep.keys || []).length,
    requestsCount: providerMap.get(ep.name)?.requests || 0
  }));

  const estCostNum = Number(totalCost.toFixed(4));

  return {
    timeRange,
    totalRequests,
    successfulRequests: Math.max(0, totalRequests - errorCount),
    failedRequests: errorCount,
    totalInputTokens,
    totalCachedTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    estCost: estCostNum,
    estCostStr: `~$${totalCost.toFixed(2)}`,
    kpi: {
      totalRequests,
      totalInputTokens,
      totalCachedTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estCost: estCostNum,
      estCostStr: `~$${totalCost.toFixed(2)}`,
      avgLatencyMs: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
      avgTtftMs: totalRequests > 0 ? Math.round(totalTtft / totalRequests) : 0,
      errorRate: totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(1) + '%' : '0.0%'
    },
    recentRequests,
    usageByModel,
    usageByProvider,
    breakdown: {
      byModel: usageByModel,
      byProvider: usageByProvider
    },
    timeline: generateTimelineBuckets(filtered, timeRange, now),
    topology: {
      routerName: '9Router',
      status: 'online',
      providersCount: configuredEndpoints.length,
      activeProvidersCount: configuredEndpoints.filter(p => p.status).length,
      endpoints: configuredEndpoints
    }
  };
}

function getRouterDetails(opts = {}) {
  const options = typeof opts === 'string' ? { query: opts } : (opts || {});
  const provider = options.provider || 'all';
  const model = options.model || 'all';
  const startDate = options.startDate || '';
  const endDate = options.endDate || '';
  const search = options.search || options.query || '';
  const limit = options.limit || 100;
  const page = options.page || 1;

  let list = requestLogs;

  if (provider && provider !== 'all') {
    const pLow = provider.toLowerCase();
    list = list.filter(r => (r.provider || '').toLowerCase() === pLow);
  }

  if (model && model !== 'all') {
    const mLow = model.toLowerCase();
    list = list.filter(r => (r.model || '').toLowerCase().includes(mLow));
  }

  if (startDate) {
    const startMs = new Date(startDate).getTime();
    if (!isNaN(startMs)) list = list.filter(r => r.timeMs >= startMs);
  }

  if (endDate) {
    const endMs = new Date(endDate).getTime();
    if (!isNaN(endMs)) list = list.filter(r => r.timeMs <= endMs);
  }

  if (search) {
    const sLow = search.toLowerCase();
    list = list.filter(r =>
      (r.model || '').toLowerCase().includes(sLow) ||
      (r.provider || '').toLowerCase().includes(sLow) ||
      (r.ip || '').includes(sLow) ||
      (r.id || '').toLowerCase().includes(sLow) ||
      (r.error || '').toLowerCase().includes(sLow) ||
      (r.requestSummary || '').toLowerCase().includes(sLow) ||
      (r.responseSummary || '').toLowerCase().includes(sLow)
    );
  }

  const totalCount = list.length;
  const p = Math.max(1, parseInt(page) || 1);
  const lim = Math.max(1, parseInt(limit) || 100);
  const startIndex = (p - 1) * lim;
  const items = list.slice(startIndex, startIndex + lim);

  return {
    totalCount,
    page: p,
    limit: lim,
    totalPages: Math.ceil(totalCount / lim) || 1,
    requests: items,
    items
  };
}

function checkBlacklist(text, blacklist) {
  if (!text || typeof text !== 'string') return null;
  const list = Array.isArray(blacklist) ? blacklist : [];
  const lower = text.toLowerCase();
  for (const word of list) {
    const clean = (word || '').trim().toLowerCase();
    if (clean && lower.includes(clean)) {
      return clean;
    }
  }
  return null;
}

function getCachedResponse(key) {
  const item = responseCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedResponse(key, data, ttlSeconds = 3600) {
  if (responseCache.size >= 200) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

function clearResponseCache() {
  responseCache.clear();
}

module.exports = {
  MODEL_PRICING,
  calculateCost,
  logRequest,
  getLogs,
  clearLogs,
  getMetrics,
  getRouterOverview,
  getRouterDetails,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  clearResponseCache
};
