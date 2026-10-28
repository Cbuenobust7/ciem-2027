import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'

export default function PaymentFailurePage() {
  const { t } = useLanguage()
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <span className="text-3xl text-red-700">✕</span>
      </div>
      <h1 className="mt-6 text-2xl font-bold text-master-navy">
        {t('paymentFailed')}
      </h1>
      <p className="mt-2 text-gray-600">
        {t('noChargeNote')}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/visibility">
          <Button variant="primary" size="md">
            {t('tryAgain')}
          </Button>
        </Link>
        <Link to="/">
          <Button variant="secondary" size="md">
            {t('goHome')}
          </Button>
        </Link>
      </div>
    </div>
  )
}