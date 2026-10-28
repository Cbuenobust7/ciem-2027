import { useLanguage, type TranslationKey } from '@/i18n'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateProvider } from '@/hooks/useCleaning'
import { authErrorMessage, cleaningErrorMessage } from '@/lib/cleaning'
import { useAuthStore, useProviderAccounts } from '@/stores/auth'
import { useProviderAccountStore } from '@/stores/providerAccount'
import type { ProviderKind } from '@/types/api'

const BENEFICIOS: { titulo: TranslationKey; detalle: TranslationKey }[] = [
  {
    titulo: 'benefitFeeTitle',
    detalle: 'benefitFeeBody',
  },
  {
    titulo: 'benefitScheduleTitle',
    detalle: 'benefitScheduleBody',
  },
  {
    titulo: 'benefitCustomersTitle',
    detalle: 'benefitCustomersBody',
  },
  {
    titulo: 'benefitBookingsTitle',
    detalle: 'benefitBookingsBody',
  },
]

const ZONAS = [
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'UTC',
]

const PERFIL_INICIAL = {
  display_name: '',
  kind: 'company' as ProviderKind,
  legal_name: '',
  tax_id: '',
  phone: '',
  contact_email: '',
  description: '',
  timezone: 'America/Lima',
}

export default function JoinPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const canPublish = useAuthStore((s) => s.user?.can_publish === true)
  const providerAccounts = useProviderAccounts()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setUser = useAuthStore((s) => s.setUser)
  const setProviderAccount = useProviderAccountStore((s) => s.setAccount)
  const createProvider = useCreateProvider()

  const aviso = (location.state as { notice?: string } | null)?.notice

  const [cuenta, setCuenta] = useState({ username: '', email: '', password: '' })
  const [perfil, setPerfil] = useState(PERFIL_INICIAL)
  const [logo, setLogo] = useState<File | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function cambiarCuenta(campo: keyof typeof cuenta) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setCuenta((actual) => ({ ...actual, [campo]: event.target.value }))
  }

  function cambiarPerfil(campo: keyof typeof perfil) {
    return (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setPerfil((actual) => ({ ...actual, [campo]: event.target.value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!perfil.display_name.trim()) {
      setError(t('publicNameRequired'))
      return
    }

    if (!termsAccepted) {
      setError(t('termsRequired'))
      return
    }

    setIsLoading(true)

    // 1. Si no hay sesión, se crea la cuenta de cliente y se entra con ella.
    if (!isAuthenticated) {
      try {
        const registro = await authApi.register({
          username: cuenta.username,
          email: cuenta.email,
          password: cuenta.password,
        })
        setAuth(registro.user, registro.tokens.access, registro.tokens.refresh)
      } catch (caught) {
        setError(authErrorMessage(caught))
        setIsLoading(false)
        return
      }
    }

    // 2. Alta de la cuenta de proveedor (crea la membership `owner`).
    try {
      const account = await createProvider.mutateAsync({
        payload: {
          display_name: perfil.display_name.trim(),
          kind: perfil.kind,
          legal_name: perfil.legal_name.trim() || undefined,
          tax_id: perfil.tax_id.trim() || undefined,
          phone: perfil.phone.trim() || undefined,
          contact_email: perfil.contact_email.trim() || undefined,
          description: perfil.description.trim() || undefined,
          timezone: perfil.timezone,
          terms_accepted: termsAccepted,
        },
        // El logo obliga a `multipart/form-data`; sin él la petición va en JSON.
        logo,
      })
      setProviderAccount(account.id, account.display_name)

      // La sesión acaba de ganar permisos de publicación: se refresca el rol
      // para que las rutas de publicación no sigan bloqueadas con datos viejos.
      try {
        setUser(await authApi.getProfile())
      } catch {
        // El alta ya está hecha; el rol se recalculará en el próximo inicio.
      }

      navigate('/provider/dashboard', { replace: true })
    } catch (caught) {
      setError(cleaningErrorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {aviso === 'publisher_required' && (
        <div className="mb-6 rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          <p className="font-medium">{t('providerAccountRequired')}</p>
          <p className="mt-1">
            {t('providerOwnerRequired')}<code>staff</code>) puede gestionar reservas y agenda, pero no publicar.
          </p>
        </div>
      )}

      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
          {t('joinHeroTitle')}
        </p>
        <h1 className="mt-2 text-4xl font-bold text-master-navy">
          {t('joinHeroSubtitle')}
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          {t('joinHeroBody')}
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {BENEFICIOS.map((beneficio) => (
          <div key={t(beneficio.titulo)} className="card">
            <h2 className="font-semibold text-master-navy">{t(beneficio.titulo)}</h2>
            <p className="mt-1 text-sm text-gray-600">{t(beneficio.detalle)}</p>
          </div>
        ))}
      </section>

      {isAuthenticated && providerAccounts.length > 0 && (
        <section className="card mt-8">
          <h2 className="text-lg font-semibold text-master-navy">
            Ya operas {providerAccounts.length === 1 ? 'una cuenta' : 'estas cuentas'}
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {providerAccounts.map((account) => (
              <li key={account.id}>
                <strong>{account.display_name}</strong>{' '}
                <span className="text-gray-500">
                  · rol {account.role}
                  {account.role === 'owner' || account.role === 'admin'
                    ? ''
                    : t('noPublishPermission')}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/provider/dashboard" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              {t('goToProviderPanel')}
            </Button>
          </Link>
        </section>
      )}

      <section className="card mt-8">
        <h2 className="text-2xl font-bold text-master-navy">
          {canPublish ? t('createAnotherAccount') : t('joinAsProvider')}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {isAuthenticated
            ? t('accountCreationNote')
            : t('createCustomerAccountNote')}
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          {!isAuthenticated && (
            <fieldset className="mb-8">
              <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                1 · Tu acceso
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('username')}
                  name="username"
                  autoComplete="username"
                  value={cuenta.username}
                  onChange={cambiarCuenta('username')}
                  required
                />
                <Input
                  label={t('email')}
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={cuenta.email}
                  onChange={cambiarCuenta('email')}
                  required
                />
              </div>
              <Input
                label={t('password')}
                type="password"
                name="password"
                autoComplete="new-password"
                hint={t('minEightChars')}
                minLength={8}
                value={cuenta.password}
                onChange={cambiarCuenta('password')}
                required
              />
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {isAuthenticated ? 'Datos de la empresa' : '2 · Tu empresa'}
            </legend>

            <Input
              label={t('publicName')}
              name="display_name"
              value={perfil.display_name}
              onChange={cambiarPerfil('display_name')}
              placeholder="p. ej. CleanHome Lima"
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="mb-4">
                <label className="label" htmlFor="kind">
                  {t('providerType')}
                </label>
                <select
                  id="kind"
                  className="input"
                  value={perfil.kind}
                  onChange={cambiarPerfil('kind')}
                >
                  <option value="company">{t('company')}</option>
                  <option value="individual">{t('individual')}</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="label" htmlFor="timezone">
                  {t('scheduleTimezone')}
                </label>
                <select
                  id="timezone"
                  className="input"
                  value={perfil.timezone}
                  onChange={cambiarPerfil('timezone')}
                >
                  {ZONAS.map((zona) => (
                    <option key={zona} value={zona}>
                      {zona}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('legalNameOptional')}
                name="legal_name"
                value={perfil.legal_name}
                onChange={cambiarPerfil('legal_name')}
              />
              <Input
                label={t('taxIdOptional')}
                name="tax_id"
                value={perfil.tax_id}
                onChange={cambiarPerfil('tax_id')}
              />
              <Input
                label={t('phoneOptional')}
                name="phone"
                value={perfil.phone}
                onChange={cambiarPerfil('phone')}
              />
              <Input
                label={t('contactEmailOptional')}
                type="email"
                name="contact_email"
                value={perfil.contact_email}
                onChange={cambiarPerfil('contact_email')}
              />
            </div>

            <div className="mb-4">
              <label className="label" htmlFor="description">
                {t('descriptionOptional')}
              </label>
              <textarea
                id="description"
                className="input min-h-24"
                rows={3}
                value={perfil.description}
                onChange={cambiarPerfil('description')}
                placeholder={t('aboutPlaceholder')}
              />
            </div>

            <div className="mb-4">
              <label className="label" htmlFor="join-logo">
                {t('logoOptional')}
              </label>
              <input
                id="join-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="input"
                onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-sm text-gray-500">
                {logo
                  ? `Se enviará: ${logo.name}`
                  : 'PNG, JPG, WebP, GIF o SVG. Se sube junto con el alta.'}
              </p>
            </div>
          </fieldset>

          <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>{t('acceptTerms')}</span>
          </label>

          <Button type="submit" isLoading={isLoading} className="mt-2 w-full sm:w-auto">
            {isAuthenticated ? 'Crear cuenta de proveedor' : 'Crear cuenta y unirme'}
          </Button>

          <p className="mt-3 text-xs text-gray-500">
            {t('joinLegalNote')}
          </p>
        </form>
      </section>
    </div>
  )
}
