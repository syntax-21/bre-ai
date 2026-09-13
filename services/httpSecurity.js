const crypto = require('crypto');
const net = require('net');
const { AsyncLocalStorage } = require('async_hooks');

const internalRequests = new WeakSet();
const requestContext = new AsyncLocalStorage();
const attempts = new Map();
const MAX_BODY = 4 * 1024 * 1024;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
}

function clientIp(req) {
  const headers = req.headers || {};
  // Vercel overwrites x-forwarded-for. A direct Node server must use the socket.
  const forwarded = process.env.VERCEL ? headers['x-forwarded-for'] : '';
  const value = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  if (net.isIP(value)) return value;
  return String(req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
}

function consumeLimit(key, max, windowMs) {
  const now = Date.now();
  if (attempts.size >= 10000) {
    for (const [k, item] of attempts) if (item.resetAt <= now) attempts.delete(k);
    if (attempts.size >= 10000 && !attempts.has(key)) return 60;
  }
  let bucket = attempts.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count++;
  attempts.set(key, bucket);
  return bucket.count > max ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0;
}

async function readJson(req, maxBytes = MAX_BODY) {
  let value = req.body;
  if (value === undefined || value === null) {
    const announced = Number(req.headers?.['content-length']);
    if (announced > maxBytes) throw httpError(413, 'Payload too large (maksimal 4 MB).');
    value = await new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      const cleanup = () => {
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
        req.removeListener('aborted', onAbort);
      };
      const onError = error => { cleanup(); reject(error); };
      const onAbort = () => onError(httpError(400, 'Request aborted'));
      const onData = chunk => {
        size += Buffer.byteLength(chunk);
        if (size > maxBytes) { onError(httpError(413, 'Payload too large (maksimal 4 MB).')); req.resume(); return; }
        chunks.push(Buffer.from(chunk));
      };
      const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
      req.on('data', onData); req.on('end', onEnd); req.on('error', onError); req.on('aborted', onAbort);
    });
  }
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') {
    if (Buffer.byteLength(value) > maxBytes) throw httpError(413, 'Payload too large');
    try { value = JSON.parse(value); } catch { throw httpError(400, 'JSON tidak valid'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'Body harus berupa objek JSON');
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) throw httpError(413, 'Payload too large');
  return value;
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function apiHandler(handler, methods = ['GET'], { admin = false } = {}) {
  return async (req, res) => {
    securityHeaders(res);
    const origin = req.headers?.origin;
    const allowed = (process.env.BRE_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    // Public APIs support key-based cross-origin clients; admin calls are same-origin by default.
    if (!admin && !allowed.length) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && allowed.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-custom-model, x-custom-provider, x-custom-style, x-custom-language');
    res.setHeader('Access-Control-Expose-Headers', 'X-Provider, X-Model, X-Cache, Retry-After');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }); }
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      req.query = Object.fromEntries(parsed.searchParams);
      if (admin && !internalRequests.has(req)) {
        const retry = consumeLimit('admin:' + clientIp(req), 180, 60000);
        if (retry) { res.setHeader('Retry-After', String(retry)); throw httpError(429, 'Terlalu banyak permintaan admin'); }
      }
      if (req.method === 'POST') req.body = await readJson(req);
      return await requestContext.run({ pending: [] }, async () => {
        try { return await handler(req, res); }
        finally { await Promise.allSettled(requestContext.getStore().pending); }
      });
    } catch (error) {
      if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
      if (!error.status) console.error('[API]', error.name, error.message);
      return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Terjadi kesalahan internal server' });
    }
  };
}

function trackPending(promise) {
  requestContext.getStore()?.pending.push(promise);
  return promise;
}

module.exports = { apiHandler, readJson, httpError, safeEqual, clientIp, consumeLimit, securityHeaders, internalRequests, trackPending };
