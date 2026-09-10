// ========================================================
// Test Suite: Telegram Bot Multi-Turn Conversation Memory
// Validates Context Retention, Safe Pruning & Persistence
// ========================================================

const telegramBot = require('../services/telegramBot');
const sessionManager = require('../services/telegram/sessionManager');
const { pruneConversationHistory, sanitizeMessagesForLLM, buildHistoryUserSnippet } = sessionManager;
const { getConfig, saveConfig } = require('../api/_shared');
const chatHandler = require('../api/chat');

async function runMemoryTests() {
  console.log('🧪 Starting Telegram Bot Conversation Memory Tests...\n');

  // 1. Test pruneConversationHistory
  console.log('=== TEST 1: Safe Pruning & Role Alternation ===');
  const mockHistory = [
    { role: 'user', content: 'Turn 1 User' },
    { role: 'assistant', content: 'Turn 1 AI' },
    { role: 'user', content: 'Turn 2 User' },
    { role: 'assistant', content: 'Turn 2 AI' },
    { role: 'user', content: 'Turn 3 User' },
    { role: 'assistant', content: 'Turn 3 AI' },
    { role: 'user', content: 'Turn 4 User' },
    { role: 'assistant', content: 'Turn 4 AI' },
    { role: 'user', content: 'Turn 5 User' },
    { role: 'assistant', content: 'Turn 5 AI' },
    { role: 'user', content: 'Turn 6 User' },
    { role: 'assistant', content: 'Turn 6 AI' }
  ];

  // Prune with limit 6
  const pruned6 = pruneConversationHistory(mockHistory, 6);
  console.log('Pruned 12 messages to limit 6: length =', pruned6.length);
  console.log('First message role is:', pruned6[0]?.role);
  if (pruned6.length <= 6 && pruned6[0]?.role === 'user') {
    console.log('✅ PASS: Pruning guarantees first message is always USER (no orphan assistant)');
  } else {
    console.error('❌ FAIL: Leading message is not USER:', pruned6[0]);
    process.exit(1);
  }

  // Test odd limit pruning (e.g. limit 5)
  const pruned5 = pruneConversationHistory(mockHistory, 5);
  console.log('Pruned 12 messages with odd limit 5: length =', pruned5.length, 'first role =', pruned5[0]?.role);
  if (pruned5[0]?.role === 'user') {
    console.log('✅ PASS: Odd limit safely drops orphan assistant to keep valid USER start');
  } else {
    console.error('❌ FAIL: Odd limit left assistant at start:', pruned5);
    process.exit(1);
  }

  // 2. Test sanitizeMessagesForLLM
  console.log('\n=== TEST 2: Sanitize Messages for Upstream LLMs ===');
  const messyMessages = [
    { role: 'assistant', content: 'Stray initial assistant message' },
    { role: 'user', content: 'Halo' },
    { role: 'user', content: 'Tambah lagi pertanyaan' },
    { role: 'assistant', content: 'Jawaban AI 1' },
    { role: 'assistant', content: 'Jawaban AI 2 sambungan' },
    { role: 'user', content: 'Pertanyaan ketiga' }
  ];

  const sanitized = sanitizeMessagesForLLM(messyMessages);
  console.log('Sanitized message count:', sanitized.length);
  console.log('Sanitized roles sequence:', sanitized.map(m => m.role).join(' -> '));

  if (sanitized[0].role === 'user' &&
      sanitized[0].content.includes('Halo') &&
      sanitized[0].content.includes('Tambah lagi') &&
      sanitized[1].role === 'assistant' &&
      sanitized[1].content.includes('Jawaban AI 1') &&
      sanitized[2].role === 'user') {
    console.log('✅ PASS: Stray assistant stripped and duplicate roles merged seamlessly');
  } else {
    console.error('❌ FAIL: Message sanitization failed:', sanitized);
    process.exit(1);
  }

  // 3. Test buildHistoryUserSnippet for Media & Non-text Messages
  console.log('\n=== TEST 3: Rich Context Memory Snippets ===');
  const textMsg = { text: 'Halo Bre!' };
  const photoMsg = { photo: [{ file_id: '123' }], caption: 'Tolong analisis diagram arsitektur ini' };
  const docMsg = { document: { file_name: 'main.py' }, caption: 'Periksa fungsi login' };
  const voiceMsg = { voice: { duration: 15 }, caption: 'Curhat singkat' };
  const replyMsg = { text: 'Lanjutannya apa ya?', reply_to_message: { from: { first_name: 'Bre AI', is_bot: true }, text: 'Langkah 1 install node' } };

  console.log('Text snippet:', buildHistoryUserSnippet(textMsg));
  console.log('Photo snippet:', buildHistoryUserSnippet(photoMsg));
  console.log('Doc snippet:', buildHistoryUserSnippet(docMsg));
  console.log('Voice snippet:', buildHistoryUserSnippet(voiceMsg));
  console.log('Reply snippet:', buildHistoryUserSnippet(replyMsg));

  if (buildHistoryUserSnippet(photoMsg).includes('diagram arsitektur') &&
      buildHistoryUserSnippet(docMsg).includes('main.py') &&
      buildHistoryUserSnippet(replyMsg).includes('Membalas Bre AI')) {
    console.log('✅ PASS: Rich user context preserved for all message types');
  } else {
    console.error('❌ FAIL: Context snippets missing critical info');
    process.exit(1);
  }

  // 4. Test Multi-Turn Conversation Simulation on TelegramBotService
  console.log('\n=== TEST 4: Multi-Turn Conversation Simulation (10 Turns) ===');
  const testChatId = 987654321;
  telegramBot.clearChatHistory(testChatId);

  const telegramApi = require('../services/telegram/api');
  const outgoingMessages = [];
  const mockApiCall = async (method, payload) => {
    outgoingMessages.push({ method, payload });
    return { ok: true, result: { message_id: Math.floor(Math.random() * 1000) } };
  };
  telegramApi.apiCall = mockApiCall;
  telegramBot.apiCall = mockApiCall;
  telegramApi.sendTelegramMessage = async (chatId, text) => {
    outgoingMessages.push({ chatId, text });
    return { message_id: 12345 };
  };
  telegramApi.sendTyping = async () => true;

  const testTurns = [
    'Halo nama saya Amirun, saya programmer kecerdasan buatan',
    'Berapa hasil dari 50 x 2?',
    'Apa ibukota Indonesia saat ini?',
    'Sebutkan 3 bahasa pemrograman paling populer',
    'Bagaimana cara kerja API webhook?',
    'Apa kepanjangan dari CPU?',
    'Berapa 100 dibagi 4?',
    'Sebutkan rumus luas lingkaran',
    'Apa makanan khas dari Palembang?',
    'Pertanyaan penting: siapa nama saya yang saya sebutkan di awal percakapan?'
  ];

  for (let i = 0; i < testTurns.length; i++) {
    const question = testTurns[i];
    await telegramBot.handleMessage({
      chat: { id: testChatId },
      from: { id: testChatId, first_name: 'Amirun', username: 'amirun' },
      text: question
    });
  }

  const savedHistory = telegramBot.getChatHistory(testChatId);
  console.log(`Saved history turns after 10 questions: ${savedHistory.length} messages`);
  console.log('First history message:', savedHistory[0]);
  console.log('Last history message role:', savedHistory[savedHistory.length - 1].role);

  if (savedHistory.length === 20 && savedHistory[0].role === 'user' && savedHistory[0].content.includes('Amirun')) {
    console.log('✅ PASS: All 10 turns (20 messages) retained in memory without losing initial context!');
  } else {
    console.error('❌ FAIL: History was truncated prematurely or corrupted:', savedHistory);
    process.exit(1);
  }

  // 5. Test Persistence Across Bot Restart / Reload
  console.log('\n=== TEST 5: Persistence Across Bot Instance Reload ===');
  // Trigger disk save
  sessionManager.scheduleSaveToDisk();
  await new Promise(r => setTimeout(r, 600)); // wait for debounced disk write

  // Create a brand new TelegramBotService instance
  const { TelegramBotService } = require('../services/telegram');
  const newBotInstance = new TelegramBotService();

  const reloadedHistory = newBotInstance.getChatHistory(testChatId);
  console.log(`Reloaded history message count on fresh instance: ${reloadedHistory.length}`);

  if (reloadedHistory.length === 20 && reloadedHistory[0].content.includes('Amirun')) {
    console.log('✅ PASS: Conversation history successfully loaded from persistent disk storage!');
  } else {
    console.error('❌ FAIL: Reloaded history mismatch:', reloadedHistory);
    process.exit(1);
  }

  // 6. Test /reset and /clear Commands
  console.log('\n=== TEST 6: /reset & /clear Commands ===');
  await telegramBot.handleMessage({
    chat: { id: testChatId },
    from: { id: testChatId, first_name: 'Amirun' },
    text: '/reset'
  });

  const resetHistory = telegramBot.getChatHistory(testChatId);
  console.log('History length after /reset:', resetHistory.length);
  if (resetHistory.length === 0) {
    console.log('✅ PASS: /reset cleanly wiped history for that chat');
  } else {
    console.error('❌ FAIL: History not cleared:', resetHistory);
    process.exit(1);
  }

  console.log('\n🎉 ALL TELEGRAM CONVERSATION MEMORY TESTS PASSED 100% SUCCESSFULLY! 🎉');
}

runMemoryTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
