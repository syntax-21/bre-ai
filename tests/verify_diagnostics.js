// ========================================================
// Test Suite: Verify Ping, Detect Model, & Live Model Tester
// ========================================================
const assert = require('assert');
const { getConfig, saveConfig } = require('../api/_shared');
const { handleAdminCallback } = require('../services/telegram/adminMenu');
const { handleSlashCommand } = require('../services/telegram/commandHandler');
const { handleMessage } = require('../services/telegram/messageHandler');

async function runDiagnosticsTests() {
  console.log('🧪 Starting Diagnostics Test Suite (Ping, Detect, Live Test)...');

  const cfg = getConfig();
  const testChatId = 123456789;
  const mockToken = 'mock-test-token';
  const ownerUser = { id: cfg.telegramOwnerId || 999000111, first_name: 'Amirun' };

  let lastSentMessage = null;
  let lastEditedMessage = null;
  let lastAnswerCallback = null;

  // Mock botService
  const mockBotService = {
    activeToken: mockToken,
    activeOwnerId: ownerUser.id,
    activeAccessMode: 'public',
    conversations: new Map(),
    sendTelegramMessage: async (chatId, text, markup) => {
      lastSentMessage = { chatId, text, markup };
      return { message_id: 101, text };
    },
    editTelegramMessage: async (chatId, messageId, text, markup) => {
      lastEditedMessage = { chatId, messageId, text, markup };
      return { message_id: messageId, text };
    },
    answerCallback: async (cqId, text, showAlert) => {
      lastAnswerCallback = { cqId, text, showAlert };
      return true;
    },
    queryBreAIRouter: async (prompt) => {
      return 'Halo! Saya Bre AI, asisten kecerdasan buatan serba bisa yang diciptakan oleh Amirun Rayan Ariandi.';
    }
  };

  // Mock API methods inside services/telegram/api
  const api = require('../services/telegram/api');
  api.sendTelegramMessage = mockBotService.sendTelegramMessage;
  api.editTelegramMessage = mockBotService.editTelegramMessage;
  api.answerCallback = mockBotService.answerCallback;

  // Mock fetch for upstream testing
  const originalFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    if (url.includes('/models')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'mercury-2' }, { id: 'mercury-preview' }, { id: 'deepseek-chat' }]
        })
      };
    }
    // Chat completion dummy probe
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Halo! Saya Bre AI siap membantu Anda.' } }]
      })
    };
  };

  try {
    // ----------------------------------------------------
    // TEST 1: adm_prov_ping:0 (Inline Button Test Ping Latensi)
    // ----------------------------------------------------
    console.log('\n1. Testing Inline Button "⚡ Test Ping Latensi" (adm_prov_ping:0)...');
    lastEditedMessage = null;
    await handleAdminCallback({
      id: 'cq_ping_1',
      from: ownerUser,
      message: { chat: { id: testChatId }, message_id: 201 },
      data: 'adm_prov_ping:0'
    }, mockBotService);

    assert(lastEditedMessage, 'editTelegramMessage must be called for adm_prov_ping');
    assert(lastEditedMessage.text.includes('Hasil Uji Ping & Latensi Provider'), 'Must display Ping Results');
    assert(lastEditedMessage.text.includes('Online (HTTP 200 OK)'), 'Must indicate 200 OK');
    console.log('   ✅ Inline Test Ping Latensi: PASS -> Output rendered with latency & status!');

    // ----------------------------------------------------
    // TEST 2: adm_prov_detect:0 (Inline Button Detect Model)
    // ----------------------------------------------------
    console.log('\n2. Testing Inline Button "🔍 Detect Model" (adm_prov_detect:0)...');
    lastEditedMessage = null;
    await handleAdminCallback({
      id: 'cq_detect_1',
      from: ownerUser,
      message: { chat: { id: testChatId }, message_id: 202 },
      data: 'adm_prov_detect:0'
    }, mockBotService);

    assert(lastEditedMessage, 'editTelegramMessage must be called for adm_prov_detect');
    assert(lastEditedMessage.text.includes('Berhasil Mendeteksi Model'), 'Must display detected models text');
    assert(lastEditedMessage.text.includes('mercury-2'), 'Must list detected model');
    console.log('   ✅ Inline Detect Model: PASS -> Output rendered with detected models list!');

    // ----------------------------------------------------
    // TEST 3: adm_prov_test:0 (Inline Button Test Model Live from Provider)
    // ----------------------------------------------------
    console.log('\n3. Testing Inline Button "🧪 Test Model Live" (adm_prov_test:0)...');
    lastEditedMessage = null;
    await handleAdminCallback({
      id: 'cq_prov_test_1',
      from: ownerUser,
      message: { chat: { id: testChatId }, message_id: 203 },
      data: 'adm_prov_test:0'
    }, mockBotService);

    assert(lastEditedMessage, 'editTelegramMessage must be called for adm_prov_test');
    assert(lastEditedMessage.text.includes('Live Test Model Berhasil'), 'Must indicate success');
    console.log('   ✅ Inline Provider Test Live: PASS -> Output rendered with live test response!');

    // ----------------------------------------------------
    // TEST 4: adm_run_test:mercury-2 (Inline Button Live Model Tester from Main Menu)
    // ----------------------------------------------------
    console.log('\n4. Testing Main Menu "🧪 Live Model Tester" (adm_run_test:mercury-2)...');
    lastEditedMessage = null;
    await handleAdminCallback({
      id: 'cq_tester_1',
      from: ownerUser,
      message: { chat: { id: testChatId }, message_id: 204 },
      data: 'adm_run_test:mercury-2'
    }, mockBotService);

    assert(lastEditedMessage, 'editTelegramMessage must be called for adm_run_test');
    assert(lastEditedMessage.text.includes('Hasil Live Test Model'), 'Must display live test results');
    console.log('   ✅ Inline Live Model Tester: PASS -> Output rendered with latency & probe response!');

    // ----------------------------------------------------
    // TEST 5: Slash Command /ping
    // ----------------------------------------------------
    console.log('\n5. Testing Slash Command /ping...');
    lastSentMessage = null;
    const pingHandled = await handleSlashCommand({
      msg: { chat: { id: testChatId } },
      botService: mockBotService,
      text: '/ping',
      chatId: testChatId,
      fromUser: ownerUser,
      senderName: 'Amirun',
      senderTag: '@amirun',
      token: mockToken,
      isOwnerUser: true,
      queryBreAIRouter: mockBotService.queryBreAIRouter
    });

    assert(pingHandled === true, '/ping must return true');
    assert(lastSentMessage, 'sendTelegramMessage must be called for /ping');
    assert(lastSentMessage.text.includes('Pong!'), 'Must output Pong text');
    assert(lastSentMessage.text.includes('Provider Latensi:'), 'Must output latency');
    console.log('   ✅ Slash Command /ping: PASS -> Pong latency message sent!');

    // ----------------------------------------------------
    // TEST 6: Slash Command /detect
    // ----------------------------------------------------
    console.log('\n6. Testing Slash Command /detect...');
    lastSentMessage = null;
    const detectHandled = await handleSlashCommand({
      msg: { chat: { id: testChatId } },
      botService: mockBotService,
      text: '/detect',
      chatId: testChatId,
      fromUser: ownerUser,
      senderName: 'Amirun',
      senderTag: '@amirun',
      token: mockToken,
      isOwnerUser: true,
      queryBreAIRouter: mockBotService.queryBreAIRouter
    });

    assert(detectHandled === true, '/detect must return true');
    assert(lastSentMessage, 'sendTelegramMessage must be called for /detect');
    assert(lastSentMessage.text.includes('Berhasil Mendeteksi'), 'Must output detected text');
    console.log('   ✅ Slash Command /detect: PASS -> Models detected and printed in chat!');

    // ----------------------------------------------------
    // TEST 7: Slash Command /livetest
    // ----------------------------------------------------
    console.log('\n7. Testing Slash Command /livetest...');
    lastSentMessage = null;
    const liveTestHandled = await handleSlashCommand({
      msg: { chat: { id: testChatId } },
      botService: mockBotService,
      text: '/livetest',
      chatId: testChatId,
      fromUser: ownerUser,
      senderName: 'Amirun',
      senderTag: '@amirun',
      token: mockToken,
      isOwnerUser: true,
      queryBreAIRouter: mockBotService.queryBreAIRouter
    });

    assert(liveTestHandled === true, '/livetest must return true');
    assert(lastSentMessage, 'sendTelegramMessage must be called for /livetest');
    assert(lastSentMessage.text.includes('Live Test Model Berhasil'), 'Must output live test success');
    console.log('   ✅ Slash Command /livetest: PASS -> Live test result printed in chat!');

    console.log('\n🎉 ALL DIAGNOSTIC TESTS PASSED 100% SUCCESSFULLY!');
  } finally {
    global.fetch = originalFetch;
  }
}

runDiagnosticsTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
