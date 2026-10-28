(() => {
  if (document.getElementById('ciem-chat')) return;
  const root = document.createElement('div');
  root.id = 'ciem-chat';
  root.innerHTML = `<button class="cc-toggle" aria-label="Abrir chat de CIEM" aria-expanded="false" aria-controls="cc-panel"> <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg> <span>Conversemos</span></button>
  <section id="cc-panel" hidden aria-label="Asistente de CIEM"><header><div><strong>Asistente CIEM</strong><small>Arquitectura digital & contenido</small></div><button class="cc-close" aria-label="Cerrar chat">×</button></header><div class="cc-messages" role="log" aria-live="polite"></div><form><label for="cc-input">Tu mensaje</label><div class="cc-compose"><textarea id="cc-input" rows="2" maxlength="2000" placeholder="¿Cómo podemos ayudarte?" required></textarea><button type="submit" aria-label="Enviar mensaje">➤</button></div><small>Asistente con IA. Puede cometer errores. No compartas datos sensibles.</small></form></section>`;
  document.body.append(root);
  const panel = root.querySelector('section'), toggle = root.querySelector('.cc-toggle');
  const log = root.querySelector('.cc-messages'), form = root.querySelector('form');
  const input = root.querySelector('textarea'), send = form.querySelector('button');
  const history = [];
  function renderMessage(element, text) {
    element.replaceChildren();
    const pattern = /https?:\/\/[^\s<>"']+/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const url = match[0].replace(/[.,;:!?)}\]]+$/, '');
      element.append(document.createTextNode(text.slice(cursor, match.index)));
      const link = document.createElement('a');
      link.href = url;
      if (new URL(url).hostname === 'wa.me') {
        link.className = 'cc-whatsapp';
        const icon = document.createElement('i');
        icon.className = 'fa fa-whatsapp';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = 'Contactar asesor por WhatsApp';
        link.append(icon, label);
        link.setAttribute('aria-label', 'Contactar asesor por WhatsApp (abre en otra pestaña)');
      } else {
        link.textContent = url;
      }
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      element.append(link);
      cursor = match.index + url.length;
    }
    element.append(document.createTextNode(text.slice(cursor)));
  }
  function append(text, role) {
    const bubble = document.createElement('div'); bubble.className = 'cc-message cc-' + role;
    renderMessage(bubble, text); log.append(bubble); log.scrollTop = log.scrollHeight; return bubble;
  }
  function open(value) { panel.hidden = !value; toggle.setAttribute('aria-expanded', String(value)); if (value) input.focus(); else toggle.focus(); }
  toggle.onclick = () => open(panel.hidden);
  root.querySelector('.cc-close').onclick = () => open(false);
  root.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
  append('¡Hola! ¿Buscas crear una web o mejorar la que ya tienes? Te ayudo con desarrollo web, hosting, mantenimiento, soporte y Marketplace CIEM. Conversa con el equipo por WhatsApp para evaluar tu proyecto: https://wa.me/51999989709', 'assistant');
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const content = input.value.trim(); if (!content || send.disabled) return;
    append(content, 'user'); input.value = ''; send.disabled = true; input.disabled = true;
    const pending = append('Consultando…', 'assistant');
    const messages = [...history.slice(-10), {role: 'user', content}];
    try {
      const response = await fetch('/api/ciem-chat', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({messages}), signal: AbortSignal.timeout(100000)});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo completar la consulta.');
      if (typeof data.message !== 'string' || !data.message.trim()) throw new Error('El asistente no devolvió una respuesta.');
      renderMessage(pending, data.message);
      history.push({role:'user', content}, {role:'assistant', content:data.message.slice(0,2000)});
    } catch (error) { pending.textContent = error.name === 'TimeoutError' ? 'La consulta tardó demasiado. Intenta nuevamente.' : (error instanceof SyntaxError ? 'El asistente aún no está disponible.' : error.message); }
    finally { send.disabled = false; input.disabled = false; if (!panel.hidden) input.focus(); log.scrollTop = log.scrollHeight; }
  });
  document.querySelectorAll('[data-ciem-quote]').forEach(button => {
    button.addEventListener('click', () => {
      open(true);
      if (send.disabled) return;
      input.value = 'Me gustaría solicitar una cotización';
      form.requestSubmit();
    });
  });
})();
