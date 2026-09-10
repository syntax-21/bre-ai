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
  parsePdfDocument
};
