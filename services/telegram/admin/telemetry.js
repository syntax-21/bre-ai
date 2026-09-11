// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Telemetry & Metrics
// Created by Amirun Rayan Ariandi
// ========================================================
const { getRouterOverview } = require('../../../api/_shared');
const api = require('../api');

async function handle(cq, botService) {
  const data = cq.data || '';
  if (data !== 'adm_metrics' && !data.startsWith('adm_telemetry_range:')) {
    return false;
  }

  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;

  await api.answerCallback(cq.id, 'Memuat Telemetry...', false, token);
  const range = data.startsWith('adm_telemetry_range:') ? data.split(':')[1] : 'today';
  const overview = getRouterOverview({ timeRange: range });
  const kpi = overview.kpi || {};
  const totalReq = (kpi.totalRequests || overview.totalRequests || 0).toLocaleString();
  const successReq = (overview.successfulRequests || 0).toLocaleString();
  const failedReq = (overview.failedRequests || 0).toLocaleString();
  const inTokens = (kpi.totalInputTokens || overview.totalInputTokens || 0).toLocaleString();
  const cachedTokens = (kpi.totalCachedTokens || overview.totalCachedTokens || 0).toLocaleString();
  const outTokens = (kpi.totalOutputTokens || overview.totalOutputTokens || 0).toLocaleString();
  const totalTokens = (kpi.totalTokens || overview.totalTokens || 0).toLocaleString();
  const estCost = overview.estCostStr || `~$${(overview.estCost || 0).toFixed(4)}`;
  const avgLat = kpi.avgLatencyMs || 0;
  const avgTtft = kpi.avgTtftMs || 0;
  const errRate = kpi.errorRate || '0.0%';

  let rangeLabel = 'Hari Ini (Today)';
  if (range === '24h') rangeLabel = '24 Jam Terakhir';
  else if (range === '7d') rangeLabel = '7 Hari Terakhir';
  else if (range === '30d') rangeLabel = '30 Hari Terakhir';
  else if (range === '60d') rangeLabel = 'Semua Waktu (60 Hari)';

  let text = `📊 *Real-Time Telemetry & Performance*\n` +
    `📅 *Periode:* *${rangeLabel}*\n\n` +
    `• *Total Permintaan:* \`${totalReq} req\` (${successReq} ok · ${failedReq} error)\n` +
    `• *Input Tokens:* \`${inTokens} token\`\n` +
    `• *Cached Tokens:* \`${cachedTokens} token\` (Diskon Cache Hit)\n` +
    `• *Output Tokens:* \`${outTokens} token\`\n` +
    `• *Total Tokens:* \`${totalTokens} token\`\n` +
    `• *Estimasi Biaya:* \`${estCost}\`\n` +
    `• *Rata-Rata Latensi:* \`${avgLat} ms\` (TTFT: ~${avgTtft} ms)\n` +
    `• *Tingkat Kegagalan:* \`${errRate}\`\n` +
    `• *Sesi Chat Telegram Aktif:* ${botService.conversations.size} percakapan\n\n`;

  const topModels = (overview.usageByModel || []).slice(0, 4);
  if (topModels.length > 0) {
    text += `*Model Paling Banyak Digunakan:*\n`;
    topModels.forEach(m => {
      text += `• \`${m.model}\`: *${m.requests} req* (${m.totalTokens.toLocaleString()} tokens · ~$${(m.totalCost || 0).toFixed(4)})\n`;
    });
    text += '\n';
  }

  const recents = (overview.recentRequests || []).slice(0, 3);
  if (recents.length > 0) {
    text += `*Aktivitas Request Terakhir:*\n`;
    recents.forEach(r => {
      const statusIcon = r.status >= 200 && r.status < 400 ? '🟢' : '🔴';
      const snippet = (r.requestSummary || r.model || '').slice(0, 30);
      text += `${statusIcon} \`${r.model}\` (${r.provider || 'router'}) — _${r.when || 'baru saja'}_: "${snippet}..."\n`;
    });
  }

  const markup = {
    inline_keyboard: [
      [
        { text: range === 'today' ? '🔘 Today' : 'Today', callback_data: 'adm_telemetry_range:today' },
        { text: range === '24h' ? '🔘 24h' : '24h', callback_data: 'adm_telemetry_range:24h' },
        { text: range === '7d' ? '🔘 7D' : '7D', callback_data: 'adm_telemetry_range:7d' },
        { text: range === '60d' ? '🔘 All' : 'All', callback_data: 'adm_telemetry_range:60d' }
      ],
      [
        { text: '🔄 Refresh Data', callback_data: `adm_telemetry_range:${range}` },
        { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
      ]
    ]
  };
  await api.editTelegramMessage(chatId, messageId, text, markup, token);
  return true;
}

module.exports = { handle };
