export const STORAGE_KEY = 'ciem-band-studio-v1'

const VERSION_KINDS = new Set(['idea', 'lyrics', 'arrangement', 'demo'])
const VERSION_STATUSES = new Set(['draft', 'review', 'approved'])
const MAX_TRACKS = 30
const MAX_VERSIONS = 100
const MAX_TEXT_LENGTH = 12000

function text(value, label, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${label} no es válido.`)
  }
  return value.trim()
}

function findTrack(state, trackId) {
  const track = state.tracks.find((item) => item.id === trackId)
  if (!track) throw new Error('No encontramos esa canción o idea.')
  return track
}

export function initialState() {
  return {
    tracks: [
      {
        id: 'track-luces',
        title: 'Luces de madrugada',
        versions: [
          {
            id: 'track-luces-v1',
            number: 1,
            kind: 'idea',
            content: 'Una canción sobre volver a casa después del último concierto.',
            message: 'Idea inicial',
            author: 'Alex · voz',
            status: 'draft',
            createdAt: '2026-10-12T18:20:00.000Z',
          },
          {
            id: 'track-luces-v2',
            number: 2,
            kind: 'lyrics',
            content: 'La ciudad respira lento,\nqueda un eco en el andén.\nVoy siguiendo las ventanas\nque se encienden otra vez.',
            message: 'Primera estrofa',
            author: 'Mara · bajo',
            status: 'review',
            createdAt: '2026-10-14T20:05:00.000Z',
          },
        ],
        comments: [
          {
            id: 'comment-luces-1',
            versionId: 'track-luces-v2',
            author: 'Nico · guitarra',
            content: 'Me gusta el ritmo. ¿Probamos una pausa antes del último verso?',
            createdAt: '2026-10-15T16:30:00.000Z',
          },
        ],
      },
      {
        id: 'track-senal',
        title: 'Señal abierta',
        versions: [
          {
            id: 'track-senal-v1',
            number: 1,
            kind: 'arrangement',
            content: 'Verso con guitarra limpia. El coro entra con batería completa y bajo.',
            message: 'Estructura de ensayo',
            author: 'Nico · guitarra',
            status: 'approved',
            createdAt: '2026-10-11T19:00:00.000Z',
          },
        ],
        comments: [],
      },
      {
        id: 'track-papel',
        title: 'Papel y sal',
        versions: [
          {
            id: 'track-papel-v1',
            number: 1,
            kind: 'demo',
            content: 'Demo acústica: tempo medio, guitarra en afinación estándar. Falta definir el puente.',
            message: 'Nota de producción',
            author: 'Vale · batería',
            status: 'draft',
            createdAt: '2026-10-09T14:40:00.000Z',
          },
        ],
        comments: [],
      },
    ],
  }
}

export function restoreState(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tracks) || value.tracks.length > MAX_TRACKS) {
    throw new Error('Los datos de la demo no tienen un formato válido.')
  }
  const trackIds = new Set()
  for (const track of value.tracks) {
    if (!track || typeof track.id !== 'string' || !track.id || trackIds.has(track.id)) {
      throw new Error('Hay una canción con un identificador inválido.')
    }
    trackIds.add(track.id)
    text(track.title, 'El título')
    if (!Array.isArray(track.versions) || !track.versions.length || track.versions.length > MAX_VERSIONS) {
      throw new Error('El historial de versiones no es válido.')
    }
    const versionIds = new Set()
    track.versions.forEach((version, index) => {
      if (!version || typeof version.id !== 'string' || versionIds.has(version.id)) {
        throw new Error('Hay una versión con un identificador inválido.')
      }
      versionIds.add(version.id)
      if (version.number !== index + 1 || !VERSION_KINDS.has(version.kind) || !VERSION_STATUSES.has(version.status)) {
        throw new Error('Una versión contiene valores no permitidos.')
      }
      text(version.content, 'El contenido de la versión')
      text(version.message, 'El mensaje de la versión', 240)
      text(version.author, 'La persona autora', 80)
      if (typeof version.createdAt !== 'string' || Number.isNaN(Date.parse(version.createdAt))) {
        throw new Error('La fecha de una versión no es válida.')
      }
    })
    if (!Array.isArray(track.comments) || track.comments.length > 500) {
      throw new Error('Los comentarios no tienen un formato válido.')
    }
    track.comments.forEach((comment) => {
      if (!comment || typeof comment.id !== 'string' || !versionIds.has(comment.versionId)) {
        throw new Error('Un comentario no corresponde a una versión.')
      }
      text(comment.author, 'La persona autora', 80)
      text(comment.content, 'El comentario', 2000)
      if (typeof comment.createdAt !== 'string' || Number.isNaN(Date.parse(comment.createdAt))) {
        throw new Error('La fecha de un comentario no es válida.')
      }
    })
  }
  return structuredClone(value)
}

export function addTrack(state, { title, kind = 'idea', content, author = 'Integrante' }) {
  const current = restoreState(state)
  if (current.tracks.length >= MAX_TRACKS) throw new Error('La demo admite hasta 30 canciones e ideas.')
  const cleanTitle = text(title, 'El título', 120)
  const cleanContent = text(content, 'El contenido')
  if (!cleanTitle || !cleanContent || !VERSION_KINDS.has(kind)) {
    throw new Error('Completa un título y un contenido válido.')
  }
  const now = new Date().toISOString()
  current.tracks.unshift({
    id: `track-${crypto.randomUUID()}`,
    title: cleanTitle,
    versions: [{
      id: `version-${crypto.randomUUID()}`,
      number: 1,
      kind,
      content: cleanContent,
      message: 'Idea inicial',
      author: text(author, 'La persona autora', 80) || 'Integrante',
      status: 'draft',
      createdAt: now,
    }],
    comments: [],
  })
  return current
}

export function addVersion(state, trackId, { kind, content, message, author = 'Integrante' }) {
  const current = restoreState(state)
  const track = findTrack(current, trackId)
  if (track.versions.length >= MAX_VERSIONS) throw new Error('Esta canción alcanzó el límite de versiones de la demo.')
  const cleanContent = text(content, 'El contenido')
  const cleanMessage = text(message, 'El mensaje', 240)
  if (!cleanContent || !cleanMessage || !VERSION_KINDS.has(kind)) {
    throw new Error('Completa el contenido, el mensaje y el tipo de cambio.')
  }
  track.versions.push({
    id: `version-${crypto.randomUUID()}`,
    number: track.versions.length + 1,
    kind,
    content: cleanContent,
    message: cleanMessage,
    author: text(author, 'La persona autora', 80) || 'Integrante',
    status: 'draft',
    createdAt: new Date().toISOString(),
  })
  return current
}

export function setVersionStatus(state, trackId, versionId, status) {
  const current = restoreState(state)
  const track = findTrack(current, trackId)
  const version = track.versions.find((item) => item.id === versionId)
  if (!version) throw new Error('No encontramos esa versión.')
  if (!VERSION_STATUSES.has(status)) throw new Error('Ese estado de revisión no está permitido.')
  version.status = status
  return current
}

export function addComment(state, trackId, versionId, { author = 'Integrante', content }) {
  const current = restoreState(state)
  const track = findTrack(current, trackId)
  if (!track.versions.some((version) => version.id === versionId)) {
    throw new Error('No encontramos la versión que quieres comentar.')
  }
  const cleanContent = text(content, 'El comentario', 2000)
  if (!cleanContent) throw new Error('Escribe un comentario antes de publicarlo.')
  if (track.comments.length >= 500) throw new Error('Esta canción alcanzó el límite de comentarios de la demo.')
  track.comments.push({
    id: `comment-${crypto.randomUUID()}`,
    versionId,
    author: text(author, 'La persona autora', 80) || 'Integrante',
    content: cleanContent,
    createdAt: new Date().toISOString(),
  })
  return current
}
