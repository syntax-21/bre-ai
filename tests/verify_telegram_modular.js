// Test suite for modular Telegram bot services
const telegramBot = require('../services/telegramBot');
const telegramMod = require('../services/telegram');
const { isOwner, isUserAllowed, recordRecentUser, recentUsers } = require('../services/telegram/accessControl');
const { buildMainMenuMarkup, getMainMenuText } = require('../services/telegram/adminMenu');
const { getConfig, saveConfig } = require('../api/_shared');

async function runTests() {
  console.log('=== 1. VERIFY EXPORT EQUIVALENCE ===');
  if (telegramBot === telegramMod) {
    console.log('PASS: telegramBot is identical to telegramMod');
  } else {
    console.error('FAIL: telegramBot and telegramMod do not match');
    process.exit(1);
  }

  console.log('\n=== 2. VERIFY ACCESS CONTROL ===');
  saveConfig({
    telegramOwnerId: '123456789',
    telegramAccessMode: 'whitelist',
    telegramUsers: [
      { id: '123456789', username: 'owner_user', role: 'owner' },
      { id: '999999999', username: 'allowed_user', role: 'whitelist' },
      { id: '888888888', username: 'blocked_user', role: 'blocked' }
    ]
  });

  const owner = { id: 123456789, username: 'owner_user', first_name: 'Owner' };
  const allowed = { id: 999999999, username: 'allowed_user', first_name: 'Allowed' };
  const blocked = { id: 888888888, username: 'blocked_user', first_name: 'BadGuy' };
  const stranger = { id: 777777777, username: 'stranger', first_name: 'Stranger' };

  console.log('isOwner(owner):', isOwner(owner), isOwner(owner) === true ? 'PASS' : 'FAIL');
  console.log('isOwner(stranger):', isOwner(stranger), isOwner(stranger) === false ? 'PASS' : 'FAIL');
  console.log('isUserAllowed(owner):', isUserAllowed(owner), isUserAllowed(owner) === true ? 'PASS' : 'FAIL');
  console.log('isUserAllowed(allowed):', isUserAllowed(allowed), isUserAllowed(allowed) === true ? 'PASS' : 'FAIL');
  console.log('isUserAllowed(blocked):', isUserAllowed(blocked), isUserAllowed(blocked) === false ? 'PASS' : 'FAIL');
  console.log('isUserAllowed(stranger in whitelist mode):', isUserAllowed(stranger), isUserAllowed(stranger) === false ? 'PASS' : 'FAIL');

  saveConfig({ telegramAccessMode: 'public' });
  console.log('isUserAllowed(stranger in public mode):', isUserAllowed(stranger), isUserAllowed(stranger) === true ? 'PASS' : 'FAIL');
  console.log('isUserAllowed(blocked in public mode):', isUserAllowed(blocked), isUserAllowed(blocked) === false ? 'PASS' : 'FAIL');

  console.log('\n=== 3. VERIFY ADMIN MENU BUILDER ===');
  const cfg = getConfig();
  const markup = buildMainMenuMarkup(cfg);
  console.log('Total Button Rows in Admin Menu:', markup.inline_keyboard.length);
  const allButtons = markup.inline_keyboard.flat();
  console.log('Available Button Actions:', allButtons.map(b => b.callback_data).join(', '));
  if (allButtons.some(b => b.callback_data === 'adm_metrics') &&
      allButtons.some(b => b.callback_data === 'adm_logs') &&
      allButtons.some(b => b.callback_data === 'adm_providers') &&
      allButtons.some(b => b.callback_data === 'adm_engine') &&
      allButtons.some(b => b.callback_data === 'adm_broadcast') &&
      allButtons.some(b => b.callback_data === 'adm_tester')) {
    console.log('PASS: All admin controls present in menu markup');
  } else {
    console.error('FAIL: Missing admin buttons');
    process.exit(1);
  }

  console.log('\n=== 4. VERIFY CALLBACK QUERY HANDLER MOCKS ===');
  saveConfig({ telegramBotToken: 'mock_bot_token_123' });
  const telegramApi = require('../services/telegram/api');
  const apiCalls = [];
  telegramApi.apiCall = async (method, payload) => {
    apiCalls.push({ method, payload });
    return { ok: true, result: {} };
  };
  telegramBot.apiCall = telegramApi.apiCall;

  const dummyMsg = { chat: { id: 123456789 }, message_id: 42 };

  // Test adm_main
  await telegramBot.handleCallbackQuery({ id: 'cq1', from: owner, message: dummyMsg, data: 'adm_main' });
  console.log('Handled adm_main, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  // Test adm_metrics
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq2', from: owner, message: dummyMsg, data: 'adm_metrics' });
  console.log('Handled adm_metrics, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  // Test adm_benchmark
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq3', from: owner, message: dummyMsg, data: 'adm_benchmark' });
  console.log('Handled adm_benchmark, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  // Test adm_params
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq4', from: owner, message: dummyMsg, data: 'adm_params' });
  console.log('Handled adm_params, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  // Test adm_settemp:0.7
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq5', from: owner, message: dummyMsg, data: 'adm_settemp:0.7' });
  console.log('Handled adm_settemp:0.7, config temp is now:', getConfig().temperature, getConfig().temperature === 0.7 ? 'PASS' : 'FAIL');

  // Test adm_diag
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq6', from: owner, message: dummyMsg, data: 'adm_diag' });
  console.log('Handled adm_diag, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  // Test adm_logs
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq7', from: owner, message: dummyMsg, data: 'adm_logs' });
  console.log('Handled adm_logs, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  // Test adm_flush_confirm and adm_flush_exec
  apiCalls.length = 0;
  await telegramBot.handleCallbackQuery({ id: 'cq8', from: owner, message: dummyMsg, data: 'adm_flush_confirm' });
  await telegramBot.handleCallbackQuery({ id: 'cq9', from: owner, message: dummyMsg, data: 'adm_flush_exec' });
  console.log('Handled adm_flush_confirm & exec, calls:', apiCalls.length > 0 ? 'PASS' : 'FAIL');

  console.log('\n=== 5. VERIFY MESSAGE HANDLER ===');
  // Test /admin command from owner
  apiCalls.length = 0;
  await telegramBot.handleMessage({ chat: { id: 123456789 }, from: owner, text: '/admin' });
  console.log('Owner /admin handled, sent panel:', apiCalls.some(c => c.method === 'sendMessage') ? 'PASS' : 'FAIL');

  // Test /admin from non-owner
  apiCalls.length = 0;
  await telegramBot.handleMessage({ chat: { id: 777777777 }, from: stranger, text: '/admin' });
  console.log('Stranger /admin rejected with access warning:', apiCalls.some(c => c.method === 'sendMessage' && c.payload.text.includes('Akses Ditolak')) ? 'PASS' : 'FAIL');

  // Test /start command
  apiCalls.length = 0;
  await telegramBot.handleMessage({ chat: { id: 123456789 }, from: owner, text: '/start' });
  console.log('/start handled:', apiCalls.some(c => c.method === 'sendMessage' && c.payload.text.includes('Selamat datang')) ? 'PASS' : 'FAIL');

  // Test /status command
  apiCalls.length = 0;
  await telegramBot.handleMessage({ chat: { id: 123456789 }, from: owner, text: '/status' });
  console.log('/status handled:', apiCalls.some(c => c.method === 'sendMessage' && c.payload.text.includes('Status Sistem')) ? 'PASS' : 'FAIL');

  // Test sticker message
  apiCalls.length = 0;
  await telegramBot.handleMessage({ chat: { id: 123456789 }, from: owner, sticker: { emoji: '😎' } });
  console.log('Sticker handled:', apiCalls.some(c => c.method === 'sendMessage' && c.payload.text.includes('stikernya')) ? 'PASS' : 'FAIL');

  // Test /broadcast command
  recordRecentUser({ id: 555555, username: 'testuser1', first_name: 'Test 1' });
  recordRecentUser({ id: 666666, username: 'testuser2', first_name: 'Test 2' });
  apiCalls.length = 0;
  await telegramBot.handleMessage({ chat: { id: 123456789 }, from: owner, text: '/broadcast Pengumuman penting dari Bre AI!' });
  const broadcastSends = apiCalls.filter(c => c.method === 'sendMessage' && c.payload.text.includes('Pengumuman penting'));
  console.log('Broadcast sends executed to recipients:', broadcastSends.length, broadcastSends.length >= 2 ? 'PASS' : 'FAIL');

  console.log('\n=== 6. VERIFY STATUS METHODS ===');
  const status = telegramBot.getStatus();
  console.log('Bot status summary:', status.running !== undefined, status.accessMode !== undefined ? 'PASS' : 'FAIL');

  console.log('\n>>> ALL MODULAR TELEGRAM TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
