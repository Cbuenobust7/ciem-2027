import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAvailability } from '@/hooks/useCleaning'
import { AVAILABILITY_REASON_LABELS, addDays, todayIso } from '@/lib/cleaning'
import { useBookingWizardStore } from '@/stores/bookingWizard'
import type { ServiceDetails } from '@/types/api'
import { useLanguage } from '@/i18n'

/** Tope de ventana, igual que en el asistente: el backend limita por `max_horizon_days`. */
const MAX_WINDOW_DAYS = 60

/** 'YYYY-MM' + delta meses. Aritmética entera de meses, sin objetos Date. */
function addMonths(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split('-').map(Number)
  const total = year * 12 + (month - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/**
 * Calendario del cliente en la ficha del anuncio (Entrega D).
 *
 * Muestra el mes con los días reservables del servicio. Los días sin hueco salen
 * deshabilitados y con el motivo que devuelve la API en el `title`. Al elegir un
 * día se precarga el asistente (`setDate` limpia el hueco anterior) y se navega a
 * la reserva, que arranca en el paso 1 con esa fecha ya puesta.
 *
 * No necesita backend: usa `GET /api/cleaning/providers/{id}/availability/`.
 */
export function AvailabilityCalendar({
  listingId,
  details,
}: {
  listingId: number
  details: ServiceDetails
}) {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const setDate = useBookingWizardStore((s) => s.setDate)
  const setStep = useBookingWizardStore((s) => s.setStep)

  const today = todayIso()
  const horizonEnd = addDays(today, Math.min(details.max_horizon_days ?? 0, MAX_WINDOW_DAYS))
  const [month, setMonth] = useState(() => today.slice(0, 7))

  // El mes visible se recorta al horizonte de reserva del servicio.
  const monthStart = `${month}-01`
  const from = monthStart < today ? today : monthStart
  const nextMonth = addMonths(month, 1)
  const monthEnd = addDays(`${nextMonth}-01`, -1)
  const to = monthEnd > horizonEnd ? horizonEnd : monthEnd
  const inWindow = from <= to

  const { data, isLoading } = useAvailability(
    details.provider_account,
    inWindow ? { service: listingId, from, to } : undefined,
  )

  const days = useMemo(() => data?.days ?? [], [data])

  // Cabeceras de la semana: se derivan de Intl, que ya respeta el idioma activo.
  const weekdays = useMemo(() => {
    const locale = language === 'en' ? 'en-GB' : 'es-PE'
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    // El backend usa 0 = lunes; se toma un lunes real como referencia.
    const monday = new Date(Date.UTC(2024, 0, 1))
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(monday.getTime() + index * 86400000)),
    )
  }, [language])

  const monthLabel = useMemo(() => {
    const locale = language === 'en' ? 'en-GB' : 'es-PE'
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(`${month}-01T12:00:00Z`),
    )
  }, [month, language])

  // Relleno inicial: `weekday` 0 = lunes, así que la rejilla empieza en lunes.
  const lead = days.length ? days[0].weekday : 0

  const choose = (date: string) => {
    setDate(date)
    setStep(1)
    navigate(`/cleaning/book/${listingId}`)
  }

  return (
    <div className="mt-4 rounded-lg border border-primary-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-primary-700 hover:bg-primary-50 disabled:opacity-40"
          onClick={() => setMonth(addMonths(month, -1))}
          disabled={addMonths(month, -1) < today.slice(0, 7)}
        >
          ←
        </button>
        <p className="text-sm font-bold capitalize text-master-navy">{monthLabel}</p>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-primary-700 hover:bg-primary-50 disabled:opacity-40"
          onClick={() => setMonth(addMonths(month, 1))}
          disabled={`${addMonths(month, 1)}-01` > horizonEnd}
        >
          →
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
        {weekdays.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, index) => (
          <span key={`hueco-${index}`} />
        ))}
        {days.map((day) => {
          const free = day.slots.length > 0
          const reason = day.reason ? t(AVAILABILITY_REASON_LABELS[day.reason]) ?? day.reason : ''
          return (
            <button
              key={day.date}
              type="button"
              disabled={!free}
              title={free ? t('book') : reason || t('noAvailability')}
              onClick={() => choose(day.date)}
              className={
                free
                  ? 'rounded bg-primary-50 py-1 text-sm font-bold text-primary-800 hover:bg-primary-100'
                  : 'rounded bg-gray-50 py-1 text-sm text-gray-400'
              }
            >
              {Number(day.date.slice(-2))}
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {isLoading ? t('loading') : inWindow ? t('chooseDay') : t('noAvailability')}
      </p>
    </div>
  )
}
