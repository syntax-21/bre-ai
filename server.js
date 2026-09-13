// ========================================================
// Bre v3.0 Local HTTP Server
// Created by Amirun Rayan Ariandi
// ========================================================
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

const chat = require('./api/chat');
const models = require('./api/models');
const config = require('./api/config');
const info = require('./api/info');
const test = require('./api/test');
const search = require('./api/search');
const telegram = require('./api/telegram');
const motivation = require('./api/motivation');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.ico':   'image/x-icon',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.svg':   'image/svg+xml',
  '.json':  'application/json',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
};

function serve(res, filePath, code) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  let data;
  try {
    data = fs.readFileSync(filePath);
  } catch (e) {
    res.writeHead(404);
    return res.end('Not Found');
  }
  res.writeHead(code || 200, { 'Content-Type': mime });
  res.end(data);
}

function wrapRes(res) {
  res.json = function(obj, code) {
    res.writeHead(code || 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(obj));
  };
  res.status = function(code) {
    return {
      end: function(msg) { res.writeHead(code); res.end(msg || ''); },
      json: function(obj) { res.json(obj, code); }
    };
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-endpoint, x-custom-keys, x-custom-model, x-custom-provider, x-custom-style, x-custom-language');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const wres = wrapRes(res);

  // OpenAI-compatible native endpoints
  if (pathname === '/api/chat' || pathname === '/v1/chat/completions' || pathname === '/chat/completions') return chat(req, wres);
  if (pathname === '/api/models' || pathname === '/v1/models' || pathname === '/models') return models(req, wres);

  if (pathname === '/api/config') return config(req, wres);
  if (pathname === '/api/info') return info(req, wres);
  if (pathname === '/api/test') return test(req, wres);
  if (pathname === '/api/search') return search(req, wres);
  if (pathname === '/api/telegram') return telegram(req, wres);
  if (pathname === '/api/motivation') return motivation(req, wres);

  if (pathname === '/admin') return serve(res, path.join(PUBLIC, 'admin.html'));

  let safePath = pathname || '/';
  try {
    safePath = decodeURIComponent(safePath);
  } catch (e) {}
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const fp = path.resolve(PUBLIC, '.' + (safePath.startsWith('/') || safePath.startsWith('\\') ? safePath : '/' + safePath));
  const publicDir = path.resolve(PUBLIC);
  if (!fp.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return serve(res, fp);
  const index = path.join(PUBLIC, 'index.html');
  if (fs.existsSync(index)) return serve(res, index);
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Bre v3.0                           ║');
  console.log('║   Ciptaan Amirun Rayan Ariandi       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('  Buka: http://localhost:' + PORT);
  console.log('');

  // Clear in-memory response cache on server startup to prevent language bleeding
  try {
    const { clearResponseCache } = require('./api/_shared');
    if (typeof clearResponseCache === 'function') {
      clearResponseCache();
    }
  } catch (e) {}

  // Auto start telegram bot if configured
  try {
    const telegramBot = require('./services/telegramBot');
    telegramBot.init().catch(err => {
      console.warn('[Telegram] Auto-start notice:', err.message);
    });
  } catch (e) {
    console.warn('[Telegram] Init skip:', e.message);
  }
});
