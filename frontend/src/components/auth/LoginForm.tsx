import { useLanguage } from '@/i18n'
import { useRef, useState, type FormEvent } from 'react'

import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authErrorMessage } from '@/lib/cleaning'
import { useAuthStore } from '@/stores/auth'
import { useProviderAccountStore } from '@/stores/providerAccount'
import type { User } from '@/types/api'

interface LoginFormProps {
  /** Se llama con el usuario ya autenticado: cada contenedor decide a dónde ir. */
  onSuccess?: (user: User) => void
  autoFocus?: boolean
  /** Prefijo de los `id` para que no choquen si hay dos formularios montados. */
  idPrefix?: string
}

/**
 * Formulario de login compartido por el modal de la barra y la página `/login`.
 *
 * Hace lo que antes solo hacía el modal: guarda la sesión, deja preseleccionada
 * la cuenta de proveedor (para que las pantallas `/provider/*` no pregunten con
 * cuál operar) y avisa por `onSuccess`. El enrutado por rol lo decide quien lo
 * monta, que es lo único que difiere entre el modal y la página.
 */
export function LoginForm({
  onSuccess,
  autoFocus = false,
  idPrefix = 'login',
}: LoginFormProps) {
  const { t } = useLanguage()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setProviderAccount = useProviderAccountStore((s) => s.setAccount)
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const data = await authApi.login({ email, password })
      setAuth(data.user, data.access, data.refresh)

      const accounts = data.user.provider_accounts ?? []
      const preferred =
        accounts.find(
          (account) => account.role === 'owner' || account.role === 'admin',
        ) ?? accounts[0]
      if (preferred) setProviderAccount(preferred.id, preferred.display_name)

      onSuccess?.(data.user)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Input
        ref={emailRef}
        id={`${idPrefix}-email`}
        label={t('email')}
        type="email"
        name="email"
        autoComplete="email"
        autoFocus={autoFocus}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Input
        id={`${idPrefix}-password`}
        label={t('password')}
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
        {t('enter')}
      </Button>
    </form>
  )
}
