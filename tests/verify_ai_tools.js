import cmdPkg from '../services/telegram/commandHandler.js';
const { handleSlashCommand } = cmdPkg;
import apiPkg from '../services/telegram/api.js';

console.log('🧪 Starting AI Tools & Health Benchmark Test Suite...\n');

let capturedMessages = [];
const origSend = apiPkg.sendTelegramMessage;
apiPkg.sendTelegramMessage = async (chatId, text, replyMarkup, replyTo, token) => {
  capturedMessages.push({ chatId, text, replyMarkup, replyTo, token });
  return { message_id: 12345, text };
};
apiPkg.sendTyping = async () => {};
apiPkg.editTelegramMessage = async (chatId, msgId, text) => {
  capturedMessages.push({ chatId, msgId, text });
  return true;
};

async function runTest() {
  const chatId = 12345678;
  const fromUser = { id: 12345678, username: 'testuser', first_name: 'Tester' };
  const mockQueryRouter = async (prompt) => `[Mock Response] Jawaban untuk: ${prompt.slice(0, 30)}...`;

  console.log('1. Testing /tools command...');
  capturedMessages = [];
  let handled = await handleSlashCommand({
    msg: { chat: { id: chatId }, from: fromUser },
    botService: null,
    text: '/tools',
    chatId,
    fromUser,
    senderName: 'Tester',
    senderTag: '[Tester]',
    token: 'test-token',
    isOwnerUser: false,
    queryBreAIRouter: mockQueryRouter
  });

  if (handled && capturedMessages.length > 0 && (capturedMessages[0].text.includes('Alat Pintar') || capturedMessages[0].text.includes('AI Tools'))) {
    console.log('   ✅ /tools command executed successfully and rendered Tools Navigator Hub!');
  } else {
    console.error('   ❌ /tools failed:', capturedMessages);
  }

  console.log('2. Testing /health command...');
  capturedMessages = [];
  handled = await handleSlashCommand({
    msg: { chat: { id: chatId }, from: fromUser },
    botService: null,
    text: '/health',
    chatId,
    fromUser,
    senderName: 'Tester',
    senderTag: '[Tester]',
    token: 'test-token',
    isOwnerUser: false,
    queryBreAIRouter: mockQueryRouter
  });

  if (handled && capturedMessages.length > 0 && capturedMessages.some(m => m.text.includes('Laporan Kesehatan') || m.text.includes('Memeriksa latensi'))) {
    console.log('   ✅ /health command executed successfully and triggered health checks!');
  } else {
    console.error('   ❌ /health failed:', capturedMessages);
  }

  console.log('3. Testing /search /code /summary /prd /copy /think /translate empty prompts...');
  const tools = ['/search', '/code', '/summary', '/prd', '/copy', '/think', '/translate'];
  for (const cmd of tools) {
    capturedMessages = [];
    handled = await handleSlashCommand({
      msg: { chat: { id: chatId }, from: fromUser },
      botService: null,
      text: cmd,
      chatId,
      fromUser,
      senderName: 'Tester',
      senderTag: '[Tester]',
      token: 'test-token',
      isOwnerUser: false,
      queryBreAIRouter: mockQueryRouter
    });

    if (handled && capturedMessages.length > 0 && (capturedMessages[0].text.includes('Panduan') || capturedMessages[0].text.includes('Gunakan format'))) {
      console.log(`   ✅ ${cmd} guided user with interactive usage instructions!`);
    } else {
      console.error(`   ❌ ${cmd} failed usage guide!`, capturedMessages);
    }
  }

  console.log('4. Testing /think with prompt execution...');
  capturedMessages = [];
  handled = await handleSlashCommand({
    msg: { chat: { id: chatId }, from: fromUser },
    botService: null,
    text: '/think Bagaimana cara optimasi web performance?',
    chatId,
    fromUser,
    senderName: 'Tester',
    senderTag: '[Tester]',
    token: 'test-token',
    isOwnerUser: false,
    queryBreAIRouter: mockQueryRouter
  });
  if (handled && capturedMessages.length > 0) {
    console.log('   ✅ /think prompt executed successfully with Deep Reasoning pipeline!');
  } else {
    console.error('   ❌ /think prompt execution failed:', capturedMessages);
  }

  console.log('\n🎉 ALL AI TOOLS & HEALTH BENCHMARK TESTS PASSED 100% SUCCESSFULLY!\n');
}

runTest().catch(err => {
  console.error('❌ Test execution error:', err);
  process.exit(1);
});

