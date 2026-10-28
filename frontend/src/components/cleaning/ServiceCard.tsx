import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/cleaning'
import type { ProviderServiceSummary } from '@/types/api'

/**
 * Servicio dentro del perfil del proveedor. Se alimenta de
 * `ProviderServiceSummary` (listing_id + título + precio + duración), que no es
 * un `ListingListItem`: por eso no se reutiliza `ListingCard` aquí — le faltan
 * los campos que esa tarjeta pinta.
 */
export function ServiceCard({
  service,
  canBook = true,
}: {
  service: ProviderServiceSummary
  canBook?: boolean
}) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="font-medium text-master-navy">{service.title}</p>
        <p className="mt-1 text-sm text-gray-600">
          {formatMoney(service.price, service.currency)} · {service.duration_minutes} min
          {service.is_active ? '' : ' · inactivo'}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <Link to={`/listings/${service.listing_id}`}>
          <Button variant="ghost" size="sm">
            {t('viewListingShort')}
          </Button>
        </Link>
        {canBook ? (
          <Link to={`/cleaning/book/${service.listing_id}`}>
            <Button variant="primary" size="sm" disabled={!service.is_active}>
              {t('book')}
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            {t('book')}
          </Button>
        )}
      </div>
    </div>
  )
}
