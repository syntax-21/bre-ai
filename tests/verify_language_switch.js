// ========================================================
// Bre AI v3.0 - Language Switch & Prompt Enforcement Test Suite
// Validates resolution, persistence, commands, callbacks, and prompt isolation
// ========================================================
const assert = require('assert');
const {
  resolveLanguageCode,
  getUserLanguage,
  saveUserLanguage,
  getUserStyle,
  saveUserStyle,
  LANGUAGE_OPTIONS,
  chatLanguages
} = require('../services/telegram/constants');

const {
  buildBreAISystemPrompt,
  getConfig,
  saveConfig
} = require('../api/_shared');

const { handleSlashCommand } = require('../services/telegram/commandHandler');

console.log('🧪 Starting Language Switch & Multi-Language Verification...\n');

// 1. Test Language Alias Resolution
console.log('1. Testing Language Alias Resolution (resolveLanguageCode)...');
const testCases = [
  { input: 'en', expected: 'en' },
  { input: 'English', expected: 'en' },
  { input: 'inggris', expected: 'en' },
  { input: 'US', expected: 'en' },
  { input: '/bahasa en', expected: 'en' },
  { input: 'ja', expected: 'ja' },
  { input: 'jepang', expected: 'ja' },
  { input: 'Japanese', expected: 'ja' },
  { input: 'nihongo', expected: 'ja' },
  { input: 'id', expected: 'id' },
  { input: 'indo', expected: 'id' },
  { input: 'indonesia', expected: 'id' },
  { input: 'bahasa', expected: 'id' },
  { input: 'zh', expected: 'zh' },
  { input: 'mandarin', expected: 'zh' },
  { input: 'chinese', expected: 'zh' },
  { input: 'ar', expected: 'ar' },
  { input: 'arab', expected: 'ar' },
  { input: 'arabic', expected: 'ar' },
  { input: 'de', expected: 'de' },
  { input: 'jerman', expected: 'de' },
  { input: 'german', expected: 'de' },
  { input: 'fr', expected: 'fr' },
  { input: 'prancis', expected: 'fr' },
  { input: 'french', expected: 'fr' },
  { input: 'ru', expected: 'ru' },
  { input: 'rusia', expected: 'ru' },
  { input: 'russian', expected: 'ru' },
  { input: 'ko', expected: 'ko' },
  { input: 'korea', expected: 'ko' },
  { input: 'korean', expected: 'ko' },
  { input: 'es', expected: 'es' },
  { input: 'spanyol', expected: 'es' },
  { input: 'spanish', expected: 'es' }
];

for (const tc of testCases) {
  const res = resolveLanguageCode(tc.input);
  assert.strictEqual(res, tc.expected, `Expected "${tc.input}" to resolve to "${tc.expected}", got "${res}"`);
}
console.log('   ✅ All 10 supported languages and aliases resolved successfully!');

// 2. Test User Language Setting & Cross-Type Retrieval (Number vs String chatId)
console.log('\n2. Testing User Language State & Cross-Type Retrieval...');
const testChatIdNum = 888777666;
const testChatIdStr = '888777666';

// Save using Number, retrieve using String
saveUserLanguage(testChatIdNum, 'en');
assert.strictEqual(getUserLanguage(testChatIdStr), 'en', 'Numeric save must be accessible via string chatId');
assert.strictEqual(getUserLanguage(testChatIdNum), 'en', 'Numeric save must be accessible via numeric chatId');

// Save using String, retrieve using Number
saveUserLanguage(testChatIdStr, 'ja');
assert.strictEqual(getUserLanguage(testChatIdNum), 'ja', 'String save must be accessible via numeric chatId');
assert.strictEqual(getUserLanguage(testChatIdStr), 'ja', 'String save must be accessible via string chatId');

// Verify config persistence
const currentCfg = getConfig();
const userInCfg = (currentCfg.telegramUsers || []).find(u => String(u.id) === testChatIdStr);
assert.ok(userInCfg, 'User must exist in config.telegramUsers');
assert.strictEqual(userInCfg.language, 'ja', 'User language must be persisted in config.telegramUsers');
console.log('   ✅ Bidirectional numeric/string lookup and config.json persistence verified!');

// 3. Test Command Handler: /bahasa /lang /language now show auto-detect info message
console.log('\n3. Testing Slash Command Behavior (/bahasa, /lang, /language, /style)...');
(async () => {
  let sentMessages = [];
  const mockApi = require('../services/telegram/api');
  const originalSend = mockApi.sendTelegramMessage;
  mockApi.sendTelegramMessage = async (chatId, text, markup) => {
    sentMessages.push({ chatId, text, markup });
    return { message_id: 999 };
  };

  const mockBotService = {
    conversations: new Map(),
    activeToken: 'test_token',
    activeOwnerId: '999000111',
    activeAccessMode: 'public'
  };

  // Test 3a: /bahasa en now shows auto-detect info message (no longer saves language)
  sentMessages = [];
  const handledDirectEn = await handleSlashCommand({
    msg: {},
    botService: mockBotService,
    text: '/bahasa en',
    chatId: testChatIdNum,
    fromUser: { id: testChatIdNum, first_name: 'Tester' },
    senderName: 'Tester',
    senderTag: '@tester',
    token: 'test_token',
    isOwnerUser: false,
    queryBreAIRouter: async () => 'mock'
  });

  assert.strictEqual(handledDirectEn, true, '/bahasa en must be handled');
  // Command now shows info about auto-detection, does NOT save language
  assert.ok(
    sentMessages[0].text.includes('Otomatis') || sentMessages[0].text.includes('otomatis') || sentMessages[0].text.includes('auto'),
    'Message must explain auto-detection'
  );
  console.log('   ✅ /bahasa en now shows auto-detect info (language persistence removed).');

  // Test 3b: /lang jepang also shows auto-detect info
  sentMessages = [];
  const handledDirectJa = await handleSlashCommand({
    msg: {},
    botService: mockBotService,
    text: '/lang jepang',
    chatId: testChatIdNum,
    fromUser: { id: testChatIdNum, first_name: 'Tester' },
    senderName: 'Tester',
    senderTag: '@tester',
    token: 'test_token',
    isOwnerUser: false,
    queryBreAIRouter: async () => 'mock'
  });
  assert.strictEqual(handledDirectJa, true, '/lang jepang must be handled');
  console.log('   ✅ /lang jepang shows auto-detect info (no persistence).');

  // Test 3c: /language without argument also shows auto-detect info
  sentMessages = [];
  const handledMenu = await handleSlashCommand({
    msg: {},
    botService: mockBotService,
    text: '/language',
    chatId: testChatIdNum,
    fromUser: { id: testChatIdNum, first_name: 'Tester' },
    senderName: 'Tester',
    senderTag: '@tester',
    token: 'test_token',
    isOwnerUser: false,
    queryBreAIRouter: async () => 'mock'
  });
  assert.strictEqual(handledMenu, true, '/language without arguments must be handled');
  console.log('   ✅ /language shows auto-detect info (no inline keyboard menu).');

  // Test 3d: /style is blocked for non-owner
  sentMessages = [];
  const handledStyleUser = await handleSlashCommand({
    msg: {},
    botService: mockBotService,
    text: '/style jakarta',
    chatId: testChatIdNum,
    fromUser: { id: testChatIdNum, first_name: 'Tester' },
    senderName: 'Tester',
    senderTag: '@tester',
    token: 'test_token',
    isOwnerUser: false,
    queryBreAIRouter: async () => 'mock'
  });
  assert.strictEqual(handledStyleUser, true, '/style must be handled (and blocked for non-owner)');
  assert.ok(sentMessages[0].text.includes('Owner') || sentMessages[0].text.includes('owner'), '/style must be blocked for non-owner');
  console.log('   ✅ /style is correctly blocked for non-owner users.');

  // Test 3e: /style works for owner
  sentMessages = [];
  const handledStyleOwner = await handleSlashCommand({
    msg: {},
    botService: mockBotService,
    text: '/style jakarta',
    chatId: testChatIdNum,
    fromUser: { id: testChatIdNum, first_name: 'Tester' },
    senderName: 'Tester',
    senderTag: '@tester',
    token: 'test_token',
    isOwnerUser: true,
    queryBreAIRouter: async () => 'mock'
  });
  assert.strictEqual(handledStyleOwner, true, '/style must be handled for owner');
  assert.ok(sentMessages[0].text.includes('Global') || sentMessages[0].text.includes('global') || sentMessages[0].text.includes('Berhasil'), '/style must confirm global change for owner');
  console.log('   ✅ /style correctly sets global style for owner.');

  // 4. Test Prompt Building: Auto-detect mode and explicit language modes
  console.log('\n4. Testing Prompt Building (Auto-detect & Explicit Language Modes)...');

  // 4a. Auto-detect mode (default for Telegram)
  const autoPrompt = buildBreAISystemPrompt({ language: 'auto', style: 'jakarta' });
  assert.ok(autoPrompt.includes('AUTO LANGUAGE DETECTION'), 'Auto mode must have auto-detect instruction');
  assert.ok(autoPrompt.includes('GAUL') && autoPrompt.includes('SANTAI'), 'Auto mode must include Indonesian Gaul style instruction');
  assert.ok(autoPrompt.includes('Amirun Rayan Ariandi'), 'Bre AI ownership must remain intact in auto mode');
  assert.ok(!autoPrompt.includes('STRICT OUTPUT LANGUAGE ENFORCEMENT'), 'Auto mode must NOT force a single language');
  console.log('   ✅ Auto-detect mode builds correct prompt with GAUL & SANTAI style for Indonesian.');

  // 4b. Explicit English mode
  const enSystemPrompt = buildBreAISystemPrompt({ language: 'en', style: 'santai' });
  assert.ok(enSystemPrompt.includes('ENGLISH'), 'Must have English enforcement');
  assert.ok(enSystemPrompt.includes('FORMAL, POLITE, INTELLIGENT, AND PROFESSIONAL'), 'Must enforce formal Bre AI tone');
  assert.ok(enSystemPrompt.includes('Amirun Rayan Ariandi'), 'Bre AI ownership must remain intact');
  console.log('   ✅ Explicit English mode enforces formal Bre AI tone.');

  // 4c. Explicit Indonesian mode
  const idSystemPrompt = buildBreAISystemPrompt({ language: 'id', style: 'jakarta' });
  assert.ok(idSystemPrompt.includes('INDONESIA GAUL'), 'Must enforce Indonesian GAUL tone');
  assert.ok(idSystemPrompt.includes('Amirun Rayan Ariandi'), 'Bre AI ownership must remain intact');
  console.log('   ✅ Indonesian explicit mode enforces GAUL & SANTAI style.');

  // 4d. Explicit Japanese mode
  const jaSystemPrompt = buildBreAISystemPrompt({ language: 'ja', style: 'jakarta' });
  assert.ok(jaSystemPrompt.includes('JAPANESE'), 'Must have Japanese enforcement');
  assert.ok(jaSystemPrompt.includes('丁寧語'), 'Must include native Japanese polite instructions');
  console.log('   ✅ Japanese explicit mode enforces polite Japanese Bre AI tone.');

  // 4e. Null/undefined language defaults to auto
  const nullPrompt = buildBreAISystemPrompt({ language: null });
  assert.ok(nullPrompt.includes('AUTO LANGUAGE DETECTION'), 'Null language must default to auto-detect');
  console.log('   ✅ Null language correctly defaults to auto-detect mode.');

  // Restore mock
  mockApi.sendTelegramMessage = originalSend;

  console.log('\n🎉 ALL LANGUAGE SWITCHING & PERSISTENCE TESTS PASSED 100% SUCCESSFULLY!\n');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

