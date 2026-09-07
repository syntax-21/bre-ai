// ========================================================
// Bre AI v3.0 - Telegram Access Control & User Tracking
// Multi-role permissions, Whitelist/Blocklist, and Owner Alerts
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig, saveConfig } = require('../../api/_shared');
const { sendTelegramMessage } = require('./api');

const recentUsers = new Map(); // userId -> { id, username, name, lastSeen, notified }
const notifiedUsers = new Set(); // userId -> already sent new user alert to owner

function recordRecentUser(fromUser) {
  if (!fromUser || !fromUser.id) return;
  const existing = recentUsers.get(fromUser.id);
  recentUsers.set(fromUser.id, {
    id: fromUser.id,
    username: fromUser.username || '',
    name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'User',
    lastSeen: Date.now(),
    notified: existing ? existing.notified : false
  });
}

function getRecentUsersList() {
  return Array.from(recentUsers.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

// Check if sender is Bot Owner
function isOwner(fromUser, activeOwnerId = null) {
  if (!fromUser) return false;
  const cfg = getConfig();
  const ownerId = String(activeOwnerId || cfg.telegramOwnerId || '').trim().toLowerCase().replace(/^@/, '');
  if (!ownerId) return false;

  const uId = String(fromUser.id);
  const uName = (fromUser.username || '').toLowerCase().replace(/^@/, '');

  if (ownerId === uId || (uName && ownerId === uName)) return true;

  // Also check role in telegramUsers array
  if (Array.isArray(cfg.telegramUsers)) {
    const found = cfg.telegramUsers.find(u =>
      String(u.id) === uId ||
      (u.username && u.username.toLowerCase().replace(/^@/, '') === uName)
    );
    if (found && found.role === 'owner') return true;
  }

  return false;
}

// Check if user is explicitly registered in database
function isUserRegistered(fromUser) {
  if (!fromUser) return false;
  const cfg = getConfig();
  const uId = String(fromUser.id);
  const uName = (fromUser.username || '').toLowerCase().replace(/^@/, '');

  if (Array.isArray(cfg.telegramUsers)) {
    return cfg.telegramUsers.some(u =>
      String(u.id) === uId ||
      (u.username && u.username.toLowerCase().replace(/^@/, '') === uName)
    );
  }
  return false;
}

// Check if a user is allowed to chat with Bre AI
function isUserAllowed(fromUser, activeOwnerId = null, activeAccessMode = null) {
  if (!fromUser) return false;
  if (isOwner(fromUser, activeOwnerId)) return true; // Owner always allowed

  const cfg = getConfig();
  const uId = String(fromUser.id);
  const uName = (fromUser.username || '').toLowerCase().replace(/^@/, '');

  // 1. Check specific roles in telegramUsers list
  if (Array.isArray(cfg.telegramUsers)) {
    const match = cfg.telegramUsers.find(u =>
      String(u.id) === uId ||
      (u.username && u.username.toLowerCase().replace(/^@/, '') === uName)
    );
    if (match) {
      if (match.role === 'blocked') return false; // Blocked user always rejected
      if (match.role === 'whitelist' || match.role === 'owner') return true;
    }
  }

  // 2. Check legacy comma-separated whitelist if provided
  const rawLegacyWhitelist = (cfg.telegramAllowedUsers || '').trim();
  if (rawLegacyWhitelist) {
    const allowed = rawLegacyWhitelist.split(/[\n,;]+/).map(s => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
    if (allowed.includes(uId) || (uName && allowed.includes(uName))) return true;
  }

  // 3. Check access mode
  const mode = activeAccessMode || cfg.telegramAccessMode || 'public';
  if (mode === 'whitelist') {
    // In whitelist-only mode, unlisted users are rejected
    return false;
  }

  // In public mode, everyone not blocked is allowed
  return true;
}

// Add or update user role in telegramUsers config
function setUserRole(userId, username = '', name = '', role = 'whitelist') {
  const cfg = getConfig();
  const users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
  const uIdStr = String(userId);
  const uNameClean = (username || '').replace(/^@/, '');

  const idx = users.findIndex(u =>
    String(u.id) === uIdStr ||
    (uNameClean && u.username && u.username.toLowerCase().replace(/^@/, '') === uNameClean.toLowerCase())
  );

  const userEntry = {
    id: uIdStr,
    username: uNameClean,
    name: name || (uNameClean ? `@${uNameClean}` : `User ${uIdStr}`),
    role: role,
    updatedAt: new Date().toISOString()
  };

  if (idx >= 0) {
    users[idx] = { ...users[idx], ...userEntry };
  } else {
    userEntry.addedAt = new Date().toISOString();
    users.push(userEntry);
  }

  saveConfig({ telegramUsers: users });
  return userEntry;
}

// Remove user from telegramUsers config
function removeUserRole(targetIdOrUsername) {
  const cfg = getConfig();
  const users = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
  const cleanTarget = String(targetIdOrUsername).toLowerCase().replace(/^@/, '');

  const filtered = users.filter(u =>
    String(u.id).toLowerCase() !== cleanTarget &&
    (u.username || '').toLowerCase().replace(/^@/, '') !== cleanTarget
  );

  saveConfig({ telegramUsers: filtered });
  return filtered.length < users.length;
}

// Notify Owner when a new user enters/starts the bot with interactive Action Buttons
async function notifyOwnerNewUser(fromUser, initialText = '', botService = null) {
  if (!fromUser || !fromUser.id) return;
  const cfg = getConfig();
  const ownerId = botService?.activeOwnerId || cfg.telegramOwnerId;
  const token = botService?.activeToken || null;

  if (!ownerId) return; // No owner configured
  if (isOwner(fromUser, ownerId)) return; // Don't notify if owner themselves

  // Only notify once per user session
  const uId = fromUser.id;
  if (notifiedUsers.has(uId)) return;
  notifiedUsers.add(uId);

  const fullName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || 'Tanpa Nama';
  const usernameTag = fromUser.username ? `@${fromUser.username}` : '_(tidak ada username)_';
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
  const modeLabel = (cfg.telegramAccessMode || 'public') === 'whitelist' ? '🔒 Whitelist (Private)' : '🟢 Publik';
  const previewText = (initialText || '').slice(0, 100);

  const alertText = `🔔 *NOTIFIKASI PENGGUNA BARU MASUK*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Ada pengguna baru yang baru saja berinteraksi dengan Bre AI di Telegram:\n\n` +
    `• *Nama:* ${fullName}\n` +
    `• *Username:* ${usernameTag}\n` +
    `• *ID Telegram:* \`${uId}\`\n` +
    `• *Waktu:* ${timeStr}\n` +
    `• *Mode Bot Saat Ini:* ${modeLabel}\n` +
    (previewText ? `• *Pesan Awal:* _"${previewText}"_\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Silakan pilih tindakan otorisasi di bawah ini:_`;

  const markup = {
    inline_keyboard: [
      [
        { text: '🟢 Izinkan (Whitelist)', callback_data: `adm_appr_wl:${uId}` },
        { text: '🔴 Tolak / Blokir', callback_data: `adm_appr_bl:${uId}` }
      ],
      [
        { text: '👥 Buka Manajemen User', callback_data: 'adm_users' },
        { text: '✕ Abaikan', callback_data: `adm_appr_ign:${uId}` }
      ]
    ]
  };

  try {
    await sendTelegramMessage(ownerId, alertText, markup, null, token);
  } catch (err) {
    console.warn('[TelegramBot] Gagal mengirim notifikasi new user ke Owner:', err.message);
  }
}

module.exports = {
  recentUsers,
  notifiedUsers,
  recordRecentUser,
  getRecentUsersList,
  isOwner,
  isUserRegistered,
  isUserAllowed,
  setUserRole,
  removeUserRole,
  notifyOwnerNewUser
};
