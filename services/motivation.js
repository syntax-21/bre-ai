// ========================================================
// Bre AI v3.0 - Motivasi Harian Engine
// 100% Bersumber dari Kecerdasan Buatan (Bre AI Core Router)
// Otomatis membuat & mengirim kutipan motivasi orisinil 2x sehari,
// sinkron untuk Web chat & Telegram Bot.
// Created by Amirun Rayan Ariandi
// ========================================================
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { getConfig, saveConfig } = require('../api/_shared');
const api = require('./telegram/api');

const LOG_PATH = path.join(process.cwd(), 'data', 'motivation_log.json');

// Backward compatibility alias (tidak lagi memakai array hardcoded)
const MOTIVATION_QUOTES = [];

let sentSlots = new Set();
let lastMotivation = null;

function loadLog() {
  try {
    if (fs.existsSync(LOG_PATH)) {
      const arr = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
      if (Array.isArray(arr)) sentSlots = new Set(arr);
    }
  } catch (e) { sentSlots = new Set(); }
}

function saveLog() {
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const arr = Array.from(sentSlots).slice(-400);
    fs.writeFileSync(LOG_PATH, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {}
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseSlotTime(hhmm) {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const minutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if (minutes < 0 || minutes > 1439) return null;
  return minutes;
}

/**
 * Membersihkan respons teks motivasi yang dihasilkan oleh AI
 * @param {string} rawText
 * @returns {string} Cleaned quote string
 */
function sanitizeAiQuote(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // Buang catatan Standby Engine jika ada (> 💡 *Bre AI Standby Engine:* ...)
  const standbyIdx = text.indexOf('> 💡 *Bre AI Standby Engine:*');
  if (standbyIdx !== -1) {
    text = text.slice(0, standbyIdx).trim();
  }
  const standbyIdx2 = text.indexOf('> 💡 Bre AI Standby Engine:');
  if (standbyIdx2 !== -1) {
    text = text.slice(0, standbyIdx2).trim();
  }

  // Bersihkan baris markdown blockquote (misal: > "...")
  text = text.replace(/^>\s*/gm, '').trim();

  // Bersihkan prefix pengantar AI seperti "Kutipan:", "Motivasi Hari Ini:", "Berikut kutipan:", dll
  text = text.replace(/^(kutipan|motivasi|quote|inspirasi|pesan motivasi)(\s*(hari ini|harian|pagi|sore|malam))?\s*[:：\-–—]\s*/i, '');
  text = text.replace(/^(berikut\s+(adalah\s+)?(kutipan|motivasi|kata\s+bijak|pesan)\s*[:：\-–—]?\s*)/i, '');
  text = text.replace(/^(tentu,\s*(ini|berikut)?\s*(kutipan|motivasi)?\s*[:：\-–—]?\s*)/i, '');

  // Bersihkan tanda petik pembuka dan penutup di awal & akhir
  text = text.replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();

  return text;
}

/**
 * Menghasilkan kutipan motivasi orisinil langsung dari Bre AI Router
 * @param {object} options
 * @param {string} [options.customTheme] - Arahan tema kustom dari Admin
 * @param {string} [options.slotLabel] - Label jam/slot (misal: '08:00', '19:00')
 * @returns {Promise<string>} Teks kutipan motivasi AI
 */
async function generateMotivationQuote({ customTheme = '', slotLabel = '' } = {}) {
  const cfg = getConfig();
  const chatHandler = require('../api/chat');

  // 1. Tentukan konteks waktu (Pagi / Siang / Sore / Malam)
  let timeContext = '';
  let hour = new Date().getHours();
  if (slotLabel) {
    const parts = String(slotLabel).split(':');
    const parsedH = parseInt(parts[0], 10);
    if (!isNaN(parsedH)) hour = parsedH;
  }

  if (hour >= 4 && hour < 11) {
    timeContext = 'Waktu Pengiriman: PAGI HARI. Fokus energi: Membakar semangat menyambut fajar baru, keberanian mengambil langkah pertama, antusiasme peluang, dan produktivitas tinggi.';
  } else if (hour >= 11 && hour < 17) {
    timeContext = 'Waktu Pengiriman: SIANG / SORE HARI. Fokus energi: Menjaga konsistensi, pantang menyerah di tengah keletihan, daya juang, dan keteguhan menyelesaikan target hari ini.';
  } else {
    timeContext = 'Waktu Pengiriman: MALAM HARI. Fokus energi: Refleksi bijak, apresiasi atas perjuangan hari ini, ketenangan batin, kedamaian pikiran, dan optimisme menyongsong hari esok.';
  }

  // 2. Variasi tema inspirasi agar setiap kutipan memiliki keunikan mendalam
  const VARIETY_ANGLES = [
    'filosofi ketekunan bertahap dan konsistensi jangka panjang',
    'keberanian keluar dari zona nyaman dan mengambil keputusan besar',
    'ketenangan batin serta ketegaran mental saat menghadapi tantangan',
    'menghargai potensi diri dan bertumbuh melampaui keraguan',
    'fokus pada aksi nyata daripada rasa takut yang belum tentu terjadi',
    'mengubah hambatan atau kegagalan menjadi bahan bakar keberhasilan',
    'kekuatan disiplin diri sehari-hari yang membentuk masa depan',
    'kebijaksanaan hidup, kebaikan hati, dan dampak positif bagi sekitar'
  ];
  const chosenAngle = VARIETY_ANGLES[Math.floor(Math.random() * VARIETY_ANGLES.length)];

  // 3. Susun User Prompt & System Prompt untuk Bre AI
  let userPrompt = `Buatkan 1 kutipan motivasi harian orisinil dari Bre AI.\n${timeContext}\nSudut Pandang Eksplorasi: ${chosenAngle}.`;
  
  const adminTheme = (customTheme !== null && customTheme !== undefined ? String(customTheme) : (cfg.motivationCustom || '')).trim();
  if (adminTheme) {
    userPrompt += `\nArahan / Tema Khusus dari Admin: "${adminTheme}" (Harap prioritaskan arahan ini).`;
  }

  const systemPrompt = `Kamu adalah Bre AI Engine — Pencipta Motivasi Harian Cerdas, Orisinil, dan Menginspirasi Jiwa.
Tugasmu adalah merangkai 1 kutipan motivasi yang berbobot, bernyawa, segar, mendalam, dan membakar semangat hidup.

ATURAN WAJIB:
1. Bahasa: Bahasa Indonesia yang indah, elegan, mengalir alami, dan modern (tidak klise atau kaku).
2. Panjang: 1 sampai 2 kalimat padat (antara 15 - 35 kata).
3. Emoji: Wajib sertakan 1 atau 2 emoji yang pas dan berenergi positif di dalam atau di akhir kalimat.
4. Format: HANYA tulis teks kutipan itu sendiri. DILARANG menggunakan tanda petik pembuka/penutup (" atau ').
5. DILARANG menulis kata pengantar atau penutup seperti "Berikut kutipannya:", "Tentu,", "Semoga hari ini berkah:", dll. Langsung cetak teks motivasinya.`;

  const mockReq = Object.assign(new EventEmitter(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-channel': 'Bre AI Motivasi Engine'
    },
    body: {
      provider: cfg.telegramModel ? '' : '',
      model: cfg.telegramModel || cfg.model || 'auto',
      messages: [{ role: 'user', content: userPrompt }],
      stream: false,
      customSystemPrompt: systemPrompt
    },
    socket: { remoteAddress: '127.0.0.1' }
  });

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      // Fallback cerdas berbasis waktu jika AI upstream mengalami timeout
      resolve(getDynamicFallbackQuote(hour));
    }, 15000);

    const mockRes = {
      statusCode: 200,
      setHeader: () => {},
      writeHead: (code) => { mockRes.statusCode = code; },
      status: (code) => { mockRes.statusCode = code; return mockRes; },
      end: (data) => {
        clearTimeout(timeout);
        resolve(getDynamicFallbackQuote(hour));
      },
      json: (data) => {
        clearTimeout(timeout);
        if (data?.choices?.[0]?.message?.content) {
          const cleaned = sanitizeAiQuote(data.choices[0].message.content);
          if (cleaned && cleaned.length >= 10) {
            return resolve(cleaned);
          }
        }
        resolve(getDynamicFallbackQuote(hour));
      }
    };

    try {
      chatHandler(mockReq, mockRes).catch(err => {
        clearTimeout(timeout);
        resolve(getDynamicFallbackQuote(hour));
      });
    } catch (e) {
      clearTimeout(timeout);
      resolve(getDynamicFallbackQuote(hour));
    }
  });
}

function getDynamicFallbackQuote(hour) {
  if (hour >= 4 && hour < 11) {
    return 'Awali pagimu dengan keyakinan penuh bahwa setiap detik hari ini membawa peluang baru untuk bertumbuh dan menciptakan karya terbaikmu. 🌅🚀';
  } else if (hour >= 11 && hour < 17) {
    return 'Daya juang di saat lelah adalah pembeda nyata antara mereka yang sekadar bermimpi dan yang mewujudkannya menjadi kenyataan. Tetap melangkah! 🔥💪';
  } else {
    return 'Hargai setiap perjuangan dan langkah yang telah kamu lalui hari ini. Beristirahatlah dengan tenang, tenangkan pikiran, dan esok kita taklukkan hal-hal lebih besar. 🌙✨';
  }
}

/**
 * Alias pickQuote untuk kompatibilitas ke belakang (mengembalikan Promise<string>)
 */
async function pickQuote(customText = '') {
  return await generateMotivationQuote({ customTheme: customText });
}

function buildMotivationText(quote, slotLabel) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const labelSuffix = slotLabel ? ` (${slotLabel})` : '';
  return `🌅 *MOTIVASI HARIAN BRE AI*${labelSuffix}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"${quote}"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n— ${dateStr} · ✨ Dihasilkan oleh Bre AI`;
}

// Ambil daftar penerima chat_id Telegram yang valid (numeric)
function collectRecipients() {
  const cfg = getConfig();
  const recipients = new Set();
  const add = id => {
    const s = String(id || '').trim();
    if (s && /^\d+$/.test(s) && !s.startsWith('0')) recipients.add(s);
  };
  if (cfg.telegramOwnerId) add(String(cfg.telegramOwnerId).replace(/^@/, ''));
  if (Array.isArray(cfg.telegramUsers)) {
    cfg.telegramUsers.forEach(u => add(u.id));
  }
  // Plus recent active users dari akses kontrol bot
  try {
    const rec = require('./telegram/accessControl').getRecentUsersList();
    rec.forEach(u => add(u.id));
  } catch (e) {}
  return Array.from(recipients);
}

async function deliver(text) {
  const cfg = getConfig();
  const token = cfg.telegramBotToken || null;
  if (!token) return { delivered: 0, skipped: 'token' };
  const recipients = collectRecipients();
  let delivered = 0;
  for (const chatId of recipients) {
    try {
      await api.sendTelegramMessage(chatId, text, null, null, token);
      delivered++;
    } catch (e) {
      console.warn('[Motivasi] Gagal kirim ke', chatId, e.message);
    }
  }
  return { delivered, recipients: recipients.length };
}

// Kirim motivasi SEKARANG (test manual / tombol "Kirim Sekarang")
async function sendMotivationNow(customText = null) {
  const cfg = getConfig();
  const theme = customText !== null ? customText : cfg.motivationCustom;
  const quote = await generateMotivationQuote({ customTheme: theme, slotLabel: '' });
  const text = buildMotivationText(quote, '');
  const result = await deliver(text);
  lastMotivation = { quote, text, ts: Date.now(), slot: `${todayKey()} manual`, aiGenerated: true };
  return { ok: true, quote, text, ...result };
}

// Cek apakah ada slot waktu yang harus dikirim, lalu kirim otomatis
async function checkAndSendMotivation() {
  const cfg = getConfig();
  if (!cfg.motivationEnabled) return { triggered: false, reason: 'disabled' };
  if (!cfg.telegramBotToken) return { triggered: false, reason: 'no-token' };

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const tk = todayKey(now);
  const times = Array.isArray(cfg.motivationTimes) ? cfg.motivationTimes : [];
  let triggered = false;

  for (const t of times) {
    const slotMin = parseSlotTime(t);
    if (slotMin === null) continue;
    if (nowMinutes < slotMin || nowMinutes - slotMin > 5) continue; // toleransi 5 menit
    const slotKey = `${tk} ${String(t)}`;
    if (sentSlots.has(slotKey)) continue;

    try {
      const quote = await generateMotivationQuote({ customTheme: cfg.motivationCustom, slotLabel: String(t) });
      const text = buildMotivationText(quote, String(t));
      const result = await deliver(text);
      sentSlots.add(slotKey);
      saveLog();
      lastMotivation = { quote, text, ts: Date.now(), slot: slotKey, aiGenerated: true };
      console.log(`[Motivasi AI] Terkirim slot ${slotKey} -> ${result.delivered}/${result.recipients} penerima`);
      triggered = true;
    } catch (e) {
      console.warn('[Motivasi AI] Gagal mengirim slot', slotKey, e.message);
    }
  }
  return { triggered };
}

function getLastMotivation() {
  return lastMotivation ? { ...lastMotivation } : null;
}

async function previewMotivation(customText = null) {
  const cfg = getConfig();
  const theme = customText !== null ? customText : cfg.motivationCustom;
  const aiQuote = await generateMotivationQuote({ customTheme: theme });
  return {
    enabled: !!cfg.motivationEnabled,
    times: Array.isArray(cfg.motivationTimes) ? cfg.motivationTimes : [],
    quote: aiQuote,
    recipients: collectRecipients().length,
    aiGenerated: true
  };
}

loadLog();

module.exports = {
  MOTIVATION_QUOTES,
  generateMotivationQuote,
  pickQuote,
  buildMotivationText,
  checkAndSendMotivation,
  sendMotivationNow,
  getLastMotivation,
  previewMotivation,
  collectRecipients
};