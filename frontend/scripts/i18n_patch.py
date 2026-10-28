"""Utilidades para parchear la internacionalización del frontend.

Nacen de una tanda en la que el mismo parcheo hecho a mano introdujo siete fallos
(comillas, llaves, firmas deformadas, claves inválidas). Se usan así:

    from i18n_patch import read, write, add_dictionary_keys, add_hook, set_attr, set_text

    s = read('src/pages/.../Page.tsx')
    s = add_hook(s, 'export default function Page()')
    s = set_attr(s, 'label', 'Distrito', "t('district')")
    s = set_text(s, 'Elige el día', 'chooseDay')
    write('src/pages/.../Page.tsx', s)

`add_dictionary_keys` valida que la clave sea un identificador válido: una clave con
punto (`e.gHolidays`) rompe el objeto y no la detecta ningún editor.
"""
from __future__ import annotations

import pathlib
import re

KEY_RE = re.compile(r'^[A-Za-z][A-Za-z0-9]*$')


def read(path: str) -> str:
    return pathlib.Path(path).read_text(encoding='utf-8')


def write(path: str, source: str) -> None:
    pathlib.Path(path).write_text(source, encoding='utf-8')


def add_dictionary_keys(path: str, pairs: list[tuple[str, str, str]]) -> int:
    """Añade (clave, es, en) al diccionario, evitando duplicados. Devuelve cuántas añadió."""
    source = read(path)
    for key, _, _ in pairs:
        if not KEY_RE.match(key):
            raise ValueError(f'clave inválida (¿un punto?): {key!r}')
    missing = [(k, es, en) for k, es, en in pairs if f'\n    {k}:' not in source]
    es_block = ''.join(f"    {k}: '{es}',\n" for k, es, _ in missing)
    en_block = ''.join(f"    {k}: '{en}',\n" for k, _, en in missing)
    for anchor, block in (("    notFound: 'Página no encontrada.',", es_block),
                          ("    notFound: 'Page not found.',", en_block)):
        if anchor not in source:
            raise ValueError(f'no encuentro el ancla del diccionario: {anchor!r}')
        source = source.replace(anchor, block + anchor, 1)
    write(path, source)
    return len(missing)


def add_hook(source: str, signature: str) -> str:
    """Inserta `const { t } = useLanguage()` tras la firma (simple o multilínea).

    Es idempotente: si el hook ya está, no lo duplica. Duplicarlo produce
    `Cannot redeclare block-scoped variable 't'`, un error que apareció tres veces
    por llamar dos veces a esta función sobre el mismo componente.
    """
    start = source.index(signature)
    end = source.index(') {', start) + 3
    if source[end:end + 60].lstrip().startswith('const { t } = useLanguage()'):
        return source
    return source[:end] + '\n  const { t } = useLanguage()' + source[end:]


def dedupe_dictionary(path: str) -> int:
    """Elimina claves repetidas **dentro de cada bloque de idioma**.

    Nunca compara un idioma con el otro: hacerlo con un único conjunto vacía el
    bloque inglés entero (y el build no lo detecta porque los casts de tipo lo
    ocultan; en inglés todo cae al español en tiempo de ejecución).
    """
    source = read(path)
    start = source.index('const translations = {')
    end = source.index('} as const', start)
    head, body, tail = source[:start], source[start:end], source[end:]
    seen, out, removed = set(), [], 0
    for line in body.splitlines():
        if '  es: {' in line or '  en: {' in line:
            seen = set()
        m = re.match(r'^    ([A-Za-z][A-Za-z0-9]*):', line)
        if m:
            if m.group(1) in seen:
                removed += 1
                continue
            seen.add(m.group(1))
        out.append(line)
    cuerpo = '\n'.join(out) + ('\n' if body.endswith('\n') else '')
    write(path, head + cuerpo + tail)
    return removed


def set_attr(source: str, name: str, literal: str, expression: str) -> str:
    """Sustituye `name="literal"` por `name={expression}` (comillas simples o dobles)."""
    pattern = r'\b' + name + r'=(["\'])' + re.escape(literal) + r'\1'
    replaced, count = re.subn(pattern, name + '={' + expression + '}', source, count=1)
    if count != 1:
        raise ValueError(f'atributo no encontrado: {name}="{literal}"')
    return replaced


def set_text(source: str, literal: str, key: str, count: int = 1) -> str:
    """Sustituye un nodo de texto por `{t('clave')}`, tolerando saltos de línea."""
    pattern = r'>\s*' + r'\s+'.join(re.escape(word) for word in literal.split()) + r'\s*<'
    replaced, found = re.subn(pattern, ">{t('%s')}<" % key, source, count=count, flags=re.S)
    if found < 1:
        raise ValueError(f'texto no encontrado: {literal[:60]!r}')
    return replaced


def _selftest() -> None:
    """Comprueba las utilidades sobre casos sintéticos. `python3 scripts/i18n_patch.py --selftest`."""
    try:
        add_dictionary_keys('/dev/null', [('e.gHolidays', 'x', 'y')])
        raise AssertionError('debería haber rechazado la clave con punto')
    except ValueError:
        pass
    src = 'export function P({ a }: { a: number }) {\n  return (\n    <p>\n      Hola mundo\n    </p>\n  )\n}\n'
    src = add_hook(src, 'export function P({ a }: { a: number })')
    assert 'useLanguage()' in src
    src = set_text(src, 'Hola mundo', 'hello')
    assert "{t('hello')}" in src
    assert src.count('useLanguage()') == 1
    assert add_hook(src, 'export function P({ a }: { a: number })') == src, 'add_hook debe ser idempotente'
    src = set_attr('<Input label="Distrito" />', 'label', 'Distrito', "t('district')")
    assert 'label={t(\'district\')}' in src
    # dedupe_dictionary: por bloque, nunca entre idiomas
    import tempfile, os
    with tempfile.NamedTemporaryFile('w', suffix='.tsx', delete=False) as tmp:
        tmp.write("const translations = {\n  es: {\n    a: 'x',\n    b: 'y',\n  },\n  en: {\n    a: 'x',\n    b: 'y',\n  },\n} as const\n")
        ruta = tmp.name
    try:
        assert dedupe_dictionary(ruta) == 0, 'no debe tocar claves que solo se repiten entre idiomas'
        assert "'y'" in pathlib.Path(ruta).read_text()
    finally:
        os.unlink(ruta)
    print('  ✓ autocomprobación correcta: clave inválida rechazada, hook y sustituciones OK')


if __name__ == '__main__':
    import sys
    if '--selftest' in sys.argv:
        _selftest()
    else:
        print(__doc__)
