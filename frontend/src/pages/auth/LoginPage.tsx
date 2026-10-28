import { useLanguage } from '@/i18n'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { LoginForm } from '@/components/auth/LoginForm'

/**
 * Página canónica de login (`/login`), a la que apuntan los redirects de
 * `ProtectedRoute` y `RequirePublisher`. Comparte `LoginForm` con el modal, así
 * que ahora también enruta por rol: antes un proveedor que entrara por aquí
 * acababa en el catálogo en vez de en su panel.
 */
export default function LoginPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname
  const volverA = from && from !== '/login' ? from : '/'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold text-primary-600">
          {t('login')}
        </h1>

        <LoginForm
          idPrefix="login-page"
          autoFocus
          onSuccess={(user) =>
            navigate(user.is_provider ? '/provider/dashboard' : volverA, {
              replace: true,
            })
          }
        />

        <p className="mt-6 text-center text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary-600 hover:underline">
            {t('registerLink')}
          </Link>
        </p>

        <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs text-gray-500">
          ¿Eres una empresa de limpieza?{' '}
          <Link
            to="/unete"
            className="font-medium text-primary-600 hover:underline"
          >
            {t('joinAsProvider')}
          </Link>
        </p>
      </div>
    </div>
  )
}
