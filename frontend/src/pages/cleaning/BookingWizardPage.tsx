import { useLanguage, type TranslationKey } from '@/i18n'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAvailability, useCreateBooking, useProvider } from '@/hooks/useCleaning'
import { useListing } from '@/hooks/useListings'
import {
  AVAILABILITY_REASON_LABELS,
  addDays,
  cleaningError,
  cleaningErrorMessage,
  formatDayLabel,
  formatMoney,
  formatTime,
  todayIso,
} from '@/lib/cleaning'
import { useAuthStore } from '@/stores/auth'
import { useBookingWizardStore } from '@/stores/bookingWizard'

/** Tope defensivo: no pedir ventanas enormes aunque el horizonte sea amplio. */
const MAX_WINDOW_DAYS = 60

const STEP_LABELS: readonly TranslationKey[] = ['stepDate', 'stepTime', 'stepAddress', 'stepConfirm']

export default function BookingWizardPage() {
  const { t } = useLanguage()
  const { listingId: listingIdParam } = useParams<{ listingId: string }>()
  const listingId = listingIdParam ? Number(listingIdParam) : undefined
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data: listing, isLoading, isError } = useListing(listingId)
  const details = listing?.service_details ?? null
  const accountId = details?.provider_account
  const { data: provider } = useProvider(accountId)

  const step = useBookingWizardStore((s) => s.step)
  const date = useBookingWizardStore((s) => s.date)
  const slot = useBookingWizardStore((s) => s.slot)
  const address = useBookingWizardStore((s) => s.address)
  const district = useBookingWizardStore((s) => s.district)
  const districtLabel = useBookingWizardStore((s) => s.districtLabel)
  const city = useBookingWizardStore((s) => s.city)
  const notes = useBookingWizardStore((s) => s.notes)
  const idempotencyKey = useBookingWizardStore((s) => s.idempotencyKey)
  const start = useBookingWizardStore((s) => s.start)
  const setStep = useBookingWizardStore((s) => s.setStep)
  const setDate = useBookingWizardStore((s) => s.setDate)
  const setSlot = useBookingWizardStore((s) => s.setSlot)
  const setAddress = useBookingWizardStore((s) => s.setAddress)
  const setArea = useBookingWizardStore((s) => s.setArea)
  const setNotes = useBookingWizardStore((s) => s.setNotes)
  const reset = useBookingWizardStore((s) => s.reset)

  const [error, setError] = useState<string | null>(null)
  const createBooking = useCreateBooking()

  useEffect(() => {
    if (listingId) start(listingId)
  }, [listingId, start])

  const windowFrom = todayIso()
  const windowTo = addDays(
    windowFrom,
    Math.min(details?.max_horizon_days ?? 0, MAX_WINDOW_DAYS),
  )
  const availabilityQuery = useMemo(
    () =>
      details && listingId
        ? { service: listingId, from: windowFrom, to: windowTo }
        : undefined,
    [details, listingId, windowFrom, windowTo],
  )

  const {
    data: availability,
    isLoading: loadingAvailability,
    isError: availabilityFailed,
    refetch,
  } = useAvailability(accountId, availabilityQuery)

  const timezone = availability?.timezone
  const chosenDay = availability?.days.find((day) => day.date === date)
  const slots = chosenDay?.slots ?? []
  const areas = provider?.service_areas ?? []
  const selectedArea = areas.find((area) => area.district === district)

  // ---------------- estados de carga / error del anuncio ----------------

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">{t('listingNotFound')}</h1>
        <Link to="/cleaning/providers" className="mt-6 inline-block text-primary-600 hover:underline">
          ← Volver al directorio
        </Link>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">{t('notBookable')}</h1>
        <p className="mt-2 text-gray-600">{t('onlyCleaningBookable')}</p>
        <Link to={`/listings/${listing.id}`} className="mt-6 inline-block text-primary-600 hover:underline">
          ← Ver el anuncio
        </Link>
      </div>
    )
  }

  async function handleConfirm() {
    setError(null)

    if (!listingId) return
    if (!slot) {
      setError('Elige un horario antes de confirmar.')
      return
    }
    if (!address.trim()) {
      setError(t('addressRequired'))
      return
    }
    if (!district) {
      setError(t('chooseDistrictOfAddress'))
      return
    }

    try {
      await createBooking.mutateAsync({
        payload: {
          listing: listingId,
          start_at: slot.start,
          resource: slot.resource_id,
          city,
          address: address.trim(),
          district,
          customer_notes: notes.trim(),
        },
        idempotencyKey,
      })
      reset()
      navigate('/my-bookings', { state: { created: true } })
    } catch (err) {
      const api = cleaningError(err)
      setError(cleaningErrorMessage(err))
      if (api?.code === 'slot_unavailable' || api?.code === 'hold_expired') {
        await refetch()
        setStep(2)
      }
    }
  }

  const total = listing.price
  const zoneFee = selectedArea ? Number(selectedArea.extra_fee) : 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <CleaningNav />

      <nav className="text-sm text-gray-500">
        <Link to="/cleaning/providers" className="hover:text-primary-600">{t('directory')}</Link>
        {provider && (
          <>
            <span className="mx-2">/</span>
            <Link
              to={`/cleaning/providers/${provider.id}`}
              className="hover:text-primary-600"
            >
              {provider.display_name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-gray-700">{listing.title}</span>
      </nav>

      <h1 className="mt-4 text-2xl font-bold text-master-navy">
        Reservar: {listing.title}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {listing.currency} {listing.price ?? '—'} · {details.duration_minutes} min
        {provider ? ` · ${provider.display_name}` : ''}
      </p>

      {!details.is_active && (
        <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">{t('serviceInactiveWarning')}<code className="mx-1">service_inactive</code>.
        </div>
      )}

      {provider && provider.verification_status !== 'verified' && (
        <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">{t('providerNotVerifiedWarning')}<code className="mx-1">provider_not_verified</code>.
        </div>
      )}

      {/* Pasos */}
      <ol className="mt-6 flex flex-wrap gap-2 text-sm">
        {STEP_LABELS.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3 | 4
          const active = step === number
          const done = step > number
          return (
            <li
              key={t(label)}
              className={`rounded-full px-3 py-1 ${
                active
                  ? 'bg-primary-600 text-white'
                  : done
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {number}. {label}
            </li>
          )
        })}
      </ol>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mt-4">
        {/* ---------------- Paso 1: fecha ---------------- */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-master-navy">{t('chooseDay')}</h2>
            <p className="mt-1 text-sm text-gray-600">
              Antelación mínima: {details.min_notice_hours} h · horizonte de{' '}
              {details.max_horizon_days} días.
            </p>

            {loadingAvailability ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="md" />
              </div>
            ) : availabilityFailed ? (
              <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No se pudo consultar la disponibilidad.{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void refetch()}
                >{t('retry')}</button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(availability?.days ?? []).map((day) => {
                  const hasSlots = day.slots.length > 0
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={!hasSlots}
                      onClick={() => {
                        setDate(day.date)
                        setStep(2)
                      }}
                      className={`rounded-lg border p-3 text-left text-sm ${
                        hasSlots
                          ? 'border-gray-200 bg-white hover:border-primary-400 hover:bg-primary-50'
                          : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                      }`}
                    >
                      <span className="block font-medium capitalize">
                        {formatDayLabel(day.date, timezone)}
                      </span>
                      <span className="mt-1 block text-xs">
                        {hasSlots
                          ? `${day.slots.length} horario${day.slots.length === 1 ? '' : 's'}`
                          : (t(AVAILABILITY_REASON_LABELS[day.reason ?? '']) ??
                            day.reason ??
                            'Sin horarios')}
                      </span>
                    </button>
                  )
                })}

                {(availability?.days.length ?? 0) === 0 && (
                  <p className="col-span-full text-sm text-gray-600">
                    El proveedor no publicó disponibilidad para los próximos{' '}
                    {details.max_horizon_days} días.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Paso 2: horario ---------------- */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-master-navy">{t('chooseTime')}</h2>
            {date && (
              <p className="mt-1 text-sm capitalize text-gray-600">
                {formatDayLabel(date, timezone)}
              </p>
            )}

            {slots.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">{t('noSlotsThatDay')}</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {slots.map((item) => (
                  <button
                    key={`${item.start}-${item.resource_id}`}
                    type="button"
                    onClick={() => {
                      setSlot(item)
                      setStep(3)
                    }}
                    className={`rounded-lg border p-3 text-left text-sm ${
                      slot !== null && slot.start === item.start && slot.resource_id === item.resource_id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-primary-400 hover:bg-primary-50'
                    }`}
                  >
                    <span className="block font-medium text-master-navy">
                      {formatTime(item.start, timezone)} –{' '}
                      {formatTime(item.end, timezone)}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {item.resource_name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                ← Cambiar día
              </Button>
              <Button
                variant="secondary"
                onClick={() => void refetch()}
                isLoading={loadingAvailability}
              >{t('refreshSlots')}</Button>
            </div>
          </div>
        )}

        {/* ---------------- Paso 3: dirección ---------------- */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-master-navy">{t('whereIsService')}</h2>

            <div className="mt-4">
              <label className="label" htmlFor="district">{t('district')}</label>
              <select
                id="district"
                className="input"
                value={district}
                onChange={(event) => {
                  const area = areas.find(
                    (item) => item.district === event.target.value,
                  )
                  setArea({
                    district: event.target.value,
                    districtLabel: area?.district_label ?? event.target.value,
                    city: area?.city ?? null,
                  })
                }}
              >
                <option value="">{t('chooseDistrict')}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.district}>
                    {area.district_label}
                    {Number(area.extra_fee) > 0
                      ? ` (+${formatMoney(area.extra_fee, listing.currency)})`
                      : ''}
                  </option>
                ))}
              </select>
              {areas.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">{t('providerNoZonesNote')}</p>
              )}
            </div>

            <Input
              label={t('address')}
              name="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={t('addressPlaceholder')}
              hint={t('addressReferenceHint')}
            />

            <div className="mb-4">
              <label className="label" htmlFor="notes">{t('notesForProvider')}</label>
              <textarea
                id="notes"
                className="input"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t('notesPlaceholder')}
              />
            </div>

            {zoneFee > 0 && (
              <p className="mb-4 text-sm text-gray-600">
                Recargo por zona: {formatMoney(selectedArea?.extra_fee ?? '0', listing.currency)}{' '}
                (lo aplica el servidor al calcular el precio).
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Cambiar horario
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setError(null)
                  if (!address.trim()) {
                    setError(t('addressRequired'))
                    return
                  }
                  if (!district) {
                    setError(t('chooseDistrictOfAddress'))
                    return
                  }
                  setStep(4)
                }}
              >{t('continueArrow')}</Button>
            </div>
          </div>
        )}

        {/* ---------------- Paso 4: confirmar ---------------- */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-master-navy">{t('confirmBookingTitle')}</h2>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('service')}</dt>
                <dd className="text-right font-medium text-master-navy">
                  {listing.title}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('provider')}</dt>
                <dd className="text-right text-master-navy">
                  {provider?.display_name ?? `Cuenta #${accountId}`}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('dateAndTime')}</dt>
                <dd className="text-right text-master-navy">
                  {slot
                    ? `${formatDayLabel(slot.start.slice(0, 10), timezone)} · ${formatTime(slot.start, timezone)}–${formatTime(slot.end, timezone)}`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('address')}</dt>
                <dd className="text-right text-master-navy">
                  {address}
                  {districtLabel ? `, ${districtLabel}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t('price')}</dt>
                <dd className="text-right font-medium text-master-navy">
                  {formatMoney(total, listing.currency)}
                </dd>
              </div>
              {details.requires_deposit && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('deposit')}</dt>
                  <dd className="text-right text-master-navy">
                    {formatMoney(details.deposit_amount, listing.currency)}
                  </dd>
                </div>
              )}
              {notes.trim() && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{t('notes')}</dt>
                  <dd className="text-right text-master-navy">{notes}</dd>
                </div>
              )}
            </dl>

            <p className="mt-4 text-xs text-gray-500">
              La reserva se solicita sin pago. El proveedor la confirma y el cobro
              se coordina aparte (§ADR-08). Cancelación gratuita hasta{' '}
              {details.cancellation_hours} h antes.
            </p>

            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>
                ← Volver
              </Button>

              {isAuthenticated ? (
                <Button
                  variant="primary"
                  onClick={handleConfirm}
                  isLoading={createBooking.isPending}
                  disabled={!slot}
                >{t('confirmBooking')}</Button>
              ) : (
                <Link to="/login">
                  <Button variant="primary">{t('loginToBook')}</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
