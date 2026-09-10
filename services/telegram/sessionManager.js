// ========================================================
// Bre AI v3.0 - Telegram Conversation & Session Manager
// Resilient Multi-Turn Context Memory with Persistence
// Created by Amirun Rayan Ariandi
// ========================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfig } = require('../../api/_shared');

// Persistent storage file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'telegram_sessions.json');
const TMP_SESSIONS_FILE = path.join(os.tmpdir(), 'bre_telegram_sessions.json');

// In-memory conversation store: String(chatId) -> { history: Array<{role, content}>, updatedAt: number }
const conversationsMap = new Map();
let saveDebounceTimer = null;
const DEFAULT_MAX_HISTORY = 30; // 15 full question-and-answer pairs
const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours TTL

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Load persisted sessions from disk or Cloud Redis on startup
 */
async function loadSessionsFromDisk() {
  const now = Date.now();
  const cfg = getConfig();
  const redisUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || cfg.upstashRedisUrl || '').trim();
  const redisToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || cfg.upstashRedisToken || '').trim();

  // 1. Try loading from Vercel KV / Upstash Redis (if configured)
  if (redisUrl && redisToken && !redisUrl.includes('console.upstash.com')) {
    try {
      const cleanUrl = redisUrl.replace(/\/$/, '');
      const resp = await fetch(`${cleanUrl}/get/bre_telegram_sessions`, {
        headers: { 'Authorization': `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(3500)
      });
      if (resp.ok) {
        const data = await resp.json();
        let remoteVal = data.result;
        if (typeof remoteVal === 'string') {
          try { remoteVal = JSON.parse(remoteVal); } catch (e) {}
        }
        if (remoteVal && typeof remoteVal === 'object') {
          for (const [chatId, session] of Object.entries(remoteVal)) {
            if (!chatId) continue;
            const key = String(chatId);
            if (session && Array.isArray(session.history)) {
              const updatedAt = session.updatedAt || now;
              if (now - updatedAt < SESSION_TTL_MS) {
                conversationsMap.set(key, { history: session.history, updatedAt });
              }
            }
          }
          return;
        }
      }
    } catch (err) {
      console.warn('[SessionManager] Upstash session load error:', err.message);
    }
  }

  // 2. Fallback to Local Disk / Temp storage
  try {
    let filePath = null;
    if (fs.existsSync(SESSIONS_FILE)) {
      filePath = SESSIONS_FILE;
    } else if (fs.existsSync(TMP_SESSIONS_FILE)) {
      filePath = TMP_SESSIONS_FILE;
    }

    if (!filePath) return;

    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      for (const [chatId, session] of Object.entries(parsed)) {
        if (!chatId) continue;
        const key = String(chatId);
        if (Array.isArray(session)) {
          // Legacy array format
          conversationsMap.set(key, { history: session, updatedAt: now });
        } else if (session && Array.isArray(session.history)) {
          // Check TTL
          const updatedAt = session.updatedAt || now;
          if (now - updatedAt < SESSION_TTL_MS) {
            conversationsMap.set(key, {
              history: session.history,
              updatedAt
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SessionManager] Note: Could not load existing sessions:', err.message);
  }
}

/**
 * Debounced write sessions to disk and Cloud Redis to avoid I/O bottlenecks
 */
function scheduleSaveToDisk() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

  saveDebounceTimer = setTimeout(async () => {
    try {
      const now = Date.now();
      const exportObj = {};

      for (const [key, session] of conversationsMap.entries()) {
        if (session && Array.isArray(session.history) && session.history.length > 0) {
          if (now - (session.updatedAt || now) < SESSION_TTL_MS) {
            exportObj[key] = {
              history: session.history,
              updatedAt: session.updatedAt || now
            };
          }
        }
      }

      const jsonStr = JSON.stringify(exportObj, null, 2);

      // 1. Save to local or /tmp file
      if (ensureDataDir()) {
        try {
          fs.writeFileSync(SESSIONS_FILE, jsonStr, 'utf-8');
        } catch (e) {
          // Fallback to tmpdir if data dir is read-only (e.g. serverless)
          try { fs.writeFileSync(TMP_SESSIONS_FILE, jsonStr, 'utf-8'); } catch (err2) {}
        }
      } else {
        try { fs.writeFileSync(TMP_SESSIONS_FILE, jsonStr, 'utf-8'); } catch (err2) {}
      }

      // 2. Save to Vercel KV / Upstash Redis in cloud if configured
      const cfg = getConfig();
      const redisUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || cfg.upstashRedisUrl || '').trim();
      const redisToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || cfg.upstashRedisToken || '').trim();

      if (redisUrl && redisToken && !redisUrl.includes('console.upstash.com')) {
        try {
          const cleanUrl = redisUrl.replace(/\/$/, '');
          await fetch(`${cleanUrl}/set/bre_telegram_sessions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${redisToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonStr),
            signal: AbortSignal.timeout(4000)
          });
        } catch (cloudErr) {
          console.warn('[SessionManager] Upstash session save error:', cloudErr.message);
        }
      }
    } catch (e) {
      console.warn('[SessionManager] Error saving sessions to disk:', e.message);
    }
  }, 400);
}

/**
 * Prunes conversation history safely:
 * 1. Ensures length <= maxLimit (defaults to 30 messages = 15 conversation turns)
 * 2. Ensures the dialogue starts with a USER message (never an orphan assistant message)
 * 3. Keeps user-assistant turns paired together
 * 4. Normalizes dialogue structure
 */
function pruneConversationHistory(rawHistory = [], maxLimit = DEFAULT_MAX_HISTORY) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return [];

  const limit = Math.max(4, parseInt(maxLimit) || DEFAULT_MAX_HISTORY);
  let history = [...rawHistory];

  // If history exceeds limit, slice keeping the most recent items
  if (history.length > limit) {
    history = history.slice(-limit);
  }

  // CRITICAL: Strip any leading assistant messages so first message is ALWAYS a user message
  while (history.length > 0 && history[0].role !== 'user') {
    history.shift();
  }

  // Clean empty or invalid items
  history = history.filter(item => item && item.role && (item.content !== undefined && item.content !== null));

  return history;
}

/**
 * Sanitizes messages array before sending to LLM router:
 * - Drops system messages from body array (handled separately)
 * - Guarantees dialogue starts with 'user'
 * - Merges consecutive duplicate roles to prevent API 400 errors
 */
function sanitizeMessagesForLLM(messages = []) {
  if (!Array.isArray(messages)) return [];

  let turns = messages
    .filter(m => m && m.role && m.role !== 'system')
    .map(m => ({
      role: m.role,
      content: m.content
    }));

  // Strip leading assistant messages
  while (turns.length > 0 && turns[0].role !== 'user') {
    turns.shift();
  }

  // Merge consecutive duplicate roles if any
  const cleanTurns = [];
  for (const turn of turns) {
    const last = cleanTurns[cleanTurns.length - 1];
    if (last && last.role === turn.role) {
      if (typeof last.content === 'string' && typeof turn.content === 'string') {
        last.content = `${last.content}\n\n${turn.content}`;
      } else {
        cleanTurns.push(turn);
      }
    } else {
      cleanTurns.push(turn);
    }
  }

  return cleanTurns;
}

/**
 * Retrieves conversation history for a given chat ID
 */
function getChatHistory(chatId) {
  if (!chatId) return [];
  const key = String(chatId);
  const session = conversationsMap.get(key);

  if (!session) return [];

  let history = Array.isArray(session) ? session : session.history;
  if (!Array.isArray(history)) return [];

  const cfg = getConfig();
  const maxLimit = cfg.telegramMaxHistory || DEFAULT_MAX_HISTORY;
  return pruneConversationHistory(history, maxLimit);
}

/**
 * Saves and updates conversation history for a given chat ID
 */
function saveChatHistory(chatId, history = []) {
  if (!chatId) return;
  const key = String(chatId);
  const cfg = getConfig();
  const maxLimit = cfg.telegramMaxHistory || DEFAULT_MAX_HISTORY;

  const pruned = pruneConversationHistory(history, maxLimit);

  conversationsMap.set(key, {
    history: pruned,
    updatedAt: Date.now()
  });

  scheduleSaveToDisk();
}

/**
 * Clears conversation history for a specific chat ID
 */
function clearChatHistory(chatId) {
  if (!chatId) return false;
  const key = String(chatId);
  const existed = conversationsMap.delete(key);
  scheduleSaveToDisk();
  return existed;
}

/**
 * Clears all conversation histories across all chats
 */
function clearAllHistories() {
  conversationsMap.clear();
  scheduleSaveToDisk();
}

/**
 * Get active conversations count
 */
function getActiveConversationsCount() {
  const now = Date.now();
  let count = 0;
  for (const session of conversationsMap.values()) {
    const updatedAt = session?.updatedAt || now;
    if (now - updatedAt < SESSION_TTL_MS) {
      count++;
    }
  }
  return count;
}

/**
 * Constructs a rich, context-preserving user message snippet for conversation memory
 */
function buildHistoryUserSnippet(msg, userQueryPrompt = '', fallbackText = '') {
  if (!msg) return fallbackText || userQueryPrompt || 'Pesan Pengguna';

  // Reply context if user was replying to a message
  let replyContext = '';
  if (msg.reply_to_message) {
    const rep = msg.reply_to_message;
    const repSender = rep.from?.first_name || rep.from?.username || (rep.from?.is_bot ? 'Bre AI' : 'Pengguna');
    const repText = rep.text || rep.caption || (rep.photo ? '[Foto]' : (rep.document ? `[Dokumen ${rep.document.file_name || ''}]` : ''));
    if (repText) {
      replyContext = `[Membalas ${repSender}: "${repText.slice(0, 100)}"] `;
    }
  }

  // 1. Text message
  if (msg.text) {
    return `${replyContext}${msg.text.trim()}`;
  }

  // 2. Photo message
  if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
    const cap = (msg.caption || '').trim();
    return cap ? `${replyContext}[Pengguna mengirim foto dengan keterangan: "${cap}"]` : `${replyContext}[Pengguna mengirim foto/gambar untuk dianalisis]`;
  }

  // 3. Document message
  if (msg.document) {
    const name = msg.document.file_name || 'berkas';
    const cap = (msg.caption || '').trim();
    return cap ? `${replyContext}[Pengguna mengirim berkas "${name}" dengan instruksi: "${cap}"]` : `${replyContext}[Pengguna mengirim berkas "${name}"]`;
  }

  // 4. Voice / Audio message
  if (msg.voice || msg.audio) {
    const isVoice = !!msg.voice;
    const dur = (msg.voice || msg.audio)?.duration || 0;
    const cap = (msg.caption || '').trim();
    const typeLabel = isVoice ? 'Voice Note' : 'Audio';
    return cap ? `${replyContext}[Pengguna mengirim ${typeLabel} (${dur}s): "${cap}"]` : `${replyContext}[Pengguna mengirim rekaman ${typeLabel} (${dur}s)]`;
  }

  // 5. Video message
  if (msg.video || msg.video_note) {
    const dur = (msg.video || msg.video_note)?.duration || 0;
    const cap = (msg.caption || '').trim();
    return cap ? `${replyContext}[Pengguna mengirim Video (${dur}s): "${cap}"]` : `${replyContext}[Pengguna mengirim Video (${dur}s)]`;
  }

  // 6. Location / Venue
  if (msg.location || msg.venue) {
    const loc = msg.location || msg.venue?.location;
    const title = msg.venue?.title ? ` (${msg.venue.title})` : '';
    return `${replyContext}[Pengguna membagikan Lokasi GPS: ${loc?.latitude || 0}, ${loc?.longitude || 0}${title}]`;
  }

  // 7. Contact
  if (msg.contact) {
    const cName = [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' ') || 'Kontak';
    const cPhone = msg.contact.phone_number || '';
    return `${replyContext}[Pengguna membagikan Kontak: ${cName} (${cPhone})]`;
  }

  // 8. Poll
  if (msg.poll) {
    return `${replyContext}[Pengguna membagikan Polling: "${msg.poll.question || 'Polling'}"]`;
  }

  // 9. Sticker
  if (msg.sticker) {
    return `${replyContext}[Pengguna mengirim stiker: ${msg.sticker.emoji || '😄'}]`;
  }

  // 10. Animation / GIF
  if (msg.animation) {
    const cap = (msg.caption || '').trim();
    return cap ? `${replyContext}[Pengguna mengirim GIF Animasi: "${cap}"]` : `${replyContext}[Pengguna mengirim GIF Animasi]`;
  }

  return fallbackText || userQueryPrompt || 'Pesan Pengguna';
}

// Initialize and preload sessions on startup
loadSessionsFromDisk();

module.exports = {
  conversationsMap,
  DEFAULT_MAX_HISTORY,
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  clearAllHistories,
  getActiveConversationsCount,
  pruneConversationHistory,
  sanitizeMessagesForLLM,
  buildHistoryUserSnippet,
  loadSessionsFromDisk,
  scheduleSaveToDisk
};
