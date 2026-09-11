// ========================================================
// Bre AI v3.0 - Telegram Bot Admin: Security & Access Control
// Created by Amirun Rayan Ariandi
// ========================================================
const {
  getConfig,
  saveConfig
} = require('../../../api/_shared');
const api = require('../api');
const {
  recentUsers,
  getRecentUsersList,
  setUserRole,
  removeUserRole
} = require('../accessControl');

function editTelegramMessage(...args) { return api.editTelegramMessage(...args); }
function answerCallback(...args) { return api.answerCallback(...args); }
function sendTelegramMessage(...args) { return api.sendTelegramMessage(...args); }

async function handle(cq, botService, router = null) {
  const data = cq.data || '';
  const token = botService.activeToken || null;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const cfg = getConfig();

  if (data === 'adm_security') {
    await answerCallback(cq.id, null, false, token);
    const clientKeys = Array.isArray(cfg.clientKeys) ? cfg.clientKeys : [];
    const blacklist = Array.isArray(cfg.blacklist) ? cfg.blacklist : [];
    const rateMax = cfg.rateLimitMax || 5;
    const rateWin = cfg.rateLimitWindow || 30;

    const text = `🛡️ *Keamanan, Klien API & Kontrol Moderasi*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Client API Keys Terdaftar:* ${clientKeys.length} key\n` +
      `• *Rate Limit Anti-Spam:* Maks \`${rateMax} req\` per \`${rateWin} detik\`\n` +
      `• *Kata Terlarang (Blacklist):* ${blacklist.length} kata aktif\n` +
      `• *Master Client Key:* \`${cfg.clientApiKey ? cfg.clientApiKey.slice(0, 10) + '••••' : '(belum dibuat)'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih menu di bawah untuk mengelola:_`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔑 Multi-Client API Keys', callback_data: 'adm_clientkeys' },
          { text: '🎲 Master Client Key', callback_data: 'adm_masterkey' }
        ],
        [
          { text: `⏱️ Rate Limit (${rateMax}r/${rateWin}s)`, callback_data: 'adm_ratelimit_menu' },
          { text: `🚫 Blacklist (${blacklist.length})`, callback_data: 'adm_blacklist_menu' }
        ],
        [
          { text: '🔐 Ganti Password Admin', callback_data: 'adm_chpass_info' },
          { text: '⬅️ Menu Utama', callback_data: 'adm_main' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // 6a. Master Client Key Menu
  if (data === 'adm_masterkey') {
    await answerCallback(cq.id, null, false, token);
    const mKey = cfg.clientApiKey || '(belum dibuat)';
    const text = `🔑 *Master Client API Key*\n\n` +
      `Key ini dapat digunakan oleh aplikasi desktop/web eksternal (NextChat, Cherry Studio, Cline, dll) untuk mengakses endpoint proxy Bre AI.\n\n` +
      `• *Key Saat Ini:* \`${mKey}\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🎲 Generate Master Key Baru', callback_data: 'adm_gen_masterkey' }
        ],
        [
          { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_gen_masterkey') {
    const crypto = require('crypto');
    const rand = 'sk-bre-' + crypto.randomBytes(24).toString('hex');
    saveConfig({ clientApiKey: rand });
    await answerCallback(cq.id, '✅ Master API Key baru berhasil dibuat!', true, token);
    cq.data = 'adm_masterkey';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 6b. Multi-Client Keys Menu
  if (data === 'adm_clientkeys') {
    await answerCallback(cq.id, null, false, token);
    const clientKeys = Array.isArray(cfg.clientKeys) ? cfg.clientKeys : [];
    let text = `👥 *Manajemen Multi-Client API Keys*\n` +
      `Total Terdaftar: *${clientKeys.length} key*\n\n`;

    if (!clientKeys.length) {
      text += `_Belum ada Client API Key khusus. Buat di bawah:_\n`;
    } else {
      clientKeys.forEach((k, i) => {
        const masked = k.key ? (k.key.slice(0, 8) + '••••' + k.key.slice(-4)) : '-';
        const st = k.enabled !== false ? '🟢 Aktif' : '🔴 Revoked';
        text += `${i+1}. *${k.label || 'Klien'}* [${st}]\n   \`${masked}\`\n`;
      });
    }

    const rows = [];
    clientKeys.slice(0, 4).forEach((k, i) => {
      const isAct = k.enabled !== false;
      rows.push([
        { text: `${isAct ? '🔴 Cabut' : '🟢 Aktifkan'}: ${k.label || '#' + (i+1)}`, callback_data: `adm_ck_toggle:${i}` },
        { text: `🗑️ Hapus`, callback_data: `adm_ck_del:${i}` }
      ]);
    });

    rows.push([
      { text: '➕ Buat Key: Cherry Studio', callback_data: 'adm_ck_create:Cherry Studio' },
      { text: '➕ Buat Key: NextChat', callback_data: 'adm_ck_create:NextChat' }
    ]);
    rows.push([
      { text: '➕ Buat Key: Cline / VSCode', callback_data: 'adm_ck_create:Cline IDE' },
      { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  if (data.startsWith('adm_ck_toggle:')) {
    const idx = parseInt(data.split(':')[1]);
    const clientKeys = Array.isArray(cfg.clientKeys) ? [...cfg.clientKeys] : [];
    if (clientKeys[idx]) {
      clientKeys[idx].enabled = clientKeys[idx].enabled === false ? true : false;
      saveConfig({ clientKeys });
      await answerCallback(cq.id, `Status key [${clientKeys[idx].label}] diperbarui`, false, token);
    }
    cq.data = 'adm_clientkeys';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data.startsWith('adm_ck_del:')) {
    const idx = parseInt(data.split(':')[1]);
    const clientKeys = Array.isArray(cfg.clientKeys) ? [...cfg.clientKeys] : [];
    if (clientKeys[idx]) {
      const lbl = clientKeys[idx].label;
      clientKeys.splice(idx, 1);
      saveConfig({ clientKeys });
      await answerCallback(cq.id, `🗑️ Key [${lbl}] dihapus`, true, token);
    }
    cq.data = 'adm_clientkeys';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  if (data.startsWith('adm_ck_create:')) {
    const label = data.split(':')[1] || 'Client App';
    const clientKeys = Array.isArray(cfg.clientKeys) ? [...cfg.clientKeys] : [];
    const crypto = require('crypto');
    const rand = 'sk-bre-' + crypto.randomBytes(24).toString('hex');

    clientKeys.unshift({
      id: 'ck_' + Date.now(),
      label: label,
      key: rand,
      enabled: true,
      createdAt: new Date().toISOString()
    });
    saveConfig({ clientKeys });
    await answerCallback(cq.id, `✅ API Key baru untuk [${label}] dibuat!`, true, token);
    cq.data = 'adm_clientkeys';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 6c. Rate Limiter Menu
  if (data === 'adm_ratelimit_menu') {
    await answerCallback(cq.id, null, false, token);
    const rMax = cfg.rateLimitMax || 5;
    const rWin = cfg.rateLimitWindow || 30;
    const text = `⏱️ *Pengaturan Batas Request Per IP (Rate Limiter)*\n\n` +
      `Batas saat ini: *${rMax} request* per *${rWin} detik*\n\n` +
      `Mencegah spam & penyalahgunaan endpoint API oleh pihak tidak berizin.`;

    const markup = {
      inline_keyboard: [
        [
          { text: (rMax === 3 && rWin === 30) ? '✅ Ketat (3 req / 30s)' : 'Ketat (3 req / 30s)', callback_data: 'adm_setratelimit:3:30' }
        ],
        [
          { text: (rMax === 5 && rWin === 30) ? '✅ Standar (5 req / 30s)' : 'Standar (5 req / 30s)', callback_data: 'adm_setratelimit:5:30' }
        ],
        [
          { text: (rMax === 15 && rWin === 30) ? '✅ Santai (15 req / 30s)' : 'Santai (15 req / 30s)', callback_data: 'adm_setratelimit:15:30' }
        ],
        [
          { text: (rMax === 50 && rWin === 60) ? '✅ Tinggi (50 req / 60s)' : 'Tinggi (50 req / 60s)', callback_data: 'adm_setratelimit:50:60' }
        ],
        [
          { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setratelimit:')) {
    const parts = data.split(':');
    const rMax = parseInt(parts[1]);
    const rWin = parseInt(parts[2]);
    saveConfig({ rateLimitMax: rMax, rateLimitWindow: rWin });
    await answerCallback(cq.id, `✅ Rate limit diubah ke ${rMax} req / ${rWin}s`, false, token);
    cq.data = 'adm_ratelimit_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 6d. Blacklist Moderation Menu
  if (data === 'adm_blacklist_menu') {
    await answerCallback(cq.id, null, false, token);
    const list = Array.isArray(cfg.blacklist) ? cfg.blacklist : [];
    let text = `🛡️ *Daftar Kata Terlarang (Content Moderation)*\n\n` +
      `Total kata terlarang: *${list.length} kata*\n\n`;

    if (list.length > 0) {
      text += `*Daftar Kata Terlarang:*\n` + list.map(w => `• \`${w}\``).join('\n') + `\n\n`;
    } else {
      text += `_Belum ada kata terlarang yang didaftarkan._\n\n`;
    }

    text += `💡 *Cara Menambah Kata:*\nKetik perintah: \`/blacklist add [kata]\`\n_Contoh:_ \`/blacklist add spam_phrase\``;

    const markup = {
      inline_keyboard: [
        [
          { text: '🗑️ Kosongkan Semua Blacklist', callback_data: 'adm_clear_blacklist' }
        ],
        [
          { text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data === 'adm_clear_blacklist') {
    saveConfig({ blacklist: [] });
    await answerCallback(cq.id, '🗑️ Blacklist kata berhasil dikosongkan!', true, token);
    cq.data = 'adm_blacklist_menu';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 6e. Change Password Info
  if (data === 'adm_chpass_info') {
    await answerCallback(cq.id, null, false, token);
    const text = `🔐 *Ganti Password Login Web Admin*\n\n` +
      `Untuk mengganti password login Web Admin panel Anda secara langsung dari Telegram, gunakan format perintah:\n\n` +
      `\`/setpassword [password_baru_anda]\`\n\n` +
      `_Contoh:_\n\`/setpassword rahasia12345\`\n\n` +
      `Perubahan password akan langsung berlaku untuk Web Admin Dashboard.`;

    const markup = {
      inline_keyboard: [
        [{ text: '⬅️ Menu Keamanan', callback_data: 'adm_security' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  // ----------------------------------------------------
  // 7. TELEGRAM BOT SETTINGS & WEBHOOK
  // ----------------------------------------------------

  if (data.startsWith('adm_appr_wl:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    const uName = recentObj?.username || '';
    const uFullName = recentObj?.name || `User ${targetId}`;

    setUserRole(targetId, uName, uFullName, 'diizinkan');
    await answerCallback(cq.id, `✅ User ${uFullName} (@${uName || targetId}) berhasil diizinkan!`, true, token);

    // Notify the user that their access was approved
    try {
      const greetText = `🎉 *Akses Bre AI Diizinkan!*\n\nHalo ${uFullName}! Permintaan akses Anda telah disetujui oleh Owner. Sekarang Anda dapat menggunakan seluruh fitur kecerdasan Bre AI secara leluasa.\n\n_Kirim pesan atau pertanyaan apa pun untuk mulai berdiskusi!_ 🚀`;
      await sendTelegramMessage(targetId, greetText, null, null, token);
    } catch (e) {}

    // Update the notification message in Owner's chat
    const updatedAlert = (cq.message?.text || '') + `\n\n✅ *STATUS: Disetujui (Diizinkan) oleh Owner pada ${new Date().toLocaleTimeString('id-ID')}*`;
    await editTelegramMessage(chatId, messageId, updatedAlert, null, token);
    return;
  }

  if (data.startsWith('adm_appr_bl:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    const uName = recentObj?.username || '';
    const uFullName = recentObj?.name || `User ${targetId}`;

    setUserRole(targetId, uName, uFullName, 'blocked');
    await answerCallback(cq.id, `🔴 User ${uFullName} (@${uName || targetId}) telah diblokir!`, true, token);

    const updatedAlert = (cq.message?.text || '') + `\n\n🔴 *STATUS: Ditolak & Diblokir oleh Owner pada ${new Date().toLocaleTimeString('id-ID')}*`;
    await editTelegramMessage(chatId, messageId, updatedAlert, null, token);
    return;
  }

  if (data.startsWith('adm_appr_ign:')) {
    await answerCallback(cq.id, 'Notifikasi diabaikan', false, token);
    const updatedAlert = (cq.message?.text || '') + `\n\n⚪ *STATUS: Diabaikan oleh Owner.*`;
    await editTelegramMessage(chatId, messageId, updatedAlert, null, token);
    return;
  }

  // ----------------------------------------------------
  // 12. GAYA BAHASA (STYLE & TONE OF VOICE)
  // ----------------------------------------------------

  if (data === 'adm_mode') {
    await answerCallback(cq.id, null, false, token);
    const currentMode = cfg.telegramAccessMode || 'public';
    const isRestricted = (currentMode === 'whitelist' || currentMode === 'diizinkan');
    const text = `🛡️ *Pengaturan Mode Akses Bot:*\n` +
      `Mode saat ini: *${isRestricted ? '🔒 Khusus Pengguna Diizinkan' : '🟢 Terbuka untuk Publik'}*\n\n` +
      `• *🟢 Mode Publik:* Siapa saja di Telegram dapat mengobrol dengan bot (kecuali yang diblokir).\n` +
      `• *🔒 Mode Khusus Diizinkan:* Hanya akun Owner dan user yang telah disetujui (Diizinkan) yang dapat mengobrol. Pengguna baru yang mencoba chat akan meminta izin ke Owner.\n\n` +
      `Klik tombol di bawah untuk mengganti mode:`;
    const markup = {
      inline_keyboard: [
        [
          { text: !isRestricted ? '✅ 🟢 Buka untuk Publik' : '🟢 Buka untuk Publik', callback_data: 'adm_setmode:public' }
        ],
        [
          { text: isRestricted ? '✅ 🔒 Khusus Diizinkan' : '🔒 Khusus Diizinkan', callback_data: 'adm_setmode:diizinkan' }
        ],
        [
          { text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }
        ]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_setmode:')) {
    const newMode = data.split(':')[1];
    saveConfig({ telegramAccessMode: newMode });
    botService.activeAccessMode = newMode;
    const isRestricted = (newMode === 'whitelist' || newMode === 'diizinkan');
    await answerCallback(cq.id, `✅ Mode bot diubah ke: ${isRestricted ? '🔒 Khusus Diizinkan' : '🟢 Publik'}`, false, token);

    cq.data = 'adm_mode';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // ----------------------------------------------------
  // 14. BAHASA BOT DEFAULT
  // ----------------------------------------------------

  if (data === 'adm_users' || data.startsWith('adm_users:')) {
    await answerCallback(cq.id, null, false, token);
    const parts = data.split(':');
    let page = parseInt(parts[1]) || 1;
    const filter = parts[2] || 'all'; // 'all' | 'allowed' | 'blocked'

    const allUsers = Array.isArray(cfg.telegramUsers) ? [...cfg.telegramUsers] : [];
    const recent = getRecentUsersList();

    const allowedUsers = allUsers.filter(u => u.role === 'diizinkan' || u.role === 'whitelist' || u.role === 'owner');
    const blockedUsers = allUsers.filter(u => u.role === 'blocked');

    let filteredUsers = allUsers;
    if (filter === 'allowed') filteredUsers = allowedUsers;
    else if (filter === 'blocked') filteredUsers = blockedUsers;

    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const startIndex = (page - 1) * pageSize;
    const pageUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

    const filterLabels = {
      all: '👥 Semua Pengguna',
      allowed: '🟢 Pengguna Diizinkan',
      blocked: '🔴 Pengguna Diblokir'
    };

    let text = `👥 *Manajemen Pengguna Telegram*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Total Terdaftar: *${allUsers.length} akun*\n` +
      `• 🟢 Diizinkan: *${allowedUsers.length} akun*\n` +
      `• 🔴 Diblokir: *${blockedUsers.length} akun*\n` +
      `• ⚡ Pengunjung Baru: *${recent.length} user*\n` +
      `• Filter Aktif: *${filterLabels[filter] || 'Semua'}* (Hal ${page}/${totalPages})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (pageUsers.length === 0) {
      text += `_Tidak ada data pengguna pada filter ini._\n\n`;
    } else {
      text += `_Pilih akun di bawah untuk kelola hak akses / hapus:_\n\n`;
    }

    const rows = [];

    // User buttons (1 per row)
    pageUsers.forEach((u, i) => {
      const isOwnerRole = u.role === 'owner';
      const isBlocked = u.role === 'blocked';
      const badge = isOwnerRole ? '👑' : (isBlocked ? '🔴' : '🟢');
      const roleName = isOwnerRole ? 'Owner' : (isBlocked ? 'Blokir' : 'Diizinkan');
      const displayName = u.name || (u.username ? `@${u.username}` : `User ${u.id}`);
      const idTag = u.username ? `@${u.username}` : u.id;

      rows.push([{
        text: `${badge} [${roleName}] ${displayName.slice(0, 20)} (${idTag})`,
        callback_data: `adm_user_view:${u.id}`
      }]);
    });

    // Pagination row (if more than 1 page)
    if (totalPages > 1) {
      const prevPage = Math.max(1, page - 1);
      const nextPage = Math.min(totalPages, page + 1);
      rows.push([
        { text: page > 1 ? '◀️ Prev' : '⏸️', callback_data: `adm_users:${prevPage}:${filter}` },
        { text: `📄 ${page} / ${totalPages}`, callback_data: `adm_users:${page}:${filter}` },
        { text: page < totalPages ? 'Next ▶️' : '⏸️', callback_data: `adm_users:${nextPage}:${filter}` }
      ]);
    }

    // Filter Switch Tabs
    rows.push([
      { text: filter === 'all' ? '🔘 Semua' : '👥 Semua', callback_data: `adm_users:1:all` },
      { text: filter === 'allowed' ? '🔘 Diizinkan' : '🟢 Diizinkan', callback_data: `adm_users:1:allowed` },
      { text: filter === 'blocked' ? '🔘 Diblokir' : '🔴 Diblokir', callback_data: `adm_users:1:blocked` }
    ]);

    // Unregistered recent visitors one-click approve
    const unregRecent = recent.filter(r => !allUsers.some(u => String(u.id) === String(r.id))).slice(0, 2);
    if (unregRecent.length > 0) {
      unregRecent.forEach(r => {
        rows.push([{
          text: `⚡ Izinkan Baru: @${r.username || r.name} (${r.id})`,
          callback_data: `adm_addrecent:${r.id}`
        }]);
      });
    }

    rows.push([
      { text: '➕ Tambah Manual', callback_data: 'adm_user_help' },
      { text: '🔄 Refresh', callback_data: `adm_users:${page}:${filter}` }
    ]);

    rows.push([
      { text: '⬅️ Menu Pengaturan Bot', callback_data: 'adm_telegram' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: rows }, token);
    return;
  }

  // 15a. View Individual User Detail & Actions
  if (data.startsWith('adm_user_view:')) {
    await answerCallback(cq.id, null, false, token);
    const targetId = data.split(':')[1];
    const users = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers : [];
    const u = users.find(x => String(x.id) === String(targetId) || (x.username && x.username.toLowerCase() === targetId.toLowerCase()));

    if (!u) {
      await answerCallback(cq.id, 'Pengguna tidak ditemukan dalam database.', true, token);
      cq.data = 'adm_users:1:all';
      return (router ? router(cq, botService) : handle(cq, botService, router));
    }

    const isOwnerRole = u.role === 'owner';
    const isBlocked = u.role === 'blocked';
    const badge = isOwnerRole ? '👑 Owner' : (isBlocked ? '🔴 Diblokir' : '🟢 Diizinkan');
    const addedTime = u.addedAt ? new Date(u.addedAt).toLocaleString('id-ID') : '-';
    const updatedTime = u.updatedAt ? new Date(u.updatedAt).toLocaleString('id-ID') : '-';

    const text = `👤 *Detail Pengguna Telegram*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Nama / Label:* ${u.name || '-'}\n` +
      `• *Username:* ${u.username ? '@' + u.username : '_(tidak ada)_'}\n` +
      `• *ID Telegram:* \`${u.id || '-'}\`\n` +
      `• *Status Hak Akses:* ${badge}\n` +
      `• *Waktu Ditambahkan:* ${addedTime}\n` +
      `• *Pembaruan Terakhir:* ${updatedTime}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pilih tindakan untuk pengguna ini:_`;

    const actionRows = [];
    if (!isOwnerRole) {
      actionRows.push([
        { text: u.role === 'diizinkan' || u.role === 'whitelist' ? '✅ 🟢 Status: Diizinkan' : '🟢 Izinkan Akun Ini', callback_data: `adm_user_role:${u.id}:diizinkan` },
        { text: isBlocked ? '✅ 🔴 Status: Diblokir' : '🔴 Blokir Akun Ini', callback_data: `adm_user_role:${u.id}:blocked` }
      ]);
      actionRows.push([
        { text: '🗑️ Hapus dari Database', callback_data: `adm_user_del:${u.id}` }
      ]);
    }
    actionRows.push([
      { text: '⬅️ Kembali ke Daftar Pengguna', callback_data: 'adm_users:1:all' }
    ]);

    await editTelegramMessage(chatId, messageId, text, { inline_keyboard: actionRows }, token);
    return;
  }

  // 15b. Set Role for Individual User
  if (data.startsWith('adm_user_role:')) {
    const parts = data.split(':');
    const targetId = parts[1];
    const newRole = parts[2] || 'diizinkan';

    const users = Array.isArray(cfg.telegramUsers) ? cfg.telegramUsers : [];
    const u = users.find(x => String(x.id) === String(targetId) || (x.username && x.username.toLowerCase() === targetId.toLowerCase()));
    const uName = u?.username || '';
    const uFullName = u?.name || `User ${targetId}`;

    setUserRole(targetId, uName, uFullName, newRole);
    const label = newRole === 'blocked' ? '🔴 Diblokir' : '🟢 Diizinkan';
    await answerCallback(cq.id, `✅ Status ${uFullName} diubah menjadi: ${label}`, true, token);

    cq.data = `adm_user_view:${targetId}`;
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 15c. Delete Individual User from Database
  if (data.startsWith('adm_user_del:')) {
    const targetId = data.split(':')[1];
    removeUserRole(targetId);
    await answerCallback(cq.id, `✅ Pengguna (${targetId}) berhasil dihapus dari database.`, true, token);

    cq.data = 'adm_users:1:all';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }

  // 15d. Help on adding users manually
  if (data === 'adm_user_help') {
    await answerCallback(cq.id, null, false, token);
    const text = `➕ *Panduan Menambahkan Pengguna Secara Manual*\n\n` +
      `Untuk menambahkan pengguna yang diizinkan langsung lewat chat, ketikkan:\n` +
      `\`/izinkan [ID atau @username] [Nama/Catatan]\`\n\n` +
      `_Contoh:_\n` +
      `• \`/izinkan 123456789 Rayan Sahabat\`\n` +
      `• \`/izinkan @amirunrayan Developer\`\n\n` +
      `Untuk memblokir pengguna:\n` +
      `• \`/blokir 123456789\`\n\n` +
      `Untuk menghapus pengguna dari daftar:\n` +
      `• \`/batalizin 123456789\``;

    const markup = {
      inline_keyboard: [
        [{ text: '⬅️ Kembali ke Daftar Pengguna', callback_data: 'adm_users:1:all' }]
      ]
    };
    await editTelegramMessage(chatId, messageId, text, markup, token);
    return;
  }

  if (data.startsWith('adm_addrecent:')) {
    const targetId = data.split(':')[1];
    const recentObj = recentUsers.get(Number(targetId)) || recentUsers.get(targetId);
    if (recentObj) {
      setUserRole(targetId, recentObj.username, recentObj.name, 'diizinkan');
      await answerCallback(cq.id, `✅ User @${recentObj.username || recentObj.name} berhasil diizinkan!`, true, token);
    } else {
      await answerCallback(cq.id, 'User tidak ditemukan dalam sesi aktif', false, token);
    }
    cq.data = 'adm_users:1:all';
    return (router ? router(cq, botService) : handle(cq, botService, router));
  }


  return false;
}

module.exports = { handle };
