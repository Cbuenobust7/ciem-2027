import { useEffect } from 'react'

import { CatalogSection } from '@/components/catalog/CatalogSection'

/**
 * Página independiente con el mismo navbar pero cabecera propia: se entra
 * directamente al catálogo, sin el CTA del home y sin el splash del logo.
 */
export default function MarketplacePage() {
  useEffect(() => {
    document.title = 'Plantillas | CIEM'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="home-content">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-bold uppercase tracking-wide text-primary-700">CIEM · Catálogo</p>
        <h1 className="mt-2 text-3xl font-bold text-master-navy md:text-4xl">Plantillas</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Bases editables, plugins y componentes listos para descargar o personalizar.
        </p>
      </header>
      <CatalogSection showCta={false} />
    </div>
  )
}
