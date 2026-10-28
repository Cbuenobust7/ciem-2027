#!/usr/bin/env node
/**
 * Escáner de aceptación de la internacionalización.
 *
 * Uso:
 *   node scripts/i18n-check.mjs                 # todo src/, falla si hay pendientes
 *   node scripts/i18n-check.mjs --file <ruta>   # un archivo concreto
 *   node scripts/i18n-check.mjs --quiet         # solo el resumen
 *
 * Comprueba tres cosas:
 *   1. que toda clave usada con t('...') exista en el diccionario;
 *   2. que los bloques `es` y `en` tengan exactamente las mismas claves;
 *   3. que no queden textos de interfaz en español (atributos y nodos de texto,
 *      incluidos los repartidos en varias líneas).
 *
 * Notas de implementación (aprendidas a base de falsos negativos):
 *   - los patrones cruzan líneas: gran parte de este código escribe el texto en la
 *     línea siguiente a `>`;
 *   - se descartan los genéricos de TypeScript (`>Promise<`, `>ReactNode<`…);
 *   - se descartan los códigos ISO de moneda (`PEN`, `USD`), que no se traducen.
 *
 * Los nodos de texto se detectan por heurística (mayúscula inicial), así que el
 * resultado es un *mínimo*: sirve para no dar por cerrado un lote con trabajo vivo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const DICT = join(SRC, 'i18n', 'index.tsx')

const TS_GENERIC = /^(Promise|Record|Array|Partial|Map|Set|Omit|Pick|Readonly|ReturnType|ReactNode|ReactElement|HTMLElement|HTML\w+|Category\w*|Booking\w*|Service\w*|Provider\w*|Listing\w*|Rule\w*|Exception\w*|Action\w*|TranslationKey|Language|FiltersValue|FormState|Account\w*|Visibility\w*|Payment\w*|City\w*|District\w*|Media\w*|Image\w*)\b/
const ISO_CODES = new Set(['PEN', 'USD', 'EUR'])
// Archivos que no se traducen: el logotipo lleva el nombre de marca, que es el
// mismo en los dos idiomas.
const SKIP_FILES = new Set(['components/layout/BrandLogo.tsx'])
const ATTRIBUTES = ['label', 'placeholder', 'aria-label', 'emptyMessage', 'title']
// Señal fuerte de texto sin traducir escondido en constantes: un literal con acento
// y espacios que no es atributo ni ruta. Es el punto ciego que dejó ocho cadenas
// vivas en BENEFICIOS (JoinPage) sin que el escáner las viera.
const STRING_LITERAL = /(['"])((?:[^'"\\\n]|\\.){12,}?)\1/g
const TECHNICAL_BEFORE = /(className|class|href|src|to|key|id|name|type|placeholder|label|title|aria-label|timezone|value)=$/

const args = process.argv.slice(2)
const only = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
const quiet = args.includes('--quiet')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full)
  }
  return out
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length
}

function dictionary() {
  const source = readFileSync(DICT, 'utf8')
  const start = source.indexOf('const translations = {')
  const end = source.indexOf('} as const', start)
  if (start < 0 || end < 0) throw new Error('No encuentro el bloque `translations` en src/i18n/index.tsx')
  const body = source.slice(start, end)
  const es = body.slice(body.indexOf('  es: {'), body.indexOf('  en: {'))
  const en = body.slice(body.indexOf('  en: {'))
  const keys = (block) => new Set([...block.matchAll(/^ {4}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]))
  return { es: keys(es), en: keys(en) }
}

function pendingIn(file) {
  const source = readFileSync(file, 'utf8')
  const hits = []
  // Los .ts no tienen JSX: su texto vive en literales, y de eso se encarga hiddenLiterals.
  if (!file.endsWith('.tsx')) return hits
  for (const m of source.matchAll(/>\s*([A-ZÁÉÍÓÚÑ¿¡][^<>{}]{2,}?)\s*</gs)) {
    const value = m[1].replace(/\s+/g, ' ').trim()
    if (value.length > 2 && !TS_GENERIC.test(value) && !ISO_CODES.has(value)) {
      hits.push({ kind: 'texto', value, line: lineOf(source, m.index) })
    }
  }
  const attrPattern = new RegExp(`(${ATTRIBUTES.join('|')})="([A-ZÁÉÍÓÚÑ¿¡][^"]{2,})"`, 'g')
  for (const m of source.matchAll(attrPattern)) {
    hits.push({ kind: m[1], value: m[2], line: lineOf(source, m.index) })
  }
  return hits
}

function hiddenLiterals(file, source) {
  const hits = []
  for (const m of source.matchAll(STRING_LITERAL)) {
    const value = m[2]
    if (!/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(value) || !/ /.test(value)) continue
    const before = source.slice(Math.max(0, m.index - 40), m.index)
    if (TECHNICAL_BEFORE.test(before)) continue
    if (/^\s*(https?:|\/|\.\/|#|America\/)/.test(value)) continue
    hits.push({ value, line: lineOf(source, m.index) })
  }
  return hits
}

const { es, en } = dictionary()
const files = only ? [join(ROOT, only)] : walk(SRC)

let used = new Set()
let totalPending = 0
let totalHidden = 0
const hiddenAll = []
const report = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const m of source.matchAll(/\bt\('([A-Za-z][A-Za-z0-9]*)'/g)) used.add(m[1])
  if (SKIP_FILES.has(relative(SRC, file))) continue
  if (relative(SRC, file) === 'i18n/index.tsx') continue
  const hidden = hiddenLiterals(file, source)
  if (hidden.length) hiddenAll.push({ file: relative(ROOT, file), hits: hidden })
  const hits = pendingIn(file)
  if (hits.length) {
    totalPending += hits.length
    report.push({ file: relative(ROOT, file), hits })
  }
}

const missingKeys = [...used].filter((k) => !es.has(k)).sort()
const mismatch = [...es].filter((k) => !en.has(k)).concat([...en].filter((k) => !es.has(k))).sort()

console.log(`Diccionario: ${es.size} claves en «es» · ${en.size} en «en»`)
if (mismatch.length) console.log(`  ✗ desajuste entre idiomas: ${mismatch.join(', ')}`)
if (missingKeys.length) console.log(`  ✗ claves usadas sin definir: ${missingKeys.join(', ')}`)

if (report.length && !quiet) {
  console.log('\nCadenas pendientes de traducir:')
  for (const { file, hits } of report.sort((a, b) => b.hits.length - a.hits.length)) {
    console.log(`  ${file} (${hits.length})`)
    for (const h of hits.slice(0, 6)) console.log(`      ${h.line}: ${h.kind}: ${JSON.stringify(h.value.slice(0, 70))}`)
  }
}

for (const { file, hits } of hiddenAll) totalHidden += hits.length
if (hiddenAll.length && !quiet) {
  console.log('\nCadenas en constantes (punto ciego, con acento y espacios):')
  for (const { file, hits } of hiddenAll.sort((a, b) => b.hits.length - a.hits.length)) {
    console.log(`  ${file} (${hits.length})`)
    for (const h of hits.slice(0, 6)) console.log(`      ${h.line}: ${JSON.stringify(h.value.slice(0, 70))}`)
  }
}

console.log(`\nTexto visible pendiente: ${totalPending}${only ? ' (archivo indicado)' : ''}`)
console.log(`Cadenas en constantes (revisar): ${totalHidden}`)
const failed = totalPending > 0 || totalHidden > 0 || missingKeys.length > 0 || mismatch.length > 0
console.log(failed ? 'RESULTADO: FALLO' : 'RESULTADO: OK')
process.exit(failed ? 1 : 0)
