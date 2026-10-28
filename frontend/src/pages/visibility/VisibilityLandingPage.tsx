import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useCities } from '@/hooks/useVisibility'

export default function VisibilityLandingPage() {
  const { t } = useLanguage()
  const { data, isLoading, isError } = useCities()

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">
          {t('citiesLoadError')}
        </h1>
        <Link
          to="/"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          ← Volver a los anuncios
        </Link>
      </div>
    )
  }

  const cities = data.results

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-master-navy">{t('featuredSpots')}</h1>
        <p className="mt-2 text-gray-600">
          {t('featuredSpotsSubtitle')}
        </p>
      </header>

      {cities.length === 0 ? (
        <p className="text-gray-500">
          {t('noCities')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cities.map((city) => (
            <Link
              key={city.id}
              to={`/visibility/${city.slug}`}
              className="
                rounded-lg border border-gray-200 bg-white p-5 shadow-sm
                transition-colors hover:border-primary-500 hover:shadow-md
              "
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-master-navy">
                    {city.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {city.premium_slots_count} posiciones
                  </p>
                </div>

                {city.is_promo_mode && (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    {t('freeLabel')}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm font-medium text-primary-600">
                {city.is_promo_mode
                  ? 'Reclamar espacio destacado gratis →'
                  : `${city.currency} ${city.price} · ${city.duration_days} días →`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}