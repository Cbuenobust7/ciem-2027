import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ClaimModal } from '@/components/cleaning/ClaimModal'
import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { CorrectionModal } from '@/components/cleaning/CorrectionModal'
import { ServiceCard } from '@/components/cleaning/ServiceCard'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useProvider } from '@/hooks/useCleaning'
import { useLanguage } from '@/i18n'
import {
  KIND_LABELS,
  PARTICIPATION_CLASSES,
  PARTICIPATION_LABELS,
  formatMoney,
} from '@/lib/cleaning'
import type { ProviderDetail } from '@/types/api'

function whatsappHref(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

function contactLinkClass(): string {
  return 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-primary-700 hover:border-primary-300 hover:bg-primary-50'
}

export default function ProviderDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const providerId = id ? Number(id) : undefined
  const { data: provider, isLoading, isError } = useProvider(providerId)
  const [claimOpen, setClaimOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !provider) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">
          {t('providerNotFound')}
        </h1>
        <p className="mt-2 text-gray-600">{t('providerUnavailable')}</p>
        <Link
          to="/cleaning/providers"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          ← {t('cleaningDirectory')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <CleaningNav />

      <nav className="text-sm text-gray-500">
        <Link to="/cleaning/providers" className="hover:text-primary-600">
          {t('cleaningDirectory')}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{provider.display_name}</span>
      </nav>

      {provider.is_informative && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-semibold">{t('informativeShort')}</p>
          <p className="mt-1">{t('informativeNotice')}</p>
        </div>
      )}

      {!provider.is_informative && !provider.can_book && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t('notBookableNotice')}
        </div>
      )}

      <div className="card mt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50">
            {provider.logo ? (
              <img
                src={provider.logo}
                alt={provider.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-primary-600">
                {provider.display_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-master-navy">
              {provider.display_name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                {t(KIND_LABELS[provider.kind])}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ${PARTICIPATION_CLASSES[provider.participation_status]}`}
              >
                {t(PARTICIPATION_LABELS[provider.participation_status])}
              </span>
              {!provider.is_informative && (
                <span className="text-gray-600">
                  ★ {Number(provider.rating_avg).toFixed(1)} ·{' '}
                  {provider.rating_count} reseña
                  {provider.rating_count === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {provider.description && (
              <p className="mt-3 whitespace-pre-wrap text-gray-700">
                {provider.description}
              </p>
            )}

            <div className="mt-3 space-y-1 text-sm text-gray-600">
              {provider.address && (
                <p>
                  {t('address')}: {provider.address}
                </p>
              )}
              {provider.timezone && (
                <p className="text-gray-500">
                  {t('scheduleTimezone')}: {provider.timezone}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {provider.phone && (
                <a href={`tel:${provider.phone}`} className={contactLinkClass()}>
                  {t('contactCompany')}: {provider.phone}
                </a>
              )}
              {provider.contact_email && (
                <a
                  href={`mailto:${provider.contact_email}`}
                  className={contactLinkClass()}
                >
                  {t('email')}: {provider.contact_email}
                </a>
              )}
              {provider.website && (
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLinkClass()}
                >
                  {t('visitWebsite')}
                </a>
              )}
              {provider.whatsapp && whatsappHref(provider.whatsapp) && (
                <a
                  href={whatsappHref(provider.whatsapp) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLinkClass()}
                >
                  {t('whatsapp')}
                </a>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {provider.participation_status === 'directory' && (
                <Button variant="primary" size="sm" onClick={() => setClaimOpen(true)}>
                  {t('claimThisCard')}
                </Button>
              )}
              {provider.participation_status === 'claimed' && (
                <p className="text-sm text-amber-800">{t('claimPendingNotice')}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCorrectionOpen(true)}
              >
                {t('correctionTitle')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-master-navy">{t('services')}</h2>

          {provider.is_informative ? (
            <div className="card mt-3">
              {provider.service_categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {provider.service_categories.map((category) => (
                    <span
                      key={category.id}
                      className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 whitespace-pre-wrap text-gray-700">
                {provider.services_summary || t('noServicesDirectory')}
              </p>
            </div>
          ) : provider.services.length === 0 ? (
            <div className="card mt-3">
              <p className="text-gray-600">{t('noServicesYet')}</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {provider.services.map((service) => (
                <ServiceCard
                  key={service.listing_id}
                  service={service}
                  canBook={provider.can_book}
                />
              ))}
            </div>
          )}

          {!provider.is_informative && (
            <div className="card mt-6">
              <h2 className="text-xl font-bold text-master-navy">{t('reviews')}</h2>
              <p className="mt-2 text-sm text-gray-600">
                ★ {Number(provider.rating_avg).toFixed(1)} de 5 con{' '}
                {provider.rating_count} reseña
                {provider.rating_count === 1 ? '' : 's'}.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t('reviewsPhase3Note')}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <h2 className="text-xl font-bold text-master-navy">
            {t('coverageAreas')}
          </h2>

          {provider.service_areas.length === 0 ? (
            <div className="card mt-3">
              <p className="text-gray-600">{t('noCoverageAreas')}</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {provider.service_areas.map((area) => (
                <li
                  key={area.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
                >
                  <p className="font-medium text-master-navy">
                    {area.district_label}
                  </p>
                  <p className="text-gray-500">{area.city_name}</p>
                  {Number(area.extra_fee) > 0 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Recargo de zona: {formatMoney(area.extra_fee, 'PEN')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ClaimModal
        provider={provider as ProviderDetail}
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
      />
      <CorrectionModal
        provider={provider as ProviderDetail}
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
      />
    </div>
  )
}
