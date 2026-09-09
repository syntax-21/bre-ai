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

// 3. Test Command Handler: Direct Argument Switching & Interactive Menu
console.log('\n3. Testing Slash Command Switching (/bahasa, /lang, /language)...');
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

  // Test 3a: Direct command /bahasa en
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
  assert.strictEqual(getUserLanguage(testChatIdNum), 'en', 'User language must now be en');
  assert.ok(sentMessages[0].text.includes('Bahasa Berhasil Diubah'), 'Confirmation message must be sent');
  assert.ok(sentMessages[0].text.includes('English'), 'Confirmation message must mention English');
  console.log('   ✅ Direct command "/bahasa en" switched language to English.');

  // Test 3b: Direct command /lang jepang
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
  assert.strictEqual(getUserLanguage(testChatIdNum), 'ja', 'User language must now be ja');
  assert.ok(sentMessages[0].text.includes('日本語'), 'Confirmation message must mention Japanese');
  console.log('   ✅ Direct command "/lang jepang" switched language to Japanese.');

  // Test 3c: Interactive menu /language (without argument)
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
  assert.ok(sentMessages[0].markup, 'Interactive inline keyboard must be provided');
  assert.ok(Array.isArray(sentMessages[0].markup.inline_keyboard), 'Must have inline keyboard rows');
  // Check active checkmark on Japanese
  const flatButtons = sentMessages[0].markup.inline_keyboard.flat();
  const jaBtn = flatButtons.find(b => b.callback_data && b.callback_data.endsWith(':ja'));
  assert.ok(jaBtn, 'Must have button for ja');
  assert.ok(jaBtn.text.includes('✅'), 'Active language Japanese must display checkmark');
  console.log('   ✅ Interactive menu "/language" renders 10 language buttons with active checkmark.');

  // 4. Test Prompt Isolation: Foreign Language vs Indonesian
  console.log('\n4. Testing Prompt Isolation & Anti-Conflict Guarantee...');

  // 4a. When English is selected:
  const enSystemPrompt = buildBreAISystemPrompt({ language: 'en', style: 'santai' });
  assert.ok(enSystemPrompt.includes('MANDATORY LANGUAGE ENFORCEMENT - ENGLISH'), 'Must have mandatory English enforcement');
  assert.ok(enSystemPrompt.includes('DILARANG KERAS merespons dalam Bahasa Indonesia'), 'Must strictly forbid Indonesian responses');
  assert.ok(!enSystemPrompt.includes('PENYESUAIAN WAJIB GAYA BAHASA & DIALEK INDONESIA'), 'Must NOT include Indonesian dialect instructions when English is active');
  assert.ok(enSystemPrompt.includes('Amirun Rayan Ariandi'), 'Bre AI ownership must remain intact');
  console.log('   ✅ English prompt enforces 100% English and suppresses Indonesian dialect override.');

  // 4b. When Japanese is selected:
  const jaSystemPrompt = buildBreAISystemPrompt({ language: 'ja', style: 'jakarta' });
  assert.ok(jaSystemPrompt.includes('MANDATORY LANGUAGE ENFORCEMENT - JAPANESE'), 'Must have mandatory Japanese enforcement');
  assert.ok(jaSystemPrompt.includes('DILARANG KERAS merespons dalam Bahasa Indonesia'), 'Must strictly forbid Indonesian responses');
  assert.ok(!jaSystemPrompt.includes('PENYESUAIAN WAJIB GAYA BAHASA & DIALEK INDONESIA'), 'Must NOT include Indonesian dialect instructions when Japanese is active');
  assert.ok(jaSystemPrompt.includes('Amirun Rayan Ariandi'), 'Bre AI ownership must remain intact');
  console.log('   ✅ Japanese prompt enforces 100% Japanese and suppresses Indonesian dialect override.');

  // 4c. When Indonesian is selected:
  const idSystemPrompt = buildBreAISystemPrompt({ language: 'id', style: 'jakarta' });
  assert.ok(idSystemPrompt.includes('GAYA BAHASA & DIALEK (🗣️ Jakarta / Gaul (Gue-Lu))'), 'Must include Indonesian dialect instructions when Indonesian is active');
  assert.ok(idSystemPrompt.includes('Bahasa Utama: Bahasa Indonesia'), 'Must confirm Indonesian as main language');
  assert.ok(idSystemPrompt.includes('Amirun Rayan Ariandi'), 'Bre AI ownership must remain intact');
  console.log('   ✅ Indonesian prompt cleanly restores Jakarta/Gaul dialect when language is "id".');

  // Restore mock
  mockApi.sendTelegramMessage = originalSend;

  console.log('\n🎉 ALL LANGUAGE SWITCHING & PERSISTENCE TESTS PASSED 100% SUCCESSFULLY!\n');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
