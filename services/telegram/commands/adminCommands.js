// ========================================================
// Bre AI v3.0 - Telegram Commands: Admin, Access & Users
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig,
  clearResponseCache
} = require('../../../api/_shared');
const api = require('../api');
const {
  setUserRole,
  removeUserRole,
  recentUsers
} = require('../accessControl');
const { sendAdminPanel } = require('../adminMenu');

// Broadcast announcement to all known users
async function handleBroadcastCommand(chatId, fromUser, broadcastText, botService) {
  const token = botService.activeToken || null;
  const messageToSend = broadcastText.trim();
  if (!messageToSend) {
    await api.sendTelegramMessage(
      chatId,
      '📢 *Panduan Format Broadcast:*\n\nGunakan format:\n`/broadcast [isi pesan siaran]`\n\n_Contoh:_\n`/broadcast Halo! Kami baru saja memperbarui kecerdasan Bre AI ke versi terbaru 🚀`',
      null, null, token
    );
    return true;
  }

  const cfg = getConfig();
  const recipientIds = new Set();

  for (const [uid] of recentUsers) {
    recipientIds.add(Number(uid));
  }
  if (Array.isArray(cfg.telegramUsers)) {
    for (const u of cfg.telegramUsers) {
      if (u.id && !isNaN(Number(u.id)) && u.role !== 'blocked') {
        recipientIds.add(Number(u.id));
      }
    }
  }

  if (recipientIds.size === 0) {
    await api.sendTelegramMessage(
      chatId,
      '⚠️ *Tidak Ada Penerima Siaran*\n\nBelum ada pengguna lain yang berinteraksi dengan bot sejak server aktif.',
      null, null, token
    );
    return true;
  }

  await api.sendTelegramMessage(chatId, `🚀 *Memulai Pengiriman Siaran...*\nTarget penerima: ${recipientIds.size} pengguna.`, null, null, token);

  let successCount = 0;
  let failCount = 0;
  const formattedBroadcast = `📢 *PENGUMUMAN RESMI BRE AI*\n\n${messageToSend}\n\n— _Pesan dari Pengelola Bot_`;

  for (const targetId of recipientIds) {
    if (String(targetId) === String(fromUser.id)) continue;
    try {
      await api.sendTelegramMessage(targetId, formattedBroadcast, null, null, token);
      successCount++;
      await new Promise(r => setTimeout(r, 60));
    } catch (err) {
      failCount++;
    }
  }

  await api.sendTelegramMessage(
    chatId,
    `✅ *Laporan Siaran Broadcast Selesai*\n\n` +
    `• Berhasil terkirim: *${successCount} pengguna*\n` +
    `• Gagal terkirim: *${failCount} pengguna*\n` +
    `• Total target: *${recipientIds.size} akun*`,
    null, null, token
  );
  return true;
}

async function handle(ctx) {
  const { msg, botService, text, lowerText, chatId, fromUser, senderName, senderTag, token, isOwnerUser, queryBreAIRouter } = ctx;

  // /admin
  if (text === '/admin' || text.startsWith('/admin ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(
        chatId,
        `⛔ *Akses Ditolak*\n\nPerintah \`/admin\` hanya dapat diakses secara eksklusif oleh *Pemilik Bot (Owner)*.`,
        null, null, token
      );
      return true;
    }
    await sendAdminPanel(chatId, senderName, botService.conversations.size, token);
    return true;
  }


  if (lowerText === '/setmode' || lowerText.startsWith('/setmode ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawMode = text.slice(8).trim().toLowerCase();
    let mode = '';
    if (rawMode === 'public') mode = 'public';
    else if (rawMode === 'diizinkan' || rawMode === 'whitelist') mode = 'diizinkan';

    if (!mode) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/setmode public\` atau \`/setmode diizinkan\``, null, null, token);
      return true;
    }
    saveConfig({ telegramAccessMode: mode });
    botService.activeAccessMode = mode;
    await api.sendTelegramMessage(chatId, `✅ Mode akses bot diubah ke: *${mode === 'public' ? '🟢 Publik' : '🔒 Khusus Pengguna Diizinkan'}*`, null, null, token);
    return true;
  }


  // /setpassword [new_password]
  if (lowerText.startsWith('/setpassword')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const newPass = text.slice(12).trim();
    if (!newPass) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/setpassword [password_baru]\``, null, null, token);
      return true;
    }
    saveConfig({ adminPassword: newPass });
    await api.sendTelegramMessage(chatId, `✅ Password login Web Admin berhasil diganti!`, null, null, token);
    return true;
  }


  // /izinkan [id/@username] [optional name] (alias: /whitelist)
  if (lowerText.startsWith('/izinkan') || lowerText.startsWith('/whitelist')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cmdLen = lowerText.startsWith('/izinkan') ? 8 : 10;
    const args = text.slice(cmdLen).trim().split(/\s+/);
    const target = args[0];
    const customName = args.slice(1).join(' ') || '';
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/izinkan [ID atau @username] [Nama/Catatan]\`\nContoh: \`/izinkan 123456789 Rayan Sahabat\``, null, null, token);
      return true;
    }
    const isId = !isNaN(Number(target));
    const uId = isId ? target : target.replace(/^@/, '');
    const uName = isId ? '' : target.replace(/^@/, '');
    const userEntry = setUserRole(uId, uName, customName, 'diizinkan');
    await api.sendTelegramMessage(chatId, `✅ Pengguna *${userEntry.name}* (\`${userEntry.id || '@' + userEntry.username}\`) berhasil ditambahkan ke daftar Pengguna Diizinkan!`, null, null, token);
    return true;
  }


  // /blokir [id/@username] (alias: /block)
  if (lowerText.startsWith('/blokir') || lowerText.startsWith('/block')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const cmdLen = lowerText.startsWith('/blokir') ? 7 : 6;
    const target = text.slice(cmdLen).trim();
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/blokir [ID atau @username]\``, null, null, token);
      return true;
    }
    const isId = !isNaN(Number(target));
    const uId = isId ? target : target.replace(/^@/, '');
    const uName = isId ? '' : target.replace(/^@/, '');
    const userEntry = setUserRole(uId, uName, `Blocked User`, 'blocked');
    await api.sendTelegramMessage(chatId, `🔴 Pengguna *${userEntry.name}* (\`${target}\`) telah diblokir dari bot!`, null, null, token);
    return true;
  }


  // /batalizin [id/@username] (alias: /hapususer, /unblock)
  if (lowerText.startsWith('/batalizin') || lowerText.startsWith('/hapususer') || lowerText.startsWith('/unblock')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const parts = text.trim().split(/\s+/);
    const target = parts[1];
    if (!target) {
      await api.sendTelegramMessage(chatId, `ℹ️ Format: \`/batalizin [ID atau @username]\``, null, null, token);
      return true;
    }
    removeUserRole(target);
    await api.sendTelegramMessage(chatId, `✅ Pengguna \`${target}\` telah dihapus dari daftar perizinan / blokir.`, null, null, token);
    return true;
  }


  // /pengguna (alias: /users)
  if (text === '/pengguna' || text === '/users') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const users = Array.isArray(getConfig().telegramUsers) ? getConfig().telegramUsers : [];
    let uMsg = `👥 *Daftar Pengguna Terdaftar (${users.length} akun):*\n\n`;
    if (!users.length) {
      uMsg += `_Belum ada pengguna khusus terdaftar._`;
    } else {
      users.forEach((u, i) => {
        const isOwnerRole = u.role === 'owner';
        const isBlocked = u.role === 'blocked';
        const badge = isOwnerRole ? '👑 Owner' : (isBlocked ? '🔴 Diblokir' : '🟢 Diizinkan');
        uMsg += `${i+1}. *${u.name || u.username || u.id}* [${badge}]\n   \`${u.username ? '@' + u.username : u.id}\`\n`;
      });
    }
    await api.sendTelegramMessage(chatId, uMsg, null, null, token);
    return true;
  }


  // /blacklist [list | add kata | clear]
  if (lowerText.startsWith('/blacklist')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const rawArg = text.slice(10).trim();
    const parts = rawArg.split(/\s+/);
    const subCmd = parts[0]?.toLowerCase();
    const currentBlacklist = Array.isArray(getConfig().blacklist) ? [...getConfig().blacklist] : [];

    if (subCmd === 'add') {
      const word = parts.slice(1).join(' ').trim();
      if (!word) {
        await api.sendTelegramMessage(chatId, 'ℹ️ Format: `/blacklist add [kata]`', null, null, token);
        return true;
      }
      if (!currentBlacklist.includes(word)) {
        currentBlacklist.push(word);
        saveConfig({ blacklist: currentBlacklist });
      }
      await api.sendTelegramMessage(chatId, `✅ Kata \`${word}\` ditambahkan ke Blacklist Moderasi!`, null, null, token);
      return true;
    }

    if (subCmd === 'clear') {
      saveConfig({ blacklist: [] });
      await api.sendTelegramMessage(chatId, `🗑️ Blacklist kata berhasil dikosongkan!`, null, null, token);
      return true;
    }

    let blMsg = `🛡️ *Daftar Kata Terlarang (Blacklist ${currentBlacklist.length} kata):*\n\n`;
    if (!currentBlacklist.length) {
      blMsg += `_Belum ada kata terlarang didaftarkan._\n\nKetik \`/blacklist add [kata]\` untuk menambah kata.`;
    } else {
      blMsg += currentBlacklist.map(w => `• \`${w}\``).join('\n') + `\n\nKetik \`/blacklist add [kata]\` untuk menambah kata.`;
    }
    await api.sendTelegramMessage(chatId, blMsg, null, null, token);
    return true;
  }


  // /export
  if (text === '/export') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    const fullConfig = getConfig();
    const configStr = JSON.stringify(fullConfig, null, 2);
    const fileName = `bre_ai_config_${new Date().toISOString().slice(0, 10)}.json`;
    const caption = `📦 *Backup Konfigurasi Bre AI*\nTanggal: ${new Date().toLocaleString('id-ID')}`;
    try {
      await api.sendTelegramDocument(chatId, fileName, configStr, caption, token);
    } catch (e) {
      await api.sendTelegramMessage(chatId, `⚠️ Gagal mengirim berkas backup: ${e.message}`, null, null, token);
    }
    return true;
  }


  // /clearcache
  if (text === '/clearcache') {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah ini khusus untuk Owner.', null, null, token);
      return true;
    }
    clearResponseCache();
    botService.conversations.clear();
    await api.sendTelegramMessage(chatId, `⚡ *Cache RAM dan seluruh sesi percakapan berhasil dibersihkan!*`, null, null, token);
    return true;
  }


  // /broadcast [pesan]
  if (text === '/broadcast' || text.startsWith('/broadcast ')) {
    if (!isOwnerUser) {
      await api.sendTelegramMessage(chatId, '⛔ Perintah siaran hanya dapat dijalankan oleh Owner.', null, null, token);
      return true;
    }
    const broadcastBody = text.slice(10).trim();
    await handleBroadcastCommand(chatId, fromUser, broadcastBody, botService);
    return true;
  }


  return false;
}

module.exports = {
  handle,
  handleBroadcastCommand
};
