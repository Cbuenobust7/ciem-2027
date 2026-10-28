import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { categoriesApi } from '@/api/categories'
import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { ProviderAccountGate } from '@/components/provider/ProviderAccountGate'
import {
  EMPTY_FORM,
  ServiceFormFields,
  basePayload,
  cleaningSubcategories,
  type ServiceFormState,
} from '@/components/provider/ServiceFormFields'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  useProviderManagedServices,
  useUpdateService,
} from '@/hooks/useCleaning'
import { useListing, useSubmitListingReview } from '@/hooks/useListings'
import { cleaningErrorMessage, formatMoney } from '@/lib/cleaning'

export default function ProviderServicesPage() {
  const { t } = useLanguage()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <CleaningNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-master-navy">{t('myServices')}</h1>
        <p className="mt-1 text-gray-600">
          {t('servicesPageSubtitle')}
        </p>
      </div>

      <ProviderAccountGate>
        {(accountId) => <ServicesPanel accountId={accountId} />}
      </ProviderAccountGate>
    </div>
  )
}

function ServicesPanel({ accountId }: { accountId: number }) {
  const { t } = useLanguage()
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data, isLoading, isError } = useProviderManagedServices(accountId)
  const services = data?.results ?? []
  const submitReview = useSubmitListingReview()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {services.length} servicio{services.length === 1 ? '' : 's'} publicado
          {services.length === 1 ? '' : 's'}
        </p>
        <Link to="/provider/services/new">
          <Button variant="primary" size="sm">
            + Crear servicio
          </Button>
        </Link>
      </div>

      {isError && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('servicesPanelLoadError')}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : services.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">
            {t('noServicesPublished')}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {t('serviceCreatesListingNote')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.listing_id} className="card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-master-navy">{service.title}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatMoney(service.price, service.currency)} ·{' '}
                    {service.duration_minutes} min
                    <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">{service.status}</span>
                    {service.status === 'rejected' && service.rejection_reason && (
                      <span className="ml-2 text-xs text-red-700">{service.rejection_reason}</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  <Link to={`/listings/${service.listing_id}`}>
                    <Button variant="ghost" size="sm">
                      {t('viewListingShort')}
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setEditingId((current) =>
                        current === service.listing_id ? null : service.listing_id,
                      )
                    }
                  >
                    {editingId === service.listing_id ? 'Cerrar' : 'Editar'}
                  </Button>
                  {(service.status === 'draft' || service.status === 'rejected') && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={submitReview.isPending}
                      onClick={() => submitReview.mutate(service.listing_id)}
                    >
                      {t('stepSubmitReview')}
                    </Button>
                  )}
                </div>
              </div>

              {editingId === service.listing_id && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <EditServiceForm
                    listingId={service.listing_id}
                    onClose={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditServiceForm({
  listingId,
  onClose,
}: {
  listingId: number
  onClose: () => void
}) {
  const { t } = useLanguage()
  const { data: listing, isLoading } = useListing(listingId)
  const [form, setForm] = useState<ServiceFormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const updateService = useUpdateService()

  const { data: tree } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => categoriesApi.tree(),
  })
  const subcategories = cleaningSubcategories(tree)

  useEffect(() => {
    if (!listing) return
    const details = listing.service_details
    if (!details) {
      setForm(EMPTY_FORM)
      return
    }
    setForm({
      title: listing.title,
      description: listing.description,
      price: listing.price ?? '',
      currency: listing.currency,
      category: listing.category ? String(listing.category) : '',
      location: listing.location,
      duration_minutes: String(details.duration_minutes),
      buffer_minutes: String(details.buffer_minutes),
      capacity: String(details.capacity),
      min_notice_hours: String(details.min_notice_hours),
      max_horizon_days: String(details.max_horizon_days),
      cancellation_hours: String(details.cancellation_hours),
      max_per_day: details.max_per_day === null ? '' : String(details.max_per_day),
      requires_deposit: details.requires_deposit,
      deposit_amount: details.deposit_amount,
      resolves_address: details.resolves_address,
      is_instant: details.is_instant,
      is_active: details.is_active,
    })
  }, [listing])

  if (isLoading || !form) {
    return <LoadingSpinner size="md" />
  }

  async function handleSubmit() {
    setError(null)
    try {
      await updateService.mutateAsync({
        listingId,
        payload: basePayload(form!),
      })
      onClose()
    } catch (err) {
      setError(cleaningErrorMessage(err))
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ServiceFormFields
        value={form}
        onChange={(patch) => setForm((current) => (current ? { ...current, ...patch } : current))}
        subcategories={subcategories}
      />

      <div className="mt-2 flex gap-2">
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={updateService.isPending}
        >
          {t('saveChanges')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  )
}

