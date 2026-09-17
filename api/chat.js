const {
  getConfig,
  syncCloudConfig,
  sanitizeOutput,
  checkChatRateLimit,
  consumeChatRate,
  logRequest,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  getNextRoundRobinIndex,
  buildBreAISystemPrompt,
  getClientIp,
  checkClientAuth,
  STYLE_PROMPTS
} = require('./_shared');
const {
  detectQueryLanguage,
  isOwnershipOrIdentityQuery,
  getMultilingualIdentityResponse,
  enforceBreAIOwnership,
  generateStandbyResponse,
  sendStandbyResponse
} = require('../services/shared/standby');
const crypto = require('crypto');
const { apiHandler, httpError, internalRequests } = require('../services/httpSecurity');
const { safeFetch: fetch, responseJson, responseText } = require('../services/safeFetch');
const { normalizeChatUrl: normalizeUpstreamUrl } = require('../services/safeFetch');

const keyRotations = new Map();

function isVisionCapableModel(modelName) {
  if (!modelName || typeof modelName !== 'string') return false;
  const m = modelName.toLowerCase().trim();

  // 1. Explicit vision-capable models & keywords
  if (
    m.includes('4o') ||
    m.includes('vision') ||
    m.includes('gemini') ||
    m.includes('claude-3') ||
    m.includes('claude-3.5') ||
    m.includes('claude-3.7') ||
    m.includes('qwen-vl') ||
    m.includes('qwen2-vl') ||
    m.includes('qwen2.5-vl') ||
    m.includes('pixtral') ||
    m.includes('llava') ||
    m.includes('vl-') ||
    m.includes('-vl') ||
    m.includes('multimodal') ||
    m.includes('omni')
  ) {
    return true;
  }

  // 2. Explicit text-only models (do not accept pixel image_url payloads)
  if (
    m.includes('mercury') ||
    m.includes('deepseek-chat') ||
    m.includes('deepseek-coder') ||
    m.includes('deepseek-r1') ||
    m.includes('gpt-3.5') ||
    m.includes('gpt-35') ||
    m.includes('llama-3.1') ||
    m.includes('llama-3.3') ||
    m.includes('llama-3-') ||
    m.includes('mistral-7b') ||
    m.includes('mixtral') ||
    m.includes('command-r')
  ) {
    return false;
  }

  return false;
}

function prepareMessagesForModel(messages, modelName, forceText = false) {
  const isVision = !forceText && isVisionCapableModel(modelName);
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
  return normalizeUpstreamUrl(rawUrl);
}

function resolveActualModel(ep, requested) {
  const isGeneric = !requested || ['auto', 'bre-ai', 'unified', 'all'].includes(String(requested).toLowerCase().trim()) || (ep && requested === ep.name);
  if (!isGeneric) return requested;
  if (ep && Array.isArray(ep.models) && ep.models.length > 0) {
    const real = ep.models.find(m => m && !['auto', 'bre-ai', 'unified', 'all'].includes(String(m).toLowerCase().trim()));
    if (real) return real;
    return ep.models[0];
  }
  return 'mercury-2';
}

module.exports = apiHandler(async (req, res) => {
  const reqStartTime = Date.now();

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  for (const field of ['model', 'provider', 'customModel', 'style', 'language', 'customSystemPrompt']) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > (field === 'customSystemPrompt' ? 30000 : 256))) throw httpError(400, `${field} tidak valid`);
  }
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 100) throw httpError(400, 'messages harus berisi 1–100 pesan');
  if (body.messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || (typeof m.content !== 'string' && !Array.isArray(m.content)))) throw httpError(400, 'Format pesan tidak valid');
  for (const m of body.messages) if (Array.isArray(m.content)) {
    if (m.content.length > 32 || m.content.some(p => !p || !((p.type === 'text' && typeof p.text === 'string') || (p.type === 'image_url' && typeof p.image_url?.url === 'string' && /^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/.test(p.image_url.url))))) throw httpError(400, 'Format lampiran tidak valid');
  }
  if (body.stream !== undefined && typeof body.stream !== 'boolean') throw httpError(400, 'stream harus boolean');

  const bodySize = Buffer.byteLength(JSON.stringify(body));
  if (bodySize > 4 * 1024 * 1024) throw httpError(413, 'Payload melebihi batas 4 MB');

  // 1. IP and Rate Limiting
  const ip = getClientIp(req);
  const internal = internalRequests.has(req);
  const clientChannel = internal ? 'Telegram / Internal' : (req.headers.authorization || req.headers['x-api-key'] ? 'API Client' : 'Direct Web');
  const cfg = await syncCloudConfig();

  // Client Authentication (anti open-proxy) — aktif hanya jika requireAuth=true
  const clientKeyCheck = internal ? 'internal' : (cfg.requireAuth !== false ? checkClientAuth(req, cfg) : 'open');
  if (!clientKeyCheck) {
    logRequest({ ip, provider: 'AuthFilter', model: 'n/a', status: 401, latencyMs: 2, error: 'Missing or invalid API key', clientKeyName: 'Rejected' });
    return res.status(401).json({ error: 'Unauthorized: API key (x-api-key / Authorization Bearer) valid diperlukan.' });
  }

  // Check Rate Limits (Anti-Spam per IP)
  const chatRate = checkChatRateLimit(ip);
  if (!internal && chatRate.limited) {
    logRequest({ ip, provider: 'RateLimiter', model: 'n/a', status: 429, latencyMs: 1, error: 'Chat rate limit exceeded', clientKeyName: clientChannel });
    return res.status(429).json({ error: `Batas kuota request tercapai. Coba lagi dalam ${chatRate.retryAfter} detik.` });
  }
  if (!internal) consumeChatRate(ip);

  // 3. Extract Custom Provider and Model Routing
  const rawCustomProv = (req.headers['x-custom-provider'] || '').trim();
  const requestedProvider = (rawCustomProv && rawCustomProv !== 'Telegram Bot' ? rawCustomProv : (body.provider || '')).trim();
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
  const requestedLang = (req.headers['x-custom-language'] || body.language || 'auto').trim().toLowerCase();
  const stream = internal ? false : (cfg.forceStream === true ? true : (cfg.forceStream === false ? false : (body.stream !== undefined ? body.stream : cfg.streamEnabled !== false)));

  if (isOwnershipOrIdentityQuery(allUserText)) {
    return sendStandbyResponse(res, stream, getMultilingualIdentityResponse(allUserText, requestedStyle, requestedLang));
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
      targetModelName = resolveActualModel(primaryTarget, targetModelName);
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
      targetModelName = resolveActualModel(primaryTarget, requestedModel);
      candidates = [primaryTarget, ...activeEps.filter((_, idx) => idx !== chosenIdx)];
    } else if (routingMode === 'priority') {
      candidates = [...activeEps];
      primaryTarget = candidates[0];
      targetModelName = resolveActualModel(primaryTarget, requestedModel);
    } else {
      // Mode AUTO: Rotasi bergantian secara teratur (Round-Robin Sequential) ke semua provider aktif
      const startIdx = getNextRoundRobinIndex(activeEps.length);
      for (let i = 0; i < activeEps.length; i++) {
        candidates.push(activeEps[(startIdx + i) % activeEps.length]);
      }
      primaryTarget = candidates[0];
      targetModelName = resolveActualModel(primaryTarget, requestedModel);
    }
  }

  // If multimodal image is present, prioritize providers and models that support vision
  if (hasImageAttachment) {
    const visionCandidates = candidates.filter(e => Array.isArray(e.models) && e.models.some(isVisionCapableModel));
    if (visionCandidates.length > 0) {
      candidates.sort((a, b) => {
        const aHasVision = Array.isArray(a.models) && a.models.some(isVisionCapableModel);
        const bHasVision = Array.isArray(b.models) && b.models.some(isVisionCapableModel);
        if (aHasVision && !bHasVision) return -1;
        if (!aHasVision && bHasVision) return 1;
        return 0;
      });
      if (candidates.length > 0) primaryTarget = candidates[0];
    }
  }

  if (cfg.autoFailover === false) candidates = candidates.slice(0, 1);

  // 7. Response Caching check (only for non-stream requests)
  const maxTokens = body.max_tokens ?? cfg.maxTokens ?? 16384;
  const temperature = body.temperature ?? cfg.temperature ?? 0.7;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > Math.min(32768, cfg.maxTokens || 16384)) throw httpError(400, 'max_tokens di luar batas konfigurasi');
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw httpError(400, 'temperature harus 0–2');
  const topP = body.top_p ?? cfg.topP ?? 1;
  if (!Number.isFinite(topP) || topP < 0 || topP > 1) throw httpError(400, 'top_p harus 0–1');
  const dialogueDigest = userMessages.map(m => `${m.role}:${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('|');
  const cacheKey = crypto.createHash('sha256').update(JSON.stringify({ endpoint: primaryTarget.url, targetModelName, requestedLang, requestedStyle, maxTokens, temperature, topP, system: cfg.systemPrompt, custom: body.customSystemPrompt, userMessages, client: req.headers.authorization || req.headers['x-api-key'] || ip, reasoning: cfg.reasoningEffort, penalties: [cfg.frequencyPenalty, cfg.presencePenalty] })).digest('hex');

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

  let finalError = null;
  const forceTextOnly = new Set();
  let attempts = 0;
  const deadline = reqStartTime + 40000;

  providerLoop: for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const currentTarget = candidates[cIdx];
    const isFailover = cIdx > 0;
    const currApiUrl = normalizeChatUrl(currentTarget.url);
    const currKeys = (Array.isArray(currentTarget.keys) && currentTarget.keys.length > 0)
      ? currentTarget.keys.map(k => String(k).trim()).filter(Boolean)
      : (currentTarget.apiKey ? [String(currentTarget.apiKey).trim()] : []);
    if (!currKeys.length) continue;

    // Build ordered list of models to try for this provider
    let providerModels = [];
    const resolvedPrimary = resolveActualModel(currentTarget, targetModelName);
    if (resolvedPrimary) providerModels.push(resolvedPrimary);
    if (Array.isArray(currentTarget.models)) {
      for (const m of currentTarget.models) {
        const cleanM = String(m || '').trim();
        if (cleanM && !['auto', 'bre-ai', 'unified', 'all'].includes(cleanM.toLowerCase()) && !providerModels.includes(cleanM)) {
          providerModels.push(cleanM);
        }
      }
    }
    if (!providerModels.length) providerModels.push('mercury-2');

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
        if (++attempts > 6 || Date.now() >= deadline) break providerLoop;
        const idx = (startKeyIdx + kIdx) % totalKeys;
        const key = currKeys[idx];
        const auth = key.startsWith('Bearer ') ? key : `Bearer ${key}`;

        const targetMessages = prepareMessagesForModel(formattedMessages, currModel, forceTextOnly.has(currModel));
        const payload = { model: currModel, messages: targetMessages, max_tokens: maxTokens, temperature, stream };
        payload.top_p = topP;
        if (cfg.frequencyPenalty !== undefined) payload.frequency_penalty = cfg.frequencyPenalty;
        if (cfg.presencePenalty !== undefined) payload.presence_penalty = cfg.presencePenalty;
        if (cfg.reasoningEffort && cfg.reasoningEffort !== 'none') payload.reasoning_effort = cfg.reasoningEffort;

        const ctrl = new AbortController();
        const timeoutMs = Math.max(1, Math.min(isFailover ? 15000 : 20000, deadline - Date.now()));
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        let disconnected = false;
        const onClose = () => { if (!res.writableEnded) { disconnected = true; ctrl.abort(); } };
        if (typeof res.on === 'function') res.on('close', onClose);
        try {

          const upstream = await fetch(currApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: auth },
            body: JSON.stringify(payload),
            signal: ctrl.signal
          });

          if (disconnected) return;

          const latencyMs = Date.now() - reqStartTime;

          // Reject HTML parking pages or captive portal responses disguised as HTTP 200
          const upstreamContentType = (upstream.headers.get('content-type') || '').toLowerCase();
          if (upstreamContentType.includes('text/html')) {
            finalError = `Invalid upstream response (HTML page returned by ${currentTarget.name}/${currModel})`;
            await upstream.body?.cancel();
            continue;
          }

          if (upstream.ok) {
            keyRotations.set(currApiUrl, (idx + 1) % totalKeys);

            const promptTokensEst = Math.max(1, Math.round(allUserText.length / 3.8));

            if (stream && upstream.body && upstreamContentType.includes('text/event-stream')) {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'X-Provider': encodeURIComponent(currentTarget.name),
                'X-Model': encodeURIComponent(currModel)
              });

              const reader = upstream.body.getReader();
              const dec = new TextDecoder('utf-8');
              let buf = '';
              let closed = false;
              let firstChunkTime = null;
              let accumulatedResponse = '';

              try {
                let receivedBytes = 0;
                while (!closed && !disconnected) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  if (!firstChunkTime) firstChunkTime = Date.now();
                  
                  const chunkStr = dec.decode(value, { stream: true });
                  receivedBytes += value.byteLength;
                  if (receivedBytes > 4 * 1024 * 1024) throw new Error('Respons stream terlalu besar');
                  buf += chunkStr;
                  const lines = buf.split('\n'); buf = lines.pop();
                  for (const line of lines) {
                    // SSE is structured JSON; replacing words in serialized frames corrupts code and metadata.
                    res.write(line + '\n');
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
                  res.write(buf + '\n\n');
                }
              } catch (e) {
                if (!disconnected) res.write('data: ' + JSON.stringify({ error: 'Stream upstream terputus' }) + '\n\n');
              } finally { await reader.cancel().catch(() => {}); }

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
                responseSummary: accumulatedResponse.slice(0, 120),
                clientKeyName: clientChannel
              });

              return res.end();
            } else {
              const latencyMs = Date.now() - reqStartTime;
              const ttftMs = Math.round(latencyMs * 0.75);
              const data = await responseJson(upstream);
              if (typeof data.choices?.[0]?.message?.content !== 'string') throw new Error('Format respons upstream tidak valid');
              if (data.choices?.[0]?.message) {
                data.choices[0].message.content = enforceBreAIOwnership(data.choices[0].message.content, allUserText, requestedStyle, requestedLang);
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
                responseSummary: (data.choices?.[0]?.message?.content || '').slice(0, 120),
                clientKeyName: clientChannel
              });

              if (cfg.cacheEnabled) {
                setCachedResponse(cacheKey, data, cfg.cacheTTL || 3600);
              }

              res.setHeader('X-Provider', encodeURIComponent(currentTarget.name));
              res.setHeader('X-Model', encodeURIComponent(currModel));
              return res.status(200).json(data);
            }
          } else {
            const errText = await responseText(upstream, 65536);
            finalError = `HTTP ${upstream.status} [${currentTarget.name}/${currModel}]`;
            if (hasImageAttachment && /does not support image|image input|cannot (read|process) image|image_url|vision|mulmodality|multimodal/i.test(errText)) {
              forceTextOnly.add(currModel);
              finalError = `Model [${currentTarget.name}/${currModel}] tidak mendukung analisis gambar; melanjutkan ke model teks.`;
            }
          }
        } catch (e) {
          if (disconnected) return;
          const errMsg = e.name === 'AbortError' ? `Timeout [${currentTarget.name}/${currModel}]` : e.message;
          if (hasImageAttachment && !errMsg.includes('AbortError') && /does not support image|image input|cannot (read|process) image|vision|mulmodality|multimodal/i.test(errMsg)) {
            forceTextOnly.add(currModel);
            finalError = `Model [${currentTarget.name}/${currModel}] tidak mendukung analisis gambar; melanjutkan ke model teks.`;
          } else {
            finalError = errMsg;
          }
        } finally {
          clearTimeout(timer);
          res.removeListener?.('close', onClose);
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
    status: 502,
    latencyMs: totalMs,
    clientKeyName: clientChannel,
    error: finalError || 'Failed to connect to upstream provider, activated Standby Engine'
  });

  return res.status(502).json({ error: 'Provider AI sedang tidak tersedia. Silakan coba lagi atau periksa konfigurasi provider.' });
}, ['POST']);

// ========================================================
// Bre AI Multilingual Ownership & Identity Enforcement Layer
// (Moved to services/shared/standby.js)
// ========================================================
