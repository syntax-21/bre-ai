// ================================================================
// admin/tester.js - Live Model Tester, Benchmark
// ================================================================


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
