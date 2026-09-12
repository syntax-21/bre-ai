// ========================================================
// Bre AI v3.0 - Motivasi Harian Engine
// Otomatis mengirim kutipan motivasi 2x sehari (sesuai jam),
// sinkron untuk Web chat & Telegram Bot.
// Created by Amirun Rayan Ariandi
// ========================================================
const fs = require('fs');
const path = require('path');
const { getConfig, saveConfig } = require('../api/_shared');
const api = require('./telegram/api');

const LOG_PATH = path.join(process.cwd(), 'data', 'motivation_log.json');

const MOTIVATION_QUOTES = [
  'Kegagalan bukanlah akhir dari segalanya. Ia hanyalah jeda singkat sebelum kamu bangkit lebih kuat lagi. 💪',
  'Jangan menunggu untuk menjadi sempurna. Mulailah dari sekarang, dan perbaikilah seiring perjalananmu. 🚀',
  'Kamu lebih kuat dari yang kamu kira, lebih berani dari yang kamu rasa, dan lebih mampu dari yang kamu bayangkan. ✨',
  'Setiap langkah kecil yang kamu ambil hari ini adalah bagian dari perjalanan menuju impian besar besok. 🌱',
  'Orang sukses bukan mereka yang tidak pernah gagal, melainkan mereka yang tidak pernah menyerah. 👑',
  'Dirimu hari ini adalah hasil dari keputusan kemarin. Dirimu esok adalah hasil dari pilihan hari ini. 🌅',
  'Fokuslah pada tujuanmu, bukan pada rasa takutmu. Satu langkah maju lebih baik daripada seribu mimpi diam. 🎯',
  'Hidup bukan tentang menunggu badai berlalu, melainkan belajar menari di tengah hujan. 💃',
  'Kesuksesan dimulai ketika kamu berhenti bertanya "mengapa aku harus?" dan mulai berkata "coba saja dulu!". 🔥',
  'Jangan bandingkan bab 1mu dengan bab 20 milik orang lain. Tulis cerita terbaikmu sendiri. 📖',
  'Disiplin adalah jembatan antara tujuan dan pencapaian. Teruslah melangkah. 🏗️',
  'Saat kamu lelah, ingatlah: bintang paling terang membutuhkan langit paling gelap. 🌟',
  'Waktumu terbatas. Jangan habiskan untuk hidup dalam bayangan orang lain. Buatlah karyamu sendiri. 🎨',
  'Belajarlah dari kemarin, hiduplah untuk hari ini, dan berharaplah untuk hari esok. 🌤️',
  'Kesabaran itu pahit, tapi buahnya manis sekali. Tetaplah berproses. 🍯',
  'Jangan takut melangkah pelan, takutlah hanya berdiri diam tanpa arah. 🧭',
  'Kekuatanmu tidak datang dari kemampuan fisik, melainkan dari kemauan yang tak pernah padam. ⚡',
  'Setiap kali kamu ragu, ingat sejauh apa kamu telah melangkah. Kamu sudah hebat! 🏆',
  'Ide-ide hebat lahir dari pikiran yang berani bermimpi dan tangan yang berani bekerja. 💡',
  'Hari ini adalah kesempatan bagus untuk menjadi versi terbaik dari dirimu. Manfaatkan selagi bisa! 🌈',
  'Sesulit apa pun hidup, selalu ada yang bisa kamu lakukan dan berhasil. Tetaplah mencoba. 🛶',
  'Jangan remehkan kekuatan rutinitas kecil. Sedikit demi sedikit, lama-lama menjadi bukit. 🐢',
  'Sukses bukan kunci kebahagiaan. Kebahagiaan adalah kunci kesuksesan. Lakukan yang kamu cintai. 😊',
  'Yang membuatmu berbeda adalah keberanianmu mencoba hal-hal baru. Jangan berhenti berinovasi. 🧪',
  'Teriakkanlah mimpimu kepada dunia melalui karyamu, bukan hanya melalui kata-kata. 🗣️'
];

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

function pickQuote(customText = '') {
  if (customText && String(customText).trim()) {
    const lines = String(customText).split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length) return lines[Math.floor(Math.random() * lines.length)];
  }
  return MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
}

function buildMotivationText(quote, slotLabel) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `🌅 *MOTIVASI HARIAN* ${slotLabel ? `(${slotLabel})` : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"${quote}"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n— ${dateStr} · ✨ Bre AI by Amirun Rayan Ariandi`;
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
  const quote = pickQuote(customText !== null ? customText : getConfig().motivationCustom);
  const text = buildMotivationText(quote, '');
  const result = await deliver(text);
  lastMotivation = { quote, text, ts: Date.now(), slot: `${todayKey()} manual` };
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

    const quote = pickQuote(cfg.motivationCustom);
    const text = buildMotivationText(quote, String(t));
    try {
      const result = await deliver(text);
      sentSlots.add(slotKey);
      saveLog();
      lastMotivation = { quote, text, ts: Date.now(), slot: slotKey };
      console.log(`[Motivasi] Terkirim slot ${slotKey} -> ${result.delivered}/${result.recipients} penerima`);
      triggered = true;
    } catch (e) {
      console.warn('[Motivasi] Gagal mengirim slot', slotKey, e.message);
    }
  }
  return { triggered };
}

function getLastMotivation() {
  return lastMotivation ? { ...lastMotivation } : null;
}

function previewMotivation() {
  const cfg = getConfig();
  const todayQuote = pickQuote(cfg.motivationCustom);
  return {
    enabled: !!cfg.motivationEnabled,
    times: Array.isArray(cfg.motivationTimes) ? cfg.motivationTimes : [],
    quote: todayQuote,
    recipients: collectRecipients().length
  };
}

loadLog();

module.exports = {
  MOTIVATION_QUOTES,
  pickQuote,
  buildMotivationText,
  checkAndSendMotivation,
  sendMotivationNow,
  getLastMotivation,
  previewMotivation,
  collectRecipients
};