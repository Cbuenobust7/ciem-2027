import { useLanguage, type TranslationKey } from '@/i18n'
import { Link, useParams } from 'react-router-dom'

import { BookingStatusBadge } from '@/components/cleaning/BookingStatusBadge'
import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useBooking, useBookingAction } from '@/hooks/useCleaning'
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  cleaningErrorMessage,
  formatDateTime,
  formatMoney,
} from '@/lib/cleaning'
import type {
  BookingAction,
  BookingPaymentStatus,
  BookingStatus,
} from '@/types/api'

interface ActionDef {
  action: BookingAction
  label: string
  variant: 'primary' | 'secondary' | 'danger'
  detailPrompt?: string
}

/**
 * Transiciones que el proveedor puede disparar según el estado (§4.1). El
 * backend vuelve a autorizar con `ProviderMembership`, así que una acción no
 * permitida responde 403 `forbidden_role` y se muestra tal cual.
 */
type TFunc = (key: TranslationKey, values?: Record<string, string | number>) => string

function actionsFor(
  t: TFunc,
  status: BookingStatus,
  paymentStatus: BookingPaymentStatus,
): ActionDef[] {
  switch (status) {
    case 'requested':
      return [
        { action: 'confirm', label: t('actionConfirm'), variant: 'primary' },
        {
          action: 'decline',
          label: t('actionDecline'),
          variant: 'danger',
          detailPrompt: t('reasonDecline'),
        },
        {
          action: 'cancel',
          label: t('cancel'),
          variant: 'secondary',
          detailPrompt: t('reasonCancel'),
        },
      ]
    case 'confirmed':
      return [
        { action: 'start', label: t('actionStart'), variant: 'primary' },
        {
          action: 'cancel',
          label: t('cancel'),
          variant: 'secondary',
          detailPrompt: t('reasonCancel'),
        },
      ]
    case 'in_progress':
      return [{ action: 'complete', label: t('actionComplete'), variant: 'primary' }]
    case 'completed':
      return paymentStatus === 'paid'
        ? []
        : [{ action: 'mark-paid', label: t('actionMarkPaid'), variant: 'primary' }]
    default:
      return []
  }
}

export default function ProviderBookingDetailPage() {
  const { t } = useLanguage()

  const { code } = useParams<{ code: string }>()
  const { data: booking, isLoading, isError } = useBooking(code)
  const runAction = useBookingAction(code)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !booking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">{t('bookingNotFound')}</h1>
        <p className="mt-2 text-gray-600">
          {t('bookingCodeUnknown')}
        </p>
        <Link to="/provider/dashboard" className="mt-6 inline-block text-primary-600 hover:underline">
          ← Volver a la agenda
        </Link>
      </div>
    )
  }

  const actions = actionsFor(t, booking.status, booking.payment_status)

  function handleAction(def: ActionDef) {
    let detail: string | null = ''
    if (def.detailPrompt) {
      detail = prompt(def.detailPrompt)
      if (detail === null) return
    }

    const body: Record<string, unknown> = {}
    if (def.action === 'decline') body.detail = detail
    if (def.action === 'cancel') {
      body.reason = 'provider'
      body.detail = detail
    }

    runAction.mutate({ action: def.action, body })
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <CleaningNav />

      <nav className="text-sm text-gray-500">
        <Link to="/provider/dashboard" className="hover:text-primary-600">
          {t('agenda')}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-mono text-gray-700">{booking.code}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-master-navy">{booking.service.title}</h1>
        <BookingStatusBadge status={booking.status} />
        <span className="text-sm text-gray-600">
          {t(PAYMENT_STATUS_LABELS[booking.payment_status])}
        </span>
      </div>

      {runAction.isError && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {cleaningErrorMessage(runAction.error)}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((def) => (
            <Button
              key={def.action}
              variant={def.variant}
              size="sm"
              isLoading={runAction.isPending}
              onClick={() => handleAction(def)}
            >
              {def.label}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">{t('service')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={t('provider')} value={booking.account.display_name} />
            <Row
              label={t('resource')}
              value={booking.resource ? booking.resource.name : 'Sin asignar'}
            />
            <Row label={t('start')} value={formatDateTime(booking.start_at)} />
            <Row label={t('end')} value={formatDateTime(booking.end_at)} />
            <Row
              label={t('holdsUntil')}
              value={formatDateTime(booking.occupies_until)}
            />
            {booking.hold_expires_at && (
              <Row
                label={t('retentionUntil')}
                value={formatDateTime(booking.hold_expires_at)}
              />
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">{t('amounts')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={t('price')} value={formatMoney(booking.price, booking.currency)} />
            <Row label={t('zoneSurcharge')} value={formatMoney(booking.zone_fee, booking.currency)} />
            <Row
              label={t('platformFee')}
              value={formatMoney(booking.platform_fee, booking.currency)}
            />
            <Row
              label={t('providerAmount')}
              value={formatMoney(booking.provider_amount, booking.currency)}
            />
            <Row
              label={t('deposit')}
              value={formatMoney(booking.deposit_amount, booking.currency)}
            />
          </dl>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">{t('address')}</h2>
          <p className="mt-3 text-sm text-gray-700">{booking.address}</p>
          <p className="mt-1 text-sm text-gray-600">
            {booking.district}
            {booking.city ? ` (ciudad #${booking.city})` : ''}
          </p>

          {booking.customer_notes && (
            <>
              <h3 className="mt-4 text-sm font-medium text-master-navy">
                {t('customerNotes')}
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                {booking.customer_notes}
              </p>
            </>
          )}

          {booking.provider_notes && (
            <>
              <h3 className="mt-4 text-sm font-medium text-master-navy">
                {t('providerNotes')}
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                {booking.provider_notes}
              </p>
            </>
          )}

          {booking.cancel_reason && (
            <p className="mt-4 text-sm text-red-700">
              Cancelada ({booking.cancel_reason})
              {booking.cancel_detail ? `: ${booking.cancel_detail}` : ''}
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">{t('history')}</h2>
          {booking.events.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">{t('noEvents')}</p>
          ) : (
            <ol className="mt-3 space-y-3 text-sm">
              {booking.events.map((event) => (
                <li key={event.id} className="border-l-2 border-gray-200 pl-3">
                  <p className="text-master-navy">
                    {event.from_status
                      ? `${t(BOOKING_STATUS_LABELS[event.from_status as BookingStatus]) ?? event.from_status} → ${
                          t(BOOKING_STATUS_LABELS[event.to_status as BookingStatus]) ?? event.to_status
                        }`
                      : (t(BOOKING_STATUS_LABELS[event.to_status as BookingStatus]) ?? event.to_status)}
                    {event.event_type === 'payment' ? ' (pago)' : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(event.created_at)}
                    {event.actor_username ? ` · ${event.actor_username}` : ''}
                    {event.actor_role ? ` (${event.actor_role})` : ''}
                  </p>
                  {event.reason && (
                    <p className="text-xs text-gray-600">{event.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-master-navy">{value}</dd>
    </div>
  )
}
