import test from 'node:test'
import assert from 'node:assert/strict'
import { addComment, addTrack, addVersion, initialState, restoreState, setVersionStatus } from '../frontend/public/band-studio-starter-kit/model.js'

test('preserva instantáneas y numera versiones sin alterar las anteriores', () => {
  const state = initialState()
  const original = state.tracks[0].versions[1]
  const next = addVersion(state, 'track-luces', {
    kind: 'lyrics',
    content: `${original.content}\nCruza la noche la voz.`,
    message: 'Añadir cierre del verso',
    author: 'Mara · bajo',
  })
  const track = next.tracks.find((item) => item.id === 'track-luces')
  assert.equal(track.versions.length, 3)
  assert.equal(track.versions[2].number, 3)
  assert.equal(track.versions[2].status, 'draft')
  assert.equal(track.versions[1].content, original.content)
  assert.equal(state.tracks[0].versions.length, 2)
})

test('crea canciones con contenido inicial y rechaza entradas incompletas', () => {
  const next = addTrack(initialState(), {
    title: 'Ciudad de papel',
    kind: 'idea',
    content: 'Un coro para probar en el ensayo.',
    author: 'Alex · voz',
  })
  assert.equal(next.tracks[0].title, 'Ciudad de papel')
  assert.equal(next.tracks[0].versions[0].number, 1)
  assert.throws(() => addTrack(initialState(), { title: ' ', content: ' ' }))
  assert.throws(() => addTrack(initialState(), { title: 'Nueva', kind: 'unknown', content: 'Idea' }))
})

test('recorre los estados de revisión y rechaza estados ajenos al flujo', () => {
  const state = initialState()
  const versionId = state.tracks[0].versions[1].id
  const next = setVersionStatus(state, 'track-luces', versionId, 'approved')
  assert.equal(next.tracks[0].versions[1].status, 'approved')
  assert.equal(state.tracks[0].versions[1].status, 'review')
  assert.throws(() => setVersionStatus(state, 'track-luces', versionId, 'published'))
})

test('asocia comentarios a una versión y exige un comentario no vacío', () => {
  const state = initialState()
  const versionId = state.tracks[0].versions[1].id
  const next = addComment(state, 'track-luces', versionId, {
    author: 'Nico · guitarra',
    content: 'Podemos dejar respirar esta línea.',
  })
  assert.equal(next.tracks[0].comments.at(-1).versionId, versionId)
  assert.equal(state.tracks[0].comments.length, 1)
  assert.throws(() => addComment(state, 'track-luces', versionId, { content: ' ' }))
  assert.throws(() => addComment(state, 'track-luces', 'missing', { content: 'Comentario' }))
})

test('valida la restauración, la secuencia del historial y los estados permitidos', () => {
  const state = initialState()
  assert.deepEqual(restoreState(state), state)
  const malformed = structuredClone(state)
  malformed.tracks[0].versions[1].number = 9
  assert.throws(() => restoreState(malformed))
  const invalidStatus = structuredClone(state)
  invalidStatus.tracks[0].versions[0].status = 'visible'
  assert.throws(() => restoreState(invalidStatus))
})
