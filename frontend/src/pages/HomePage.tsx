import { digitalCategorySlugs, projectContact } from '@/data/ciemCatalog'
import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { ListingFilters, type FiltersValue } from '@/components/listings/ListingFilters'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { categoriesApi } from '@/api/categories'
import { useListings } from '@/hooks/useListings'
import { useQuery } from '@tanstack/react-query'

const CATEGORY_STYLES: Record<string, {symbol: string; description: string}> = {
  'templates-web': {symbol: '▱', description: 'Páginas HTML y CSS para adaptar a tu negocio.'},
  'plugins-wordpress': {symbol: '◇', description: 'Plugins básicos con shortcodes y código editable.'},
  'plataformas-web': {symbol: '▦', description: 'Soluciones por encargo, con alcance por definir.'},
  'componentes-ui': {symbol: '◌', description: 'Secciones y componentes HTML para personalizar.'},
  'tiendas-online': {symbol: '⌂', description: 'Implementación de tiendas y catálogos por encargo.'},
  'desarrollo-a-medida': {symbol: '✦', description: 'Construimos desde cero según tus necesidades.'},
}

export default function HomePage() {
  const { t } = useLanguage()
  const [autoScrollCancelled, setAutoScrollCancelled] = useState(false)

  useEffect(() => {
    if (autoScrollCancelled) return

    const timer = window.setTimeout(() => {
      document.getElementById('home-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 20_000)

    const cancelOnIntent = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.mc-header, .home-hero')) {
        setAutoScrollCancelled(true)
      }
    }
    const cancelOnManualScroll = () => setAutoScrollCancelled(true)

    document.addEventListener('click', cancelOnIntent, true)
    window.addEventListener('wheel', cancelOnManualScroll, { passive: true })
    window.addEventListener('touchstart', cancelOnManualScroll, { passive: true })
    window.addEventListener('keydown', cancelOnManualScroll)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', cancelOnIntent, true)
      window.removeEventListener('wheel', cancelOnManualScroll)
      window.removeEventListener('touchstart', cancelOnManualScroll)
      window.removeEventListener('keydown', cancelOnManualScroll)
    }
  }, [autoScrollCancelled])

  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<FiltersValue>({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') ? Number(searchParams.get('category')) : null,
    condition: searchParams.get('condition') || '',
    location: searchParams.get('location') || '',
    ordering: searchParams.get('ordering') || '-created_at',
  })

  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)

  // Categorías para el filtro
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categories = categoriesData?.results ?? []

  // Listings con filtros aplicados
  const { data, isLoading, isError } = useListings({
    search: filters.search || undefined,
    category: filters.category ?? undefined,
    condition: filters.condition || undefined,
    location: filters.location || undefined,
    ordering: filters.ordering || undefined,
    page,
  })

  // Sincronizar filtros con la URL
  function handleFiltersChange(newFilters: FiltersValue) {
    setFilters(newFilters)
    setPage(1)

    const params = new URLSearchParams()
    if (newFilters.search) params.set('search', newFilters.search)
    if (newFilters.category) params.set('category', String(newFilters.category))
    if (newFilters.condition) params.set('condition', newFilters.condition)
    if (newFilters.location) params.set('location', newFilters.location)
    if (newFilters.ordering) params.set('ordering', newFilters.ordering)
    setSearchParams(params)
  }

  function handleCategorySelect(categoryId: number) {
    handleFiltersChange({ ...filters, category: categoryId })
    document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const featuredCategories = categories.filter((category) => digitalCategorySlugs.includes(category.slug)).slice(0, 6)

  return (
    <div className="home-page">
      <section className="home-hero section" aria-labelledby="home-hero-title">
        <div className="home-hero__container">
          <div className="home-hero__inner">
            <h1 id="home-hero-title" className="home-hero__title">
              {t('homeTitle')}
            </h1>

            <p className="home-hero__text">
              {t('homeSubtitle')}
            </p>

            <button
              type="button"
              className="btn btn-primary home-hero__button"
              onClick={() =>
                document
                  .getElementById('home-content')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              {t('searchServices')}
              <span aria-hidden="true"> →</span>
            </button>
            <a href={projectContact()} target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-4">{t('customAction')}</a>
          </div>

          <div className="home-hero__links" aria-label="Redes sociales">
            <a href="#" title="Facebook" aria-label="Facebook">
              <span>f</span>
            </a>
            <a href="#" title="Instagram" aria-label="Instagram">
              <span>ig</span>
            </a>
            <a href="#" title="Twitter" aria-label="Twitter">
              <span>x</span>
            </a>
            <a href="#" title="YouTube" aria-label="YouTube">
              <span>▶</span>
            </a>
          </div>
        </div>
      </section>

      <div id="home-content" className="home-content">
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 md:p-8" aria-labelledby="custom-platform-title">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-primary-700">CIEM · Desarrollo web</p>
          <h2 id="custom-platform-title" className="text-2xl font-bold text-master-navy">{t('customTitle')}</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{t('customIntro')}</p>
          <a href={projectContact()} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5">{t('customAction')} <span aria-hidden="true">→</span></a>
        </section>
        <p className="mb-6 rounded-lg bg-primary-50 p-4 text-sm text-master-navy">{t('catalogNotice')}</p>

      {featuredCategories.length > 0 && (
        <section aria-labelledby="categorias-heading" className="mb-10">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-600">{t('exploreByNeed')}</p>
              <h2 id="categorias-heading" className="mt-1 text-2xl font-bold text-master-navy">{t('categoriesTitle')}</h2>
            </div>
            <p className="text-sm text-gray-600">{t('categoriesSubtitle')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCategories.map((category) => {
              const style = CATEGORY_STYLES[category.slug] ?? CATEGORY_STYLES['templates-web']
              const isSelected = filters.category === category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategorySelect(category.id)}
                  aria-pressed={isSelected}
                  className={[
                    'group flex min-h-32 items-start gap-4 rounded-xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    isSelected
                      ? 'border-primary-600 bg-primary-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md',
                  ].join(' ')}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700 transition group-hover:bg-primary-600 group-hover:text-white">
                    {style.symbol}
                  </span>
                  <span>
                    <span className="block text-base font-bold text-master-navy">{category.name}</span>
                    <span className="mt-1 block text-sm leading-5 text-gray-600">{style.description}</span>
                    <span className="mt-3 inline-block text-sm font-bold text-primary-700">{t('viewServices')}<span aria-hidden="true">→</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section id="servicios" aria-label={t('availableServices')} className="scroll-mt-24">
        <ListingFilters
        value={filters}
        onChange={handleFiltersChange}
        categories={categories}
      />
      </section>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">{t('loadListingsError')}</div>
      )}

      <ListingGrid
        listings={data?.results}
        isLoading={isLoading}
        emptyMessage={t('noListings')}
      />

      {/* Paginación */}
      {data && (data.next || data.previous) && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            disabled={!data.previous}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >{t('previous')}</Button>
          <span className="text-sm text-gray-600">{t('pageCount', { page, count: data.count })}</span>
          <Button
            variant="secondary"
            disabled={!data.next}
            onClick={() => setPage((p) => p + 1)}
          >{t('next')}</Button>
        </div>
      )}
      </div>
    </div>
  )
}
