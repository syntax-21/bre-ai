const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public', 'vendor');
fs.mkdirSync(output, { recursive: true });
const sources = [
  ['dompurify/dist/purify.min.js', 'purify.min.js'],
  ['marked/lib/marked.umd.js', 'marked.js'],
  ['xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
  ['mammoth/mammoth.browser.min.js', 'mammoth.browser.min.js'],
  ['pdfjs-dist/build/pdf.min.mjs', 'pdf.min.mjs'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs']
];
let copied = 0;
for (const [source, name] of sources) {
  const srcPath = path.join(root, 'node_modules', source);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(output, name));
    copied++;
  } else {
    console.warn(`[Build] WARNING: ${source} tidak ditemukan. Jalankan 'npm install' terlebih dahulu.`);
  }
}
console.log(`Browser dependencies built in public/vendor (${copied}/${sources.length} files copied)`);
