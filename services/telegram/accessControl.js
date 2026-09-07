// ========================================================
// Bre AI v3.0 - Telegram Access Control & User Tracking
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig, saveConfig } = require('../../api/_shared');

const recentUsers = new Map(); // userId -> { id, username, name, lastSeen }

function recordRecentUser(fromUser) {
  if (!fromUser || !fromUser.id) return;
  recentUsers.set(fromUser.id, {
    id: fromUser.id,
    username: fromUser.username || '',
    name: [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'User',
    lastSeen: Date.now()
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

module.exports = {
  recentUsers,
  recordRecentUser,
  getRecentUsersList,
  isOwner,
  isUserAllowed
};
