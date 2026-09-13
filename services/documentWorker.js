const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
  require('./telegram/documentParser').extractDocumentContent(Buffer.from(workerData.buffer), workerData.name, workerData.mime)
    .then(result => parentPort.postMessage(result))
    .catch(error => parentPort.postMessage({ success: false, type: 'error', text: '', summary: error.message }));
}

let active = 0;
function parseDocument(buffer, name = '', mime = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length > 20 * 1024 * 1024) return Promise.reject(new Error('Dokumen melebihi 20 MB'));
  if (active >= 2) return Promise.reject(new Error('Parser sedang sibuk. Coba lagi.'));
  active++;
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { buffer, name, mime }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const timer = setTimeout(() => { reject(new Error('Parsing dokumen timeout')); worker.terminate(); }, 12000);
    worker.once('message', result => { resolve(result); worker.terminate(); });
    worker.once('error', reject);
    worker.once('exit', code => { clearTimeout(timer); active--; if (code) reject(new Error('Parser dokumen berhenti')); });
  });
}
module.exports = { parseDocument };
