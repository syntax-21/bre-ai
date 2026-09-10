const zlib = require('zlib');

/**
 * Pure Node.js zero-dependency unzipper for zip-based documents (.xlsx, .docx, .odt)
 * @param {Buffer} buffer
 * @returns {Record<string, Buffer>}
 */
function unzipBuffer(buffer) {
  const files = {};
  let offset = 0;

  while (offset < buffer.length - 4) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === 0x04034b50) { // Local file header
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      const filename = buffer.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
      const dataStart = offset + 30 + nameLen + extraLen;

      if (dataStart + compSize <= buffer.length) {
        const compData = buffer.slice(dataStart, dataStart + compSize);
        try {
          if (compMethod === 8) { // DEFLATE
            files[filename] = zlib.inflateRawSync(compData);
          } else if (compMethod === 0) { // Stored / uncompressed
            files[filename] = compData;
          }
        } catch (e) {
          // ignore corrupted chunk
        }
      }

      offset = dataStart + compSize;
    } else if (sig === 0x02014b50 || sig === 0x06054b50) {
      // Central directory header / End of central dir
      break;
    } else {
      offset++;
    }
  }

  return files;
}

/**
 * Parses XLSX XML files into human/LLM-readable tabular markdown or CSV
 * @param {Buffer} buffer
 * @returns {string}
 */
function parseXlsx(buffer) {
  const files = unzipBuffer(buffer);
  
  // 1. Parse sharedStrings.xml
  const sharedStrings = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = files['xl/sharedStrings.xml'].toString('utf8');
    // Match <si>...<t>string</t>...</si> or multiple <t> inside <r>
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let match;
    while ((match = siRegex.exec(xml)) !== null) {
      const siContent = match[1];
      const tMatches = siContent.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
      // Decode basic xml entities
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

  // 2. Find sheet names in xl/workbook.xml
  const sheetNames = [];
  if (files['xl/workbook.xml']) {
    const wbXml = files['xl/workbook.xml'].toString('utf8');
    const sheetRegex = /<sheet[^>]+name="([^"]+)"[^>]+sheetId="([^"]+)"/g;
    let sm;
    while ((sm = sheetRegex.exec(wbXml)) !== null) {
      sheetNames.push({ name: sm[1], id: sm[2] });
    }
  }

  // 3. Find and parse worksheet files (e.g. xl/worksheets/sheet1.xml)
  const sheetFiles = Object.keys(files).filter(k => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'));
  sheetFiles.sort();

  if (sheetFiles.length === 0) {
    return 'Berkas spreadsheet XLSX kosong atau tidak dapat diuraikan.';
  }

  let result = '';

  sheetFiles.forEach((sf, idx) => {
    const sheetName = sheetNames[idx]?.name || `Sheet ${idx + 1}`;
    const xml = files[sf].toString('utf8');

    // Parse rows: <row r="1"> ... <c r="A1" t="s"><v>0</v></c> ... </row>
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rMatch;
    const rows = [];

    while ((rMatch = rowRegex.exec(xml)) !== null) {
      const rowXml = rMatch[1];
      const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:\s+t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g;
      let cMatch;
      const rowCells = [];

      while ((cMatch = cellRegex.exec(rowXml)) !== null) {
        const colLetter = cMatch[1];
        const cellType = cMatch[3]; // 's' = shared string, 'str' = string, 'b' = bool, undefined = number
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

        // Clean xml entities
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

    result += `\n[Sheet "${sheetName}"]: Total ${totalRows} baris, ${headers.length} kolom\n`;
    result += `Headers: ${headers.join(' | ')}\n`;
    result += `Sample Data (${previewRows.length} baris):\n`;
    previewRows.forEach((r, rI) => {
      result += `Baris ${rI + 1}: ${r.join(' | ')}\n`;
    });
  });

  return result.trim();
}

/**
 * Parses DOCX XML files into clean plaintext
 * @param {Buffer} buffer
 * @returns {string}
 */
function parseDocx(buffer) {
  const files = unzipBuffer(buffer);
  if (!files['word/document.xml']) {
    return 'Berkas Word DOCX kosong atau tidak dapat diuraikan.';
  }
  const xml = files['word/document.xml'].toString('utf8');
  // Match paragraphs <w:p>...</w:p>
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

console.log('Testing pure-node document parser functions defined successfully!');
