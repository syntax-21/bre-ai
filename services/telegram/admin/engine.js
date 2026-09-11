// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Engine AI & Parameters
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  STYLE_LABELS,
  STYLE_PROMPTS
} = require('../../../api/_shared');
const api = require('../api');
const { PROMPT_PRESETS, LANGUAGE_LABELS } = require('./menuBuilder');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const cfg = getConfig();

  if (data === 'adm_engine') {
    await answerCallback(cq.id, null, false, token);
    const temp = cfg.temperature ?? 0.7;
    const topP = cfg.topP ?? 1.0;
    const freq = cfg.frequencyPenalty ?? 0.0;
    const pres = cfg.presencePenalty ?? 0.0;
    const maxTok = cfg.maxTokens || 16384;
    const stream = cfg.forceStream === true ? 'Paksa Aktif' : (cfg.forceStream === false ? 'Paksa Mati' : 'Auto');
    const cache = cfg.cacheEnabled ? `🟢 Aktif (${cfg.cacheTTL || 3600}s)` : '🔴 Nonaktif';

    const text = `⚙️ *Konfigurasi Global Engine & Parameter AI*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Temperature (Kreativitas):* \`${temp}\`\n` +
      `• *Top-P Sampling:* \`${topP}\`\n` +
      `• *Frequency / Presence Penalty:* \`${freq} / ${pres}\`\n` +
      `• *Max Output Tokens:* \`${maxTok}\`\n` +
      `• *Mode Streaming:* \`${stream}\`\n` +
      `• *In-Memory Cache (RAM):* ${cache}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih parameter yang ingin diubah:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🎭 Master System Prompt', callback_data: 'adm_prompt_menu' },
          { text: `🌡️ Suhu: ${temp}`, callback_data: 'adm_params' }
        ],
        [
          { text: `🎛️ Top-P: ${topP}`, callback_data: 'adm_topp_menu' },
          { text: `🎚️ Penalties (${freq}/${pres})`, callback_data: 'adm_penalty_menu' }
        ],
        [
          { text: `🔢 Max Tokens: ${maxTok}`, callback_data: 'adm_tokens_menu' },
          { text: `🌊 Stream: ${stream}`, callback_data: 'adm_stream_menu' }
        ],
        [
          { text: `⚡ Cache RAM: ${cfg.cacheEnabled ? 'ON' : 'OFF'}`, callback_data: 'adm_cache_menu' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 5a. System Prompt Presets
  if (data === 'adm_prompt_menu') {
    await answerCallback(cq.id, null, false, token);
    const currentSnippet = (cfg.systemPrompt || '').slice(0, 150) + '...';
    const text = `🎭 *Master System Prompt Persona*\n\n` +
      `*Cuplikan System Prompt Saat Ini:*\n` +
      `_${currentSnippet}_\n\n` +
      `Pilih preset siap pakai di bawah, atau gunakan perintah \`/setprompt [teks]\` untuk instruksi khusus:`;

    const markup = {
      inline_keyboard: [
        [
          { text: '⚡ Persona Standar Bre AI', callback_data: 'adm_setprompt:master' }
        ],
        [
          { text: '💻 Developer & Software Architect', callback_data: 'adm_setprompt:dev' }
        ],
        [
          { text: '🚀 Ringkas, Padat & To-The-Point', callback_data: 'adm_setprompt:speed' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setprompt:')) {
    const pType = data.split(':')[1];
    const promptText = PROMPT_PRESETS[pType];
    if (promptText) {
      saveConfig({ systemPrompt: promptText });
      await answerCallback(cq.id, `✅ Preset Prompt [${pType}] diterapkan!`, true, token);
    }
    cq.data = 'adm_prompt_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 5b. Temperature Selector
  if (data === 'adm_params') {
    await answerCallback(cq.id, null, false, token);
    const temp = cfg.temperature ?? 0.7;
    const text = `🌡️ *Pilih Tingkat Suhu Kreativitas (Temperature)*\n\n` +
      `Suhu saat ini: *${temp}*\n\n` +
      `• *0.2 Presisi:* Sangat konsisten, koding, matematika.\n` +
      `• *0.7 Seimbang:* Alami, responsif, percakapan umum.\n` +
      `• *1.0 Kreatif:* Penulisan kreatif, brainstorming ide.\n` +
      `• *1.5 Liar / Ekstrem:* Sangat variatif dan eksperimental.`;

    const markup = {
      inline_keyboard: [
        [
          { text: temp === 0.2 ? '✅ 🎯 0.2 (Presisi)' : '🎯 0.2 (Presisi)', callback_data: 'adm_settemp:0.2' },
          { text: temp === 0.7 ? '✅ ⚖️ 0.7 (Seimbang)' : '⚖️ 0.7 (Seimbang)', callback_data: 'adm_settemp:0.7' }
        ],
        [
          { text: temp === 1.0 ? '✅ 🎨 1.0 (Kreatif)' : '🎨 1.0 (Kreatif)', callback_data: 'adm_settemp:1.0' },
          { text: temp === 1.5 ? '✅ 🚀 1.5 (Liar)' : '🚀 1.5 (Liar)', callback_data: 'adm_settemp:1.5' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_settemp:')) {
    const newTemp = parseFloat(data.split(':')[1]);
    saveConfig({ temperature: newTemp });
    await answerCallback(cq.id, `✅ Suhu diubah ke: ${newTemp}`, false, token);
    cq.data = 'adm_params';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 5c. Top-P Menu
  if (data === 'adm_topp_menu') {
    await answerCallback(cq.id, null, false, token);
    const topP = cfg.topP ?? 1.0;
    const text = `🎛️ *Pilih Top-P Nucleus Sampling*\n\n` +
      `Top-P saat ini: *${topP}*\n` +
      `Top-P membatasi distribusi probabilitas token untuk mengontrol keanekaragaman kata.`;

    const markup = {
      inline_keyboard: [
        [
          { text: topP === 0.5 ? '✅ 0.5' : '0.5', callback_data: 'adm_settopp:0.5' },
          { text: topP === 0.8 ? '✅ 0.8' : '0.8', callback_data: 'adm_settopp:0.8' }
        ],
        [
          { text: topP === 0.9 ? '✅ 0.9' : '0.9', callback_data: 'adm_settopp:0.9' },
          { text: topP === 1.0 ? '✅ 1.0 (Default)' : '1.0 (Default)', callback_data: 'adm_settopp:1.0' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_settopp:')) {
    const val = parseFloat(data.split(':')[1]);
    saveConfig({ topP: val });
    await answerCallback(cq.id, `✅ Top-P diubah ke: ${val}`, false, token);
    cq.data = 'adm_topp_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 5d. Penalties Menu
  if (data === 'adm_penalty_menu') {
    await answerCallback(cq.id, null, false, token);
    const freq = cfg.frequencyPenalty ?? 0.0;
    const pres = cfg.presencePenalty ?? 0.0;
    const text = `🎚️ *Pengaturan Frequency & Presence Penalty*\n\n` +
      `Saat ini: Frequency Penalty = \`${freq}\`, Presence Penalty = \`${pres}\`\n\n` +
      `• *Frequency Penalty:* Mencegah pengulangan kata yang sama.\n` +
      `• *Presence Penalty:* Mendorong model membahas topik-topik baru.`;

    const markup = {
      inline_keyboard: [
        [
          { text: (freq === 0.0 && pres === 0.0) ? '✅ Standar (0.0 / 0.0)' : 'Standar (0.0 / 0.0)', callback_data: 'adm_setpenalty:0.0:0.0' }
        ],
        [
          { text: (freq === 0.5 && pres === 0.5) ? '✅ Moderat (0.5 / 0.5)' : 'Moderat (0.5 / 0.5)', callback_data: 'adm_setpenalty:0.5:0.5' }
        ],
        [
          { text: (freq === 1.0 && pres === 1.0) ? '✅ Anti-Repetisi Kuat (1.0 / 1.0)' : 'Anti-Repetisi Kuat (1.0 / 1.0)', callback_data: 'adm_setpenalty:1.0:1.0' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setpenalty:')) {
    const parts = data.split(':');
    const freq = parseFloat(parts[1]);
    const pres = parseFloat(parts[2]);
    saveConfig({ frequencyPenalty: freq, presencePenalty: pres });
    await answerCallback(cq.id, `✅ Penalties diubah ke ${freq} / ${pres}`, false, token);
    cq.data = 'adm_penalty_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 5e. Max Output Tokens Menu
  if (data === 'adm_tokens_menu') {
    await answerCallback(cq.id, null, false, token);
    const maxTok = cfg.maxTokens || 16384;
    const text = `🔢 *Pilih Batas Maksimal Token Output (Max Tokens)*\n\n` +
      `Batas saat ini: *${maxTok} tokens*`;

    const markup = {
      inline_keyboard: [
        [
          { text: maxTok === 4096 ? '✅ 4,096' : '4,096', callback_data: 'adm_settokens:4096' },
          { text: maxTok === 8192 ? '✅ 8,192' : '8,192', callback_data: 'adm_settokens:8192' }
        ],
        [
          { text: maxTok === 16384 ? '✅ 16,384 (Default)' : '16,384 (Default)', callback_data: 'adm_settokens:16384' },
          { text: maxTok === 32768 ? '✅ 32,768 (Max)' : '32,768 (Max)', callback_data: 'adm_settokens:32768' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_settokens:')) {
    const val = parseInt(data.split(':')[1]);
    saveConfig({ maxTokens: val });
    await answerCallback(cq.id, `✅ Max Tokens diubah ke: ${val}`, false, token);
    cq.data = 'adm_tokens_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 5f. Streaming Mode Menu
  if (data === 'adm_stream_menu') {
    await answerCallback(cq.id, null, false, token);
    const st = cfg.forceStream === true ? 'true' : (cfg.forceStream === false ? 'false' : 'auto');
    const text = `🌊 *Pengaturan Mode Streaming Respon*\n\n` +
      `Mode saat ini: *${st === 'true' ? 'Paksa Streaming' : (st === 'false' ? 'Paksa Non-Streaming' : 'Auto (Ikuti Klien)')}*`;

    const markup = {
      inline_keyboard: [
        [
          { text: st === 'auto' ? '✅ 🌐 Auto (Ikuti Klien)' : '🌐 Auto (Ikuti Klien)', callback_data: 'adm_setstream:auto' }
        ],
        [
          { text: st === 'true' ? '✅ ⚡ Paksa Streaming Aktif' : '⚡ Paksa Streaming Aktif', callback_data: 'adm_setstream:true' }
        ],
        [
          { text: st === 'false' ? '✅ ⚪ Paksa Non-Streaming' : '⚪ Paksa Non-Streaming', callback_data: 'adm_setstream:false' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setstream:')) {
    const val = data.split(':')[1];
    const streamVal = val === 'true' ? true : (val === 'false' ? false : 'auto');
    saveConfig({ forceStream: streamVal });
    await answerCallback(cq.id, `✅ Mode stream diubah ke: ${val}`, false, token);
    cq.data = 'adm_stream_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 5g. Response Cache Menu
  if (data === 'adm_cache_menu') {
    await answerCallback(cq.id, null, false, token);
    const isCache = !!cfg.cacheEnabled;
    const ttl = cfg.cacheTTL || 3600;
    const text = `⚡ *In-Memory Response Caching (RAM)*\n\n` +
      `Status Cache: *${isCache ? '🟢 Aktif' : '🔴 Nonaktif'}*\n` +
      `Masa Berlaku (TTL): *${ttl} detik* (${Math.round(ttl/60)} menit)\n\n` +
      `_Respon prompt identik non-streaming akan dijawab instan (0ms) dari RAM server._`;

    const markup = {
      inline_keyboard: [
        [
          { text: isCache ? '🔴 Matikan Cache' : '🟢 Aktifkan Cache', callback_data: 'adm_cache_toggle' }
        ],
        [
          { text: ttl === 900 ? '✅ 15 Menit' : '15 Menit', callback_data: 'adm_setcachettl:900' },
          { text: ttl === 3600 ? '✅ 1 Jam (Default)' : '1 Jam (Default)', callback_data: 'adm_setcachettl:3600' }
        ],
        [
          { text: ttl === 21600 ? '✅ 6 Jam' : '6 Jam', callback_data: 'adm_setcachettl:21600' },
          { text: ttl === 86400 ? '✅ 24 Jam' : '24 Jam', callback_data: 'adm_setcachettl:86400' }
        ],
        [
          { text: '⬅️ Konfigurasi Engine', callback_data: 'adm_engine' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_cache_toggle') {
    const next = !cfg.cacheEnabled;
    saveConfig({ cacheEnabled: next });
    await answerCallback(cq.id, `Cache RAM ${next ? 'Diaktifkan 🟢' : 'Dinonaktifkan 🔴'}`, false, token);
    cq.data = 'adm_cache_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data.startsWith('adm_setcachettl:')) {
    const ttl = parseInt(data.split(':')[1]);
    saveConfig({ cacheTTL: ttl });
    await answerCallback(cq.id, `✅ Cache TTL diubah ke: ${ttl}s`, false, token);
    cq.data = 'adm_cache_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // ----------------------------------------------------
  // 6. SECURITY & CLIENT KEYS
  // ----------------------------------------------------

  if (data === 'adm_style') {
    await answerCallback(cq.id, null, false, token);
    const currentStyle = cfg.telegramStyle || cfg.defaultStyle || 'santai';
    const styleText = `🎭 *Pengaturan Gaya Bahasa Default Bot Telegram:*\n` +
      `Gaya aktif saat ini: *${STYLE_LABELS[currentStyle] || '✨ Santai & Friendly'}*\n\n` +
      `Pilih gaya bahasa yang diinginkan untuk respons default Bre AI:\n` +
      `_(Pengguna juga dapat memilih gaya bahasa masing-masing dengan perintah /style)_\n\n` +
      `• *Jakarta:* Gaul santai akrab (gue-lu, nih, dong, asik)\n` +
      `• *Jawa Halus:* Kromo Inggil sangat santun & penuh rasa hormat\n` +
      `• *Jawa Kasar:* Ngoko / Arekan medok akrab layaknya sahabat karib\n` +
      `• *Sunda:* Dialek ramah, hangat, dan sopan khas urang Sunda\n` +
      `• *Sopan & Formal:* Bahasa baku elegan dan profesional\n` +
      `• *Santai & Friendly:* Ceria, hangat, dan menyenangkan\n` +
      `• *Medan / Batak:* Enerjik, bersemangat, dan blak-blakan (Horas!)\n` +
      `• *Makassar / Bugis:* Ramah khas Sulawesi (Tabe', mantapji tawwa)`;

    const styleRows = Object.entries(STYLE_LABELS).map(([code, label]) => ([
      {
        text: (code === currentStyle ? '✅ ' : '') + label,
        callback_data: `adm_setstyle:${code}`
      }
    ]));
    styleRows.push([{ text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }]);

    await editTelegramMessage(chatId, messageId, styleText, { inline_keyboard: styleRows }, token);
    return;
  }

  if (data.startsWith('adm_setstyle:')) {
    const newStyle = data.split(':')[1];
    const styleLabel = STYLE_LABELS[newStyle] || newStyle;
    saveConfig({ telegramStyle: newStyle });
    await answerCallback(cq.id, `✅ Gaya bahasa default diubah ke: ${styleLabel}`, true, token);

    cq.data = 'adm_style';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }


  if (data === 'adm_language') {
    await answerCallback(cq.id, null, false, token);
    const currentLang = cfg.telegramLanguage || 'id';
    const langText = `🌐 *Pengaturan Bahasa Default Bot:*\n` +
      `Bahasa aktif: *${LANGUAGE_LABELS[currentLang] || 'Bahasa Indonesia'}*\n\n` +
      `Pilih bahasa default respons Bre AI untuk semua pengguna bot:\n` +
      `_(Pengguna individual dapat mengubah bahasa mereka sendiri dengan perintah /language)_`;

    const langRows = Object.entries(LANGUAGE_LABELS).map(([code, label]) => ([
      {
        text: (code === currentLang ? '✅ ' : '') + label,
        callback_data: `adm_setlang:${code}`
      }
    ]));
    langRows.push([{ text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }]);

    await editTelegramMessage(chatId, messageId, langText, { inline_keyboard: langRows }, token);
    return;
  }

  if (data.startsWith('adm_setlang:')) {
    const newLang = data.split(':')[1];
    const langLabel = LANGUAGE_LABELS[newLang] || newLang;
    saveConfig({ telegramLanguage: newLang });
    await answerCallback(cq.id, `✅ Bahasa default diubah ke: ${langLabel}`, true, token);

    cq.data = 'adm_language';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }


  return false;
}

module.exports = { handle };
