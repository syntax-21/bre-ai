// ==========================================================================
// BRE AI - Media Handling, Document Parsing, Audio/Video & Voice
// File: public/js/app/media.js
// ==========================================================================

function webFormatBytes(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Deteksi magic bytes untuk berkas biner apa pun (browser)
function detectWebFileMagic(buf) {
  try {
    const len = Math.min(buf.byteLength, 300);
    const u8 = new Uint8Array(buf.slice(0, len));
    const ascii = String.fromCharCode(...u8);
    const hex4 = Array.from(u8.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (ascii.startsWith('PK\x03\x04') || ascii.startsWith('PK\x05\x06')) return 'ZIP Archive';
    if (ascii.startsWith('Rar!\x1a\x07')) return 'RAR Archive';
    if (hex4 === '377abcaf') return '7-Zip Archive';
    if (u8[0] === 0x1f && u8[1] === 0x8b) return 'GZIP Archive';
    if (ascii.indexOf('ustar') === 257) return 'TAR Archive';
    if (ascii.startsWith('%PDF-')) return 'Adobe PDF';
    if (ascii.startsWith('MZ')) return 'Windows Executable (.exe/.dll)';
    if (ascii.startsWith('\x7fELF')) return 'Linux Executable (ELF)';
    if (ascii.startsWith('{\\rtf')) return 'RTF Document';
    if (ascii.startsWith('\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1')) return 'MS Office Legacy (OLE2)';
    if (ascii.startsWith('SQLite format 3')) return 'SQLite Database';
    if (ascii.startsWith('OggS')) return 'OGG Media';
    if (ascii.startsWith('\x00asm')) return 'WebAssembly';
    if (ascii.startsWith('#!')) return 'Script Executable (shebang)';
    if (ascii.startsWith('7z\xbc\xaf')) return '7-Zip Archive';
  } catch (e) {}
  return '';
}

// Daftar isi ZIP via Central Directory (browser)
function readWebZipEntries(buf, maxEntries = 60) {
  const entries = [];
  const dv = new DataView(buf);
  const totalLen = buf.byteLength;
  if (totalLen < 22) return entries;
  let idx = -1;
  const searchFrom = Math.max(0, totalLen - (22 + 65535 + 4));
  for (let i = totalLen - 22; i >= searchFrom; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { idx = i; break; }
  }
  if (idx === -1) return entries;
  const cdSize = dv.getUint32(idx + 12, true);
  const cdOffset = dv.getUint32(idx + 16, true);
  const cdEnd = Math.min(totalLen, Math.max(cdOffset, idx) + cdSize);
  for (let off = cdOffset; off + 46 <= cdEnd; ) {
    if (dv.getUint32(off, true) !== 0x02014b50) { off += 4; continue; }
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const compSize = dv.getUint32(off + 20, true);
    const uncompSize = dv.getUint32(off + 24, true);
    let name;
    try { name = new TextDecoder().decode(new Uint8Array(buf, off + 46, nameLen)); }
    catch (e) { name = '?'; }
    entries.push({ name, compSize, uncompSize });
    off += 46 + nameLen + extraLen + commentLen;
    if (entries.length >= maxEntries) break;
  }
  return entries;
}

function getLocaleCode(lang) {
  const map = {
    id: 'id-ID',
    ja: 'ja-JP',
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-ES',
    ar: 'ar-SA',
    de: 'de-DE',
    fr: 'fr-FR',
    ru: 'ru-RU',
    ko: 'ko-KR'
  };
  return map[lang] || 'en-US';
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsText(file);
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsDataURL(file);
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

async function compressImage(file, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function extractVideoKeyframesAndMeta(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      try { URL.revokeObjectURL(url); } catch(e){}
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ duration: 0, width: 0, height: 0, frames: [] });
    }, 8000);

    video.onloadedmetadata = async () => {
      const duration = video.duration || 0;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;

      const timestamps = [];
      if (duration > 0) {
        if (duration <= 3) {
          timestamps.push(duration * 0.5);
        } else if (duration <= 10) {
          timestamps.push(1, duration * 0.5, duration - 1);
        } else {
          timestamps.push(duration * 0.15, duration * 0.5, duration * 0.85);
        }
      } else {
        timestamps.push(0);
      }

      const frames = [];
      const canvas = document.createElement('canvas');
      const maxDim = 640;
      let cW = width;
      let cH = height;
      if (cW > maxDim || cH > maxDim) {
        if (cW > cH) {
          cH = Math.round((cH * maxDim) / cW);
          cW = maxDim;
        } else {
          cW = Math.round((cW * maxDim) / cH);
          cH = maxDim;
        }
      }
      canvas.width = cW;
      canvas.height = cH;
      const ctx = canvas.getContext('2d');

      for (const t of timestamps) {
        try {
          await new Promise((resSeek) => {
            const onSeek = () => {
              video.removeEventListener('seeked', onSeek);
              try {
                ctx.drawImage(video, 0, 0, cW, cH);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                frames.push({ timeSec: t, dataUrl });
              } catch (e) {}
              resSeek();
            };
            video.addEventListener('seeked', onSeek);
            video.currentTime = Math.min(t, duration || 0);
          });
        } catch (err) {}
      }

      clearTimeout(timeout);
      cleanup();
      resolve({ duration, width, height, frames });
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ duration: 0, width: 0, height: 0, frames: [] });
    };
  });
}

const extractVideoFrames = extractVideoKeyframesAndMeta;

async function extractAudioWaveformAndMeta(file) {
  return new Promise(async (resolve) => {
    let duration = 0;
    let sampleRate = 44100;
    let channels = 2;
    let peaks = [];

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const arrayBuf = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
        duration = audioBuffer.duration;
        sampleRate = audioBuffer.sampleRate;
        channels = audioBuffer.numberOfChannels;

        const rawData = audioBuffer.getChannelData(0);
        const samples = 24;
        const blockSize = Math.floor(rawData.length / samples) || 1;
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize && (blockStart + j) < rawData.length; j++) {
            sum += Math.abs(rawData[blockStart + j]);
          }
          peaks.push(Math.min(1, (sum / blockSize) * 2.5));
        }
        try { audioCtx.close(); } catch(e){}
        return resolve({ duration, sampleRate, channels, peaks });
      }
    } catch (e) {}

    try {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.onloadedmetadata = () => {
        duration = audio.duration || 0;
        try { URL.revokeObjectURL(url); } catch(e){}
        resolve({ duration, sampleRate, channels, peaks });
      };
      audio.onerror = () => {
        try { URL.revokeObjectURL(url); } catch(e){}
        resolve({ duration: 0, sampleRate, channels, peaks });
      };
    } catch(err) {
      resolve({ duration: 0, sampleRate, channels, peaks });
    }
  });
}

function setupPaste() {
  document.addEventListener('paste', async e => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          toast('🖼️ Memproses gambar dari clipboard...', 'info');
          const dataUrl = await compressImage(file);
          if (dataUrl) {
            files.push({
              name: `pasted_image_${Date.now()}.jpg`,
              type: 'image',
              content: dataUrl,
              data: dataUrl
            });
            renderAttachBar();
            toast('🖼️ Gambar berhasil ditempel!', 'ok');
          }
        }
      }
    }
  });
}

async function processFileContent(f) {
  const isImg = f.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp|heic|heif)$/i.test(f.name);
  const isVid = f.type.startsWith('video/') || /\.(mp4|mkv|avi|mov|webm|flv|wmv|3gp|m4v|ts|ogv|vob)$/i.test(f.name);
  const isAud = f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|weba|mid|midi|aiff)$/i.test(f.name);
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isDocx = /\.docx$/i.test(f.name) || f.type.includes('wordprocessingml');
  const isExcel = /\.(xlsx|xls)$/i.test(f.name) || f.type.includes('spreadsheet') || f.type.includes('excel');
  const isText = f.type.startsWith('text/') || f.type === 'application/json' || f.type === 'application/xml' || f.type === 'application/javascript' || f.type === 'application/x-javascript' || f.type === 'image/svg+xml' ||
    /\.(js|mjs|cjs|jsx|ts|tsx|py|pyw|pyi|html|htm|css|scss|sass|json|jsonl|md|markdown|mdx|c|cpp|cc|h|hpp|hh|cs|java|kt|kts|rs|go|swift|scala|php|rb|pl|pm|lua|r|m|dart|groovy|v|cob|sh|bash|zsh|fish|bat|cmd|ps1|psm1|vbs|reg|diff|patch|log|sql|tsv|tab|csv|xml|yaml|yml|toml|env|ini|cfg|conf|config|properties|editorconfig|gitignore|gitattributes|dockerfile|gradle|lock|txt|text|textile|rst|adoc|asciidoc|tex|ltx|bib|srt|vtt|gcode|stl|proto|prj|gel|gcode|asm|s|inc|pug|ejs|twig|jinja|hbs|mustache|ftl|sol|vy|cairo|zig|nim|elm|clj|cljs|erl|ex|exs|hs|lhs|fs|fsx|vb|cob)$/i.test(f.name);

  if (isImg) {
    toast(`🖼️ Mengoptimalkan gambar: ${f.name}...`, 'info');
    try {
      const compressedDataUrl = await compressImage(f);
      if (compressedDataUrl) {
        files.push({
          name: f.name,
          type: 'image',
          content: compressedDataUrl,
          data: compressedDataUrl
        });
        renderAttachBar();
        toast(`✅ Gambar terlampir: ${f.name}`, 'ok');
      }
    } catch (err) {
      console.error('Image processing failed:', err);
      toast('Gagal memproses gambar: ' + err.message, 'err');
    }
    return;
  }

  if (isVid) {
    toast(`🎬 Menganalisis video: ${f.name}...`, 'info');
    try {
      const vidMeta = await extractVideoKeyframesAndMeta(f);
      const durStr = vidMeta.duration > 0 ? `${Math.round(vidMeta.duration)}s` : 'Video';
      const resStr = vidMeta.width && vidMeta.height ? `${vidMeta.width}x${vidMeta.height}` : 'HD';
      const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;

      const frameSummary = vidMeta.frames.length > 0
        ? `[Cuplikan Visual: ${vidMeta.frames.length} keyframe diekstrak pada timeline ${vidMeta.frames.map(fr => `${Math.round(fr.timeSec)}s`).join(', ')}]`
        : '[Analisis video container]';

      files.push({
        name: f.name,
        type: 'video',
        isVideo: true,
        badgeIcon: '🎬',
        badgeMeta: `${durStr} · ${resStr}`,
        duration: vidMeta.duration,
        previewThumb: vidMeta.frames[0]?.dataUrl || null,
        videoFrames: vidMeta.frames,
        content: `--- BEGIN VIDEO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}, Durasi: ${durStr}, Resolusi: ${resStr}) ---\n${frameSummary}\nFormat: ${f.type || 'video'}\n--- END VIDEO ATTACHMENT ---`,
        data: vidMeta.frames[0]?.dataUrl || ''
      });
      renderAttachBar();
      toast(`✅ Video terlampir: ${f.name} (${durStr})`, 'ok');
    } catch (err) {
      console.error('Video analysis failed:', err);
      const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
      files.push({
        name: f.name,
        type: 'video',
        isVideo: true,
        badgeIcon: '🎬',
        badgeMeta: sizeStr,
        content: `--- BEGIN VIDEO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}) ---\nFormat: ${f.type || 'video'}\n--- END VIDEO ATTACHMENT ---`,
        data: ''
      });
      renderAttachBar();
      toast(`✅ Video terlampir: ${f.name}`, 'ok');
    }
    return;
  }

  if (isAud) {
    toast(`🎵 Menganalisis audio: ${f.name}...`, 'info');
    try {
      const audMeta = await extractAudioWaveformAndMeta(f);
      const durSec = Math.round(audMeta.duration || 0);
      const durStr = durSec > 0 ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : 'Audio';
      const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
      const ext = f.name.split('.').pop().toUpperCase() || 'AUDIO';

      files.push({
        name: f.name,
        type: 'audio',
        isAudio: true,
        badgeIcon: '🎵',
        badgeMeta: `${durStr} · ${ext}`,
        duration: audMeta.duration,
        waveform: audMeta.peaks || [],
        content: `--- BEGIN AUDIO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}, Durasi: ${durStr}, Format: ${ext}) ---\nSample Rate: ${audMeta.sampleRate || 44100} Hz (${audMeta.channels === 1 ? 'Mono' : 'Stereo'})\nKarakteristik Audio: Dinamika gelombang suara terdeteksi aktif.\n--- END AUDIO ATTACHMENT ---`,
        data: ''
      });
      renderAttachBar();
      toast(`✅ Audio terlampir: ${f.name} (${durStr})`, 'ok');
    } catch (err) {
      console.error('Audio analysis failed:', err);
      const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
      files.push({
        name: f.name,
        type: 'audio',
        isAudio: true,
        badgeIcon: '🎵',
        badgeMeta: sizeStr,
        content: `--- BEGIN AUDIO ATTACHMENT: ${f.name} (Ukuran: ${sizeStr}) ---\nFormat: ${f.type || 'audio'}\n--- END AUDIO ATTACHMENT ---`,
        data: ''
      });
      renderAttachBar();
      toast(`✅ Audio terlampir: ${f.name}`, 'ok');
    }
    return;
  }

  if (isPdf) {
    toast(`📑 Extracting PDF: ${f.name}...`, 'info');
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        if (!window.pdfjsLib) {
          throw new Error('PDF.js engine is still loading. Please try again.');
        }
        const typedArray = new Uint8Array(e.target.result);
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 20);

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += `\n\n[Page ${pageNum}]:\n` + pageText;
          if (fullText.length > 12000) {
            fullText = fullText.slice(0, 12000) + '\n... [Teks dipotong agar respons cepat]';
            break;
          }
        }

        files.push({
          name: f.name,
          type: 'text',
          isPdf: true,
          badgeIcon: '📑',
          badgeMeta: `${pdf.numPages} hal`,
          pageCount: pdf.numPages,
          content: `--- BEGIN PDF ATTACHMENT: ${f.name} (${pdf.numPages} pages) ---\n${fullText.trim()}\n--- END PDF ATTACHMENT ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Extracted ${pdf.numPages} pages from ${f.name}`, 'ok');
      } catch (err) {
        console.error('PDF extraction failed:', err);
        toast('PDF extraction failed: ' + err.message, 'err');
      }
    };
    reader.readAsArrayBuffer(f);
    return;
  }

  if (isDocx) {
    toast(`📝 Extracting Word document: ${f.name}...`, 'info');
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        if (!window.mammoth) {
          throw new Error('Mammoth.js parser is loading. Please try again.');
        }
        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
        let rawText = (result.value || '').trim();
        if (rawText.length > 12000) {
          rawText = rawText.slice(0, 12000) + '\n... [Teks dipotong agar respons cepat]';
        }
        files.push({
          name: f.name,
          type: 'text',
          isDocx: true,
          badgeIcon: '📝',
          badgeMeta: 'Word Doc',
          content: `--- BEGIN WORD DOCUMENT: ${f.name} ---\n${rawText}\n--- END WORD DOCUMENT ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Extracted Word document: ${f.name}`, 'ok');
      } catch(err) {
        console.error('Word extraction failed:', err);
        toast('Word extraction failed: ' + err.message, 'err');
      }
    };
    reader.readAsArrayBuffer(f);
    return;
  }

  if (isExcel) {
    toast(`📊 Extracting Spreadsheet: ${f.name}...`, 'info');
    const reader = new FileReader();
    reader.onload = e => {
      try {
        if (!window.XLSX) {
          throw new Error('SheetJS parser is loading. Please try again.');
        }
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        let combinedContent = '';
        const sheetCount = workbook.SheetNames.length;

        workbook.SheetNames.forEach((name, sIdx) => {
          const sheet = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (!rows || !rows.length) return;

          const totalRows = rows.length;
          const headers = rows[0] || [];
          const maxSampleRows = Math.min(totalRows, 50);
          const sampleRows = rows.slice(0, maxSampleRows);

          const csvSample = sampleRows.map(r => Array.isArray(r) ? r.map(c => String(c).replace(/[\n\r,]+/g, ' ').trim()).join(', ') : '').join('\n');

          combinedContent += `\n[Sheet ${sIdx + 1}/${sheetCount}: "${name}"] (Total Rows: ${totalRows}, Columns: ${headers.length})\n[Headers]: ${headers.join(', ')}\n[Data Sample (First ${maxSampleRows} rows)]:\n${csvSample}\n`;
        });

        if (combinedContent.length > 12000) {
          combinedContent = combinedContent.slice(0, 12000) + '\n... [Data dipangkas untuk optimasi respons instan]';
        }

        files.push({
          name: f.name,
          type: 'text',
          isExcel: true,
          badgeIcon: '📊',
          badgeMeta: `${sheetCount} sheet${sheetCount > 1 ? 's' : ''}`,
          content: `--- BEGIN SPREADSHEET DATA: ${f.name} (${sheetCount} sheets) ---\n${combinedContent.trim()}\n--- END SPREADSHEET DATA ---`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Extracted spreadsheet: ${f.name} (${sheetCount} sheets)`, 'ok');
      } catch(err) {
        console.error('Excel extraction failed:', err);
        toast('Excel extraction failed: ' + err.message, 'err');
      }
    };
    reader.readAsArrayBuffer(f);
    return;
  }

  if (isText) {
    const reader = new FileReader();
    reader.onload = e => {
      let textContent = String(e.target.result || '');
      if (textContent.length > 12000) {
        textContent = textContent.slice(0, 12000) + '\n... [Teks dipangkas agar respons instan]';
      }
      const ext = f.name.split('.').pop().toUpperCase() || 'TXT';
      files.push({
        name: f.name,
        type: 'text',
        badgeIcon: '📄',
        badgeMeta: ext,
        content: `--- BEGIN FILE: ${f.name} ---\n${textContent}\n--- END FILE ---`,
        data: ''
      });
      renderAttachBar();
      toast(`✅ Berkas teks terlampir: ${f.name}`, 'ok');
    };
    reader.readAsText(f);
  } else {
    const sizeBytes = f.size || 0;
    const sizeStr = sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;
    if (f.size > 60 * 1048576) {
      files.push({
        name: f.name,
        type: 'binary',
        badgeIcon: '📦',
        badgeMeta: sizeStr,
        content: `[Lampiran Berkas: "${f.name}" (Ukuran: ${sizeStr}, Tipe: ${f.type || 'file biner'})]`,
        data: ''
      });
      renderAttachBar();
      toast(`✅ Berkas terlampir: ${f.name} (${sizeStr})`, 'ok');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const arr = e.target.result;
        const magic = detectWebFileMagic(arr);
        let innerInfo = '';
        if (magic === 'ZIP Archive') {
          const entries = readWebZipEntries(arr);
          if (entries.length) {
            const shown = entries.slice(0, 40).map(en => {
              const sz = en.uncompSize ? ` (${webFormatBytes(en.uncompSize)})` : '';
              return `${en.name}${sz}`;
            }).join(', ');
            innerInfo = `\nBerisi ${entries.length} berkas: ${shown}${entries.length > 40 ? '…' : ''}`;
          }
        }
        const typeLabel = magic ? `Tipe Deteksi: ${magic}` : (f.type || 'file biner');
        files.push({
          name: f.name,
          type: 'binary',
          badgeIcon: '📦',
          badgeMeta: magic ? magic : sizeStr,
          content: `[Lampiran Berkas: "${f.name}" (Ukuran: ${sizeStr}, ${typeLabel})]${innerInfo}`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Berkas terlampir: ${f.name} (${sizeStr})`, 'ok');
      } catch (err) {
        files.push({
          name: f.name,
          type: 'binary',
          badgeIcon: '📦',
          badgeMeta: sizeStr,
          content: `[Lampiran Berkas: "${f.name}" (Ukuran: ${sizeStr}, Tipe: ${f.type || 'file biner'})]`,
          data: ''
        });
        renderAttachBar();
        toast(`✅ Berkas terlampir: ${f.name} (${sizeStr})`, 'ok');
      }
    };
    reader.readAsArrayBuffer(f);
  }
}

async function handleFiles(list) {
  for (const f of Array.from(list)) {
    await processFileContent(f);
  }
}

function removeFile(i) {
  files.splice(i, 1);
  renderAttachBar();
}

// ---- SPEECH RECOGNITION (STT) & TEXT-TO-SPEECH (TTS) ----
function setupSTT() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  mic = new SR();
  mic.continuous = false;
  mic.interimResults = false;
  mic.onresult = e => {
    const el = document.getElementById('msgInput');
    if (el) {
      el.value += (el.value ? ' ' : '') + e.results[0][0].transcript;
      el.dispatchEvent(new Event('input'));
    }
  };
  mic.onend = mic.onerror = () => {
    recording = false;
    document.getElementById('btnMic')?.classList.remove('active');
  };
}

function startRecording() {
  if (!mic) return toast('Voice input not supported in this browser', 'err');
  if (recording) return;
  mic.lang = getLocaleCode(currentLang);
  try {
    mic.start();
    recording = true;
    document.getElementById('btnMic')?.classList.add('active');
  } catch (e) {
    recording = false;
    document.getElementById('btnMic')?.classList.remove('active');
  }
}

function stopRecording() {
  if (mic && recording) {
    mic.stop();
    recording = false;
    document.getElementById('btnMic')?.classList.remove('active');
  }
}

function toggleMic() {
  if (!mic) return toast('Voice input not supported in this browser', 'err');
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function toggleTTS() {
  autoTTS = !autoTTS;
  document.getElementById('btnTTS')?.classList.toggle('active', autoTTS);
  toast(autoTTS ? 'Voice Output ON' : 'Voice Output OFF');
  if (!autoTTS && window.speechSynthesis) window.speechSynthesis.cancel();
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, ' [Code Block] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*#_~>\[\]]/g, '')
    .trim();
  if (!clean) return;

  const locale = getLocaleCode(currentLang);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = locale;
  u.rate = 1.0;

  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    const matchedVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase() === locale.toLowerCase())
                      || voices.find(v => v.lang.toLowerCase().startsWith(currentLang.toLowerCase()));
    if (matchedVoice) u.voice = matchedVoice;
  }

  window.speechSynthesis.speak(u);
}

// ---- WEB SEARCH UI & FREE IMAGE GEN HELPER ----
function initWebSearchUI() {
  const btn = document.getElementById('btnWebSearch');
  if (btn) btn.classList.toggle('active', isWebSearch);
}

function toggleWebSearch() {
  isWebSearch = !isWebSearch;
  localStorage.setItem('bre_web_search', isWebSearch.toString());
  initWebSearchUI();
  toast(isWebSearch ? '🌐 Web Search Enabled (DuckDuckGo Grounding)' : 'Web Search Disabled');
}

function promptImageGen() {
  const inp = document.getElementById('msgInput');
  if (!inp) return;
  inp.value = '/image ';
  inp.focus();
  inp.dispatchEvent(new Event('input'));
  toast('Type what you want to draw and press Enter!', 'info');
}
