import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'

export default function PaymentPendingPage() {
  const { t } = useLanguage()
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
        <span className="text-3xl text-yellow-700">⏳</span>
      </div>
      <h1 className="mt-6 text-2xl font-bold text-master-navy">
        {t('paymentPending')}
      </h1>
      <p className="mt-2 text-gray-600">
        {t('paymentPendingNote')}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/my-visibility">
          <Button variant="primary" size="md">
            {t('viewMyPositions')}
          </Button>
        </Link>
        <Link to="/visibility">
          <Button variant="secondary" size="md">
            {t('backToPremium')}
          </Button>
        </Link>
      </div>
    </div>
  )
}