import { useLanguage } from '@/i18n'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { LoginForm } from '@/components/auth/LoginForm'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Login en modal para la barra pública. Es un envoltorio delgado de
 * `LoginForm`: aquí solo vive el diálogo, el cierre con Escape y el enrutado por
 * rol (un proveedor entra en su panel; un cliente vuelve a donde estaba).
 */
export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname
  const volverA = from && from !== '/login' && from !== '/register' ? from : '/'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 id="login-modal-title" className="text-xl font-bold text-master-navy">
            {t('login')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          {t('loginModalSubtitle')}
        </p>

        <div className="mt-4">
          <LoginForm
            idPrefix="login-modal"
            autoFocus
            onSuccess={(user) => {
              navigate(user.is_provider ? '/provider/dashboard' : volverA, {
                replace: true,
              })
              onClose()
            }}
          />
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <Link
            to="/register"
            onClick={onClose}
            className="text-primary-600 hover:underline"
          >
            {t('registerLink')}
          </Link>
        </p>

        <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs text-gray-500">
          ¿Eres una empresa de limpieza?{' '}
          <Link
            to="/unete"
            onClick={onClose}
            className="font-medium text-primary-600 hover:underline"
          >
            {t('joinAsProvider')}
          </Link>
        </p>
      </div>
    </div>
  )
}
