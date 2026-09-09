// ========================================================
// Bre AI v3.0 - Telegram Forwarded Messages Handler
// Supports Telegram Bot API 7.0+ (forward_origin) & Classic Formats
// Created by Amirun Rayan Ariandi
// ========================================================

/**
 * Extract rich origin metadata from forwarded Telegram messages
 * Supports both Telegram Bot API 7.0+ (forward_origin) and Classic fields
 * @param {object} msg - Telegram message object
 * @returns {object|null} Parsed forward metadata or null if not forwarded
 */
function extractForwardOrigin(msg) {
  if (!msg) return null;

  let originType = null;
  let sourceName = '';
  let username = '';
  let authorSignature = '';
  let originalDate = null;
  let originalMessageId = null;

  // 1. Telegram Bot API 7.0+ (forward_origin)
  if (msg.forward_origin) {
    const fo = msg.forward_origin;
    originType = fo.type; // 'user' | 'hidden_user' | 'chat' | 'channel'
    if (fo.date) originalDate = new Date(fo.date * 1000);

    if (fo.type === 'user' && fo.sender_user) {
      const u = fo.sender_user;
      sourceName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Pengguna Telegram';
      if (u.username) username = `@${u.username}`;
    } else if (fo.type === 'hidden_user') {
      sourceName = fo.sender_user_name || 'Pengguna (Akun Privat)';
    } else if (fo.type === 'chat' && fo.sender_chat) {
      const c = fo.sender_chat;
      sourceName = c.title || 'Grup Obrolan';
      if (c.username) username = `@${c.username}`;
      if (fo.author_signature) authorSignature = fo.author_signature;
    } else if (fo.type === 'channel' && fo.chat) {
      const ch = fo.chat;
      sourceName = ch.title || 'Saluran Telegram';
      if (ch.username) username = `@${ch.username}`;
      if (fo.author_signature) authorSignature = fo.author_signature;
      if (fo.message_id) originalMessageId = fo.message_id;
    }
  }

  // 2. Classic Telegram API fields (for older updates or backward compatibility)
  if (!sourceName) {
    if (msg.forward_from) {
      originType = 'user';
      const u = msg.forward_from;
      sourceName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Pengguna Telegram';
      if (u.username) username = `@${u.username}`;
    } else if (msg.forward_from_chat) {
      const ch = msg.forward_from_chat;
      originType = ch.type || 'channel';
      sourceName = ch.title || (originType === 'channel' ? 'Saluran Telegram' : 'Grup Telegram');
      if (ch.username) username = `@${ch.username}`;
    } else if (msg.forward_sender_name) {
      originType = 'hidden_user';
      sourceName = msg.forward_sender_name;
    }

    if (msg.forward_signature) authorSignature = msg.forward_signature;
    if (msg.forward_date && !originalDate) originalDate = new Date(msg.forward_date * 1000);
    if (msg.forward_from_message_id && !originalMessageId) originalMessageId = msg.forward_from_message_id;
  }

  if (!sourceName && !originType) return null;

  let dateFormatted = '';
  if (originalDate && !isNaN(originalDate.getTime())) {
    dateFormatted = originalDate.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  }

  const typeLabels = {
    user: 'Akun Pengguna',
    hidden_user: 'Pengguna Privat',
    chat: 'Grup/Komunitas',
    channel: 'Saluran/Channel'
  };
  const typeLabel = typeLabels[originType] || 'Pesan Terusan';

  const metaParts = [`Sumber: ${sourceName}`];
  if (username) metaParts.push(username);
  if (typeLabel) metaParts.push(`Tipe: ${typeLabel}`);
  if (authorSignature) metaParts.push(`Penulis: "${authorSignature}"`);
  if (dateFormatted) metaParts.push(`Waktu Asli: ${dateFormatted}`);

  const header = `[PESAN TERUSAN TELEGRAM - ${metaParts.join(' | ')}]`;

  return {
    isForwarded: true,
    originType,
    sourceName: sourceName || 'Sumber Terusan',
    username,
    authorSignature,
    dateFormatted,
    typeLabel,
    header
  };
}

/**
 * Build rich guidance instructions for Bre AI on how to handle a forwarded message
 * @param {object} forwardInfo - Forward origin metadata
 * @returns {string} Context instructions for AI system
 */
function buildForwardGuidance(forwardInfo) {
  if (!forwardInfo) return '';
  return `\n\n[PANDUAN PEMROSESAN PESAN TERUSAN UNTUK BRE AI]:
Pesan di atas adalah pesan yang diteruskan (forwarded) oleh pengguna dari: "${forwardInfo.sourceName}" (${forwardInfo.typeLabel}${forwardInfo.username ? ` | ${forwardInfo.username}` : ''}).
Tugas Anda sebagai Bre AI:
- Pahami dan telaah isi pesan terusan tersebut secara menyeluruh.
- Jika pesan berisi pertanyaan/keluhan/masalah: berikan jawaban, solusi teknis, atau evaluasi terbaik.
- Jika pesan berupa kode/script/error: telaah, perbaiki, dan berikan kode atau solusi lengkap (jika diminta berkas/file, pastikan buat berkas lengkap).
- Jika pesan berupa artikel, berita, atau teks panjang: sajikan ringkasan intisari dan poin-poin penting yang rapi.
- Jika pengguna melampirkan instruksi atau pertanyaan tambahan bersama pesan terusan ini: prioritaskan pemenuhan instruksi pengguna tersebut.
- Tetaplah ramah, cerdas, solutif, dan bangga sebagai Bre AI ciptaan Amirun Rayan Ariandi.`;
}

module.exports = {
  extractForwardOrigin,
  buildForwardGuidance
};
