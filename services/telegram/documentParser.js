// ========================================================
// Bre AI - Telegram & Server Document Parser
// Parses Excel (.xlsx/.xls/.csv), Word (.docx), PDF (.pdf), and text
// ========================================================
const zlib = require('zlib');

let xlsxLib = null;
try { xlsxLib = require('xlsx'); } catch (e) {}

let mammothLib = null;
try { mammothLib = require('mammoth'); } catch (e) {}

let pdfParseLib = null;
try { pdfParseLib = require('pdf-parse'); } catch (e) {}

/**
 * Fallback pure-Node unzip for XLSX/DOCX if external modules aren't available
 */
function unzipBuffer(buffer) {
  const files = {};
  let offset = 0;
  while (offset < buffer.length - 4) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const filename = buffer.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
      const dataStart = offset + 30 + nameLen + extraLen;

      if (dataStart + compSize <= buffer.length) {
        const compData = buffer.slice(dataStart, dataStart + compSize);
        try {
          if (compMethod === 8) {
            files[filename] = zlib.inflateRawSync(compData);
          } else if (compMethod === 0) {
            files[filename] = compData;
          }
        } catch (e) {}
      }
      offset = dataStart + compSize;
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      break;
    } else {
      offset++;
    }
  }
  return files;
}

/**
 * Fallback XLSX Parser using pure Node XML unzipping
 */
function parseXlsxFallback(buffer) {
  const files = unzipBuffer(buffer);
  const sharedStrings = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = files['xl/sharedStrings.xml'].toString('utf8');
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let match;
    while ((match = siRegex.exec(xml)) !== null) {
      const siContent = match[1];
      const tMatches = siContent.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
      sharedStrings.push(
        text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    }
  }

  const sheetNames = [];
  if (files['xl/workbook.xml']) {
    const wbXml = files['xl/workbook.xml'].toString('utf8');
    const sheetRegex = /<sheet[^>]+name="([^"]+)"/g;
    let sm;
    while ((sm = sheetRegex.exec(wbXml)) !== null) {
      sheetNames.push(sm[1]);
    }
  }

  const sheetFiles = Object.keys(files).filter(k => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'));
  sheetFiles.sort();

  if (sheetFiles.length === 0) return '';

  let out = '';
  sheetFiles.forEach((sf, idx) => {
    const sheetName = sheetNames[idx] || `Sheet ${idx + 1}`;
    const xml = files[sf].toString('utf8');
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rMatch;
    const rows = [];

    while ((rMatch = rowRegex.exec(xml)) !== null) {
      const rowXml = rMatch[1];
      const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:\s+t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g;
      let cMatch;
      const rowCells = [];
      while ((cMatch = cellRegex.exec(rowXml)) !== null) {
        const cellType = cMatch[3];
        const inner = cMatch[4];
        let val = '';
        if (cellType === 'inlineStr') {
          const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          if (tMatch) val = tMatch[1];
        } else {
          const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
          if (vMatch) {
            const rawV = vMatch[1];
            if (cellType === 's') {
              const strIdx = parseInt(rawV, 10);
              val = sharedStrings[strIdx] !== undefined ? sharedStrings[strIdx] : rawV;
            } else {
              val = rawV;
            }
          }
        }
        val = String(val)
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
        rowCells.push(val);
      }
      if (rowCells.length > 0 && rowCells.some(c => c !== '')) {
        rows.push(rowCells);
      }
    }

    if (rows.length === 0) return;
    const totalRows = rows.length;
    const maxPreview = Math.min(totalRows, 60);
    const previewRows = rows.slice(0, maxPreview);
    const headers = previewRows[0] || [];

    out += `\n[Sheet "${sheetName}"]: Total ${totalRows} baris, ${headers.length} kolom\n`;
    out += `[Header Kolom]: ${headers.join(' | ')}\n`;
    out += `[Data Sampel (${previewRows.length} baris)]:\n`;
    previewRows.forEach((r, rI) => {
      out += `Baris ${rI + 1}: ${r.join(' | ')}\n`;
    });
  });

  return out.trim();
}

/**
 * Extracts spreadsheet data (.xlsx, .xls, .csv, .ods)
 * @param {Buffer} buffer
 * @param {string} fileName
 * @returns {string}
 */
async function parseSpreadsheet(buffer, fileName = 'data.xlsx') {
  if (xlsxLib) {
    try {
      const workbook = xlsxLib.read(buffer, { type: 'buffer' });
      let combined = '';
      const sheetCount = workbook.SheetNames.length;

      workbook.SheetNames.forEach((name, sIdx) => {
        const sheet = workbook.Sheets[name];
        const rows = xlsxLib.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rows || !rows.length) return;

        const totalRows = rows.length;
        const headers = rows[0] || [];
        const maxSampleRows = Math.min(totalRows, 60);
        const sampleRows = rows.slice(0, maxSampleRows);

        const tableText = sampleRows
          .map((r, idx) => {
            if (!Array.isArray(r)) return '';
            const cleanCols = r.map(c => String(c).replace(/[\n\r\t|]+/g, ' ').trim());
            return `Baris ${idx + 1}: ` + cleanCols.join(' | ');
          })
          .filter(Boolean)
          .join('\n');

        combined += `\n[Sheet ${sIdx + 1}/${sheetCount}: "${name}"] (Total Baris: ${totalRows}, Total Kolom: ${headers.length})\n`;
        combined += `[Header Kolom]: ${headers.join(' | ')}\n`;
        combined += `[Data Sampel (Maks ${maxSampleRows} baris pertama)]:\n${tableText}\n`;
      });

      if (combined.trim()) return combined.trim();
    } catch (e) {
      console.warn('[DocParser] SheetJS parse failed, trying fallback:', e.message);
    }
  }

  // Fallback to pure node parser for xlsx
  const fallback = parseXlsxFallback(buffer);
  if (fallback) return fallback;

  return `[Spreadsheet "${fileName}"]: Berkas tabel spreadsheet terlampir.`;
}

/**
 * Extracts Word document (.docx)
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function parseWordDocument(buffer) {
  if (mammothLib) {
    try {
      const res = await mammothLib.extractRawText({ buffer });
      return (res.value || '').trim();
    } catch (e) {}
  }

  // Fallback pure node docx
  const files = unzipBuffer(buffer);
  if (files['word/document.xml']) {
    const xml = files['word/document.xml'].toString('utf8');
    const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let match;
    const paragraphs = [];
    while ((match = pRegex.exec(xml)) !== null) {
      const pXml = match[1];
      const tMatches = pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
      if (text.trim()) {
        paragraphs.push(
          text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
        );
      }
    }
    return paragraphs.join('\n\n');
  }

  return '';
}

/**
 * Extracts PDF document (.pdf)
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function parsePdfDocument(buffer) {
  if (pdfParseLib) {
    try {
      const data = await pdfParseLib(buffer);
      const text = (data.text || '').trim();
      const info = `[PDF: ${data.numpages || 1} Halaman]`;
      return `${info}\n\n${text}`;
    } catch (e) {
      console.warn('[DocParser] PDF parse error:', e.message);
    }
  }
  return '';
}

/**
 * Fast extraction of MP4/MOV/3GP metadata (atoms: ftyp, moov, mvhd, tkhd)
 */
function parseMp4Atoms(buffer) {
  let durationSec = 0;
  let width = 0;
  let height = 0;
  let majorBrand = '';
  try {
    let offset = 0;
    while (offset < buffer.length - 8) {
      const size = buffer.readUInt32BE(offset);
      const type = buffer.toString('latin1', offset + 4, offset + 8);
      const actualSize = size === 1 ? Number(buffer.readBigUInt64BE(offset + 8)) : size;
      if (actualSize < 8 || offset + actualSize > buffer.length + 1000) break;

      if (type === 'ftyp') {
        majorBrand = buffer.toString('latin1', offset + 8, offset + 12).trim();
      } else if (type === 'moov') {
        // Search inside moov for mvhd and tkhd
        const moovData = buffer.slice(offset + 8, Math.min(buffer.length, offset + actualSize));
        let mOff = 0;
        while (mOff < moovData.length - 8) {
          const aSize = moovData.readUInt32BE(mOff);
          const aType = moovData.toString('latin1', mOff + 4, mOff + 8);
          if (aSize < 8 || mOff + aSize > moovData.length) { mOff += 4; continue; }

          if (aType === 'mvhd') {
            const version = moovData[mOff + 8];
            let timescale = 0;
            let duration = 0;
            if (version === 1) {
              timescale = moovData.readUInt32BE(mOff + 28);
              duration = Number(moovData.readBigUInt64BE(mOff + 32));
            } else {
              timescale = moovData.readUInt32BE(mOff + 20);
              duration = moovData.readUInt32BE(mOff + 24);
            }
            if (timescale > 0 && duration > 0) {
              durationSec = Math.round((duration / timescale) * 10) / 10;
            }
          } else if (aType === 'trak') {
            // Find tkhd inside trak to get width & height
            const trakData = moovData.slice(mOff + 8, mOff + aSize);
            let tOff = 0;
            while (tOff < trakData.length - 8) {
              const tSize = trakData.readUInt32BE(tOff);
              const tType = trakData.toString('latin1', tOff + 4, tOff + 8);
              if (tSize < 8 || tOff + tSize > trakData.length) { tOff += 4; continue; }
              if (tType === 'tkhd') {
                const ver = trakData[tOff + 8];
                const wPos = ver === 1 ? tOff + 92 : tOff + 80;
                if (wPos + 8 <= trakData.length) {
                  const w = trakData.readUInt32BE(wPos) >> 16;
                  const h = trakData.readUInt32BE(wPos + 4) >> 16;
                  if (w > 0 && h > 0 && (!width || w > width)) {
                    width = w;
                    height = h;
                  }
                }
              }
              tOff += tSize;
            }
          }
          mOff += aSize;
        }
      }
      offset += actualSize;
    }
  } catch (e) {}
  return { durationSec, width, height, majorBrand };
}

/**
 * Extracts Video metadata (.mp4, .mkv, .avi, .mov, .webm, .flv, .wmv, .3gp, .m4v, .ts)
 */
function parseVideoMetadata(buffer, fileName = '', mimeType = '') {
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const sizeBytes = buffer.length;
  const sizeStr = sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;

  let formatName = ext.toUpperCase() || 'VIDEO';
  let duration = 0;
  let resolution = '';

  // 1. MP4 / MOV / 3GP / M4V
  if (['mp4', 'mov', '3gp', 'm4v'].includes(ext) || mimeType.includes('mp4') || mimeType.includes('quicktime')) {
    const mp4Info = parseMp4Atoms(buffer);
    if (mp4Info.durationSec > 0) duration = mp4Info.durationSec;
    if (mp4Info.width && mp4Info.height) resolution = `${mp4Info.width}x${mp4Info.height}`;
    if (mp4Info.majorBrand) formatName = `${ext.toUpperCase()} (${mp4Info.majorBrand})`;
  }
  // 2. AVI
  else if (ext === 'avi' || mimeType.includes('msvideo')) {
    try {
      if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'AVI ') {
        const avihIdx = buffer.indexOf('avih');
        if (avihIdx !== -1 && avihIdx + 36 <= buffer.length) {
          const uSecPerFrame = buffer.readUInt32LE(avihIdx + 4);
          const totalFrames = buffer.readUInt32LE(avihIdx + 16);
          const w = buffer.readUInt32LE(avihIdx + 32);
          const h = buffer.readUInt32LE(avihIdx + 36);
          if (w > 0 && h > 0) resolution = `${w}x${h}`;
          if (uSecPerFrame > 0 && totalFrames > 0) {
            duration = Math.round((uSecPerFrame * totalFrames / 1000000) * 10) / 10;
          }
        }
      }
    } catch (e) {}
  }
  // 3. WebM / MKV (Matroska)
  else if (['webm', 'mkv'].includes(ext) || mimeType.includes('webm') || mimeType.includes('matroska')) {
    formatName = ext === 'webm' ? 'WebM Video' : 'Matroska Video (MKV)';
  }
  // 4. FLV
  else if (ext === 'flv' || mimeType.includes('flv')) {
    formatName = 'Flash Video (FLV)';
  }
  // 5. WMV
  else if (ext === 'wmv' || mimeType.includes('wmv')) {
    formatName = 'Windows Media Video (WMV)';
  }

  const durStr = duration > 0 ? `${duration} detik` : 'Estimasi multi-track';
  const resStr = resolution ? `Resolusi: ${resolution}` : 'Resolusi: Standard Definition / High-Def';

  return `[BERKAS VIDEO: "${fileName}"]\n` +
    `• Format Kontainer: ${formatName}\n` +
    `• Ukuran File: ${sizeStr} (${sizeBytes.toLocaleString()} bytes)\n` +
    `• Durasi: ${durStr}\n` +
    `• ${resStr}\n` +
    `• MIME Type: ${mimeType || 'video/' + (ext || 'mp4')}`;
}

/**
 * Extracts Audio metadata (.mp3, .wav, .ogg, .m4a, .aac, .flac, .wma, .opus, .amr, .webm)
 */
function parseAudioMetadata(buffer, fileName = '', mimeType = '') {
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const sizeBytes = buffer.length;
  const sizeStr = sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;

  let formatName = ext.toUpperCase() || 'AUDIO';
  let duration = 0;
  let sampleRate = 0;
  let channels = 0;
  let title = '';
  let artist = '';
  let album = '';

  // 1. WAV
  if (ext === 'wav' || mimeType.includes('wav')) {
    try {
      if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WAVE') {
        const fmtIdx = buffer.indexOf('fmt ');
        if (fmtIdx !== -1 && fmtIdx + 24 <= buffer.length) {
          channels = buffer.readUInt16LE(fmtIdx + 10);
          sampleRate = buffer.readUInt32LE(fmtIdx + 12);
          const byteRate = buffer.readUInt32LE(fmtIdx + 16);
          if (byteRate > 0) {
            duration = Math.round((sizeBytes / byteRate) * 10) / 10;
          }
        }
      }
    } catch (e) {}
  }
  // 2. MP3 (Check ID3v2 tags)
  else if (ext === 'mp3' || mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    try {
      if (buffer.toString('latin1', 0, 3) === 'ID3') {
        const id3Buf = buffer.slice(0, Math.min(buffer.length, 4096)).toString('latin1');
        const titMatch = id3Buf.match(/TIT2[\s\S]{4}([^\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09]+)/);
        if (titMatch) title = titMatch[1].replace(/[^a-zA-Z0-9\s_\-\(\)\.]/g, '').trim();
        const artMatch = id3Buf.match(/TPE1[\s\S]{4}([^\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09]+)/);
        if (artMatch) artist = artMatch[1].replace(/[^a-zA-Z0-9\s_\-\(\)\.]/g, '').trim();
        const albMatch = id3Buf.match(/TALB[\s\S]{4}([^\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09]+)/);
        if (albMatch) album = albMatch[1].replace(/[^a-zA-Z0-9\s_\-\(\)\.]/g, '').trim();
      }
    } catch (e) {}
  }

  let tagStr = '';
  if (title || artist || album) {
    tagStr = `\n• Metadata Tag: ${title ? `Judul: "${title}" ` : ''}${artist ? `| Artis: "${artist}" ` : ''}${album ? `| Album: "${album}"` : ''}`;
  }

  const durStr = duration > 0 ? `\n• Durasi: ${duration} detik` : '';
  const srStr = sampleRate > 0 ? `\n• Sample Rate: ${sampleRate} Hz (${channels === 1 ? 'Mono' : 'Stereo'})` : '';

  return `[BERKAS AUDIO: "${fileName}"]\n` +
    `• Format Audio: ${formatName}\n` +
    `• Ukuran File: ${sizeStr} (${sizeBytes.toLocaleString()} bytes)\n` +
    `• MIME Type: ${mimeType || 'audio/' + (ext || 'mpeg')}` +
    durStr +
    srStr +
    tagStr;
}

/**
 * Main dispatcher to parse any incoming document buffer
 * @param {Buffer} buffer
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<{ success: boolean, text: string, type: string, summary: string }>}
 */
async function extractDocumentContent(buffer, fileName = '', mimeType = '') {
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const isExcel = ['xlsx', 'xls', 'csv', 'tsv', 'ods', 'tab'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel');
  const isWord = ['docx', 'doc', 'odt', 'rtf'].includes(ext) || mimeType.includes('wordprocessingml') || mimeType.includes('msword');
  const isPdf = ext === 'pdf' || mimeType.includes('pdf');
  const isVideo = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', '3gp', 'm4v', 'ts', 'ogv', 'vob'].includes(ext) || mimeType.startsWith('video/');
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 'amr', 'weba', 'mid', 'midi', 'aiff'].includes(ext) || mimeType.startsWith('audio/');

  try {
    if (isExcel) {
      const parsedText = await parseSpreadsheet(buffer, fileName);
      return {
        success: true,
        type: 'spreadsheet',
        text: parsedText,
        summary: `Spreadsheet (${ext.toUpperCase()})`
      };
    }

    if (isWord) {
      const parsedText = await parseWordDocument(buffer);
      return {
        success: true,
        type: 'word',
        text: parsedText || `Dokumen Word (${fileName})`,
        summary: `Word Document (${ext.toUpperCase()})`
      };
    }

    if (isPdf) {
      const parsedText = await parsePdfDocument(buffer);
      return {
        success: true,
        type: 'pdf',
        text: parsedText || `Dokumen PDF (${fileName})`,
        summary: 'Adobe PDF'
      };
    }

    if (isVideo) {
      const parsedText = parseVideoMetadata(buffer, fileName, mimeType);
      return {
        success: true,
        type: 'video',
        text: parsedText,
        summary: `Video (${ext.toUpperCase() || 'MP4'})`
      };
    }

    if (isAudio) {
      const parsedText = parseAudioMetadata(buffer, fileName, mimeType);
      return {
        success: true,
        type: 'audio',
        text: parsedText,
        summary: `Audio (${ext.toUpperCase() || 'MP3'})`
      };
    }

    // Standard text/code check
    const isText = !buffer.slice(0, 1000).includes(0);
    if (isText) {
      const utf8Text = buffer.toString('utf8');
      return {
        success: true,
        type: 'text',
        text: utf8Text,
        summary: `Teks/Kode (.${ext || 'txt'})`
      };
    }

    return {
      success: false,
      type: 'binary',
      text: '',
      summary: `Berkas Biner (.${ext})`
    };
  } catch (err) {
    return {
      success: false,
      type: 'error',
      text: '',
      summary: `Gagal membaca (${err.message})`
    };
  }
}

module.exports = {
  extractDocumentContent,
  parseSpreadsheet,
  parseWordDocument,
  parsePdfDocument,
  parseVideoMetadata,
  parseAudioMetadata
};
