import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useMyPurchases } from '@/hooks/useVisibility'
import type { VisibilityStatus } from '@/types/api'

function statusLabel(status: VisibilityStatus) {
  switch (status) {
    case 'PAID':
      return 'Activa'
    case 'PENDING':
      return 'Pendiente'
    case 'EXPIRED':
      return 'Expirada'
    case 'CANCELLED':
      return 'Cancelada'
  }
}

function statusClasses(status: VisibilityStatus) {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-700'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700'
    case 'EXPIRED':
      return 'bg-gray-100 text-gray-600'
    case 'CANCELLED':
      return 'bg-red-100 text-red-700'
  }
}

export default function MyVisibilityPage() {
  const { t } = useLanguage()
  const { data, isLoading, isError } = useMyPurchases()

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
          {t('spotsLoadError')}
        </h1>
        <Link
          to="/"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          ← Volver
        </Link>
      </div>
    )
  }

  const purchases = data.results

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-master-navy">
            {t('myFeaturedSpots')}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('myFeaturedSpotsSubtitle')}
          </p>
        </div>
        <Link
          to="/visibility"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          {t('buyAnotherSpot')}
        </Link>
      </header>

      {purchases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">
            {t('noSpotsYet')}
          </p>
          <div className="mt-4">
            <Link to="/visibility">
              <Button variant="primary" size="md">
                {t('viewAvailableSpots')}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div
              key={purchase.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-master-navy">
                    Espacio destacado en {purchase.city_name} · Posición #{purchase.position}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {purchase.is_promo
                      ? t('spotClaimedFree')
                      : `${purchase.currency} ${purchase.price}`}
                  </p>
                  {purchase.status === 'PAID' && (
                    <p className="mt-2 text-xs text-gray-500">
                      Activa desde{' '}
                      {new Date(purchase.starts_at).toLocaleDateString('es-PE')}{' '}
                      hasta{' '}
                      {new Date(purchase.ends_at).toLocaleDateString('es-PE')}
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses(purchase.status)}`}
                >
                  {statusLabel(purchase.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}