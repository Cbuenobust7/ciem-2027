import { useLanguage } from '@/i18n'
import { BOOKING_STATUS_CLASSES, BOOKING_STATUS_LABELS } from '@/lib/cleaning'
import type { BookingStatus } from '@/types/api'

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useLanguage()

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BOOKING_STATUS_CLASSES[status]}`}
    >
      {t(BOOKING_STATUS_LABELS[status])}
    </span>
  )
}
