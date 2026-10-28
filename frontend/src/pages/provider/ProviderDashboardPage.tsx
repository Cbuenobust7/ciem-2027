import { useLanguage } from '@/i18n'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { BookingStatusBadge } from '@/components/cleaning/BookingStatusBadge'
import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { ProviderAccountGate } from '@/components/provider/ProviderAccountGate'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useProviderBookings } from '@/hooks/useCleaning'
import {
  BOOKING_STATUS_LABELS,
  addDays,
  endOfDayIso,
  formatDateTime,
  formatDayLabel,
  formatTime,
  startOfDayIso,
  todayIso,
} from '@/lib/cleaning'
import type { Booking, BookingStatus } from '@/types/api'

const STATUS_FILTERS: { value: '' | BookingStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'requested', label: BOOKING_STATUS_LABELS.requested },
  { value: 'confirmed', label: BOOKING_STATUS_LABELS.confirmed },
  { value: 'in_progress', label: BOOKING_STATUS_LABELS.in_progress },
  { value: 'completed', label: BOOKING_STATUS_LABELS.completed },
]

export default function ProviderDashboardPage() {
  const { t } = useLanguage()
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CleaningNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-master-navy">{t('providerPanel')}</h1>
        <p className="mt-1 text-gray-600">
          {t('dashboardSubtitle')}
        </p>
      </div>

      <ProviderAccountGate>
        {(accountId) => <AgendaPanel accountId={accountId} />}
      </ProviderAccountGate>
    </div>
  )
}

function AgendaPanel({ accountId }: { accountId: number }) {
  const { t } = useLanguage()
  const [weekStart, setWeekStart] = useState(todayIso())
  const [status, setStatus] = useState<'' | BookingStatus>('')

  // Los extremos se calculan en la zona del navegador y se envían en ISO con
  // zona: la agenda del backend no acepta un parámetro de zona horaria.
  const from = startOfDayIso(weekStart)
  const to = endOfDayIso(addDays(weekStart, 6))

  const { data, isLoading, isError } = useProviderBookings(accountId, {
    from,
    to,
    status: status || undefined,
  })

  const bookings = [...(data?.results ?? [])].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )

  const groups = new Map<string, Booking[]>()
  bookings.forEach((booking) => {
    const key = booking.resource
      ? `${booking.resource.name}`
      : 'Sin recurso asignado'
    const list = groups.get(key) ?? []
    list.push(booking)
    groups.set(key, list)
  })

  const pending = bookings.filter((booking) => booking.status === 'requested').length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          ← Semana anterior
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(todayIso())}>
          {t('today')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          {t('nextWeek')}
        </Button>
        <span className="text-sm text-gray-600">
          {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value || 'all'}
            type="button"
            onClick={() => setStatus(filter.value)}
            className={`rounded-full px-3 py-1 text-sm ${
              status === filter.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}

        {pending > 0 && (
          <span className="ml-2 rounded-full bg-yellow-100 px-3 py-1 text-sm text-yellow-800">
            {pending} por confirmar
          </span>
        )}
      </div>

      {isError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('dashboardLoadError')}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">
            No hay reservas en esta semana{status ? ' con ese estado' : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([resource, items]) => (
            <section key={resource}>
              <h2 className="mb-2 text-lg font-semibold text-master-navy">
                {resource}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {items.length} reserva{items.length === 1 ? '' : 's'}
                </span>
              </h2>

              <div className="space-y-2">
                {items.map((booking) => (
                  <div
                    key={booking.code}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-master-navy">
                          {formatTime(booking.start_at)} –{' '}
                          {formatTime(booking.end_at)}
                        </span>
                        <BookingStatusBadge status={booking.status} />
                        <span className="font-mono text-xs text-gray-500">
                          {booking.code}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-600">
                        {booking.service.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(booking.start_at)}
                      </p>
                    </div>

                    <Link to={`/provider/bookings/${booking.code}`} className="flex-shrink-0">
                      <Button variant="secondary" size="sm">
                        {t('open')}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
