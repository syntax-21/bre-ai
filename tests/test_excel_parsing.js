const XLSX = require('xlsx');
const { extractDocumentContent } = require('../services/telegram/documentParser');

async function run() {
  console.log('Testing Excel XLSX parsing...');
  
  // Create sample workbook
  const wb = XLSX.utils.book_new();
  const data1 = [
    ['Program/Kegiatan', 'Unit Kerja', 'Pagu Anggaran', 'Realisasi', 'Sisa', 'Status'],
    ['Pengembangan Web AI', 'Divisi IT', 50000000, 35000000, 15000000, 'On Track'],
    ['Integrasi Bot Telegram', 'Divisi IT', 30000000, 28000000, 2000000, 'On Track'],
    ['Audit Server & Database', 'Divisi Infra', 20000000, 20000000, 0, 'Selesai']
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(data1);
  XLSX.utils.book_append_sheet(wb, ws1, 'Planning JPP');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`Generated sample XLSX buffer of size: ${buf.length} bytes`);

  const res = await extractDocumentContent(buf, 'Dashboard Planning JPP (Total - LoP).xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  console.log('Result Success:', res.success);
  console.log('Result Type:', res.type);
  console.log('Result Summary:', res.summary);
  console.log('Result Text Preview:\n' + res.text);

  if (!res.success || !res.text.includes('Pengembangan Web AI') || !res.text.includes('Planning JPP')) {
    throw new Error('Excel parsing test failed!');
  }

  console.log('\n✅ ALL EXCEL PARSING TESTS PASSED 100%!');
}

run().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
