// ========================================================
// Bre AI v3.0 - Audio / Voice Transcription Engine
// Mengubah voice note / audio menjadi teks via API transkripsi
// OpenAI-compatible (Whisper). Otomatis memakai endpoint & key
// dari provider pertama yang aktif, atau konfigurasi manual.
// Created by Amirun Rayan Ariandi
// ========================================================
const { getConfig } = require('../api/_shared');

function normalizeEndpoint(rawUrl) {
  const u = (rawUrl || '').trim();
  if (!u) return '';
  if (u.endsWith('/audio/transcriptions')) return u.replace(/\/+$/, '');
  if (u.endsWith('/chat/completions')) return u.replace(/\/chat\/completions$/, '/audio/transcriptions');
  if (u.endsWith('/v1')) return `${u}/audio/transcriptions`;
  if (u.endsWith('/')) return `${u}v1/audio/transcriptions`;
  return `${u}/v1/audio/transcriptions`;
}

function getTranscriptionConfig() {
  const cfg = getConfig();
  if (cfg.transcriptionEnabled === false) return null;

  let endpoint = (cfg.transcriptionEndpoint || '').trim();
  let key = (cfg.transcriptionKey || '').trim();

  if (!endpoint) {
    const eps = (cfg.endpoints || []).filter(e => e.status !== false && e.enabled !== false);
    const ep = eps[0];
    if (ep && ep.url) {
      endpoint = normalizeEndpoint(ep.url);
      const keys = (Array.isArray(ep.keys) ? ep.keys : []).map(k => String(k || '').trim()).filter(Boolean);
      key = keys[0] || String(ep.apiKey || '').trim();
    }
  }

  if (!endpoint || !key) return null;
  const lang = String(cfg.transcriptionLanguage || 'auto').toLowerCase().trim();
  return {
    endpoint,
    key: key.startsWith('Bearer ') ? key : `Bearer ${key}`,
    model: cfg.transcriptionModel || 'whisper-1',
    language: (lang && lang !== 'auto') ? lang : null
  };
}

async function transcribeAudio(audioBuffer, mimeType = '', filename = 'audio.ogg') {
  const tc = getTranscriptionConfig();
  if (!tc) return null;
  if (!audioBuffer || !audioBuffer.length) return null;

  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || 'application/octet-stream' });
  form.append('file', blob, filename);
  form.append('model', tc.model);
  if (tc.language) form.append('language', tc.language);

  try {
    const res = await fetch(tc.endpoint, {
      method: 'POST',
      headers: { 'Authorization': tc.key },
      body: form
    });
    if (!res.ok) {
      console.warn(`[Transcription] Upstream ${res.status}: ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    const text = (data && data.text && String(data.text).trim()) ? String(data.text).trim() : null;
    return text || null;
  } catch (e) {
    console.warn('[Transcription] Error:', e.message);
    return null;
  }
}

module.exports = {
  transcribeAudio,
  getTranscriptionConfig,
  normalizeEndpoint
};