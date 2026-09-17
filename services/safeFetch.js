const dns = require('dns');
const net = require('net');
let Agent;
try {
  Agent = require('undici').Agent;
} catch (e) {
  Agent = null;
}

function isPrivateAddress(address) {
  let ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
    if (!ip.includes('.')) {
      const parts = ip.split(':');
      if (parts.length === 2) ip = [parseInt(parts[0], 16) >> 8, parseInt(parts[0], 16) & 255, parseInt(parts[1], 16) >> 8, parseInt(parts[1], 16) & 255].join('.');
    }
  }
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  // Only global unicast IPv6; exclude transition mechanisms carrying private IPv4.
  return net.isIP(ip) !== 6 || !/^[23]/.test(ip) || /^200[12]:/.test(ip) || /^2001:db8:/.test(ip);
}

function privateAllowed(hostname) {
  return !process.env.VERCEL && (process.env.BRE_ALLOW_PRIVATE_UPSTREAMS || '').split(',').map(s => s.trim().toLowerCase()).includes(hostname.toLowerCase());
}

function validateUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('URL endpoint tidak valid');
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('URL endpoint harus HTTP(S) tanpa kredensial atau fragment');
  if (url.protocol !== 'https:' && !privateAllowed(host)) throw new Error('Endpoint wajib HTTPS');
  if (!privateAllowed(host) && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || (net.isIP(host) && isPrivateAddress(host)))) throw new Error('Alamat endpoint privat/internal ditolak');
  return url;
}

const dispatcher = Agent ? new Agent({ connect: { lookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || (!privateAllowed(hostname) && addresses.some(a => isPrivateAddress(a.address)))) return callback(new Error('Alamat DNS privat/internal ditolak'));
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
} }, headersTimeout: 25000, bodyTimeout: 25000, connections: 8 }) : null;

async function safeFetch(raw, options = {}) {
  const url = validateUrl(raw);
  const opts = { ...options, redirect: 'error', signal: options.signal || AbortSignal.timeout(20000) };
  if (dispatcher) opts.dispatcher = dispatcher;
  return globalThis.fetch(url.href, opts);
}

async function responseText(response, maxBytes = 2 * 1024 * 1024) {
  if (!response.body?.getReader) return response.text();
  const reader = response.body.getReader();
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Respons upstream terlalu besar');
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}

async function responseJson(response, maxBytes) { return JSON.parse(await responseText(response, maxBytes)); }

function normalizeChatUrl(raw) {
  const url = new URL(String(raw).trim());
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += (url.pathname.endsWith('/v1') ? '' : '/v1') + '/chat/completions';
  return url.href;
}

module.exports = { safeFetch, responseText, responseJson, validateUrl, normalizeChatUrl, isPrivateAddress };
