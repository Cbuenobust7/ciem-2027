import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { listingsApi } from '@/api/listings'
import type { ListingListItem } from '@/types/api'
import { circularCatalogPage, CATALOG_PAGE_SIZE } from '@/lib/catalogSlider'
import { projectContact } from '@/data/ciemCatalog'
import { analytics, trackAnalyticsEvent } from '@/lib/analytics'
import { useLanguage } from '@/i18n'
import '@/pages/CatalogSlider.css'

/**
 * CTA del catálogo + carrusel de productos.
 * Vive aquí para que el home y /marketplace muestren exactamente lo mismo.
 */
const CHIPS = ['Plataformas web', 'Web + IA', 'Hosting', 'Mantenimiento', 'Ciberseguridad']

export function CatalogSection({ showCta = true }: { showCta?: boolean }) {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1))
  const [touchStart, setTouchStart] = useState<number | null>(null)

  // Cargar el catálogo filtrado para que el carrusel pueda volver al inicio.
  const catalogParams = { ordering: '-created_at' }
  const { data: catalog = [], isLoading, isError } = useQuery({
    queryKey: ['listings', 'catalog-slider', catalogParams],
    queryFn: async () => {
      const items: ListingListItem[] = []
      let apiPage = 1
      while (true) {
        const response = await listingsApi.list({ ...catalogParams, page: apiPage })
        items.push(...response.results)
        if (!response.next || response.results.length === 0) break
        apiPage += 1
      }
      return items
    },
  })
  const pageCount = Math.ceil(catalog.length / CATALOG_PAGE_SIZE)
  const currentPage = Math.max(1, Math.min(page, pageCount || 1))
  const visibleProducts = circularCatalogPage(catalog, currentPage)

  function goToPage(nextPage: number) {
    const targetPage = ((nextPage - 1 + pageCount) % pageCount) + 1
    if (targetPage !== currentPage) {
      trackAnalyticsEvent(analytics.catalogPageChange)
    }
    setPage(targetPage)
    const params = new URLSearchParams(searchParams)
    if (targetPage === 1) params.delete('page')
    else params.set('page', String(targetPage))
    setSearchParams(params, { replace: true, preventScrollReset: true })
  }

  return (
    <>
      {showCta && (
        <div className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-master-navy text-2xl font-bold text-white">C</div>
              <div>
                <b className="block text-lg font-bold tracking-[0.08em] text-master-navy">CIEM</b>
                <small className="block text-[13px] text-master-navy/70">Productos &amp; Servicios Digitales</small>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-master-navy/15 bg-white px-4 py-2 text-sm font-semibold text-master-navy">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-master-cyan" />
              Desarrollo web · IA · Hosting · Mantenimiento · Ciberseguridad
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="catalog-title" className="text-4xl font-bold leading-[1.05] tracking-tight text-master-navy md:text-5xl">
                <span className="block">Elige tu plantilla o</span>
                <span className="block text-primary-500">la creamos desde cero.</span>
              </h2>
              <div aria-hidden="true" className="my-4 h-[5px] w-[72px] rounded bg-master-cyan" />
              <div className="flex flex-wrap gap-2">
                {CHIPS.map(chip => (
                  <span key={chip} className="rounded-lg border border-master-navy/15 bg-white px-3.5 py-1.5 text-[14.5px] font-semibold text-master-navy">{chip}</span>
                ))}
              </div>
            </div>

            <div className="flex-none rounded-2xl bg-master-navy p-6 text-white lg:w-[330px]">
              <p className="text-[15px] leading-relaxed text-white/80">Cuéntanos tu idea: evaluamos alcance, precio y plazo antes de confirmar tu propuesta.</p>
              <a
                href={projectContact()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAnalyticsEvent(analytics.quoteRequest)}
                className="mt-4 flex items-center justify-center gap-2.5 rounded-xl bg-master-cyan px-5 py-3.5 text-lg font-bold text-master-navy transition-colors hover:bg-master-cyan/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-master-navy"
              >
                Solicitar cotización
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <small className="mt-3 block text-center text-[13px] text-white/80">WhatsApp <strong className="text-white">+51 999 989 709</strong></small>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">{t('loadListingsError')}</div>
      )}

      <div
        className="catalog-slider"
        aria-label={t('availableServices')}
        aria-roledescription="carousel"
        aria-busy={isLoading}
        onTouchStart={event => setTouchStart(event.touches[0].clientX)}
        onTouchEnd={event => {
          if (touchStart !== null && pageCount > 1) {
            const delta = touchStart - event.changedTouches[0].clientX
            if (Math.abs(delta) > 60) goToPage(currentPage + (delta > 0 ? 1 : -1))
          }
          setTouchStart(null)
        }}
      >
        <div key={`${JSON.stringify(catalogParams)}-${currentPage}`} className="catalog-slider__slide">
          <ListingGrid
            listings={visibleProducts}
            isLoading={isLoading}
            emptyMessage={t('noListings')}
          />
        </div>
        {!isLoading && !isError && pageCount > 0 && (
          <nav className="catalog-slider__pagination" aria-label={t('pageCount', { page: currentPage, count: catalog.length })}>
            {pageCount > 1 && <Button variant="secondary" onClick={() => goToPage(currentPage - 1)}>{t('previous')}</Button>}
            <div className="catalog-slider__numbers">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => (
                <button
                  type="button"
                  key={number}
                  className="catalog-slider__number"
                  aria-label={t('pageCount', { page: number, count: catalog.length })}
                  aria-current={currentPage === number ? 'page' : undefined}
                  onClick={() => goToPage(number)}
                >{number}</button>
              ))}
            </div>
            {pageCount > 1 && <Button variant="secondary" onClick={() => goToPage(currentPage + 1)}>{t('next')}</Button>}
          </nav>
        )}
        <span className="sr-only" role="status" aria-live="polite">{!isLoading && t('pageCount', { page: currentPage, count: catalog.length })}</span>
      </div>
    </>
  )
}
