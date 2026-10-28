import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary-600">404</h1>
        <p className="mt-4 text-gray-600">{t('notFound')}</p>
        <Link to="/" className="mt-6 inline-block text-primary-600 hover:underline">{t('backHome')}</Link>
      </div>
    </div>
  )
}
