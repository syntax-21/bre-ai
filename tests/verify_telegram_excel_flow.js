const XLSX = require('xlsx');
const { extractDocumentContent } = require('../services/telegram/documentParser');
const { handleMessage } = require('../services/telegram/messageHandler');

async function testTelegramExcelFlow() {
  console.log('Testing Telegram Excel (.xlsx) Flow End-to-End...');

  // 1. Create a mock Excel file like the user's "Dashboard Planning JPP (Total - LoP).xlsx"
  const wb = XLSX.utils.book_new();
  const data = [
    ['Kode LoP', 'Program/Kegiatan', 'Unit Kerja', 'Pagu Anggaran', 'Realisasi', 'Sisa Anggaran', 'Status'],
    ['LOP-001', 'Pengembangan Portal AI', 'Divisi IT', 75000000, 50000000, 25000000, 'On Track'],
    ['LOP-002', 'Upgrade Server Cloud', 'Divisi Infra', 45000000, 45000000, 0, 'Selesai'],
    ['LOP-003', 'Pelatihan SDM Big Data', 'Divisi HR', 20000000, 10000000, 10000000, 'On Track']
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Planning JPP');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // 2. Test extraction
  const parsed = await extractDocumentContent(
    xlsxBuffer,
    'Dashboard Planning JPP (Total - LoP).xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  console.log('Document Parsed Type:', parsed.type);
  console.log('Document Parsed Content Snippet:\n', parsed.text);

  if (!parsed.success || parsed.type !== 'spreadsheet' || !parsed.text.includes('Pengembangan Portal AI')) {
    throw new Error('Failed to parse Excel buffer correctly!');
  }

  // 3. Mock Telegram bot service
  const sentMessages = [];
  const mockApi = require('../services/telegram/api');
  mockApi.downloadTelegramFile = async (fileId) => {
    return xlsxBuffer;
  };
  mockApi.sendTelegramMessage = async (chatId, text) => {
    sentMessages.push({ chatId, text });
    return { message_id: 123 };
  };
  mockApi.sendTyping = async () => {};

  const mockBotService = {
    activeOwnerId: '123456',
    activeAccessMode: 'public',
    conversations: new Map(),
    getChatHistory: () => [],
    MAX_HISTORY: 30
  };

  const mockMsg = {
    message_id: 999,
    chat: { id: 123456 },
    from: { id: 123456, first_name: 'Amirun', username: 'amirun' },
    document: {
      file_id: 'mock_file_id_xlsx_123',
      file_name: 'Dashboard Planning JPP (Total - LoP).xlsx',
      file_size: xlsxBuffer.length,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    caption: 'Tolong buatkan tabel pivot dan analisis serapan anggaran per Unit Kerja dari data ini'
  };

  console.log('Simulating incoming Telegram document message...');
  await handleMessage(mockMsg, mockBotService);

  console.log(`Total messages sent: ${sentMessages.length}`);
  const finalMsg = sentMessages[sentMessages.length - 1]?.text || '';
  console.log('Final AI Response Preview:\n' + finalMsg.slice(0, 400) + '...\n');

  // Verify that the response does NOT contain "tidak dapat membaca file"
  if (finalMsg.toLowerCase().includes('tidak dapat membaca') || finalMsg.toLowerCase().includes('tidak memiliki kemampuan untuk membuka')) {
    throw new Error('AI still returned cannot read file error!');
  }

  console.log('✅ TELEGRAM EXCEL FLOW VERIFIED 100% SUCCESFULLY!');
}

testTelegramExcelFlow().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
