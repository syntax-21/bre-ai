// ==========================================================================
// BRE AI - Core Chat Engine, SSE Streaming, Models & Provider Management
// File: public/js/app/chat.js
// ==========================================================================

// ---- AI PROVIDER & MODEL SELECTOR ----
async function initModelSelect() {
  const provSel = document.getElementById('chatProviderSelect');

  try {
    const r = await fetch('/api/config');
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data?.config?.endpoints)) {
        chatEndpoints = data.config.endpoints;
      }
    }
  } catch (e) {
    console.warn('[Bre AI] Gagal memuat daftar provider publik:', e.message);
  }

  if (provSel) {
    let provHtml = '<option value="auto">🌐 Auto Provider</option>';
    chatEndpoints.forEach((ep, idx) => {
      const name = ep.name || `Provider #${idx + 1}`;
      provHtml += `<option value="${esc(name)}">${esc(name)}</option>`;
    });
    provSel.innerHTML = provHtml;

    if (selectedProvider && (selectedProvider === 'auto' || chatEndpoints.some(e => e.name === selectedProvider))) {
      provSel.value = selectedProvider;
    } else {
      provSel.value = 'auto';
      selectedProvider = 'auto';
    }
  }

  updateChatModelOptions();
}

function onChatProviderChange(provName) {
  selectedProvider = provName || 'auto';
  localStorage.setItem('bre_provider', selectedProvider);
  updateChatModelOptions();
  toast('Provider dipilih: ' + (selectedProvider === 'auto' ? 'Auto Routing' : selectedProvider), 'ok');
}

function updateChatModelOptions() {
  const modelSel = document.getElementById('modelSelect');
  if (!modelSel) return;

  const modelList = ['auto'];
  const seen = new Set(['auto']);

  if (selectedProvider === 'auto') {
    chatEndpoints.forEach(ep => {
      (ep.models || []).forEach(m => {
        const clean = String(m || '').trim();
        if (clean && clean.toLowerCase() !== 'auto' && !seen.has(clean)) { seen.add(clean); modelList.push(clean); }
      });
      (ep.mapping || []).forEach(map => {
        const alias = String(map || '').split(':')[0]?.trim();
        if (alias && alias.toLowerCase() !== 'auto' && !seen.has(alias)) { seen.add(alias); modelList.push(alias); }
      });
    });
  } else {
    const ep = chatEndpoints.find(e => e.name === selectedProvider);
    if (ep) {
      (ep.models || []).forEach(m => {
        const clean = String(m || '').trim();
        if (clean && clean.toLowerCase() !== 'auto' && !seen.has(clean)) { seen.add(clean); modelList.push(clean); }
      });
      (ep.mapping || []).forEach(map => {
        const alias = String(map || '').split(':')[0]?.trim();
        if (alias && alias.toLowerCase() !== 'auto' && !seen.has(alias)) { seen.add(alias); modelList.push(alias); }
      });
    }
  }

  if (modelList.length <= 1) modelList.push('mercury-2');

  modelSel.innerHTML = modelList.map(m => {
    const label = m === 'auto' ? '✨ Otomatis' : m;
    return `<option value="${esc(m)}">${esc(label)}</option>`;
  }).join('');

  if (selectedModel && modelList.includes(selectedModel)) {
    modelSel.value = selectedModel;
  } else {
    modelSel.value = 'auto';
    selectedModel = 'auto';
    localStorage.setItem('bre_model', 'auto');
  }
}

function setChatModel(val) {
  selectedModel = val || 'auto';
  localStorage.setItem('bre_model', selectedModel);
  const modelSel = document.getElementById('modelSelect');
  const label = modelSel?.options[modelSel.selectedIndex]?.textContent || selectedModel;
  toast('Model aktif: ' + label, 'ok');
}

function setProvider(val) {
  onChatProviderChange(val);
}

function setModel(val) {
  setChatModel(val);
}

// ---- CHAT LIFECYCLE MANAGEMENT ----
function togglePinChat(id, e) {
  if (e) e.stopPropagation();
  const target = chats.find(c => c.id === id);
  if (!target) return;
  target.pinned = !target.pinned;
  saveChats();
  renderChatList();
  toast(target.pinned ? '📌 Conversation pinned to top' : '📍 Conversation unpinned', 'ok');
}

function newChat() {
  if (generating) stopGen();
  const id = 'c' + Date.now();
  const freshChat = { id, title: 'New Conversation', msgs: [], ts: Date.now() };
  if (isIncognito) {
    tempIncognitoChat = freshChat;
    activeChat = freshChat;
  } else {
    chats.unshift(freshChat);
    saveChats();
  }
  switchChat(id);
  if (window.innerWidth <= 768) toggleSidebar(false);
}

function switchChat(id) {
  if (generating) stopGen();
  if (isIncognito && tempIncognitoChat && id === tempIncognitoChat.id) {
    activeChat = tempIncognitoChat;
  } else {
    activeChat = chats.find(c => c.id === id) || chats[0];
  }
  editingMsgIdx = null;
  renderChatList();
  renderMessages();
}

function deleteChat(id, e) {
  if (e) e.stopPropagation();
  chats = chats.filter(c => c.id !== id);
  saveChats();
  if (!chats.length) newChat();
  else if (activeChat?.id === id) switchChat(chats[0].id);
  else renderChatList();
}

function renameChat(id, e) {
  if (e) e.stopPropagation();
  const target = chats.find(c => c.id === id);
  const currentTitle = target?.title || '';
  const t = prompt('Chat title:', currentTitle);
  if (t?.trim()) {
    target.title = t.trim();
    saveChats();
    renderChatList();
  }
}

function clearAllChats() {
  const dict = I18N[currentLang] || I18N.en;
  if (confirm('Clear all conversation history?')) {
    chats = [];
    saveChats();
    newChat();
    updateStats();
    toast(dict.clearedToast, 'ok');
  }
}

function exportJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' }));
  a.download = 'bre_ai_conversations.json';
  a.click();
  toast('Conversation history exported', 'ok');
}

function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) return toast('JSON maksimal 4 MB', 'err');
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of chat objects.');
      }
      let count = 0;
      normalizeChats(data).forEach(c => {
        if (c && Array.isArray(c.msgs)) {
          const exists = chats.some(x => x.id === c.id);
          c.id = String(c.id || '').replace(/[<>"'&]/g, '').slice(0, 50) || ('c' + Date.now());
          const newId = exists ? ('c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)) : (c.id || ('c' + Date.now()));
          chats.unshift({
            ...c,
            id: newId,
            title: c.title || 'Imported Conversation',
            ts: c.ts || Date.now()
          });
          count++;
        }
      });
      saveChats();
      renderChatList();
      updateStats();
      if (count > 0) {
        switchChat(chats[0].id);
        toast(`✅ Imported ${count} conversations successfully!`, 'ok');
      } else {
        toast('No valid conversation objects found in JSON.', 'err');
      }
    } catch(err) {
      console.error('Import error:', err);
      toast('Failed to import JSON: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function exportCurrentChat(format) {
  document.getElementById('exportMenu')?.classList.remove('show');
  if (!activeChat || !activeChat.msgs?.length) {
    return toast('No messages in this conversation to export', 'err');
  }

  const title = (activeChat.title || 'conversation').replace(/[^a-zA-Z0-9_\-]/g, '_');
  let content = '';

  if (format === 'md') {
    content = `# ${activeChat.title || 'Bre AI Conversation'}\n` +
      `*Generated by Bre AI on ${new Date().toLocaleString()}*\n\n---\n\n`;
    activeChat.msgs.forEach(m => {
      const isUser = m.role === 'user';
      content += `### ${isUser ? '👤 User' : '⚡ Bre AI'}\n\n${m.content}\n\n---\n\n`;
    });
  } else {
    content = `${activeChat.title || 'Bre AI Conversation'}\n` +
      `Exported: ${new Date().toLocaleString()}\n` +
      `==========================================\n\n`;
    activeChat.msgs.forEach(m => {
      const isUser = m.role === 'user';
      content += `[${isUser ? 'USER' : 'BRE AI'}]:\n${m.content}\n\n------------------------------------------\n\n`;
    });
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.${format}`;
  a.click();
  toast(`Exported conversation as .${format}`, 'ok');
}

function toggleIncognito() {
  if (generating) stopGen();
  isIncognito = !isIncognito;
  const btn = document.getElementById('btnIncognito');
  const banner = document.getElementById('incognitoBanner');

  if (isIncognito) {
    btn?.classList.add('active');
    if (banner) banner.style.display = 'flex';
    tempIncognitoChat = {
      id: 'incognito_' + Date.now(),
      title: '🕶️ Incognito Chat',
      msgs: [],
      ts: Date.now()
    };
    activeChat = tempIncognitoChat;
    renderMessages();
    toast('🕶️ Incognito Mode Active: Chat is temporary and not saved.', 'info');
  } else {
    btn?.classList.remove('active');
    if (banner) banner.style.display = 'none';
    tempIncognitoChat = null;
    if (!chats.length) newChat();
    else switchChat(chats[0].id);
    toast('Exited Incognito Mode.', 'ok');
  }
}

// ---- MESSAGE ACTIONS ----
function quickSend(txt) {
  const inp = document.getElementById('msgInput');
  if (inp) inp.value = txt;
  sendOrStop();
}

function copyMsg(i) {
  if (!activeChat?.msgs?.[i]) return;
  navigator.clipboard.writeText(activeChat.msgs[i].content);
  const dict = I18N[currentLang] || I18N.en;
  toast(dict.copied, 'ok');
}

const copyMessage = copyMsg;

function startEditUserMsg(i) {
  editingMsgIdx = i;
  renderMessages();
  setTimeout(() => {
    const ta = document.getElementById('editInput' + i);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, 50);
}

const editMessage = startEditUserMsg;

function cancelEditUserMsg() {
  editingMsgIdx = null;
  renderMessages();
}

function saveEditUserMsg(i) {
  const ta = document.getElementById('editInput' + i);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) return;

  editingMsgIdx = null;
  if (generating) stopGen();

  activeChat.msgs = activeChat.msgs.slice(0, i);
  const inp = document.getElementById('msgInput');
  if (inp) inp.value = newText;
  sendOrStop();
}

function regenerateBotMsg(i) {
  if (generating) stopGen();
  const target = activeChat.msgs[i];
  if (!target) return;
  if (!target.versions) {
    target.versions = [target.content];
    target.currentVersion = 0;
  }
  target.versions.push('');
  target.currentVersion = target.versions.length - 1;
  target.content = '';
  renderMessages();
  executeBotGeneration(i);
}

const retryMessage = regenerateBotMsg;

function switchBotVersion(i, delta) {
  const target = activeChat.msgs[i];
  if (!target || !target.versions || target.versions.length <= 1) return;
  const cur = typeof target.currentVersion === 'number' ? target.currentVersion : 0;
  const nextVer = cur + delta;
  if (nextVer >= 0 && nextVer < target.versions.length) {
    target.currentVersion = nextVer;
    target.content = target.versions[nextVer];
    saveChats();
    renderMessages();
  }
}

// ---- WEB SEARCH GROUNDING FETCH ----
async function performWebSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { headers: clientHeaders() });
    if (!res.ok) throw new Error('Search HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.warn('Web search error:', err);
    return [];
  }
}

const performDuckDuckGoSearch = performWebSearch;

// ---- GENERATION CORE & SSE STREAMING ----
function stopGen() {
  ctrl?.abort();
  generationSequence++;
  setBusy(false);
}

function setBusy(v) {
  generating = v;
  const sendIcon = document.getElementById('sendIcon');
  const stopIcon = document.getElementById('stopIcon');
  if (sendIcon) sendIcon.style.display = v ? 'none' : '';
  if (stopIcon) stopIcon.style.display = v ? '' : 'none';
}

async function sendOrStop() {
  if (generating) { stopGen(); return; }
  const el = document.getElementById('msgInput');
  if (!el) return;
  let text = el.value.trim();
  if (!text && !files.length) return;

  // Free AI Image Generation shortcut (/image or /img)
  if (text.startsWith('/image ') || text.startsWith('/img ')) {
    const prompt = text.replace(/^\/(image|img)\s+/i, '').trim();
    if (!prompt) {
      toast('Please enter a description for the image', 'err');
      return;
    }
    el.value = '';
    el.style.height = 'auto';
    if (!activeChat) newChat();
    activeChat.title = `🎨 ${prompt.slice(0, 24)}...`;

    const seed = Math.floor(Math.random() * 1000000);
    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    activeChat.msgs.push({
      role: 'user',
      content: `🎨 **Generate Image:** ${prompt}`,
      rawUserText: text
    });

    activeChat.msgs.push({
      role: 'assistant',
      content: `Here is the AI generated image for **"${prompt}"**:\n\n<div class="generated-image-card"><img src="${imgUrl}" alt="${esc(prompt)}" onclick="window.open('${imgUrl}', '_blank')"><div class="generated-image-footer"><span>🎨 Pollinations Free AI Engine</span><a href="${imgUrl}" target="_blank" download style="color:#38bdf8;text-decoration:none;">📥 Full Resolution</a></div></div>\n\n*Prompt:* **"${esc(prompt)}"**`,
      versions: [""],
      currentVersion: 0,
      stats: { elapsed: '0.8', tokens: 40, tokPerSec: '50.0' }
    });

    saveChats();
    renderChatList();
    renderMessages();
    scrollToBottom(true);
    toast('🎨 Image generated successfully!', 'ok');
    return;
  }

  const currentFiles = [...files];
  files = [];
  renderAttachBar();
  el.value = '';
  adjustInputHeight();

  if (!activeChat) newChat();
  if (!activeChat.msgs.length) {
    activeChat.title = text.slice(0, 32).replace(/[\n\r]+/g, ' ') || 'Conversation';
  }

  const imageFiles = currentFiles.filter(f => f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/')));
  const videoFiles = currentFiles.filter(f => f.isVideo && Array.isArray(f.videoFrames) && f.videoFrames.length > 0);
  const otherFiles = currentFiles.filter(f => !imageFiles.includes(f) && !videoFiles.includes(f));

  let userPrompt = text;
  if (otherFiles.length) {
    userPrompt += '\n\n[ATTACHED MEDIA & DOCUMENTS]:\n' + otherFiles.map(f => `${f.content}`).join('\n\n');
  }

  let displayContent = text || '';
  if (imageFiles.length) {
    displayContent = imageFiles.map(img => `![${esc(img.name)}](${img.data || img.content})\n\n`).join('') + displayContent;
  }
  if (videoFiles.length) {
    displayContent = videoFiles.filter(v => v.previewThumb).map(vid => `![Video: ${esc(vid.name)}](${vid.previewThumb})\n\n`).join('') + displayContent;
  }

  const attachedBadges = currentFiles.map(f => ({
    name: f.name,
    icon: f.badgeIcon || (f.isVideo ? '🎬' : (f.isAudio ? '🎵' : (f.type === 'image' ? '🖼️' : '📎'))),
    meta: f.badgeMeta || (f.isVideo ? 'Video' : (f.isAudio ? 'Audio' : (f.type === 'image' ? 'Image' : 'File'))),
    isImage: f.type === 'image' || (typeof f.content === 'string' && f.content.startsWith('data:image/'))
  }));

  const allVisionImages = [];
  imageFiles.forEach(img => {
    allVisionImages.push({
      type: 'image_url',
      image_url: { url: img.data || img.content }
    });
  });
  videoFiles.forEach(vid => {
    vid.videoFrames.forEach(fr => {
      allVisionImages.push({
        type: 'image_url',
        image_url: { url: fr.dataUrl }
      });
    });
  });

  let apiContent;
  if (allVisionImages.length) {
    if (selectedModel.toLowerCase().includes('mercury')) {
      toast('💡 Mengirim cuplikan video/gambar ke router multimodal.', 'info');
    }
    apiContent = [
      { type: 'text', text: userPrompt || 'Mohon analisis visual dan detail dari berkas ini secara mendalam.' },
      ...allVisionImages
    ];
  } else {
    apiContent = userPrompt;
  }

  let searchResults = [];
  if (isWebSearch && text) {
    toast('🌐 Searching web in real-time...', 'info');
    searchResults = await performWebSearch(text);
  }

  activeChat.msgs.push({
    role: 'user',
    content: displayContent,
    rawUserText: text,
    apiContent: apiContent,
    attachments: attachedBadges
  });
  activeChat.ts = Date.now();
  saveChats();
  renderChatList();
  renderMessages();
  scrollToBottom(true);

  await executeBotGeneration(null, searchResults);
}

const sendMsg = sendOrStop;

async function executeBotGeneration(targetBotIdx = null, searchResults = [], generationChat = activeChat) {
  const chatToUse = generationChat;
  const sequence = ++generationSequence;
  let botIdx = targetBotIdx;
  if (botIdx === null) {
    botIdx = chatToUse.msgs.length;
    chatToUse.msgs.push({
      role: 'assistant',
      content: '',
      isTyping: true,
      versions: [''],
      currentVersion: 0,
      searchSources: searchResults
    });
  } else {
    chatToUse.msgs[botIdx].content = '';
    chatToUse.msgs[botIdx].isTyping = true;
  }
  setBusy(true);
  saveChats();
  renderMessages();
  scrollToBottom(true);

  const genStartTime = performance.now();

  const msgs = chatToUse.msgs.slice(0, botIdx).slice(-100).map(m => ({
    role: m.role,
    content: m.apiContent || m.content
  }));

  let pExtra = PERSONAS[persona] || '';
  const langPrompt = LANGUAGE_PROMPTS[currentLang];
  if (langPrompt) {
    pExtra = (pExtra ? pExtra + '\n\n' : '') + `[LANGUAGE INSTRUCTION]: ${langPrompt}`;
  }
  if (!currentLang || currentLang === 'auto' || currentLang === 'id') {
    const stylePrompt = STYLE_PROMPTS[currentStyle];
    if (stylePrompt) {
      pExtra = (pExtra ? pExtra + '\n\n' : '') + stylePrompt;
    }
  }

  const activeSources = chatToUse.msgs[botIdx].searchSources || searchResults || [];
  if (activeSources.length) {
    let searchContext = '\n\n[REAL-TIME WEB SEARCH RESULTS (DuckDuckGo Grounding - Current Year: 2026)]:\n';
    activeSources.forEach((r, idx) => {
      searchContext += `Source [${idx+1}]: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n\n`;
    });
    searchContext += 'Instruction: Utilize the fresh search results above to answer accurately with citation numbers [1], [2] where appropriate.\n';
    pExtra = (pExtra ? pExtra + '\n\n' : '') + searchContext;
  }

  ctrl = new AbortController();

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-custom-provider': selectedProvider,
        'x-custom-model': selectedModel,
        'x-custom-style': currentStyle,
        'x-custom-language': currentLang,
        ...clientHeaders()
      },
      body: JSON.stringify({
        messages: msgs,
        customSystemPrompt: pExtra,
        style: currentStyle,
        language: currentLang,
        stream: true,
        provider: selectedProvider,
        model: selectedModel,
        temperature: temperature,
        max_tokens: maxTokens
      }),
      signal: ctrl.signal
    });

    if (!r.ok) {
      let errDetail = 'HTTP ' + r.status;
      try {
        const errJson = await r.json();
        if (errJson && errJson.error) {
          errDetail = errJson.error;
        }
      } catch (errParse) {
        try {
          const errText = await r.text();
          if (errText) errDetail = errText.slice(0, 300);
        } catch (e) {}
      }
      throw new Error(errDetail);
    }

    if (r.headers.get('content-type')?.includes('event-stream')) {
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const d = JSON.parse(t.slice(6))?.choices?.[0]?.delta;
              if (d) {
                chatToUse.msgs[botIdx].isTyping = false;
                const rc = d.reasoning_content || d.thought || (d.reasoning ? d.reasoning : null);
                if (rc) {
                  let c = chatToUse.msgs[botIdx].content || '';
                  if (!c.startsWith('<think>')) {
                    chatToUse.msgs[botIdx].content = '<think>' + rc;
                  } else if (!c.includes('</think>')) {
                    chatToUse.msgs[botIdx].content = c + rc;
                  } else {
                    const parts = c.split('</think>');
                    chatToUse.msgs[botIdx].content = parts[0] + rc + '</think>' + parts.slice(1).join('</think>');
                  }
                }
                if (d.content) {
                  let c = chatToUse.msgs[botIdx].content || '';
                  if (c.startsWith('<think>') && !c.includes('</think>')) {
                    chatToUse.msgs[botIdx].content = c + '</think>\n\n' + d.content;
                  } else {
                    chatToUse.msgs[botIdx].content = c + d.content;
                  }
                }
                streamUpdate(botIdx, chatToUse);
              }
            } catch(e){}
          }
        }
      }
      if (buf && buf.trim()) {
        const remainingLines = buf.split('\n');
        for (const line of remainingLines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const d = JSON.parse(t.slice(6))?.choices?.[0]?.delta;
              if (d) {
                chatToUse.msgs[botIdx].isTyping = false;
                const rc = d.reasoning_content || d.thought || (d.reasoning ? d.reasoning : null);
                if (rc) {
                  let c = chatToUse.msgs[botIdx].content || '';
                  if (!c.startsWith('<think>')) {
                    chatToUse.msgs[botIdx].content = '<think>' + rc;
                  } else if (!c.includes('</think>')) {
                    chatToUse.msgs[botIdx].content = c + rc;
                  } else {
                    const parts = c.split('</think>');
                    chatToUse.msgs[botIdx].content = parts[0] + rc + '</think>' + parts.slice(1).join('</think>');
                  }
                }
                if (d.content) {
                  let c = chatToUse.msgs[botIdx].content || '';
                  if (c.startsWith('<think>') && !c.includes('</think>')) {
                    chatToUse.msgs[botIdx].content = c + '</think>\n\n' + d.content;
                  } else {
                    chatToUse.msgs[botIdx].content = c + d.content;
                  }
                }
                streamUpdate(botIdx, chatToUse);
              }
            } catch(e){}
          }
        }
      }
      let curContent = chatToUse.msgs[botIdx].content || '';
      if (curContent.startsWith('<think>') && !curContent.includes('</think>')) {
        chatToUse.msgs[botIdx].content = curContent + '</think>\n\n';
      }
    } else {
      const respData = await r.json();
      chatToUse.msgs[botIdx].isTyping = false;
      let respContent = respData.choices?.[0]?.message?.content || respData.error || '';
      const reasoning = respData.choices?.[0]?.message?.reasoning_content || respData.choices?.[0]?.message?.thought;
      if (reasoning && !respContent.includes('<think>')) {
        respContent = `<think>${reasoning.trim()}</think>\n\n` + respContent;
      }
      chatToUse.msgs[botIdx].content = respContent;
    }

    chatToUse.msgs[botIdx].isTyping = false;

    const finalContent = chatToUse.msgs[botIdx].content;
    if (!chatToUse.msgs[botIdx].versions) {
      chatToUse.msgs[botIdx].versions = [finalContent];
      chatToUse.msgs[botIdx].currentVersion = 0;
    } else {
      const curV = chatToUse.msgs[botIdx].currentVersion || 0;
      chatToUse.msgs[botIdx].versions[curV] = finalContent;
    }

    const elapsedSec = ((performance.now() - genStartTime) / 1000).toFixed(1);
    const estTokens = Math.max(1, Math.round(finalContent.length / 3.8));
    const tokPerSec = (estTokens / Math.max(0.1, parseFloat(elapsedSec))).toFixed(1);
    chatToUse.msgs[botIdx].stats = {
      elapsed: elapsedSec,
      tokens: estTokens,
      tokPerSec: tokPerSec
    };

    saveChats();
    renderMessages();
    if (autoTTS) speakText(finalContent);
  } catch(e) {
    if (e.name !== 'AbortError') {
      if (chatToUse?.msgs?.[botIdx]) {
        chatToUse.msgs[botIdx].isTyping = false;
        const errLower = (e.message || '').toLowerCase();
        let tips = '💡 *Tips:* Pastikan backend server aktif (`node server.js`) atau periksa konfigurasi Provider di menu **Settings**.';
        if (errLower.includes('network error') || errLower.includes('failed to fetch') || errLower.includes('load failed')) {
          tips = '💡 *Tips:* Terjadi kendala koneksi jaringan atau respon serverless timeout/terputus. Pastikan koneksi internet stabil dan konfigurasi API Key provider di menu **Settings (Admin)** sudah tersimpan.';
        } else if (errLower.includes('413') || errLower.includes('payload too large')) {
          tips = '💡 *Tips:* Ukuran berkas/gambar terlalu besar untuk serverless (maksimal 4.5MB). Sistem sekarang otomatis mengompres gambar sebelum dikirim.';
        }
        chatToUse.msgs[botIdx].content = `⚠️ **Bre AI:** Tidak dapat memproses permintaan.\n\n*Kendala:* ${e.message}\n\n${tips}`;
      }
      saveChats();
      renderMessages();
      scrollToBottom(true);
    }
  } finally {
    if (chatToUse?.msgs?.[botIdx]) {
      chatToUse.msgs[botIdx].isTyping = false;
    }
    if (sequence === generationSequence) { setBusy(false); saveChats(); renderMessages(); }
  }
}

function streamUpdate(idx, chat = activeChat) {
  const m = chat.msgs[idx];
  if (m) m.isTyping = false;
  if (m && m.versions && typeof m.currentVersion === 'number') {
    m.versions[m.currentVersion] = m.content;
  }
  if (chat !== activeChat || !m) return;
  const b = document.getElementById('b' + idx);
  if (b) {
    b.innerHTML = renderContent(m.content, false);
    afterRender(b);
  }
  const c = document.getElementById('messagesContainer');
  if (c) {
    const isScrolledUp = c.scrollHeight - c.scrollTop - c.clientHeight > 150;
    if (!isScrolledUp) {
      c.scrollTop = c.scrollHeight;
    } else {
      unreadWhileScrolled++;
      updateScrollBadge();
    }
  }
}

// ---- APPLICATION INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
  if (window.marked) marked.setOptions({ breaks: true, gfm: true });
  initTheme();
  initLanguage();
  initStyle();
  initParams();
  initModelSelect();
  loadCustomPersonas();
  initWebSearchUI();
  setupKeyboardShortcuts();
  loadChats();
  setupInput();
  renderAttachBar();
  setupDrop();
  setupPaste();
  setupSTT();
  setupScrollDetection();
  initMotivationBanner();
  if (!chats.length) newChat(); else switchChat(chats[0].id);
});
