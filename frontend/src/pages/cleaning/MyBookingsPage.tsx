import { useLanguage, type TranslationKey } from '@/i18n'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { BookingStatusBadge } from '@/components/cleaning/BookingStatusBadge'
import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  useBookingAction,
  useMyBookings,
  useProviderSideIndex,
} from '@/hooks/useCleaning'
import {
  PAYMENT_STATUS_LABELS,
  cleaningErrorMessage,
  formatDateTime,
  formatMoney,
} from '@/lib/cleaning'
import type { Booking, BookingStatus } from '@/types/api'

const STATUS_FILTERS: { value: '' | BookingStatus; labelKey: TranslationKey }[] = [
  { value: '', labelKey: 'bookingStatusAll' },
  { value: 'requested', labelKey: 'bookingStatusRequested' },
  { value: 'confirmed', labelKey: 'bookingStatusConfirmed' },
  { value: 'in_progress', labelKey: 'bookingStatusInProgress' },
  { value: 'completed', labelKey: 'bookingStatusCompleted' },
  { value: 'cancelled', labelKey: 'bookingStatusCancelled' },
]

export default function MyBookingsPage() {
  const { t } = useLanguage()

  const location = useLocation()
  const [status, setStatus] = useState<'' | BookingStatus>('')
  const [page, setPage] = useState(1)

  const created = Boolean(
    (location.state as { created?: boolean } | null)?.created,
  )

  const providerIndex = useProviderSideIndex(true)
  const { data, isLoading, isError } = useMyBookings({
    status: status || undefined,
    page,
  })

  // `GET /api/cleaning/bookings/` sin filtro devuelve la unión cliente +
  // proveedor y el serializer no expone `customer`: se restan los códigos del
  // lado proveedor para quedarnos con las reservas como cliente.
  const providerCodes = new Set(providerIndex.data?.codes ?? [])
  const bookings = (data?.results ?? []).filter(
    (booking) => !providerCodes.has(booking.code),
  )
  const providerAccounts = providerIndex.data?.accounts ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <CleaningNav />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-master-navy">{t('myBookings')}</h1>
          <p className="mt-1 text-gray-600">
            {t('myBookingsSubtitle')}
          </p>
        </div>
        <Link to="/cleaning/providers">
          <Button variant="primary">{t('searchServices')}</Button>
        </Link>
      </div>

      {created && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {t('bookingCreatedNote')}
        </div>
      )}

      {providerAccounts.length > 0 && (
        <div className="mb-4 rounded border border-gray-200 bg-white p-3 text-sm text-gray-600">
          También gestionas {providerAccounts.length === 1 ? 'una cuenta' : `${providerAccounts.length} cuentas`} de
          proveedor.{' '}
          {providerAccounts.map((account) => (
            <Link
              key={account.id}
              to="/provider/dashboard"
              className="mr-2 text-primary-600 hover:underline"
            >
              {account.display_name}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value || 'all'}
            type="button"
            onClick={() => {
              setStatus(filter.value)
              setPage(1)
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              status === filter.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      {isError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('myBookingsLoadError')}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">
            No tienes reservas{status ? ' con ese estado' : ''}.
          </p>
          <Link to="/cleaning/providers" className="mt-4 inline-block">
            <Button variant="primary">{t('exploreProviders')}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingRow key={booking.code} booking={booking} />
          ))}
        </div>
      )}

      {data && (data.next || data.previous) && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            disabled={!data.previous}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            ← Anterior
          </Button>
          <span className="text-sm text-gray-600">{t('pageNumber', { page })}</span>
          <Button
            variant="secondary"
            disabled={!data.next}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  )
}

function BookingRow({ booking }: { booking: Booking }) {
  const { t } = useLanguage()
  const cancel = useBookingAction(booking.code)
  const canCancel =
    booking.status === 'requested' || booking.status === 'confirmed'

  return (
    <div className="card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span className="font-mono text-xs text-gray-500">{booking.code}</span>
            <span className="text-xs text-gray-500">
              {t(PAYMENT_STATUS_LABELS[booking.payment_status])}
            </span>
          </div>

          <p className="mt-2 font-semibold text-master-navy">
            {booking.service.title}
          </p>

          <p className="mt-1 text-sm text-gray-600">
            {formatDateTime(booking.start_at)} –{' '}
            {formatDateTime(booking.end_at)} · {booking.account.display_name}
          </p>

          <p className="mt-1 text-sm text-gray-600">
            {formatMoney(booking.price, booking.currency)}
            {Number(booking.deposit_amount) > 0
              ? ` · depósito ${formatMoney(booking.deposit_amount, booking.currency)}`
              : ''}
            {booking.resource ? ` · ${booking.resource.name}` : ''}
          </p>

          {booking.status === 'requested' && booking.hold_expires_at && (
            <p className="mt-2 text-xs text-yellow-700">
              El horario se libera si el proveedor no confirma antes de{' '}
              {formatDateTime(booking.hold_expires_at)}.
            </p>
          )}

          {cancel.isError && (
            <p className="mt-2 text-xs text-red-600">
              {cleaningErrorMessage(cancel.error)}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <Link to={`/listings/${booking.service.listing}`}>
            <Button variant="ghost" size="sm">
              {t('viewService')}
            </Button>
          </Link>

          {canCancel && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={cancel.isPending}
              onClick={() => {
                if (
                  confirm(
                    `¿Cancelar la reserva ${booking.code}? Se avisará al proveedor.`,
                  )
                ) {
                  cancel.mutate({ action: 'cancel', body: { reason: 'customer' } })
                }
              }}
            >
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
