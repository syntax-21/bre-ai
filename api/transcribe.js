// ========================================================
// Bre AI v3.0 - Web Audio Transcription Endpoint
// Menerima audio base64 (JSON) dan mengembalikan teks transkripsi
// via Whisper-compatible upstream (services/transcription.js).
// Created by Amirun Rayan Ariandi
// ========================================================
const { apiHandler, httpError, consumeLimit } = require('../services/httpSecurity');
const { syncCloudConfig, getClientIp, STYLE_PROMPTS } = require('./_shared');
const { transcribeAudio, getTranscriptionConfig } = require('../services/transcription');

module.exports = apiHandler(async (req, res) => {
  const cfg = await syncCloudConfig();
  const ip = getClientIp(req);
  const retry = consumeLimit('transcribe:' + ip, 20, 60000);
  if (retry) {
    res.setHeader('Retry-After', String(retry));
    throw httpError(429, 'Batas transkripsi tercapai. Coba lagi nanti.');
  }

  if (!getTranscriptionConfig()) {
    throw httpError(503, 'Fitur transkripsi belum dikonfigurasi. Atur endpoint Whisper di panel admin.');
  }

  const body = req.body || {};
  const b64 = typeof body.audio === 'string' ? body.audio.replace(/^data:[^;]+;base64,/, '') : '';
  if (!b64) throw httpError(400, 'Field "audio" (base64) wajib diisi');
  if (b64.length > 4 * 1024 * 1024) throw httpError(413, 'Audio melebihi batas 3 MB (base64)');

  let buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch (e) {
    throw httpError(400, 'Audio base64 tidak valid');
  }
  if (!buffer.length) throw httpError(400, 'Audio kosong');

  const mime = typeof body.mime === 'string' ? body.mime.slice(0, 100) : 'audio/ogg';
  const filename = typeof body.filename === 'string' ? body.filename.replace(/[^\w.\-]/g, '_').slice(0, 80) : 'audio.ogg';

  const text = await transcribeAudio(buffer, mime, filename);
  if (!text) throw httpError(502, 'Gagal mentranskripsi audio (upstream tidak merespons teks).');
  return res.json({ ok: true, text });
}, ['POST']);
