import {
  STORAGE_KEY,
  addComment,
  addTrack,
  addVersion,
  initialState,
  restoreState,
  setVersionStatus,
} from './model.js'

const $ = (selector, root = document) => root.querySelector(selector)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char])
const versionKinds = { idea: 'Idea', lyrics: 'Letra', arrangement: 'Arreglo', demo: 'Demo' }
const versionStatuses = { draft: 'Borrador', review: 'En revisión', approved: 'Aprobada por la banda' }
const statusClass = { draft: 'status-draft', review: 'status-review', approved: 'status-approved' }

let state
let activeTrackId
let activeVersionId
let uploadedFiles = []

const uploadFeedback = $('#upload-feedback')
const studioMessage = document.createElement('p')
studioMessage.id = 'studio-feedback'
studioMessage.className = 'feedback'
studioMessage.setAttribute('role', 'status')
studioMessage.setAttribute('aria-live', 'polite')
$('.studio-main').prepend(studioMessage)

function announce(message, { studio = false } = {}) {
  ;(studio ? studioMessage : uploadFeedback).textContent = message
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    announce('El navegador no pudo guardar los cambios. Puedes seguir explorando, pero no se conservarán al cerrar la página.', { studio: true })
    return false
  }
}

function changeState(next, message) {
  state = restoreState(next)
  const saved = persist()
  renderWorkspace()
  if (message && saved) announce(message, { studio: true })
}

function selectedTrack() {
  return state.tracks.find((track) => track.id === activeTrackId) ?? state.tracks[0]
}

function selectedVersion(track) {
  return track.versions.find((version) => version.id === activeVersionId) ?? track.versions.at(-1)
}

function renderWorkspace() {
  const track = selectedTrack()
  if (!track) {
    activeTrackId = undefined
    activeVersionId = undefined
  } else {
    activeTrackId = track.id
    if (!track.versions.some((version) => version.id === activeVersionId)) {
      activeVersionId = track.versions.at(-1).id
    }
  }
  $('#track-count').textContent = String(state.tracks.length)
  $('#track-list').innerHTML = state.tracks.map((item) => {
    const latest = item.versions.at(-1)
    return `<button type="button" class="track-item ${item.id === activeTrackId ? 'is-selected' : ''}" data-track-id="${escapeHtml(item.id)}">
      <span class="track-symbol">♫</span><span class="track-copy"><strong>${escapeHtml(item.title)}</strong><small>${item.versions.length} ${item.versions.length === 1 ? 'versión' : 'versiones'} · ${escapeHtml(versionKinds[latest.kind])}</small></span><span class="track-state ${statusClass[latest.status]}">${escapeHtml(versionStatuses[latest.status])}</span>
    </button>`
  }).join('')
  $('#track-detail').innerHTML = track ? renderTrack(track, selectedVersion(track)) : '<div class="empty-workspace"><span>♫</span><h2>Una página en blanco.</h2><p>Crea una idea para empezar a trabajar en una canción.</p></div>'
}

function renderTrack(track, selected) {
  const comments = track.comments.filter((comment) => comment.versionId === selected.id)
  const versions = track.versions
  const compare = versions.length > 1
    ? `<details class="compare-panel"><summary>Comparar versiones anteriores</summary><div class="compare-grid"><article><span>VERSIÓN ${versions.at(-2).number} · ${escapeHtml(versions.at(-2).message)}</span><pre>${escapeHtml(versions.at(-2).content)}</pre></article><article><span>VERSIÓN ${versions.at(-1).number} · ${escapeHtml(versions.at(-1).message)}</span><pre>${escapeHtml(versions.at(-1).content)}</pre></article></div></details>`
    : ''
  return `<div class="track-heading"><div><p class="eyebrow">CANCIÓN / ESPACIO DE TRABAJO</p><h2>${escapeHtml(track.title)}</h2><p>El historial conserva cada propuesta para revisarla sin perder la anterior.</p></div><span class="version-count">${versions.length} ${versions.length === 1 ? 'versión' : 'versiones'}</span></div>
    <div class="revision-layout">
      <section class="revision-main">
        <div class="panel-heading"><div><p class="eyebrow">HISTORIAL DE CAMBIOS</p><h3>Revisiones</h3></div><span class="branch-label">◉ main / canción</span></div>
        <div class="version-list">${versions.map((version) => `<button type="button" class="version-row ${version.id === selected.id ? 'is-current' : ''}" data-version-id="${escapeHtml(version.id)}">
          <span class="version-marker">${version.number}</span><span class="version-info"><strong>${escapeHtml(version.message)}</strong><small>${escapeHtml(version.author)} · ${dateLabel(version.createdAt)}</small></span><span class="status-chip ${statusClass[version.status]}">${escapeHtml(versionStatuses[version.status])}</span>
        </button>`).join('')}</div>
        ${compare}
        <article class="snapshot">
          <div class="snapshot-header"><div><p class="eyebrow">VERSIÓN ${selected.number} · ${escapeHtml(versionKinds[selected.kind])}</p><h3>${escapeHtml(selected.message)}</h3></div><span class="status-chip ${statusClass[selected.status]}">${escapeHtml(versionStatuses[selected.status])}</span></div>
          <p class="snapshot-meta">${escapeHtml(selected.author)} · ${dateLabel(selected.createdAt)}</p>
          <pre class="snapshot-content">${escapeHtml(selected.content)}</pre>
          <div class="review-actions">${selected.status === 'draft' ? `<button type="button" class="button button-outline" data-version-status="review" data-version-id="${escapeHtml(selected.id)}">Enviar a revisión →</button>` : ''}${selected.status !== 'approved' ? `<button type="button" class="button button-lime" data-version-status="approved" data-version-id="${escapeHtml(selected.id)}">Marcar aprobada ✓</button>` : ''}${selected.status !== 'draft' ? `<button type="button" class="text-button" data-version-status="draft" data-version-id="${escapeHtml(selected.id)}">Volver a borrador</button>` : ''}</div>
        </article>
        <section class="comments"><div class="panel-heading"><div><p class="eyebrow">CONVERSACIÓN</p><h3>Comentarios de la versión</h3></div><span class="count-pill">${comments.length}</span></div>
          <div class="comment-list">${comments.length ? comments.map((comment) => `<article class="comment"><span class="comment-avatar">${escapeHtml(comment.author.slice(0, 1))}</span><div><strong>${escapeHtml(comment.author)}</strong><small>${dateLabel(comment.createdAt)}</small><p>${escapeHtml(comment.content)}</p></div></article>`).join('') : '<p class="muted">Todavía no hay comentarios en esta versión.</p>'}</div>
          <form id="comment-form" class="comment-form"><label for="comment-author">Integrante</label><select id="comment-author"><option>Alex · voz</option><option>Mara · bajo</option><option>Nico · guitarra</option><option>Vale · batería</option></select><label for="comment-content">Deja una nota de revisión</label><textarea id="comment-content" maxlength="2000" required placeholder="¿Qué funciona? ¿Qué podríamos probar?"></textarea><button class="button button-dark" type="submit">Comentar ↗</button></form>
        </section>
      </section>
      <aside class="new-version panel"><p class="eyebrow">PROPONER UN CAMBIO</p><h3>Nueva versión</h3><p>Tu propuesta queda junto al historial; la versión anterior no se reemplaza.</p>
        <form id="version-form"><label for="version-message">Mensaje del cambio</label><input id="version-message" maxlength="240" required placeholder="Ej. Cambiar cierre del coro">
          <label for="version-kind">Tipo de material</label><select id="version-kind"><option value="idea">Idea</option><option value="lyrics">Letra</option><option value="arrangement">Arreglo</option><option value="demo">Demo / nota de producción</option></select>
          <label for="version-author">Integrante</label><select id="version-author"><option>Alex · voz</option><option>Mara · bajo</option><option>Nico · guitarra</option><option>Vale · batería</option></select>
          <label for="version-content">Texto de la propuesta</label><textarea id="version-content" maxlength="12000" required placeholder="Escribe una letra, idea o nota de producción. Cada envío crea una nueva versión."></textarea>
          <button class="button button-lime" type="submit">Guardar nueva versión ↗</button>
        </form>
      </aside>
    </div>`
}

function renderUploadedFiles() {
  const container = $('#uploaded-media')
  container.innerHTML = uploadedFiles.map((item) => {
    const preview = item.type.startsWith('image/')
      ? `<img src="${item.url}" alt="Vista previa de ${escapeHtml(item.name)}">`
      : item.type.startsWith('video/')
        ? `<video src="${item.url}" controls preload="metadata"></video>`
        : `<audio src="${item.url}" controls preload="metadata"></audio>`
    return `<article class="uploaded-card"><div class="uploaded-preview">${preview}</div><div class="uploaded-caption"><span>${escapeHtml(item.name)}</span><button type="button" class="remove-media" data-media-id="${item.id}" aria-label="Quitar ${escapeHtml(item.name)}">×</button></div><small>${escapeHtml(item.type)} · vista local</small></article>`
  }).join('')
}

function clearUploadedFiles() {
  uploadedFiles.forEach((item) => URL.revokeObjectURL(item.url))
  uploadedFiles = []
  renderUploadedFiles()
}

function renderView() {
  const studio = location.hash === '#studio'
  $('#scene-view').hidden = studio
  $('#studio-view').hidden = !studio
  document.querySelectorAll('[data-view]').forEach((link) => {
    if (link.tagName === 'A') link.setAttribute('aria-current', link.dataset.view === (studio ? 'studio' : 'scene') ? 'page' : 'false')
  })
  if (studio) renderWorkspace()
}

try {
  const saved = localStorage.getItem(STORAGE_KEY)
  state = saved ? restoreState(JSON.parse(saved)) : initialState()
} catch {
  state = initialState()
  announce('No se pudieron leer los datos guardados. Se cargaron ejemplos nuevos; el almacenamiento anterior no se modificó.', { studio: true })
}
activeTrackId = state.tracks[0]?.id
activeVersionId = state.tracks[0]?.versions.at(-1).id
renderWorkspace()
renderView()

window.addEventListener('hashchange', renderView)

$('#new-track-toggle').addEventListener('click', () => {
  const form = $('#new-track-form')
  form.hidden = !form.hidden
  if (!form.hidden) $('#new-track-title').focus()
})

$('#new-track-form').addEventListener('submit', (event) => {
  event.preventDefault()
  try {
    const form = event.currentTarget
    const title = $('#new-track-title').value
    const kind = $('#new-track-kind').value
    const content = $('#new-track-content').value
    const next = addTrack(state, { title, kind, content, author: $('#version-author')?.value ?? 'Alex · voz' })
    activeTrackId = next.tracks[0].id
    activeVersionId = next.tracks[0].versions[0].id
    changeState(next, 'Se creó la idea con su primera versión.')
    form.reset()
    form.hidden = true
  } catch (error) {
    announce(error.message, { studio: true })
  }
})

$('#track-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-track-id]')
  if (!button) return
  activeTrackId = button.dataset.trackId
  const track = selectedTrack()
  activeVersionId = track?.versions.at(-1).id
  renderWorkspace()
})

$('#track-detail').addEventListener('click', (event) => {
  const versionButton = event.target.closest('[data-version-id]')
  if (versionButton && !versionButton.dataset.versionStatus) {
    activeVersionId = versionButton.dataset.versionId
    renderWorkspace()
    return
  }
  const statusButton = event.target.closest('[data-version-status]')
  if (statusButton) {
    try {
      changeState(setVersionStatus(state, activeTrackId, statusButton.dataset.versionId, statusButton.dataset.versionStatus), 'Se actualizó el estado de revisión.')
    } catch (error) {
      announce(error.message, { studio: true })
    }
  }
})

$('#track-detail').addEventListener('submit', (event) => {
  event.preventDefault()
  try {
    const track = selectedTrack()
    if (event.target.id === 'version-form') {
      const next = addVersion(state, track.id, {
        kind: $('#version-kind').value,
        content: $('#version-content').value,
        message: $('#version-message').value,
        author: $('#version-author').value,
      })
      activeVersionId = next.tracks.find((item) => item.id === track.id).versions.at(-1).id
      changeState(next, 'Nueva versión guardada en el historial.')
    } else if (event.target.id === 'comment-form') {
      const version = selectedVersion(track)
      const next = addComment(state, track.id, version.id, {
        author: $('#comment-author').value,
        content: $('#comment-content').value,
      })
      changeState(next, 'Comentario añadido a esta versión.')
    }
  } catch (error) {
    announce(error.message, { studio: true })
  }
})

$('#upload-form').addEventListener('submit', (event) => event.preventDefault())
$('#media-files').addEventListener('change', (event) => {
  const files = [...event.target.files]
  event.target.value = ''
  const availableSlots = Math.max(0, 8 - uploadedFiles.length)
  const accepted = []
  const errors = []
  files.forEach((file) => {
    const validType = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')
    const maxBytes = file.type.startsWith('video/') ? 40 * 1024 * 1024 : file.type.startsWith('audio/') ? 20 * 1024 * 1024 : 12 * 1024 * 1024
    if (!validType) errors.push(`${file.name}: tipo de archivo no admitido.`)
    else if (file.size > maxBytes) errors.push(`${file.name}: supera el límite local para este tipo de archivo.`)
    else if (accepted.length >= availableSlots) errors.push('La demo permite previsualizar hasta 8 archivos por sesión.')
    else accepted.push(file)
  })
  accepted.forEach((file) => uploadedFiles.push({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    url: URL.createObjectURL(file),
  }))
  renderUploadedFiles()
  announce([...errors, ...(accepted.length ? [`${accepted.length} archivo(s) listos para previsualizar en este dispositivo.`] : [])].join(' '))
})

$('#uploaded-media').addEventListener('click', (event) => {
  const button = event.target.closest('[data-media-id]')
  if (!button) return
  const [removed] = uploadedFiles.filter((item) => item.id === button.dataset.mediaId)
  if (removed) URL.revokeObjectURL(removed.url)
  uploadedFiles = uploadedFiles.filter((item) => item.id !== button.dataset.mediaId)
  renderUploadedFiles()
  announce('Archivo quitado de la vista previa local.')
})

$('#reset-demo').addEventListener('click', () => {
  if (!confirm('¿Restablecer las canciones y revisiones de ejemplo? Tus cambios locales se borrarán.')) return
  try {
    localStorage.removeItem(STORAGE_KEY)
    state = initialState()
    activeTrackId = state.tracks[0].id
    activeVersionId = state.tracks[0].versions.at(-1).id
    clearUploadedFiles()
    $('#new-track-form').hidden = true
    renderWorkspace()
    announce('Datos de ejemplo restablecidos. Los archivos nunca se almacenaron.', { studio: true })
  } catch {
    announce('No se pudieron restablecer los datos guardados. Recarga la página para volver a la demo inicial.', { studio: true })
  }
})

window.addEventListener('beforeunload', clearUploadedFiles)
