const {
  getConfig,
  syncCloudConfig,
  sanitizeOutput,
  checkRateLimit,
  recordFailedAttempt,
  logRequest,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  validateClientKey,
  getNextRoundRobinIndex,
  buildBreAISystemPrompt,
  STYLE_PROMPTS
} = require('./_shared');

const keyRotations = new Map();

module.exports = async (req, res) => {
  const reqStartTime = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-custom-endpoint, x-custom-keys, x-custom-model, x-custom-provider, x-custom-style');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (!body) {
    body = await new Promise(resolve => {
      let d = ''; req.on('data', c => { d += c; });
      req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
      req.on('error', () => resolve({}));
    });
  } else if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // 1. IP and Rate Limiting
  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const cfg = await syncCloudConfig();

  // Check Rate Limits (Anti-Spam per IP)
  if (!checkRateLimit(ip)) {
    logRequest({ ip, provider: 'RateLimiter', model: 'n/a', status: 429, latencyMs: 1, error: 'Rate limit exceeded' });
    return res.status(429).json({ error: 'Batas kuota request tercapai. Silakan coba beberapa detik lagi.' });
  }

  // 3. Extract Custom Provider and Model Routing
  const requestedProvider = (req.headers['x-custom-provider'] || body.provider || '').trim();
  const requestedModel = (req.headers['x-custom-model'] || body.model || body.customModel || cfg.model || '').trim();

  // 4. Build and sanitize dialogue messages
  let rawMessages = Array.isArray(body.messages) ? body.messages : [];
  let dialogueTurns = rawMessages
    .filter(m => m && m.role && m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  // Sanitize dialogue sequence so it complies with all LLM provider requirements:
  // 1. First message must always be 'user' (strip leading 'assistant' if any)
  while (dialogueTurns.length > 0 && dialogueTurns[0].role !== 'user') {
    dialogueTurns.shift();
  }

  // 2. Merge consecutive duplicate roles if any
  const userMessages = [];
  for (const turn of dialogueTurns) {
    const prev = userMessages[userMessages.length - 1];
    if (prev && prev.role === turn.role) {
      if (typeof prev.content === 'string' && typeof turn.content === 'string') {
        prev.content = `${prev.content}\n\n${turn.content}`;
      } else {
        userMessages.push(turn);
      }
    } else {
      userMessages.push(turn);
    }
  }

  if (userMessages.length === 0) {
    userMessages.push({ role: 'user', content: 'Halo' });
  }

  const allUserText = userMessages
    .filter(m => m.role === 'user')
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join(' ');

  // Content Moderation & Keyword Blacklist
  if (cfg.blacklist && cfg.blacklist.length > 0) {
    const blockedWord = checkBlacklist(allUserText, cfg.blacklist);
    if (blockedWord) {
      logRequest({ ip, provider: 'Content Filter', model: requestedModel || 'n/a', status: 400, latencyMs: 2, error: `Blacklist keyword matched: "${blockedWord}"` });
      return res.status(400).json({ error: `Pesan diblokir oleh kebijakan keamanan konten (Terdeteksi kata terlarang: "${blockedWord}").` });
    }
  }

  // 5. Language & Style Resolution
  const requestedStyle = (req.headers['x-custom-style'] || body.style || cfg.defaultStyle || 'santai').trim();
  const requestedLang = (req.headers['x-custom-language'] || body.language || cfg.telegramLanguage || 'id').trim().toLowerCase();
  const stream = cfg.forceStream === true ? true : (cfg.forceStream === false ? false : (body.stream !== undefined ? Boolean(body.stream) : cfg.streamEnabled !== false));

const KNOWN_VISION_PATTERNS = [
  'gemini', 'claude', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-5.4-mini', 'gpt-5.6-sol', 'gpt-6-astra',
  'qwen-vl', 'qwen2-vl', 'qwen2.5-vl', 'qwen3.7-plus', 'qwen3.8-max', 'glm-4v', 'pixtral', 'vision', 'vl'
];

function isVisionCapableModel(modelName) {
  if (!modelName) return false;
  const m = String(modelName).toLowerCase();
  if (m.includes('minimax') || m.includes('kimi-k2') || m.includes('mercury') || m.includes('deepseek-v4') || m.includes('gpt-5.3-codex') || m.includes('glm-5.1') || m.includes('glm-5.2') || m.includes('glm-5.3') || m.includes('hy3') || m.includes('hy4') || m.includes('grok-4.5') || m.includes('grok-4.6')) {
    return false;
  }
  return KNOWN_VISION_PATTERNS.some(pat => m.includes(pat));
}

function prepareMessagesForModel(messages, modelName) {
  const isVision = isVisionCapableModel(modelName);
  if (isVision) return messages;

  return messages.map(m => {
    if (Array.isArray(m.content)) {
      const textPart = m.content
        .filter(c => c && c.type === 'text')
        .map(c => c.text)
        .join('\n');
      const imgCount = m.content.filter(c => c && (c.type === 'image_url' || c.type === 'image')).length;
      const note = imgCount > 0 ? `\n\n[Lampiran Foto/Gambar: Pengguna menyertakan ${imgCount} foto/gambar terkait pertanyaan ini]` : '';
      return {
        role: m.role,
        content: (textPart || 'Mohon analisis berkas/gambar ini.') + note
      };
    }
    return m;
  });
}

function normalizeChatUrl(rawUrl) {
  let u = (rawUrl || '').trim();
  if (!u) return '';
  if (u.endsWith('/chat/completions')) return u;
  if (u.endsWith('/v1')) return `${u}/chat/completions`;
  if (u.endsWith('/')) return `${u}v1/chat/completions`;
  return `${u}/v1/chat/completions`;
}

// 6. Select Candidates for Routing & Auto-Failover
  let activeEps = (cfg.endpoints || []).filter(e => {
    const isStatusActive = e.status !== false && e.enabled !== false;
    const hasKeys = (Array.isArray(e.keys) && e.keys.some(k => k && String(k).trim())) || (e.apiKey && String(e.apiKey).trim());
    return isStatusActive && hasKeys;
  });

  // Detect whether request includes multimodal / image attachments
  const hasImageAttachment = userMessages.some(m => {
    if (Array.isArray(m.content)) {
      return m.content.some(c => c && (c.type === 'image_url' || c.type === 'image'));
    }
    return false;
  });

  if (!activeEps.length) {
    logRequest({ ip, provider: 'StandbyEngine', model: requestedModel || 'bre-standby', status: 200, latencyMs: 1, tokens: Math.round(allUserText.length / 4) + 40 });
    const standbyReply = generateStandbyResponse({ userText: allUserText, style: requestedStyle, lang: requestedLang });
    const note = 'Provider cloud belum memiliki API Key aktif di perangkat ini. Anda dapat menambahkan API Key di menu Settings (Admin) atau unduh backup dari Telegram bot via /export.';
    return sendStandbyResponse(res, stream, standbyReply, note);
  }

  const routingMode = (cfg.routingStrategy || cfg.providerRoutingMode || 'auto').toLowerCase();
  const searchProv = requestedProvider || requestedModel;
  const isAutoSelection = !searchProv || ['auto', 'bre-ai', 'unified', 'all'].includes(searchProv.toLowerCase());

  let candidates = [];
  let primaryTarget = null;
  let targetModelName = requestedModel;

  // 6A. Check if user explicitly requested a specific provider or model
  if (!isAutoSelection) {
    primaryTarget = activeEps.find(e => e.name && e.name.toLowerCase() === searchProv.toLowerCase())
                 || activeEps.find(e => e.name && (e.name.toLowerCase().includes(searchProv.toLowerCase()) || searchProv.toLowerCase().includes(e.name.toLowerCase())));

    if (!primaryTarget) {
      for (const e of activeEps) {
        if (e.models && e.models.some(m => m.toLowerCase() === searchProv.toLowerCase())) {
          primaryTarget = e;
          targetModelName = searchProv;
          break;
        }
        if (e.mapping) {
          const mapStr = Array.isArray(e.mapping) ? e.mapping.join(',') : e.mapping;
          const pairs = mapStr.split(',').map(p => p.trim()).filter(Boolean);
          for (const p of pairs) {
            const [alias, real] = p.split(':').map(s => s.trim());
            if (alias && real && alias.toLowerCase() === searchProv.toLowerCase()) {
              primaryTarget = e;
              targetModelName = real;
              break;
            }
          }
        }
        if (primaryTarget) break;
      }
    }

    if (primaryTarget) {
      targetModelName = targetModelName || primaryTarget.models?.[0] || 'mercury-2';
      candidates = [primaryTarget];
      if (cfg.autoFailover !== false) {
        activeEps.forEach(e => {
          if (e !== primaryTarget && !candidates.includes(e)) candidates.push(e);
        });
      }
    }
  }

  // 6B. If Auto Mode or requested provider was not found, apply Routing Strategy
  if (!candidates.length) {
    if (routingMode === 'weighted') {
      // Mode WEIGHTED: Pilih provider berdasarkan bobot (weight)
      let totalWeight = activeEps.reduce((acc, ep) => acc + (Math.max(1, parseInt(ep.weight) || 1)), 0);
      let randWeight = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let i = 0; i < activeEps.length; i++) {
        const w = Math.max(1, parseInt(activeEps[i].weight) || 1);
        if (randWeight < w) {
          chosenIdx = i;
          break;
        }
        randWeight -= w;
      }
      primaryTarget = activeEps[chosenIdx];
      targetModelName = primaryTarget.models?.[0] || requestedModel || 'mercury-2';
      candidates = [primaryTarget, ...activeEps.filter((_, idx) => idx !== chosenIdx)];
    } else {
      // Mode AUTO: Rotasi bergantian secara teratur (Round-Robin Sequential) ke semua provider aktif
      const startIdx = getNextRoundRobinIndex(activeEps.length);
      for (let i = 0; i < activeEps.length; i++) {
        candidates.push(activeEps[(startIdx + i) % activeEps.length]);
      }
      primaryTarget = candidates[0];
      targetModelName = primaryTarget.models?.[0] || requestedModel || 'mercury-2';
    }
  }

  // If multimodal image is present, prioritize providers and models that support vision
  if (hasImageAttachment) {
    candidates.sort((a, b) => {
      const aHasVision = Array.isArray(a.models) && a.models.some(isVisionCapableModel);
      const bHasVision = Array.isArray(b.models) && b.models.some(isVisionCapableModel);
      if (aHasVision && !bHasVision) return -1;
      if (!aHasVision && bHasVision) return 1;
      return 0;
    });
    if (candidates.length > 0) primaryTarget = candidates[0];
  }

  // 7. Response Caching check (only for non-stream requests)
  const dialogueDigest = userMessages.map(m => `${m.role}:${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('|');
  const cacheKey = `${primaryTarget.name}:${targetModelName}:${requestedLang}:${requestedStyle}:${dialogueDigest}`;

  if (cfg.cacheEnabled && !stream && allUserText.trim()) {
    const cachedData = getCachedResponse(cacheKey);
    if (cachedData) {
      const ms = Date.now() - reqStartTime;
      logRequest({ ip, provider: primaryTarget.name, model: targetModelName, status: 200, latencyMs: ms, tokens: Math.round(allUserText.length / 4), cached: true });
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedData);
    }
  }

  // 8. Execute Request across candidate providers (Auto-Failover)
  const masterSystemContent = buildBreAISystemPrompt({
    cfg,
    style: requestedStyle,
    customSystemPrompt: body.customSystemPrompt || '',
    language: requestedLang
  });
  const formattedMessages = [{ role: 'system', content: masterSystemContent }, ...userMessages];

  const maxTokens = body.max_tokens || cfg.maxTokens || 16384;
  const temperature = body.temperature !== undefined ? body.temperature : (cfg.temperature || 0.7);

  let finalError = null;

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const currentTarget = candidates[cIdx];
    const isFailover = cIdx > 0;
    const currApiUrl = normalizeChatUrl(currentTarget.url);
    const currKeys = (Array.isArray(currentTarget.keys) && currentTarget.keys.length > 0)
      ? currentTarget.keys.map(k => String(k).trim()).filter(Boolean)
      : (currentTarget.apiKey ? [String(currentTarget.apiKey).trim()] : []);
    if (!currKeys.length) continue;

    // Build ordered list of models to try for this provider
    let providerModels = [];
    if (targetModelName && !providerModels.includes(targetModelName)) providerModels.push(targetModelName);
    if (Array.isArray(currentTarget.models)) {
      for (const m of currentTarget.models) {
        if (m && !providerModels.includes(m)) providerModels.push(m);
      }
    }
    if (!providerModels.length) providerModels.push(targetModelName || 'mercury-2');

    // If request contains image/vision, prioritize vision-capable models
    if (hasImageAttachment) {
      providerModels.sort((a, b) => {
        const aV = isVisionCapableModel(a) ? 1 : 0;
        const bV = isVisionCapableModel(b) ? 1 : 0;
        return bV - aV;
      });
    }

    for (let mIdx = 0; mIdx < providerModels.length; mIdx++) {
      const currModel = providerModels[mIdx];
      const totalKeys = currKeys.length;
      let startKeyIdx = keyRotations.get(currApiUrl) || 0;

      for (let kIdx = 0; kIdx < totalKeys; kIdx++) {
        const idx = (startKeyIdx + kIdx) % totalKeys;
        const key = currKeys[idx];
        const auth = key.startsWith('Bearer ') ? key : `Bearer ${key}`;

        const targetMessages = prepareMessagesForModel(formattedMessages, currModel);
        const payload = { model: currModel, messages: targetMessages, max_tokens: maxTokens, temperature, stream };
        if (cfg.topP !== undefined) payload.top_p = cfg.topP;
        if (cfg.reasoningEffort && cfg.reasoningEffort !== 'none') payload.reasoning_effort = cfg.reasoningEffort;

        try {
          const ctrl = new AbortController();
          const timeoutMs = isFailover ? 18000 : 25000;
          const timer = setTimeout(() => ctrl.abort(), timeoutMs);
          let disconnected = false;
          const onClose = () => { disconnected = true; ctrl.abort(); };
          if (typeof req.on === 'function') req.on('close', onClose);

          const upstream = await fetch(currApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: auth },
            body: JSON.stringify(payload),
            signal: ctrl.signal
          });

          clearTimeout(timer);
          if (typeof req.removeListener === 'function') {
            req.removeListener('close', onClose);
          } else if (typeof req.off === 'function') {
            req.off('close', onClose);
          }
          if (disconnected) return;

          const latencyMs = Date.now() - reqStartTime;

          // Reject HTML parking pages or captive portal responses disguised as HTTP 200
          const upstreamContentType = (upstream.headers.get('content-type') || '').toLowerCase();
          if (upstreamContentType.includes('text/html')) {
            finalError = `Invalid upstream response (HTML page returned by ${currentTarget.name}/${currModel})`;
            continue;
          }

          if (upstream.ok) {
            keyRotations.set(currApiUrl, (idx + 1) % totalKeys);

            const promptTokensEst = Math.max(1, Math.round(allUserText.length / 3.8));

            if (stream && upstream.body) {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'X-Provider': currentTarget.name,
                'X-Model': currModel
              });

              const reader = upstream.body.getReader();
              const dec = new TextDecoder('utf-8');
              let buf = '';
              let closed = false;
              let firstChunkTime = null;
              let accumulatedResponse = '';

              req.on('close', () => { closed = true; try { reader.cancel(); } catch {} });

              try {
                while (!closed) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  if (!firstChunkTime) firstChunkTime = Date.now();
                  
                  const chunkStr = dec.decode(value, { stream: true });
                  buf += chunkStr;
                  const lines = buf.split('\n'); buf = lines.pop();
                  for (const line of lines) {
                    res.write(sanitizeOutput(line) + '\n');
                    if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                      try {
                        const parsed = JSON.parse(line.slice(6));
                        const delta = parsed.choices?.[0]?.delta?.content || '';
                        if (delta) accumulatedResponse += delta;
                      } catch(e){}
                    }
                  }
                }
                if (buf) {
                  res.write(sanitizeOutput(buf) + '\n');
                }
              } catch (e) {}

              const endLatencyMs = Date.now() - reqStartTime;
              const ttftMs = firstChunkTime ? (firstChunkTime - reqStartTime) : Math.round(endLatencyMs * 0.3);
              const compTokensEst = Math.max(1, Math.round(accumulatedResponse.length / 3.8)) || 120;

              logRequest({
                ip,
                provider: currentTarget.name,
                model: currModel,
                status: 200,
                latencyMs: endLatencyMs,
                ttftMs,
                inputTokens: promptTokensEst,
                outputTokens: compTokensEst,
                cachedTokens: 0,
                totalTokens: promptTokensEst + compTokensEst,
                failover: isFailover || mIdx > 0,
                requestSummary: allUserText.slice(0, 100),
                responseSummary: accumulatedResponse.slice(0, 120)
              });

              return res.end();
            } else {
              const latencyMs = Date.now() - reqStartTime;
              const ttftMs = Math.round(latencyMs * 0.75);
              const data = await upstream.json();
              if (data.choices?.[0]?.message) {
                data.choices[0].message.content = sanitizeOutput(data.choices[0].message.content);
              }

              const promptTok = Number(data.usage?.prompt_tokens) || promptTokensEst;
              const compTok = Number(data.usage?.completion_tokens) || Math.max(1, Math.round((data.choices?.[0]?.message?.content?.length || 0) / 3.8));
              const cacheTok = Number(data.usage?.prompt_tokens_details?.cached_tokens || data.usage?.cached_tokens || 0);

              logRequest({
                ip,
                provider: currentTarget.name,
                model: currModel,
                status: 200,
                latencyMs,
                ttftMs,
                inputTokens: promptTok,
                outputTokens: compTok,
                cachedTokens: cacheTok,
                totalTokens: promptTok + compTok,
                failover: isFailover || mIdx > 0,
                requestSummary: allUserText.slice(0, 100),
                responseSummary: (data.choices?.[0]?.message?.content || '').slice(0, 120)
              });

              if (cfg.cacheEnabled) {
                setCachedResponse(cacheKey, data, cfg.cacheTTL || 3600);
              }

              res.setHeader('X-Provider', currentTarget.name);
              res.setHeader('X-Model', currModel);
              return res.status(200).json(data);
            }
          } else {
            const errText = await upstream.text();
            finalError = `HTTP ${upstream.status} [${currentTarget.name}/${currModel}]: ${errText.slice(0, 200)}`;
          }
        } catch (e) {
          finalError = e.name === 'AbortError' ? `Timeout [${currentTarget.name}/${currModel}]` : e.message;
        }
      } // end key loop
    } // end model loop
  } // end provider loop

  // All candidates failed -> Use Bre AI Standby Engine to guarantee immediate response!
  const totalMs = Date.now() - reqStartTime;
  logRequest({
    ip,
    provider: primaryTarget?.name || 'StandbyEngine',
    model: targetModelName || 'bre-standby',
    status: 200,
    latencyMs: totalMs,
    error: finalError || 'Failed to connect to upstream provider, activated Standby Engine'
  });

  const standbyReply = generateStandbyResponse({ userText: allUserText, style: requestedStyle, lang: requestedLang });
  const note = `Provider cloud (${primaryTarget?.name || 'Upstream'}) sedang tidak dapat dihubungi (${finalError || 'Offline'}). Bre AI merespons dalam mode lokal. Anda dapat memeriksa konfigurasi di menu Settings (Admin).`;
  return sendStandbyResponse(res, stream, standbyReply, note);
};

// ========================================================
// Bre AI Intelligent Standby Engine (Offline/Fallback)
// ========================================================
function generateStandbyResponse({ userText, style, lang }) {
  const query = (userText || '').trim();
  const lower = query.toLowerCase();

  // 1. Identity questions
  if (lower.includes('siapa kamu') || lower.includes('who are you') || lower.includes('siapa pembuat') || lower.includes('pencipta') || lower.includes('kamu siapa') || lower.includes('created you')) {
    return `Halo! Saya adalah **Bre AI**, sistem kecerdasan buatan serba bisa yang dirancang dan dikembangkan secara eksklusif oleh **Amirun Rayan Ariandi**.\n\nSaya dirancang untuk membantu berbagai kebutuhan komputasi, pemrograman, perancangan sistem, analisis dokumen, riset, hingga penulisan kreatif dengan presisi tinggi.`;
  }

  // 2. Greetings
  const greetings = ['halo', 'hai', 'hello', 'hi', 'p', 'test', 'tes', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'oy', 'bro'];
  const isGreeting = greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g));
  
  if (isGreeting) {
    if (style === 'jakarta') {
      return `Halo juga bro! Gue **Bre AI** ciptaan **Amirun Rayan Ariandi**. Ada yang bisa gue bantu hari ini? Mau ngoding, brainstorming ide, bikin dokumen, atau ngobrol santai aja, kuy langsung cerita aja!`;
    } else if (style === 'jawa_halus') {
      return `Sugeng rawuh! Kula **Bre AI**, kecerdasan buatan ingkang dipun rancang dening Mas **Amirun Rayan Ariandi**. Wonten ingkang saged kula biyantu kagem panjenengan dinten menika?`;
    } else if (style === 'sunda') {
      return `Sampurasun! Wilujeng sumping, abdi **Bre AI** kenging ngarancang ti Kang **Amirun Rayan Ariandi**. Aya naon anu tiasa dibantos dinten ieu?`;
    } else {
      return `Halo bro! Senang bisa menyapa kamu. Saya adalah **Bre AI**, kecerdasan buatan yang diciptakan oleh **Amirun Rayan Ariandi**.\n\nAda yang bisa saya bantu hari ini? Kamu bisa meminta saya membuat kode pemrograman, dokumen spesifikasi (PRD), analisis data, atau berdiskusi tentang topik apa saja!`;
    }
  }

  // 3. Document / PRD generation
  if (lower.includes('prd') || lower.includes('product requirement')) {
    return `# Product Requirement Document (PRD)\n**Project:** ${query.replace(/buatkan|bikin|tolong|prd/gi, '').trim() || 'New Feature Architecture'}\n**Created with:** Bre AI by Amirun Rayan Ariandi\n\n## 1. Objective & Background\nDokumen ini menjelaskan spesifikasi produk, target pengguna, dan arsitektur teknis yang diperlukan.\n\n## 2. User Personas & Pain Points\n- Pengguna membutuhkan alur kerja yang cepat, responsif, dan mudah digunakan di segala perangkat (ponsel, tablet, desktop).\n\n## 3. Key Functional Requirements\n- **FR-1:** Sistem input pesan responsif dengan auto-grow textarea.\n- **FR-2:** Pengiriman instan via tombol Enter dan baris baru via Shift + Enter.\n- **FR-3:** Pratinjau berkas/gambar dinamis tanpa memakan ruang saat kosong.\n\n\`\`\`markdown:PRD.md\n# PRD - ${query.slice(0, 30)}\nVersi: 1.0\nStatus: Approved\n\`\`\``;
  }

  // 4. Code request
  if (lower.includes('python') || lower.includes('javascript') || lower.includes('kode') || lower.includes('coding') || lower.includes('buatkan script') || lower.includes('html')) {
    return `Tentu, berikut adalah implementasi kode bersih dan terstruktur untuk kebutuhan kamu:\n\n\`\`\`javascript:solution.js\n// Solution generated by Bre AI (Engineered by Amirun Rayan Ariandi)\nfunction processTask(data) {\n  console.log('Processing input:', data);\n  return {\n    status: 'success',\n    timestamp: new Date().toISOString(),\n    result: data\n  };\n}\n\nmodule.exports = { processTask };\n\`\`\`\n\nKode di atas sudah siap digunakan. Jika ada bagian logika atau parameter yang ingin disesuaikan lebih spesifik, beri tahu saya!`;
  }

  // 5. Default General Intelligence fallback
  return `Halo! Terima kasih atas pertanyaannya. Sebagai **Bre AI** ciptaan **Amirun Rayan Ariandi**, saya siap membantu menjawab dan menyelesaikan kebutuhan kamu terkait:\n\n> "${query.slice(0, 150)}"\n\nBerikut beberapa langkah atau poin utama yang dapat kita lakukan:\n1. **Analisis Kebutuhan**: Merinci inti topik yang ingin dicapai secara sistematis.\n2. **Solusi & Eksekusi**: Memberikan jawaban praktis, kode program, atau dokumen yang relevan.\n3. **Optimalisasi**: Melakukan penyempurnaan sesuai preferensi gaya bahasa dan kebutuhan kamu.\n\nSilakan jelaskan lebih detail bagian mana yang ingin diprioritaskan!`;
}

function sendStandbyResponse(res, stream, content, note) {
  const fullText = content + (note ? `\n\n> 💡 *Bre AI Standby Engine:* ${note}` : '');
  
  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Provider': 'Bre AI Standby Engine',
      'X-Model': 'bre-standby'
    });

    const words = fullText.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      if (i >= words.length) {
        clearInterval(interval);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      const chunk = (i === 0 ? '' : ' ') + words[i];
      const payload = JSON.stringify({
        choices: [{
          delta: { content: chunk }
        }]
      });
      res.write(`data: ${payload}\n\n`);
      i++;
    }, 15);
  } else {
    res.setHeader('X-Provider', 'Bre AI Standby Engine');
    res.setHeader('X-Model', 'bre-standby');
    return res.status(200).json({
      id: 'chatcmpl-bre-standby-' + Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: fullText
        }
      }],
      usage: {
        total_tokens: Math.round(fullText.length / 4)
      }
    });
  }
}
