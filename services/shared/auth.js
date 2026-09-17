// ========================================================
// Bre AI - Auth, Admin Password & Rate Limiting
// Dipisah dari api/_shared.js agar berkas inti lebih ringan.
// ========================================================
const crypto = require('crypto');
const { safeEqual, clientIp } = require('../httpSecurity');

const loginAttempts = new Map();
const chatRateBuckets = new Map();

function hashAdminPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw || ''), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function matchPassword(input, expected) {
  if (!expected || typeof input !== 'string' || !input || input.length > 256) return false;
  const s = String(expected).trim();
  const i = String(input);
  if (s.startsWith('scrypt$')) {
    const parts = s.split('$');
    if (parts.length !== 3 || !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{64}$/i.test(parts[2])) return false;
    const candidate = crypto.scryptSync(i, parts[1], 32);
    const expectedBuf = Buffer.from(parts[2], 'hex');
    return candidate.length === expectedBuf.length && crypto.timingSafeEqual(candidate, expectedBuf);
  }
  const a = Buffer.from(i);
  const b = Buffer.from(s);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyAdminPassword(input, stored) {
  if (process.env.ADMIN_PASSWORD) {
    const envPw = process.env.ADMIN_PASSWORD.trim();
    if (envPw && matchPassword(input, envPw)) return true;
  }
  if (stored && matchPassword(input, stored)) return true;
  return false;
}

function getClientIp(req) {
  return clientIp(req);
}

function checkRateLimit(ip) {
  const now = Date.now();
  const { getConfig } = require('./configStore');
  const cfg = getConfig();
  const limitMax = cfg.rateLimitMax || 5;
  const limitWin = (cfg.rateLimitWindow || 30) * 1000;

  const c = loginAttempts.get(ip) || { count: 0, resetAt: now + limitWin };
  if (now > c.resetAt) { c.count = 0; c.resetAt = now + limitWin; }
  if (c.count >= limitMax) return { limited: true, retryAfter: Math.ceil((c.resetAt - now) / 1000) };
  return { limited: false };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const { getConfig } = require('./configStore');
  const cfg = getConfig();
  const limitWin = (cfg.rateLimitWindow || 30) * 1000;

  const c = loginAttempts.get(ip) || { count: 0, resetAt: now + limitWin };
  if (now > c.resetAt) { c.count = 1; c.resetAt = now + limitWin; } else c.count++;
  loginAttempts.set(ip, c);
  if (loginAttempts.size > 10000) loginAttempts.delete(loginAttempts.keys().next().value);
}

function clearLoginAttempts(ip) { loginAttempts.delete(ip); }

function checkChatRateLimit(ip) {
  const now = Date.now();
  const { getConfig } = require('./configStore');
  const cfg = getConfig();
  const max = cfg.chatRateLimitMax || 30;
  const win = (cfg.chatRateLimitWindow || 60) * 1000;
  const c = chatRateBuckets.get(ip) || { count: 0, resetAt: now + win };
  if (now > c.resetAt) { c.count = 0; c.resetAt = now + win; }
  if (c.count >= max) return { limited: true, retryAfter: Math.ceil((c.resetAt - now) / 1000) };
  return { limited: false };
}

function consumeChatRate(ip) {
  const now = Date.now();
  const { getConfig } = require('./configStore');
  const cfg = getConfig();
  const win = (cfg.chatRateLimitWindow || 60) * 1000;
  const c = chatRateBuckets.get(ip) || { count: 0, resetAt: now + win };
  if (now > c.resetAt) { c.count = 1; c.resetAt = now + win; } else c.count++;
  chatRateBuckets.set(ip, c);
  if (chatRateBuckets.size > 10000) chatRateBuckets.delete(chatRateBuckets.keys().next().value);
}

function checkClientAuth(req, cfg) {
  try {
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const key = (req.headers['x-api-key'] || bearer || '').trim();
    if (!key) return null;
    const ip = getClientIp(req);
    if (checkRateLimit(ip).limited) return null;
    const keys = Array.isArray(cfg.clientKeys)
      ? cfg.clientKeys.map(k => String(k).trim()).filter(Boolean)
      : [];
    if (keys.some(k => safeEqual(k, key))) return 'Client';
    if (verifyAdminPassword(key, cfg.adminPassword)) return 'Admin';
    recordFailedAttempt(ip);
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashAdminPassword,
  verifyAdminPassword,
  checkClientAuth,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  checkChatRateLimit,
  consumeChatRate
};
