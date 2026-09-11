// ================================================================
// admin/tester.js - Live Model Tester, Benchmark, AI Tools Studio
// ================================================================

const STUDIO_TOOLS = {
  search: { title: '🔍 Web Search & Riset Internet Live', cmd: '/search [kueri]', desc: 'Mencari informasi terkini dari internet.', label: 'Topik / Kueri Pencarian Web', placeholder: 'Masukkan kueri pencarian (contoh: perkembangan AI terkini 2026)...', buildPrompt: (input) => `[PENCARIAN WEB LIVE: "${input}"]\n\nSebagai Bre AI, carilah informasi akurat dan rangkum topik "${input}" secara komprehensif.` },
  code: { title: '💻 Code Assistant & Bug Fixer', cmd: '/code [deskripsi]', desc: 'Menghasilkan kode pemrograman berkualitas tinggi.', label: 'Deskripsi Program / Bug yang Ingin Diperbaiki', placeholder: 'Contoh: Buatkan script scraper website dengan Python BeautifulSoup...', buildPrompt: (input) => `Bertindaklah sebagai Principal Software Engineer. Buatkan kode berkualitas tinggi untuk: "${input}". Berikan kode lengkap dalam blok kode dengan nama file di baris pertama.` },
  summary: { title: '📝 Smart Document Summarizer', cmd: '/summary [teks]', desc: 'Merangkum teks panjang menjadi ringkasan eksekutif.', label: 'Teks / Dokumen yang Ingin Dirangkum', placeholder: 'Tempelkan artikel atau teks panjang di sini...', buildPrompt: (input) => `Buatkan ringkasan eksekutif, poin-poin penting (Key Takeaways), dan Action Items dari teks berikut:\n\n${input}` },
  prd: { title: '📋 Product Requirement Document (PRD) Builder', cmd: '/prd [nama fitur]', desc: 'Menyusun dokumen PRD lengkap standar industri.', label: 'Nama Fitur / Konsep Produk', placeholder: 'Contoh: Fitur Multi-Tenant Booking & Pembayaran Otomatis QRIS...', buildPrompt: (input) => `Bertindaklah sebagai Senior Product Manager. Susun PRD lengkap untuk: "${input}". Format: Overview, Problem Statement, User Stories, Functional Specs, Acceptance Criteria, Edge Cases, Success Metrics.` },
  copy: { title: '✍️ Viral Copywriting & Marketing Content', cmd: '/copy [topik]', desc: 'Meracik copywriting persuasif berkonversi tinggi.', label: 'Produk / Topik Promosi Iklan', placeholder: 'Contoh: Layanan Konsultasi Bisnis Digital Marketing UMKM...', buildPrompt: (input) => `Bertindaklah sebagai Master Copywriter (AIDA & PAS framework). Buatkan copywriting persuasif untuk: "${input}". Berikan: 3 Hook/Headline, Benefits, Value Proposition, CTA persuasif.` },
  think: { title: '🧠 Deep Analytical Reasoning (Chain of Thought)', cmd: '/think [masalah]', desc: 'Memecahkan masalah analitis kompleks secara sistematis.', label: 'Pertanyaan / Masalah Analitis', placeholder: 'Contoh: Analisis perbandingan arsitektur Monolith vs Microservices...', buildPrompt: (input) => `Analisis dan pecahkan pertanyaan berikut dengan penalaran sistematis langkah demi langkah:\n\n"${input}"\n\nSajikan analisis komparatif, trade-offs, mitigasi risiko, dan rekomendasi konkrit.` },
  translate: { title: '🌐 Smart Polyglot Translator', cmd: '/translate [bahasa] [teks]', desc: 'Menerjemahkan teks secara natural dan profesional.', label: 'Bahasa Target & Teks Sumber', placeholder: 'english Selamat pagi rekan-rekan, mari kita review progress sprint minggu ini.', buildPrompt: (input) => { const parts = input.trim().split(/\s+/); const target = parts[0]||'English'; const text = parts.slice(1).join(' ')||input; return `Terjemahkan teks berikut ke dalam bahasa ${target} dengan nada profesional:\n\n"${text}"\n\nSertakan opsi alternatif santai jika ada.`; } }
};
let currentStudioToolKey = 'search';

function selectStudioTool(toolKey, btn) {
  currentStudioToolKey = toolKey;
  const tool = STUDIO_TOOLS[toolKey];
  if (!tool) return;
  document.querySelectorAll('#tabTools .guide-app-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const setTxt = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setTxt('studioToolTitle', tool.title);
  setTxt('studioTelegramCommandBadge', `Perintah Bot: ${tool.cmd}`);
  setTxt('studioToolDesc', tool.desc);
  setTxt('studioInputLabel', tool.label);
  const inputEl = document.getElementById('studioInputText');
  if (inputEl) { inputEl.placeholder = tool.placeholder; inputEl.value = ''; }
  const resContainer = document.getElementById('studioResultContainer');
  if (resContainer) resContainer.style.display = 'none';
}

async function executeStudioTool() {
  const tool = STUDIO_TOOLS[currentStudioToolKey];
  const inputEl = document.getElementById('studioInputText');
  const input = (inputEl?.value || '').trim();
  const resContainer = document.getElementById('studioResultContainer');
  const resContent = document.getElementById('studioResultContent');
  const latencyEl = document.getElementById('studioExecutionLatency');
  const btn = document.getElementById('btnExecuteStudioTool');
  if (!input) return toast('Silakan masukkan input teks untuk menjalankan alat ini.', 'err');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Menjalankan...'; }
  if (resContainer) { resContainer.style.display = 'block'; if(resContent) resContent.innerHTML = '<span style="color:#94a3b8;">Sedang menghubungi engine AI Bre AI...</span>'; }
  const startTime = Date.now();
  try {
    const promptToSend = tool.buildPrompt(input);
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: promptToSend }], stream: false }) });
    const elapsed = Date.now() - startTime;
    const data = await res.json();
    if (res.ok) {
      if(latencyEl) latencyEl.textContent = `Latensi: ${elapsed} ms`;
      const reply = data.choices?.[0]?.message?.content || JSON.stringify(data);
      if(resContent) resContent.textContent = reply;
      toast('Alat AI berhasil dieksekusi!', 'ok');
    } else {
      if(latencyEl) latencyEl.textContent = `Error (${elapsed} ms)`;
      if(resContent) resContent.innerHTML = `<span style="color:#ef4444;">${data.error || 'Gagal mengeksekusi alat'}</span>`;
      toast(data.error || 'Eksekusi gagal', 'err');
    }
  } catch(err) {
    const elapsed = Date.now() - startTime;
    if(latencyEl) latencyEl.textContent = `Error (${elapsed} ms)`;
    if(resContent) resContent.innerHTML = `<span style="color:#ef4444;">${err.message}</span>`;
    toast('Error: ' + err.message, 'err');
  } finally { if(btn) { btn.disabled = false; btn.innerHTML = '🚀 Jalankan Alat AI Ini'; } }
}

async function runMultiProviderBenchmark() {
  syncProvidersFromUI();
  const tbody = document.getElementById('healthBenchmarkTableBody');
  const btn = document.getElementById('btnBenchmarkAll');
  if (!endpoints.length) return toast('Belum ada provider yang terdaftar.', 'err');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Menguji Semua Provider...'; }
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#38bdf8;padding:25px;">⏳ Sedang menguji ${endpoints.length} provider...</td></tr>`;
  try {
    const results = await Promise.all(endpoints.map(async (ep, idx) => {
      const primaryModel = ep.models?.[0] || 'default';
      const start = Date.now();
      try {
        const r = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customEndpoint: ep.url, customKeys: (ep.keys||[]).join('\n'), customModel: primaryModel, prompt: 'Ping' }) });
        const elapsed = Date.now() - start;
        const data = await r.json();
        return { idx: idx+1, name: ep.name||`Provider #${idx+1}`, url: ep.url||'-', model: primaryModel, ok: r.ok && !data.error, status: r.status, latency: data.latencyMs||elapsed, error: data.error||(r.ok?null:'HTTP '+r.status), active: ep.status !== false };
      } catch(e) { return { idx:idx+1, name:ep.name||`Provider #${idx+1}`, url:ep.url||'-', model:primaryModel, ok:false, status:0, latency:Date.now()-start, error:e.message, active:ep.status!==false }; }
    }));
    if (tbody) tbody.innerHTML = results.map(r => {
      const badge = r.active ? (r.ok ? `<span class="ping-badge ok">🟢 200 OK</span>` : `<span class="ping-badge fail">🔴 ${(r.error||'Error').slice(0,30)}</span>`) : `<span class="ping-badge" style="background:#1e293b;color:#94a3b8;">⚪ Nonaktif</span>`;
      const failover = r.ok ? `<span style="color:#10b981;font-size:12px;">✅ Siap Melayani</span>` : `<span style="color:#ef4444;font-size:12px;">⚠️ Auto-Skipped</span>`;
      return `<tr><td>${r.idx}</td><td style="font-weight:600;color:#f1f5f9;">${r.name}</td><td style="font-family:monospace;font-size:11.5px;color:#94a3b8;">${r.url}</td><td><code style="background:#060911;padding:2px 6px;border-radius:4px;font-size:11.5px;color:#38bdf8;">${r.model}</code></td><td>${badge}</td><td style="font-weight:600;color:${r.ok?'#38bdf8':'#ef4444'};">${r.latency} ms</td><td>${failover}</td></tr>`;
    }).join('');
    toast(`Benchmark selesai! ${results.filter(r=>r.ok).length}/${results.length} provider sehat.`, 'ok');
  } catch(err) { toast('Gagal menjalankan benchmark: ' + err.message, 'err'); }
  finally { if(btn) { btn.disabled=false; btn.innerHTML='⚡ Uji Semua Provider Bersamaan'; } }
}

function updateTestModelDropdown() {
  syncProvidersFromUI();
  const sel = document.getElementById('testModelSelect');
  if (!sel) return;
  const allModels = new Set();
  endpoints.forEach(ep => { (ep.models||[]).forEach(m => allModels.add(m)); (ep.mapping||[]).forEach(map => { const alias=map.split(':')[0]?.trim(); if(alias) allModels.add(alias); }); });
  if (!allModels.size) allModels.add('mercury-2');
  sel.innerHTML = Array.from(allModels).map(m => `<option value="${m}">${m}</option>`).join('');
}

async function runLiveTest() {
  const sel = document.getElementById('testModelSelect');
  const model = sel ? sel.value : 'mercury-2';
  const prompt = document.getElementById('testPromptInput')?.value.trim() || 'Hi';
  const out = document.getElementById('testOutputArea');
  const btn = document.getElementById('btnRunTest');
  if (btn) { btn.disabled = true; }
  if (out) out.textContent = '⏳ Mengirim permintaan ke endpoint upstream...';
  const start = Date.now();
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }) });
    const elapsed = Date.now() - start;
    if (r.ok) {
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
      if(out) out.textContent = `[HTTP 200 OK | Latency: ${elapsed}ms | Model: ${model}]\n\n${content}`;
      toast(`Query sukses (${elapsed}ms)`, 'ok');
    } else {
      const err = await r.text();
      if(out) out.textContent = `[HTTP ${r.status} Error | ${elapsed}ms]\n\n${err}`;
      toast(`Gagal (HTTP ${r.status})`, 'err');
    }
  } catch(e) {
    if(out) out.textContent = `[Network Error]\n\n${e.message}`;
    toast('Network Error: ' + e.message, 'err');
  } finally { if(btn) btn.disabled = false; }
}

function clearLiveOutput() {
  const out = document.getElementById('testOutputArea');
  if (out) out.textContent = 'Output dibersihkan.';
}
