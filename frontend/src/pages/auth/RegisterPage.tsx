import { useLanguage } from '@/i18n'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authErrorMessage } from '@/lib/cleaning'
import { useAuthStore } from '@/stores/auth'

/**
 * Registro ultraligero de **cliente**: usuario, email y contraseña.
 *
 * Quien quiere darse de alta como empresa usa `/unete`, que pide además los
 * datos de la cuenta de proveedor en el mismo formulario.
 */
export default function RegisterPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A dónde volver tras registrarse: `?next=` o la ruta de origen. Solo rutas
  // internas, para no permitir redirecciones a otro dominio.
  const params = new URLSearchParams(location.search)
  const solicitado =
    params.get('next') ??
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/'
  const destino = solicitado.startsWith('/') ? solicitado : '/'

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const data = await authApi.register(form)
      // El backend devuelve { user, tokens: { access, refresh } }
      setAuth(data.user, data.tokens.access, data.tokens.refresh)
      navigate(destino, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-2 text-center text-2xl font-bold text-primary-600">
          {t('createAccount')}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          {t('registerSubtitle')}
        </p>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label={t('email')}
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange('email')}
            required
          />
          <Input
            label={t('username')}
            type="text"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange('username')}
            required
          />
          <Input
            label={t('password')}
            type="password"
            name="password"
            autoComplete="new-password"
            hint={t('minEightChars')}
            value={form.password}
            onChange={handleChange('password')}
            minLength={8}
            required
          />

          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            {t('createAccount')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary-600 hover:underline">
            {t('signIn')}
          </Link>
        </p>

        <p className="mt-3 border-t border-gray-100 pt-3 text-center text-sm text-gray-600">
          ¿Tienes una empresa de limpieza?{' '}
          <Link to="/unete" className="font-medium text-primary-600 hover:underline">
            {t('joinAsProvider')}
          </Link>
        </p>
      </div>
    </div>
  )
}
