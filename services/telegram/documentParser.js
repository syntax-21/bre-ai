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
 * Magic bytes detection — mengidentifikasi tipe berkas biner apa pun tanpa ekstensi
 */
function detectBinaryMagic(buffer) {
  if (!buffer || buffer.length < 8) return '';
  const b0 = buffer[0];
  const hex12 = buffer.slice(0, 12).toString('hex');
  const ascii = buffer.slice(0, 16).toString('latin1');

  if (b0 === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'PNG (Portable Network Graphics)';
  if (b0 === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'JPEG (JPG)';
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'GIF (Graphics Interchange Format)';
  if (ascii.startsWith('BM')) return 'BMP (Bitmap)';
  if ((ascii.startsWith('II*\x00')) || (ascii.startsWith('MM\x00*'))) return 'TIFF';
  if (ascii.startsWith('%PDF-')) return 'Adobe PDF';
  if (ascii.startsWith('PK\x03\x04')) return 'ZIP Archive (terkompresi ZIP)';
  if (ascii.startsWith('PK\x05\x06') || ascii.startsWith('PK\x07\x08')) return 'ZIP Archive (empty/stream)';
  if (ascii.startsWith('Rar!\x1a\x07')) return 'RAR Archive';
  if (hex12.startsWith('377abcaf271c')) return '7-Zip Archive (7z)';
  if (b0 === 0x1f && buffer[1] === 0x8b) return 'GZIP Archive (tar.gz / gz)';
  if (buffer.toString('latin1', 257, 262) === 'ustar') return 'TAR Archive';
  if (ascii.startsWith('MSCF')) return 'CAB (Windows Cabinet)';
  if (ascii.startsWith('\x7fELF')) return 'ELF Executable (Linux)';
  if (ascii.startsWith('MZ')) return 'PE Executable (Windows .exe/.dll)';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'WebP Image';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ') return 'AVI Video';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return 'WAV Audio';
  if (ascii.startsWith('OggS')) return 'OGG (Audio/Video/Opus)';
  if (ascii.startsWith('wOF2')) return 'WOFF2 Font';
  if (ascii.startsWith('wOFF')) return 'WOFF Font';
  if (ascii.startsWith('\x00\x00\x01\x00')) return 'SWF (Flash)';
  if (ascii.startsWith('SQLite format 3')) return 'SQLite Database';
  if (ascii.startsWith('\x00asm')) return 'WebAssembly (wasm)';
  if (ascii.startsWith('dex\n037')) return 'APK/DEX (Android)';
  if (ascii.startsWith('\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1')) return 'MS Office Legacy (OLE2: .doc/.xls/.ppt)';
  if (ascii.startsWith('{\\rtf')) return 'RTF (Rich Text)';
  if (ascii.startsWith('#!')) return 'Script Executable (shebang)';
  if (b0 === 0x42 && buffer[1] === 0x5a && buffer[2] === 0x68) return 'BZ2 (bzip2 compressed)';
  if (b0 === 0xfd && buffer[1] === 0x37 && buffer[2] === 0x7a && buffer[3] === 0x58) return 'XZ (LZMA compressed)';
  if (b0 === 0x1f && buffer[1] === 0xa0) return 'LZH Archive';
  if (b0 === 0x4d && buffer[1] === 0x53 && buffer[2] === 0x43 && buffer[3] === 0x46) return 'Microsoft Cabinet';
  if (b0 === 0xff && buffer[1] === 0xfe) return 'UTF-16 Text (LE)';
  if (b0 === 0xfe && buffer[1] === 0xff) return 'UTF-16 Text (BE)';
  if (b0 === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'UTF-8 Text (BOM)';
  return '';
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * Daftar isi ZIP archive via Central Directory (fallback: local headers)
 */
function parseZipListing(buffer) {
  const entries = [];
  const seen = new Set();

  // Scan Central Directory (0x02014b50)
  for (let offset = 0; offset < buffer.length - 46; offset++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    if (offset + 46 + nameLen > buffer.length) break;
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    const compSize = buffer.readUInt32LE(offset + 20);
    const uncompSize = buffer.readUInt32LE(offset + 24);
    const flags = buffer.readUInt16LE(offset + 8);
    const encSup = (flags & 0x0800) !== 0;
    if (!seen.has(name)) {
      seen.add(name);
      entries.push({
        name,
        size: uncompSize,
        compSize,
        raw: encSup
      });
    }
    offset += 45 + nameLen + extraLen + commentLen;
  }

  // Fallback: scan Local File Headers (0x04034b50)
  if (!entries.length) {
    for (let offset = 0; offset < buffer.length - 30; offset++) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) continue;
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      if (offset + 30 + nameLen > buffer.length) break;
      const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      if (!seen.has(name)) {
        seen.add(name);
        entries.push({ name, size: uncompSize, compSize, raw: false });
      }
      offset += 29 + nameLen + extraLen + compSize;
    }
  }

  if (!entries.length) return '';
  const total = entries.length;
  const list = entries.slice(0, 120).map(e =>
    `${e.raw ? '[terenkripsi] ' : ''}${e.name} (${formatBytes(e.compSize)} → ${formatBytes(e.size)})`
  ).join('\n');
  const more = total > 120 ? `\n… dan ${total - 120} berkas lainnya` : '';
  return `[ISI ZIP: ${total} berkas]\n${list}${more}`;
}

/**
 * Daftar isi TAR archive via ustar headers
 */
function parseTarListing(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const nameBuf = buffer.slice(offset, offset + 100).toString('utf8').replace(/\0.*$/, '');
    if (!nameBuf && buffer.slice(offset, offset + 512).every(b => b === 0)) break;
    const sizeStr = buffer.slice(offset + 124, offset + 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const typeFlag = String.fromCharCode(buffer[offset + 156] || 0);
    const validMagic = buffer.toString('utf8', offset + 257, offset + 265).includes('ustar');
    if (!validMagic) break;
    if (nameBuf && typeFlag !== 'x' && typeFlag !== 'g') {
      entries.push({ name: nameBuf, size });
    }
    offset += 512 + Math.ceil(size / 512) * 512;
    if (entries.length > 500) break;
  }
  if (!entries.length) return '';
  const list = entries.slice(0, 120).map(e => `${e.size ? `${e.name} (${formatBytes(e.size)})` : `${e.name}/`}`).join('\n');
  const more = entries.length > 120 ? `\n… dan ${entries.length - 120} item lainnya` : '';
  return `[ISI TAR: ${entries.length} item]\n${list}${more}`;
}

/**
 * Parsing archive apa pun (.zip/.rar/.7z/.tar/.gz/.tgz/.tar.gz/.bz2/.xz/cab)
 */
function parseArchiveListing(buffer, fileName) {
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const base = fileName.toLowerCase();
  const sizeStr = formatBytes(buffer.length);

  // 1. TAR.gz / .tgz / .gz — coba gunzip lalu pindai isi
  if (ext === 'gz' || ext === 'tgz' || base.endsWith('.tar.gz')) {
    try {
      const inflated = zlib.gunzipSync(buffer);
      const inner = parseTarListing(inflated) || parseZipListing(inflated);
      const innerSize = formatBytes(inflated.length);
      if (inner) return `[ARSIP GZ] "${fileName}" (terkompresi ${sizeStr}, isi ${innerSize})\n${inner}`;
      return `[ARSIP GZ] "${fileName}" (terkompresi ${sizeStr}, isi ${innerSize})\nTidak dapat memindai isi arsip terkompresi.`;
    } catch (e) {
      return `[ARSIP GZ] "${fileName}" (${sizeStr}) — Gagal dekompresi: ${e.message}`;
    }
  }

  // 2. TAR
  if (ext === 'tar') {
    const inner = parseTarListing(buffer);
    if (inner) return inner;
  }

  // 3. ZIP / APK / JAR / EPUB / DOCX (fallback definite)
  if (ext === 'zip' || ext === 'apk' || ext === 'jar' || ext === 'epub' || ext === 'xlsx' || ext === 'docx' || buffer.toString('latin1', 0, 2) === 'PK') {
    const inner = parseZipListing(buffer);
    if (inner) return `[ARSIP ZIP] "${fileName}" (${sizeStr})\n${inner}`;
  }

  // 4. Format arsip lain dengan listing terbatas (hanya info)
  const magic = detectBinaryMagic(buffer);
  if (magic) {
    return `[ARSIP: ${magic}] "${fileName}" (${sizeStr})\nFormat arsip ini tidak bisa dibongkar lebih lanjut oleh Bre AI, namun Berkas sudah diterima penuh.`;
  }

  return `[ARSIP] "${fileName}" (${sizeStr})`;
}

/**
 * Deteksi format file untuk klasifikasi biner generik
 */
function describeBinaryFile(buffer, fileName) {
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const sizeStr = formatBytes(buffer.length);
  const magic = detectBinaryMagic(buffer);

  // EPUB & DOCX juga ZIP — daftarkan isi
  if (ext === 'epub' || buffer.toString('latin1', 0, 2) === 'PK') {
    const inner = parseZipListing(buffer);
    if (inner) return `[Berkas: "${fileName}" — ${magic || 'ZIP'}] (${sizeStr})\n${inner}`;
  }

  const typeLabel = magic ? `Tipe Deteksi: ${magic}` : 'Tipe: Biner / Format Khusus';
  const hash = hashBuffer(buffer);

  return `[BERKAS BINER: "${fileName}"]\n` +
    `• Ukuran: ${sizeStr} (${buffer.length.toLocaleString()} bytes)\n` +
    `• ${typeLabel}\n` +
    `• Indikator Berkas (hex): ${buffer.slice(0, 16).toString('hex') || '—'}\n` +
    `• SHA-256: ${hash}\n` +
    (magic ? '' : `• _Berkas ${ext || ''} tidak dapat dibaca langsung oleh AI, tapi sudah diterima penuh._`);
}

function hashBuffer(buffer) {
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32) + '…';
  } catch (e) { return '—'; }
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
  const isArchive = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cab', 'apk', 'jar', 'epub'].includes(ext) ||
    mimeType.includes('zip') || mimeType.includes('x-tar') || mimeType.includes('gzip') || mimeType.includes('x-rar') || mimeType.includes('x-7z') || mimeType.includes('x-bzip') || mimeType.includes('x-xz');

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

    // Archive apa pun (.zip/.rar/.7z/.tar/.gz/.tgz/.bz2/.xz/.cab/.apk/.epub/dll)
    if (isArchive || buffer.toString('latin1', 0, 2) === 'PK') {
      const parsedText = parseArchiveListing(buffer, fileName);
      return {
        success: true,
        type: 'archive',
        text: parsedText,
        summary: `Arsip (${ext.toUpperCase() || 'ZIP'})`
      };
    }

    // Standard text/code check (termasuk skrip shebang & RTF)
    const isText = !buffer.slice(0, 1000).includes(0);
    if (isText || buffer.toString('latin1', 0, 2) === '#!') {
      const utf8Text = buffer.toString('utf8');
      return {
        success: true,
        type: 'text',
        text: utf8Text,
        summary: `Teks/Kode (.${ext || 'txt'})`
      };
    }

    // Berkas biner lain — selalu DITERIMA dengan deskripsi lengkap (tidak pernah ditolak)
    const describedText = describeBinaryFile(buffer, fileName);
    return {
      success: false,
      type: 'binary',
      text: describedText,
      summary: describeBinaryFile(buffer, fileName).split('\n')[0].replace(/^\[BERKAS BINER: "/, '').replace(/"\]/, '') || `Berkas Biner (.${ext})`
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
  parseAudioMetadata,
  parseArchiveListing,
  parseZipListing,
  parseTarListing,
  detectBinaryMagic,
  describeBinaryFile
};
