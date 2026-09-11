// ========================================================
// Bre AI v3.0 - Telegram Commands: Engine, Style, Telemetry
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  getMetrics,
  getLogs,
  getRouterOverview,
  testSingleModel,
  STYLE_LABELS
} = require('../../../api/_shared');
const api = require('../api');

async function handle(ctx) {
  const { msg, botService, text, lowerText, chatId, fromUser, senderName, senderTag, token, isOwnerUser, queryBreAIRouter } = ctx;

  // /stats, /telemetry, /overview
  if (lowerText === '/stats' || lowerText.startsWith('/stats ') || lowerText === '/telemetry' || lowerText.startsWith('/telemetry ') || lowerText === '/overview' || lowerText.startsWith('/overview ')) {
    const rawArg = lowerText.replace(/^\/(stats|telemetry|overview)/, '').trim();
    let range = 'today';
    if (['24h', '24 jam', '1d'].includes(rawArg)) range = '24h';
    else if (['7d', '7 hari', '1w'].includes(rawArg)) range = '7d';
    else if (['30d', '30 hari', '1m'].includes(rawArg)) range = '30d';
    else if (['60d', 'all', 'semua'].includes(rawArg)) range = '60d';

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

    const recents = (overview.recentRequests || []).slice(0, 4);
    let recentStr = '';
    if (recents.length > 0) {
      recentStr = '\n\n⏱️ *Aktivitas Terakhir:*\n' + recents.map(r => {
        const statusIcon = r.status >= 200 && r.status < 400 ? '🟢' : '🔴';
        const snippet = (r.requestSummary || r.model || '').slice(0, 35);
        return `${statusIcon} \`${r.model}\` (${r.provider || 'router'}) — _${r.when || 'baru saja'}_: "${snippet}..."`;
      }).join('\n');
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: range === 'today' ? '🔘 Today' : 'Today', callback_data: 'adm_telemetry_range:today' },
          { text: range === '24h' ? '🔘 24h' : '24h', callback_data: 'adm_telemetry_range:24h' },
          { text: range === '7d' ? '🔘 7D' : '7D', callback_data: 'adm_telemetry_range:7d' },
          { text: range === '60d' ? '🔘 All' : 'All', callback_data: 'adm_telemetry_range:60d' }
        ],
        [
          { text: '📊 Buka Admin Panel', callback_data: 'adm_main' },
          { text: '🔄 Refresh', callback_data: `adm_telemetry_range:${range}` }
        ]
      ]
    };

    await api.sendTelegramMessage(
      chatId,
      `📊 *Statistik & Telemetry Bre AI*\n` +
      `📅 *Periode:* *${rangeLabel}*\n\n` +
      `• 📈 *Total Permintaan:* \`${totalReq} req\` (${successReq} sukses · ${failedReq} error)\n` +
      `• 📥 *Input Tokens:* \`${inTokens} token\`\n` +
      `• 💾 *Cached Tokens:* \`${cachedTokens} token\` (Diskon Cache Hit)\n` +
      `• 📤 *Output Tokens:* \`${outTokens} token\`\n` +
      `• 🪙 *Total Tokens:* \`${totalTokens} token\`\n` +
      `• 💵 *Estimasi Biaya:* \`${estCost}\`\n` +
      `• ⚡ *Rata-rata Latensi:* \`${avgLat} ms\` (TTFT: ~${avgTtft} ms)\n` +
      `• 🛡️ *Tingkat Error:* \`${errRate}\`` +
      recentStr +
      `\n\n_Ketik \`/stats [today|24h|7d|30d]\` atau pilih tombol periode di bawah._`,
      replyMarkup,
      null,
      token
    );
    return true;
  }


  // /metrics
  if (text === '/metrics') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const m = getMetrics();
    const metricsText = `📊 *Laporan Metrik Real-Time Bre AI*\n\n` +
      `• *Total Permintaan:* ${m.totalRequests.toLocaleString()} (${m.successfulRequests} sukses · ${m.failedRequests} gagal)\n` +
      `• *Total Token Diproses:* ${m.totalTokens.toLocaleString()} token\n` +
      `• *Tingkat Kegagalan (Error Rate):* ${m.errorRate}\n` +
      `• *Rata-Rata Latensi:* ${m.avgLatencyMs} ms\n` +
      `• *Cache RAM:* ${m.cacheSize} item\n` +
      `• *Sesi Percakapan:* ${botService.conversations.size} sesi`;
    await api.sendTelegramMessage(chatId, metricsText, null, null, token);
    return true;
  }


  // /logs
  if (text === '/logs' || text.startsWith('/logs ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const logs = getLogs().slice(0, 5);
    let logMsg = `📜 *5 Log Permintaan Terakhir:*\n\n`;
    if (!logs.length) {
      logMsg += `_Belum ada riwayat aktivitas terekam di memori._`;
    } else {
      logs.forEach((l, i) => {
        const time = l.timeStr || (l.timestamp ? new Date(l.timestamp).toLocaleTimeString('id-ID') : '-');
        const st = l.status >= 400 ? `🔴 ${l.status}` : `🟢 ${l.status}`;
        logMsg += `${i+1}. [${time}] *${l.provider || 'API'}* (${l.model || '-'})\n   Status: ${st} | ${l.latencyMs || 0}ms\n`;
        if (l.error) logMsg += `   ⚠️ Error: \`${l.error.slice(0, 60)}\`\n`;
      });
    }
    await api.sendTelegramMessage(chatId, logMsg, null, null, token);
    return true;
  }


  // /benchmark
  if (text === '/benchmark') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cfg = getConfig();
    const eps = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];
    if (!eps.length) {
      await api.sendTelegramMessage(chatId, '⚠️ Tidak ada endpoint provider yang terdaftar.', null, null, token);
      return true;
    }

    await api.sendTelegramMessage(chatId, '⏳ Sedang menguji latensi seluruh provider secara paralel...', null, null, token);
    const results = await Promise.all(
      eps.map(async (ep, idx) => {
        const testRes = await testSingleModel(ep, ep.models?.[0] || 'mercury-2');
        return {
          name: ep.name || `Provider #${idx+1}`,
          model: ep.models?.[0] || 'mercury-2',
          ok: testRes.ok,
          latencyMs: testRes.latencyMs || 0,
          error: testRes.error || null
        };
      })
    );

    results.sort((a, b) => {
      if (a.ok && !b.ok) return -1;
      if (!a.ok && b.ok) return 1;
      return a.latencyMs - b.latencyMs;
    });

    let benchText = `🏆 *Leaderboard Kecepatan Provider:*\n\n`;
    results.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}.`));
      const st = r.ok ? `🟢 ${r.latencyMs}ms` : `🔴 Gagal (${r.error?.slice(0, 30) || 'Error'})`;
      benchText += `${medal} *${r.name}* (\`${r.model}\`): ${st}\n`;
    });
    await api.sendTelegramMessage(chatId, benchText, null, null, token);
    return true;
  }

  // /setmode [public|diizinkan]

  // /settemp [0.0-2.0]
  if (lowerText.startsWith('/settemp')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const val = parseFloat(text.slice(8).trim());
    if (isNaN(val) || val < 0 || val > 2.0) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/settemp [0.0 - 2.0]\` (Contoh: \`/settemp 0.7\`)`, null, null, token);
      return true;
    }
    saveConfig({ temperature: val });
    await api.sendTelegramMessage(chatId, `✅ Suhu kreativitas (temperature) diubah ke: \`${val}\``, null, null, token);
    return true;
  }


  // /setprompt [text]
  if (lowerText.startsWith('/setprompt')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const newPrompt = text.slice(10).trim();
    if (!newPrompt) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/setprompt [isi system prompt baru Anda]\``, null, null, token);
      return true;
    }
    saveConfig({ systemPrompt: newPrompt });
    await api.sendTelegramMessage(chatId, `✅ Master System Prompt berhasil diperbarui!`, null, null, token);
    return true;
  }


  // /style, /gayabahasa, /gaya — OWNER ONLY — sets global Indonesian dialect style
  if (lowerText === '/style' || lowerText.startsWith('/style ') || lowerText === '/gayabahasa' || lowerText.startsWith('/gayabahasa ') || lowerText === '/gaya' || lowerText.startsWith('/gaya ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(
        chatId,
        `🔒 *Perintah ini hanya untuk Owner Bot.*\n\nGaya bahasa diatur secara global oleh owner. Bre AI otomatis mendeteksi bahasa yang kamu pakai dan menyesuaikan responnya. 😊`,
        null, null, token
      );
      return true;
    }

    const rawArg = text.replace(/^\/(style|gayabahasa|gaya)/i, '').trim().toLowerCase();
    const styleEntries = Object.entries(STYLE_LABELS);

    if (rawArg) {
      const matchKey = Object.keys(STYLE_LABELS).find(k => k === rawArg || k.replace('_', '') === rawArg.replace(/[\s_-]/g, ''));
      if (matchKey) {
        // Save globally to config.telegramStyle (applies to ALL Indonesian responses bot-wide)
        await saveConfig({ telegramStyle: matchKey, defaultStyle: matchKey });
        await api.sendTelegramMessage(
          chatId,
          `✅ *Gaya Bahasa Global Berhasil Diubah!*\n\n• *Gaya Aktif:* ${STYLE_LABELS[matchKey]}\n\n_Gaya ini berlaku global untuk seluruh respons Bahasa Indonesia Bre AI di bot ini._`,
          null, null, token
        );
        return true;
      } else {
        const styleList = Object.entries(STYLE_LABELS).map(([k, v]) => `• \`/style ${k}\` — ${v}`).join('\n');
        await api.sendTelegramMessage(chatId, `⚠️ *Gaya "${rawArg}" tidak dikenal.*\n\nPilihan gaya yang tersedia:\n${styleList}`, null, null, token);
        return true;
      }
    }

    const cfg2 = getConfig();
    const currentStyle = cfg2.telegramStyle || cfg2.defaultStyle || 'jakarta';
    const styleRows = styleEntries.map(([code, label]) => ([
      {
        text: (code === currentStyle ? '✅ ' : '') + label,
        callback_data: `set_style:${chatId}:${code}`
      }
    ]));
    styleRows.push([{ text: '❌ Tutup', callback_data: `set_style:${chatId}:close` }]);

    const styleText = `🎭 *Pilih Gaya Bahasa Global Bre AI*\n\n` +
      `Gaya aktif saat ini: *${STYLE_LABELS[currentStyle] || '✨ Santai & Friendly'}*\n\n` +
      `Gaya ini berlaku global untuk SEMUA respons Bahasa Indonesia di bot ini.\n` +
      `_Gunakan \`/style [nama_gaya]\` untuk langsung mengubah, atau pilih tombol:_`;

    await api.sendTelegramMessage(chatId, styleText, { inline_keyboard: styleRows }, null, token);
    return true;
  }


  // /language, /bahasa, /lang, /setlang, /setbahasa — DIHAPUS
  // Bahasa sekarang otomatis mengikuti bahasa pesan masing-masing pengguna.
  if (
    lowerText === '/language' || lowerText.startsWith('/language ') ||
    lowerText === '/bahasa' || lowerText.startsWith('/bahasa ') ||
    lowerText === '/lang' || lowerText.startsWith('/lang ') ||
    lowerText === '/setlang' || lowerText.startsWith('/setlang ') ||
    lowerText === '/setbahasa' || lowerText.startsWith('/setbahasa ')
  ) {
    await api.sendTelegramMessage(
      chatId,
      `🌐 *Pengaturan Bahasa Otomatis*\n\nBre AI sekarang otomatis mendeteksi bahasa yang kamu pakai dan menjawab dalam bahasa yang sama!\n\n` +
      `• Tulis dalam Bahasa Indonesia → Bre AI balas dalam Bahasa Indonesia 🇮🇩\n` +
      `• Write in English → Bre AI replies in English 🇺🇸\n` +
      `• 日本語で書く → 日本語で返信します 🇯🇵\n` +
      `• ...dan seterusnya untuk semua bahasa.\n\n` +
      `_Tidak perlu setting apa pun. Cukup tulis pakai bahasa yang kamu mau!_ ✨`,
      null, null, token
    );
    return true;
  }



  return false;
}

module.exports = { handle };
