const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public', 'vendor');
fs.mkdirSync(output, { recursive: true });
for (const [source, name] of [
  ['dompurify/dist/purify.min.js', 'purify.min.js'],
  ['marked/lib/marked.umd.js', 'marked.js'],
  ['xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
  ['mammoth/mammoth.browser.min.js', 'mammoth.browser.min.js'],
  ['pdfjs-dist/build/pdf.min.mjs', 'pdf.min.mjs'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs']
]) fs.copyFileSync(path.join(root, 'node_modules', source), path.join(output, name));
console.log('Browser dependencies built in public/vendor');
