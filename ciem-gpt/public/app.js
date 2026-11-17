/* CIEM GPT — el proveedor lo decide el servidor (DeepSeek → Ollama). */
(() => {
  'use strict';

  const CFG = window.CIEM_CONFIG;
  const LS_CHATS = 'ciem-gpt.chats.v3';
  const LS_CHATS_V2 = 'ciem-gpt.chats.v2';
  const LS_SETTINGS = 'ciem-gpt.settings.v1';
  const MAX_TOKENS = Number((CFG.ui && CFG.ui.maxTokens) || 1024);

  const $ = (s, r = document) => r.querySelector(s);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

  /* ────────── Estado ────────── */
  let state = { chats: [], activeId: null };
  let settings = { temperature: 0.7, system: '' };
  const quota = { limit: CFG.quota.limit, remaining: null, reset: null, known: false };
  const runtime = {
    online: null,
    greeting: (CFG.ui && CFG.ui.greeting) || 'Habla causita!',
  };
  let abortCtrl = null;
  let busy = false;

  const els = {
    sidebar: $('#sidebar'),
    overlay: $('#overlay'),
    menuBtn: $('#menuBtn'),
    newChatBtn: $('#newChatBtn'),
    chatList: $('#chatList'),
    status: $('#status'),
    statusText: $('#statusText'),
    modelBadge: $('#modelBadge'),
    settingsBtn: $('#settingsBtn'),
    settingsPanel: $('#settingsPanel'),
    settingsInfo: $('#settingsInfo'),
    temp: $('#temp'),
    tempVal: $('#tempVal'),
    systemPrompt: $('#systemPrompt'),
    exportBtn: $('#exportBtn'),
    messages: $('#messages'),
    input: $('#input'),
    sendBtn: $('#sendBtn'),
    stopBtn: $('#stopBtn'),
    ctxInfo: $('#quotaInfo'),
    quotaBanner: $('#quotaBanner'),
    quotaBannerText: $('#quotaBannerText'),
    quotaBannerLink: $('#quotaBannerLink'),
    quotaClose: $('#quotaClose'),
  };

  /* ────────── Persistencia ────────── */
  function normalizeChat(c) {
    if (!c || typeof c !== 'object' || !c.id) return null;
    return {
      id: String(c.id),
      title: typeof c.title === 'string' && c.title ? c.title : 'Nuevo chat',
      messages: Array.isArray(c.messages) ? c.messages.filter(m => m && m.role) : [],
      createdAt: Number(c.createdAt) || Date.now(),
    };
  }

  function loadState() {
    try {
      let raw = JSON.parse(localStorage.getItem(LS_CHATS) || 'null');
      if (!raw || !Array.isArray(raw.chats)) {
        raw = JSON.parse(localStorage.getItem(LS_CHATS_V2) || 'null');
      }
      if (raw && Array.isArray(raw.chats)) {
        state.chats = raw.chats.map(normalizeChat).filter(Boolean);
        state.activeId = raw.activeId || null;
        if (state.chats.length) saveChats();
      }
    } catch { /* datos corruptos → empezar limpio */ }
    if (state.activeId && !state.chats.some(c => c.id === state.activeId)) state.activeId = null;

    try {
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || 'null');
      if (s && typeof s === 'object') settings = { ...settings, ...s };
    } catch { /* ignore */ }
  }

  const saveChats = () => {
    try { localStorage.setItem(LS_CHATS, JSON.stringify(state)); } catch { /* quota */ }
  };
  const saveSettings = () => {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch { /* quota */ }
  };

  const activeChat = () => state.chats.find(c => c.id === state.activeId) || null;

  /* ────────── Cuota y estado ────────── */
  function readQuotaHeaders(res) {
    const rem = res.headers.get('X-Quota-Remaining');
    const lim = res.headers.get('X-Quota-Limit');
    const rst = res.headers.get('X-Quota-Reset');
    if (rem !== null && Number.isFinite(Number(rem))) {
      quota.remaining = Number(rem);
      quota.known = true;
    }
    if (lim !== null && Number.isFinite(Number(lim))) quota.limit = Number(lim);
    if (rst !== null) quota.reset = Number(rst) * 1000;
  }

  async function refreshQuota() {
    try {
      const res = await fetch(CFG.chat.quota, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      quota.limit = Number(d.limit) || quota.limit;
      quota.remaining = Number(d.remaining);
      quota.reset = d.reset_at ? Number(d.reset_at) * 1000 : null;
      if (typeof d.greeting === 'string' && d.greeting.trim()) {
        runtime.greeting = d.greeting.trim();
      }
      quota.known = true;
      runtime.online = true;
    } catch {
      runtime.online = false;
    }
    renderStatus();
    renderQuota();
    syncComposer();
  }

  function deepseekUsable() {
    return !(quota.known && Number.isFinite(quota.remaining) && quota.remaining <= 0);
  }

  function renderStatus() {
    if (runtime.online === null) { setStatus(false, 'Conectando…'); return; }
    if (runtime.online) {
      const q = quota.known ? ` · ${quota.remaining ?? '?'}/${quota.limit}` : '';
      setStatus(true, 'Asistente ✓' + q);
    } else {
      setStatus(false, 'Servicio no disponible');
    }
  }

  function setStatus(online, text) {
    els.status.classList.toggle('online', online);
    els.status.classList.toggle('offline', !online);
    els.statusText.textContent = text;
  }

  function renderQuota() {
    const left = quota.remaining;
    const known = Number.isFinite(left);
    els.ctxInfo.textContent = !known ? ''
      : (left > 0 ? `${left} de ${quota.limit} consultas gratis hoy` : 'sin consultas gratis hoy');
    const exhausted = known && left <= 0;
    els.quotaBanner.hidden = !exhausted;
    if (exhausted) {
      els.quotaBannerText.textContent = CFG.quota.message;
      els.quotaBannerLink.href = CFG.quota.contactUrl;
    }
  }

  function syncComposer() {
    const blocked = quota.known && Number.isFinite(quota.remaining) && quota.remaining <= 0;
    els.sendBtn.disabled = busy || blocked;
    els.sendBtn.title = blocked ? 'Sin consultas gratis: consulte a CIEM' : 'Enviar (Enter)';
    els.input.placeholder = blocked
      ? 'Sin consultas gratis. Consulte a CIEM para comprar más.'
      : 'Escribe un mensaje…';
  }

  /* ────────── Conversaciones ────────── */
  function createChat() {
    const chat = {
      id: uid(),
      title: 'Nuevo chat',
      messages: [],
      createdAt: Date.now(),
    };
    state.chats.unshift(chat);
    state.activeId = chat.id;
    saveChats();
    return chat;
  }

  function newChat() {
    if (busy) stopGeneration();
    createChat();
    renderChatList();
    renderMessages();
    els.input.focus();
  }

  function selectChat(id) {
    if (busy) stopGeneration();
    state.activeId = id;
    saveChats();
    renderChatList();
    renderMessages();
    closeSidebar();
  }

  function deleteChat(id) {
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;
    if (chat.messages.length && !confirm('¿Eliminar esta conversación?')) return;
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.activeId === id) {
      state.activeId = state.chats.length ? state.chats[0].id : null;
      if (!state.activeId) createChat();
    }
    saveChats();
    renderChatList();
    renderMessages();
  }

  function renderChatList() {
    els.chatList.innerHTML = '';
    for (const c of state.chats) {
      const item = document.createElement('div');
      item.className = 'chat-item' + (c.id === state.activeId ? ' active' : '');
      item.dataset.id = c.id;
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.setAttribute('aria-current', c.id === state.activeId ? 'true' : 'false');

      const dot = document.createElement('span');
      dot.className = 'dot';

      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = c.title || 'Nuevo chat';

      const del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.textContent = '×';
      del.title = 'Eliminar';
      del.setAttribute('aria-label', 'Eliminar ' + (c.title || 'conversación'));
      del.addEventListener('click', e => { e.stopPropagation(); deleteChat(c.id); });

      item.append(dot, title, del);
      item.addEventListener('click', () => selectChat(c.id));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectChat(c.id); }
      });
      els.chatList.appendChild(item);
    }
  }

  /* ────────── Render de mensajes ────────── */
  function inner() {
    let el = els.messages.querySelector('.messages-inner');
    if (!el) {
      els.messages.innerHTML = '';
      el = document.createElement('div');
      el.className = 'messages-inner';
      els.messages.appendChild(el);
    }
    return el;
  }

  function renderMessages() {
    const chat = activeChat();
    els.messages.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'messages-inner';
    els.messages.appendChild(box);

    if (!chat || chat.messages.length === 0) {
      box.appendChild(welcomeEl());
      return;
    }
    for (const m of chat.messages) box.appendChild(buildMessage(m));
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
  }

  function providerLabel(p) {
    if (p === 'deepseek') return 'CIEM';
    if (p === 'ollama') return 'Ollama · 192.168.1.39';
    if (p === 'ollama-local') return 'Ollama local';
    return 'Asistente';
  }

  function buildMessage(msg) {
    const row = document.createElement('div');
    row.className = 'msg ' + msg.role;
    row.dataset.id = msg.id;
    if (msg.error) row.classList.add('error');

    if (msg.role === 'assistant') {
      const head = document.createElement('div');
      head.className = 'msg-head';
      head.textContent = providerLabel(msg.provider);
      row.appendChild(head);
    }

    if (msg.role === 'assistant' && msg.reasoning) {
      row.appendChild(reasoningEl(msg.reasoning, false));
    }

    const content = document.createElement('div');
    content.className = 'content';
    if (msg.role === 'user') content.textContent = msg.content;
    else content.innerHTML = renderMarkdown(msg.content || '');
    row.appendChild(content);

    if (msg.role === 'assistant') {
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      renderMeta(meta, msg);
      row.appendChild(meta);
    }
    return row;
  }

  function reasoningEl(text, open) {
    const d = document.createElement('details');
    d.className = 'reasoning';
    d.open = !!open;
    const s = document.createElement('summary');
    s.textContent = 'Razonamiento';
    const b = document.createElement('div');
    b.className = 'reasoning-body';
    b.innerHTML = renderMarkdown(text || '');
    d.append(s, b);
    return d;
  }

  function ensureReasoning(node) {
    let d = node.querySelector('.reasoning');
    if (!d) {
      d = reasoningEl('', true);
      node.insertBefore(d, node.querySelector('.content'));
    }
    return d.querySelector('.reasoning-body');
  }

  function renderMeta(metaEl, msg) {
    metaEl.innerHTML = '';
    if (msg.note) {
      const note = document.createElement('span');
      note.className = 'msg-note';
      note.textContent = msg.note;
      metaEl.appendChild(note);
    }
    const s = msg.stats;
    if (s) {
      const parts = [];
      if (s.model) parts.push(s.model);
      if (s.tok_s) parts.push(s.tok_s.toFixed(1) + ' tok/s');
      if (s.tokens) parts.push(s.tokens + ' tokens');
      if (s.prompt) parts.push(s.prompt + ' ctx');
      if (s.total_s) parts.push(s.total_s.toFixed(1) + ' s');
      for (const p of parts) {
        const span = document.createElement('span');
        span.textContent = p;
        metaEl.appendChild(span);
      }
    }
    if (!msg.error && msg.role === 'assistant') {
      const actions = document.createElement('span');
      actions.className = 'msg-actions';

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.dataset.act = 'copy';
      copy.textContent = 'Copiar';
      copy.addEventListener('click', () => copyMessage(msg, copy));

      const regen = document.createElement('button');
      regen.type = 'button';
      regen.dataset.act = 'regen';
      regen.textContent = '↻ Regenerar';
      regen.addEventListener('click', () => regenerate(msg.id));

      actions.append(copy, regen);
      metaEl.appendChild(actions);
    }
  }

  function welcomeEl() {
    const d = document.createElement('div');
    d.className = 'welcome';

    const h = document.createElement('h1');
    h.textContent = runtime.greeting;

    const p = document.createElement('p');
    p.textContent = '¿En qué te ayudo?';

    const box = document.createElement('div');
    box.className = 'suggestions';

    const ideas = [
      'Explícame qué hace este código y cómo mejorarlo',
      'Escribe un test unitario en Python para una función de login',
      '¿Cómo funciona async/await en JavaScript?',
      'Diseña el esquema SQL de una tienda online',
    ];
    for (const idea of ideas) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = idea;
      b.addEventListener('click', () => {
        els.input.value = idea;
        autosize();
        els.input.focus();
      });
      box.appendChild(b);
    }
    d.append(h, p, box);
    return d;
  }

  /* ────────── Envío y streaming ────────── */
  function buildHistory(chat, excludeId) {
    const out = [];
    for (const m of chat.messages) {
      if (m.id === excludeId) continue;
      if (m.role === 'assistant' && !m.content) continue;
      if (m.error) continue;
      out.push({ role: m.role, content: m.content });
    }
    return out;
  }

  async function send() {
    if (busy) return;
    const text = els.input.value.trim();
    if (!text) return;
    if (!deepseekUsable()) {
      els.quotaBanner.hidden = false;
      els.input.focus();
      return;
    }

    let chat = activeChat();
    if (!chat) chat = createChat();

    els.input.value = '';
    autosize();

    const userMsg = { id: uid(), role: 'user', content: text };
    chat.messages.push(userMsg);
    if (chat.title === 'Nuevo chat') chat.title = text.replace(/\s+/g, ' ').slice(0, 44);
    saveChats();
    renderChatList();

    const box = inner();
    const wel = box.querySelector('.welcome');
    if (wel) wel.remove();
    box.appendChild(buildMessage(userMsg));
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });

    await runAssistant(chat);
  }

  async function runAssistant(chat) {
    const assistant = {
      id: uid(), role: 'assistant', content: '', reasoning: '',
      stats: null, provider: null, note: null,
    };
    chat.messages.push(assistant);

    const node = buildMessage(assistant);
    inner().appendChild(node);
    const contentEl = node.querySelector('.content');
    const metaEl = node.querySelector('.msg-meta');
    contentEl.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';

    setBusy(true);
    scrollToBottom(true);

    const started = performance.now();
    let raf = null;
    let reasonBody = null;

    const renderNow = () => {
      if (assistant.reasoning) {
        reasonBody = reasonBody || ensureReasoning(node);
        reasonBody.innerHTML = renderMarkdown(assistant.reasoning);
      }
      contentEl.innerHTML = assistant.content
        ? renderMarkdown(assistant.content)
        : '<div class="typing"><i></i><i></i><i></i></div>';
      if (nearBottom()) els.messages.scrollTop = els.messages.scrollHeight;
    };
    const scheduleRender = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; renderNow(); });
    };
    const onDelta = t => { assistant.content += t; scheduleRender(); };
    const onReason = t => { assistant.reasoning += t; scheduleRender(); };
    const onMeta = info => {
      assistant.provider = info.provider;
      const head = node.querySelector('.msg-head');
      if (head) head.textContent = providerLabel(info.provider);
    };

    abortCtrl = new AbortController();

    try {
      await streamChat({
        chat, assistant, signal: abortCtrl.signal, started,
        onDelta, onReason, onMeta,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (!assistant.content && !assistant.reasoning) assistant.content = '*(detenido)*';
      } else if (err.name === 'QuotaError') {
        quota.remaining = 0;
        quota.known = true;
        assistant.error = true;
        node.classList.add('error');
        assistant.content = '**' + CFG.quota.message + '**\n\n'
          + '[Consulte a CIEM para comprar más](' + CFG.quota.contactUrl + ')';
        renderQuota();
        syncComposer();
      } else {
        assistant.error = true;
        node.classList.add('error');
        assistant.content = '**No se pudo completar la consulta**\n\n```\n'
          + String(err.message || err) + '\n```\n\n'
          + 'Si el problema continúa, avise a CIEM.';
      }
    } finally {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      // Respuestas instantáneas: el rAF puede no haber llegado a pintar el razonamiento.
      if (assistant.reasoning) {
        reasonBody = reasonBody || ensureReasoning(node);
        reasonBody.innerHTML = renderMarkdown(assistant.reasoning);
      }
      contentEl.innerHTML = renderMarkdown(assistant.content
        || (assistant.reasoning
          ? '_(sin respuesta final: el modelo agotó los tokens razonando)_'
          : '_(respuesta vacía)_'));
      abortCtrl = null;
      setBusy(false);
      if (metaEl && !assistant.error) renderMeta(metaEl, assistant);
      saveChats();
      scrollToBottom();
      refreshQuota();
    }
  }

  async function streamChat({ chat, assistant, signal, started, onDelta, onReason, onMeta }) {
    const res = await fetch(CFG.chat.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({
        messages: buildHistory(chat, assistant.id),
        system: settings.system || '',
        temperature: Number(settings.temperature),
        max_tokens: MAX_TOKENS,
      }),
      signal,
    });
    readQuotaHeaders(res);

    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      if (res.status === 429) {
        if (info.error === 'busy') {
          throw new Error(info.message || 'El asistente está ocupado. Intenta en un momento.');
        }
        const e = new Error(info.message || CFG.quota.message);
        e.name = 'QuotaError';
        e.info = info;
        throw e;
      }
      throw new Error(info.message || info.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;

        let evt;
        try { evt = JSON.parse(data); } catch { continue; }
        if (evt.type === 'meta') onMeta(evt);
        else if (evt.type === 'delta' && evt.text) onDelta(evt.text);
        else if (evt.type === 'reasoning' && evt.text) onReason(evt.text);
        else if (evt.type === 'done') {
          assistant.stats = {
            model: evt.model,
            tokens: evt.tokens || 0,
            prompt: evt.prompt || 0,
            tok_s: evt.tokens && evt.elapsed ? evt.tokens / evt.elapsed : null,
            total_s: evt.elapsed || (performance.now() - started) / 1000,
          };
        } else if (evt.type === 'error') {
          throw new Error(evt.message || 'Error del asistente.');
        }
      }
    }
  }

  async function regenerate(id) {
    if (busy) return;
    const chat = activeChat();
    if (!chat) return;
    if (!deepseekUsable()) {
      els.quotaBanner.hidden = false;
      return;
    }
    const idx = chat.messages.findIndex(m => m.id === id);
    if (idx < 0) return;
    chat.messages = chat.messages.slice(0, idx);
    saveChats();
    renderMessages();
    await runAssistant(chat);
  }

  function stopGeneration() {
    if (abortCtrl) abortCtrl.abort();
  }

  function setBusy(on) {
    busy = on;
    els.stopBtn.hidden = !on;
    if (on) {
      els.sendBtn.disabled = true;
      els.ctxInfo.textContent = 'generando…';
    } else {
      renderQuota();
      syncComposer();
    }
  }

  function scrollToBottom(force) {
    if (force) {
      requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
      return;
    }
    if (nearBottom()) els.messages.scrollTop = els.messages.scrollHeight;
  }

  function nearBottom() {
    const el = els.messages;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }

  /* ────────── Utilidades ────────── */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
  }

  async function copyMessage(msg, btn) {
    await copyText(msg.content);
    const old = btn.textContent;
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.textContent = old; }, 1300);
  }

  function autosize() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px';
  }

  function exportChat() {
    const chat = activeChat();
    if (!chat || !chat.messages.length) return;
    let md = `# ${chat.title}\n\n_${new Date().toLocaleString()}_\n\n---\n\n`;
    for (const m of chat.messages) {
      md += `## ${m.role === 'user' ? 'Tú' : 'Asistente'}\n\n`;
      if (m.note) md += `_${m.note}_\n\n`;
      if (m.reasoning) {
        md += m.reasoning.split('\n').map(l => '> ' + l).join('\n') + '\n\n';
      }
      md += `${m.content}\n\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (chat.title || 'conversacion').replace(/[^\w\-. ]+/g, '').slice(0, 60) + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ────────── Markdown (propio, sin dependencias) ────────── */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(s) {
    let t = escapeHtml(s);

    const codes = [];
    t = t.replace(/`([^`\n]+)`/g, (_, c) => {
      codes.push(c);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });

    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[Number(i)] + '</code>');
    return t;
  }

  function renderCodeBlock(lang, code) {
    const clean = code.replace(/\n$/, '');
    return '<div class="code-block">'
      + '<div class="code-head"><span>' + escapeHtml(lang || 'texto') + '</span>'
      + '<button class="copy-code" type="button">Copiar</button></div>'
      + '<pre><code>' + escapeHtml(clean) + '</code></pre></div>';
  }

  function renderBlocks(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    const para = [];
    const flush = () => {
      if (para.length) {
        html += '<p>' + inline(para.join(' ')) + '</p>';
        para.length = 0;
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      if (/^\s*$/.test(line)) { flush(); i++; continue; }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        const lvl = Math.min(h[1].length + 1, 6);
        html += `<h${lvl}>${inline(h[2])}</h${lvl}>`;
        i++; continue;
      }

      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
        flush(); html += '<hr>'; i++; continue;
      }

      if (/^\s*>/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + renderBlocks(buf.join('\n')) + '</blockquote>';
        continue;
      }

      const li = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (li) {
        flush();
        const ordered = /^\d+\./.test(li[2]);
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
          if (!m) {
            if (items.length && lines[i].trim() && /^\s{2,}/.test(lines[i])) {
              items[items.length - 1] += ' ' + lines[i].trim();
              i++; continue;
            }
            break;
          }
          items.push(m[3]);
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        html += `<${tag}>` + items.map(x => `<li>${inline(x)}</li>`).join('') + `</${tag}>`;
        continue;
      }

      para.push(line);
      i++;
    }
    flush();
    return html;
  }

  function renderMarkdown(src) {
    if (!src) return '';
    const parts = String(src).replace(/\r\n/g, '\n').split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g);
    let html = '';
    for (const part of parts) {
      if (part.startsWith('```')) {
        const m = part.match(/^```([^\n]*)\n?([\s\S]*?)(?:```)?$/);
        const lang = (m ? m[1] : '').trim();
        const code = m ? m[2] : part.slice(3);
        html += renderCodeBlock(lang, code);
      } else {
        html += renderBlocks(part);
      }
    }
    return html;
  }

  /* ────────── Sidebar móvil ────────── */
  function openSidebar() {
    els.sidebar.classList.add('open');
    els.overlay.hidden = false;
    els.overlay.classList.add('show');
  }
  function closeSidebar() {
    els.sidebar.classList.remove('open');
    els.overlay.classList.remove('show');
    els.overlay.hidden = true;
  }

  /* ────────── Eventos ────────── */
  function bindUI() {
    els.newChatBtn.addEventListener('click', newChat);
    els.sendBtn.addEventListener('click', send);
    els.stopBtn.addEventListener('click', stopGeneration);
    els.menuBtn.addEventListener('click', openSidebar);
    els.overlay.addEventListener('click', closeSidebar);
    els.exportBtn.addEventListener('click', exportChat);

    els.input.addEventListener('input', autosize);
    els.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });

    els.settingsBtn.addEventListener('click', e => {
      e.stopPropagation();
      els.settingsPanel.hidden = !els.settingsPanel.hidden;
      renderSettingsInfo();
    });
    document.addEventListener('click', e => {
      if (!els.settingsPanel.hidden && !els.settingsPanel.contains(e.target)) {
        els.settingsPanel.hidden = true;
      }
    });

    els.temp.addEventListener('input', () => {
      settings.temperature = Number(els.temp.value);
      els.tempVal.textContent = settings.temperature.toFixed(1);
      saveSettings();
    });
    els.systemPrompt.addEventListener('input', () => {
      settings.system = els.systemPrompt.value;
      saveSettings();
    });

    els.quotaClose.addEventListener('click', () => { els.quotaBanner.hidden = true; });

    els.messages.addEventListener('click', e => {
      const btn = e.target.closest('.copy-code');
      if (!btn) return;
      const code = btn.closest('.code-block')?.querySelector('code')?.textContent || '';
      copyText(code).then(() => {
        btn.textContent = '✓ Copiado';
        setTimeout(() => { btn.textContent = 'Copiar'; }, 1300);
      });
    });
  }

  function renderSettingsInfo() {
    if (!els.settingsInfo) return;
    els.settingsInfo.textContent = 'El proveedor lo decide el servidor: CIEM Flash primero '
      + 'y el respaldo local si no responde. La clave no sale del servidor.';
  }

  /* ────────── Init ────────── */
  async function init() {
    loadState();
    bindUI();

    els.temp.value = String(settings.temperature);
    els.tempVal.textContent = Number(settings.temperature).toFixed(1);
    els.systemPrompt.value = settings.system || '';
    els.quotaBannerLink.href = CFG.quota.contactUrl;
    els.quotaBannerText.textContent = CFG.quota.message;
    els.modelBadge.textContent = 'CIEM Flash - en proceso de entrenamiento';

    await refreshQuota();

    if (!state.chats.length) {
      createChat();
    } else if (!activeChat()) {
      state.activeId = state.chats[0].id;
    }

    renderChatList();
    renderMessages();
    renderQuota();
    syncComposer();
    autosize();
    els.input.focus();

    setInterval(() => {
      if (document.hidden) return;
      refreshQuota();
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
