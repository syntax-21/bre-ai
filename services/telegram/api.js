// ========================================================
// Bre AI v3.0 - Telegram Bot API Client Module
// Handles raw HTTPS communication, message chunking, and formatting
// Created by Amirun Rayan Ariandi
// ========================================================
const https = require('https');
const { getConfig } = require('../../api/_shared');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 35000
});

// Clean raw HTML tags and convert markdown tables cleanly for phone screen
function cleanTelegramText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  // 1. Ganti tag <br>, <br/>, <br /> dengan baris baru asli (\n)
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

  // 2. Bersihkan tag script atau tag HTML umum lain yang sering dimasukkan LLM
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<\/?(p|div|span|strong|b|em|i)[^>]*>/gi, '');

  // 3. Konversi format tabel markdown kasar menjadi format list terstruktur jika ada tabel
  if (cleaned.includes('|') && cleaned.includes('---')) {
    try {
      cleaned = cleaned.replace(/((?:^[ \t]*\|.+?\|[ \t]*\r?\n)(?:^[ \t]*\|[-:\s|]+?\|[ \t]*\r?\n)(?:^[ \t]*\|.+?\|[ \t]*(?:\r?\n|$))+)/gm, (match) => {
        const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) return match;
        const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean);
        const rows = lines.slice(2);
        let out = [];
        for (const row of rows) {
          const cols = row.split('|').map(c => c.trim()).filter(Boolean);
          if (!cols.length) continue;
          let title = cols[0];
          let block = `📌 *${title}*`;
          for (let i = 1; i < cols.length; i++) {
            let hName = headers[i] ? `_${headers[i]}_: ` : '';
            let val = cols[i].replace(/<br\s*\/?>/gi, '\n  • ');
            block += `\n  • ${hName}${val}`;
          }
          out.push(block);
        }
        return '\n\n' + out.join('\n\n') + '\n\n';
      });
    } catch (e) {}
  }

  // 4. Bersihkan baris baru berlebih (maksimal 2 baris kosong)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

// Low-level Telegram API Call
function apiCall(method, payload = {}, customToken = null, fallbackToken = null) {
  const cfg = getConfig();
  const token = customToken || fallbackToken || cfg.telegramBotToken;
  if (!token) return Promise.reject(new Error('Telegram Bot Token tidak ditemukan'));

  const postData = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${method}`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 35000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description || `Telegram API Error: ${parsed.error_code}`));
          }
        } catch (e) {
          reject(new Error(`Invalid response dari Telegram: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout ke Telegram API'));
    });

    req.write(postData);
    req.end();
  });
}

const api = {
  httpsAgent,
  cleanTelegramText,
  apiCall,
  sendTelegramMessage,
  editTelegramMessage,
  answerCallback,
  sendTyping,
  downloadTelegramFile
};

// Send message with automatic chunking (>4000 chars) and Markdown fallback
async function sendTelegramMessage(chatId, text, replyMarkup = null, replyToId = null, token = null) {
  if (!text) return;
  const cleanText = cleanTelegramText(text);
  const CHUNK_SIZE = 4000;
  const chunks = [];

  for (let i = 0; i < cleanText.length; i += CHUNK_SIZE) {
    chunks.push(cleanText.slice(i, i + CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const isLast = (i === chunks.length - 1);
    const payload = {
      chat_id: chatId,
      text: chunks[i],
      parse_mode: 'Markdown'
    };
    if (replyToId && i === 0) payload.reply_to_message_id = replyToId;
    if (isLast && replyMarkup) payload.reply_markup = replyMarkup;

    try {
      await api.apiCall('sendMessage', payload, token);
    } catch (err) {
      // Fallback to plain text if Markdown syntax fails
      delete payload.parse_mode;
      try {
        await api.apiCall('sendMessage', payload, token);
      } catch (plainErr) {
        console.error('[TelegramBot] Gagal kirim pesan ke', chatId, plainErr.message);
      }
    }
  }
}

// Edit message helper for inline menus
async function editTelegramMessage(chatId, messageId, text, replyMarkup = null, token = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown'
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  try {
    await api.apiCall('editMessageText', payload, token);
  } catch (err) {
    delete payload.parse_mode;
    try {
      await api.apiCall('editMessageText', payload, token);
    } catch (plainErr) {}
  }
}

// Answer callback query with optional notification toast
async function answerCallback(callbackQueryId, text = null, showAlert = false, token = null) {
  try {
    const payload = { callback_query_id: callbackQueryId };
    if (text) {
      payload.text = text;
      payload.show_alert = showAlert;
    }
    await api.apiCall('answerCallbackQuery', payload, token);
  } catch (e) {}
}

// Send typing indicator
async function sendTyping(chatId, token = null) {
  try {
    await api.apiCall('sendChatAction', { chat_id: chatId, action: 'typing' }, token);
  } catch (e) {}
}

// Download file from Telegram API (for reading documents and code files)
async function downloadTelegramFile(fileId, token = null) {
  const fileInfo = await api.apiCall('getFile', { file_id: fileId }, token);
  if (!fileInfo || !fileInfo.file_path) throw new Error('Berkas tidak ditemukan di Telegram');

  const cfg = getConfig();
  const effectiveToken = token || cfg.telegramBotToken;
  const fileUrl = `https://api.telegram.org/file/bot${effectiveToken}/${fileInfo.file_path}`;

  return new Promise((resolve, reject) => {
    const req = https.get(fileUrl, { agent: httpsAgent, timeout: 30000 }, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Gagal mengunduh file: HTTP ${res.statusCode}`));
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
      res.on('error', err => reject(err));
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Koneksi timeout saat download berkas')); });
  });
}

api.sendTelegramMessage = sendTelegramMessage;
api.editTelegramMessage = editTelegramMessage;
api.answerCallback = answerCallback;
api.sendTyping = sendTyping;
api.downloadTelegramFile = downloadTelegramFile;
api.testToken = testToken;

module.exports = api;

// Test a bot token by calling getMe
async function testToken(token) {
  if (!token) return { ok: false, error: 'Token kosong' };
  try {
    const botInfo = await apiCall('getMe', {}, token);
    return { ok: true, bot: botInfo };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

