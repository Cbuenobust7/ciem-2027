import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useMyPurchases } from '@/hooks/useVisibility'

type Phase = 'confirming' | 'confirmed' | 'timeout'

const POLL_INTERVAL_MS = 3000
const TIMEOUT_MS = 60000

export default function PaymentSuccessPage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const externalReference = searchParams.get('external_reference')
  const purchaseId = externalReference?.match(
    /^visibility_(\d+)(?:_|$)/,
  )?.[1] ?? externalReference
  const [phase, setPhase] = useState<Phase>('confirming')

  const { data } = useMyPurchases(true, POLL_INTERVAL_MS)
  const purchases = data?.results ?? []
  const purchase = purchaseId
    ? purchases.find((p) => String(p.id) === purchaseId)
    : undefined

  useEffect(() => {
    if (phase !== 'confirming') return

    const timer = setTimeout(() => {
      setPhase((current) => (current === 'confirming' ? 'timeout' : current))
    }, TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (purchase?.status === 'PAID') {
      setPhase('confirmed')
    }
  }, [purchase])

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {phase === 'confirming' && (
        <>
          <div className="flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-master-navy">
            {t('confirmingPayment')}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('confirmingPaymentNote')}
          </p>
        </>
      )}

      {phase === 'confirmed' && (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl text-green-700">✓</span>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-master-navy">
            {t('paymentConfirmed')}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('featuredSpotActive')}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/my-visibility">
              <Button variant="primary" size="md">
                {t('viewMySpots')}
              </Button>
            </Link>
            <Link to="/">
              <Button variant="secondary" size="md">
                {t('goHome')}
              </Button>
            </Link>
          </div>
        </>
      )}

      {phase === 'timeout' && (
        <>
          <h1 className="mt-6 text-2xl font-bold text-master-navy">
            {t('processingPayment')}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('processingPaymentNote')}
          </p>
          <div className="mt-8">
            <Link to="/my-visibility">
              <Button variant="primary" size="md">
                {t('viewMySpots')}
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}