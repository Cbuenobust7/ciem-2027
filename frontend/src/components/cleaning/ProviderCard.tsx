import { Link } from 'react-router-dom'

import { useLanguage } from '@/i18n'
import {
  KIND_LABELS,
  PARTICIPATION_CLASSES,
  PARTICIPATION_LABELS,
} from '@/lib/cleaning'
import type { Provider } from '@/types/api'

export function ProviderCard({ provider }: { provider: Provider }) {
  const { t } = useLanguage()
  const shown = provider.service_areas.slice(0, 3)
  const rest = provider.service_areas.length - shown.length

  return (
    <Link
      to={`/cleaning/providers/${provider.id}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50">
          {provider.logo ? (
            <img
              src={provider.logo}
              alt={provider.display_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold text-primary-600">
              {provider.display_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-master-navy group-hover:text-primary-600">
            {provider.display_name}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
              {t(KIND_LABELS[provider.kind])}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${PARTICIPATION_CLASSES[provider.participation_status]}`}
            >
              {t(PARTICIPATION_LABELS[provider.participation_status])}
            </span>
            {provider.can_book && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                {t('book')}
              </span>
            )}
          </div>

          {provider.is_informative ? (
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">
              {provider.services_summary || t('informativeShort')}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              ★ {Number(provider.rating_avg).toFixed(1)}
              <span className="text-gray-400">
                {' '}
                · {provider.rating_count} reseña{provider.rating_count === 1 ? '' : 's'}
              </span>
            </p>
          )}

          {provider.is_informative && provider.service_categories.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {provider.service_categories.map((item) => item.name).join(', ')}
            </p>
          )}

          {shown.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Zonas: {shown.map((area) => area.district_label).join(', ')}
              {rest > 0 ? ` +${rest}` : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
