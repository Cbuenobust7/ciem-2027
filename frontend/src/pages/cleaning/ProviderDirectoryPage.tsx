import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useLanguage, type TranslationKey } from '@/i18n'
import { categoriesApi } from '@/api/categories'
import { visibilityApi } from '@/api/visibility'
import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { ProviderCard } from '@/components/cleaning/ProviderCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useProviderDirectory } from '@/hooks/useCleaning'

const KIND_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: '', labelKey: 'kindAll' },
  { value: 'individual', labelKey: 'individual' },
  { value: 'company', labelKey: 'company' },
]

const RATING_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: '', labelKey: 'anyone' },
  { value: '3', labelKey: 'rating3Plus' },
  { value: '4', labelKey: 'rating4Plus' },
  { value: '4.5', labelKey: 'rating45Plus' },
]

const ORDERING_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: '-rating_avg', labelKey: 'bestRated' },
  { value: '-rating_count', labelKey: 'moreReviews' },
  { value: 'display_name', labelKey: 'nameAsc' },
  { value: '-display_name', labelKey: 'nameDesc' },
]

const MODALITY_OPTIONS: Array<{
  value: 'all' | 'directory' | 'partners'
  labelKey: TranslationKey
}> = [
  { value: 'all', labelKey: 'modalityAll' },
  { value: 'directory', labelKey: 'modalityDirectory' },
  { value: 'partners', labelKey: 'modalityPartners' },
]

export default function ProviderDirectoryPage() {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [modality, setModality] = useState<'all' | 'directory' | 'partners'>('all')
  const [district, setDistrict] = useState('')
  const [serviceCategory, setServiceCategory] = useState('')
  const [city, setCity] = useState('')
  const [minRating, setMinRating] = useState('')
  const [kind, setKind] = useState('')
  const [ordering, setOrdering] = useState('-rating_avg')
  const [page, setPage] = useState(1)

  const { data: tree } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => categoriesApi.tree(),
  })
  const limpieza = tree?.find((item) => item.slug === 'limpieza')
  const subcategories = limpieza?.children ?? []

  const { data: citiesData } = useQuery({
    queryKey: ['visibility', 'cities'],
    queryFn: () => visibilityApi.listCities(),
  })
  const cities = citiesData?.results ?? []

  const { data, isLoading, isError } = useProviderDirectory({
    q: query.trim() || undefined,
    modality,
    district: district.trim() || undefined,
    service_category: serviceCategory || undefined,
    city: city ? Number(city) : undefined,
    min_rating: minRating ? Number(minRating) : undefined,
    kind: kind || undefined,
    ordering: ordering || undefined,
    page,
  })

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  const providers = data?.results ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <CleaningNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-master-navy">
          {t('directoryTitle')}
        </h1>
        <p className="mt-1 text-gray-600">{t('directorySubtitle')}</p>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label={t('searchByName')}
            name="q"
            placeholder={t('searchByNamePlaceholder')}
            value={query}
            onChange={(event) => resetPage(setQuery)(event.target.value)}
          />

          <div className="mb-4">
            <label className="label" htmlFor="modality">
              {t('modality')}
            </label>
            <select
              id="modality"
              className="input"
              value={modality}
              onChange={(event) =>
                resetPage(setModality)(
                  event.target.value as 'all' | 'directory' | 'partners',
                )
              }
            >
              {MODALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={t('district')}
            name="district"
            placeholder="p. ej. san-borja"
            value={district}
            onChange={(event) => resetPage(setDistrict)(event.target.value)}
            hint={t('slugHint')}
          />

          {cities.length > 0 && (
            <div className="mb-4">
              <label className="label" htmlFor="city">
                {t('city')}
              </label>
              <select
                id="city"
                className="input"
                value={city}
                onChange={(event) => resetPage(setCity)(event.target.value)}
              >
                <option value="">{t('all')}</option>
                {cities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="label" htmlFor="service_category">
              {t('serviceCategory')}
            </label>
            <select
              id="service_category"
              className="input"
              value={serviceCategory}
              onChange={(event) =>
                resetPage(setServiceCategory)(event.target.value)
              }
            >
              <option value="">{t('all')}</option>
              {subcategories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="min_rating">
              {t('rating')}
            </label>
            <select
              id="min_rating"
              className="input"
              value={minRating}
              onChange={(event) => resetPage(setMinRating)(event.target.value)}
            >
              {RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="kind">
              {t('type')}
            </label>
            <select
              id="kind"
              className="input"
              value={kind}
              onChange={(event) => resetPage(setKind)(event.target.value)}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="ordering">
              {t('ordering')}
            </label>
            <select
              id="ordering"
              className="input"
              value={ordering}
              onChange={(event) => resetPage(setOrdering)(event.target.value)}
            >
              {ORDERING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('directoryLoadError')}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : providers.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-700">{t('directoryEmpty')}</p>
          <p className="mt-2 text-sm text-gray-500">{t('directoryNote')}</p>
          <p className="mt-4 text-sm text-gray-500">
            ¿Ofreces limpieza?{' '}
            <Link
              to="/provider/services"
              className="text-primary-600 hover:underline"
            >
              {t('publishService')}
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600">
            {t('providersFound', { count: data?.count ?? 0 })}
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>

          {data && (data.next || data.previous) && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                disabled={!data.previous}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t('previous')}
              </Button>
              <span className="text-sm text-gray-600">
                {t('providerPageCount', { page, count: data.count })}
              </span>
              <Button
                variant="secondary"
                disabled={!data.next}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
