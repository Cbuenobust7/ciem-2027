import { useLanguage } from '@/i18n'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useCreateProvider, useProviderSideIndex } from '@/hooks/useCleaning'
import { ProviderVerificationBanner } from '@/components/provider/ProviderVerificationBanner'
import { cleaningErrorMessage } from '@/lib/cleaning'
import { useAuthStore } from '@/stores/auth'
import { useProviderAccountStore } from '@/stores/providerAccount'
import type { ProviderKind } from '@/types/api'

interface ProviderAccountGateProps {
  children: (accountId: number) => ReactNode
}

/**
 * Resuelve **con qué cuenta de proveedor** opera la pantalla.
 *
 * La API no publica las memberships del usuario, así que la cuenta se descubre
 * por `GET /api/cleaning/bookings/?as=provider` (que solo devuelve las reservas
 * de las cuentas donde es miembro). Si una cuenta recién creada aún no tiene
 * reservas, no aparece ahí: por eso el componente permite fijarla a mano y
 * también darse de alta (`POST /api/cleaning/providers/`, §5.1).
 */
export function ProviderAccountGate({ children }: ProviderAccountGateProps) {
  const { t } = useLanguage()

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accountId = useProviderAccountStore((s) => s.accountId)
  const accountName = useProviderAccountStore((s) => s.accountName)
  const setAccount = useProviderAccountStore((s) => s.setAccount)

  const { data: index, isLoading } = useProviderSideIndex(isAuthenticated)
  const createProvider = useCreateProvider()

  const [manualId, setManualId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [kind, setKind] = useState<ProviderKind>('individual')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accounts = index?.accounts

  // Autoselección cuando el servidor reconoce exactamente una cuenta.
  useEffect(() => {
    if (!accountId && accounts && accounts.length === 1) {
      setAccount(accounts[0].id, accounts[0].display_name)
    }
  }, [accountId, accounts, setAccount])

  if (!isAuthenticated) {
    return (
      <div className="card text-center">
        <p className="text-gray-700">
          {t('providerLoginRequired')}
        </p>
        <Link to="/login" className="mt-4 inline-block">
          <Button variant="primary">{t('login')}</Button>
        </Link>
      </div>
    )
  }

  if (accountId) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>
            Cuenta activa:{' '}
            <strong className="text-master-navy">
              {accountName ?? `#${accountId}`}
            </strong>
          </span>

          {accounts && accounts.length > 1 && (
            <select
              className="input max-w-xs"
              value={accountId}
              onChange={(event) => {
                const nextId = Number(event.target.value)
                const next = accounts.find((item) => item.id === nextId)
                setAccount(nextId, next?.display_name ?? null)
              }}
            >
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display_name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={() => setAccount(null, null)}
          >
            {t('switchAccount')}
          </button>
        </div>

        <ProviderVerificationBanner accountId={accountId} />

        {children(accountId)}
      </div>
    )
  }

  if (isLoading) {
    return <LoadingSpinner size="lg" />
  }

  async function handleCreate() {
    setError(null)
    if (!displayName.trim()) {
      setError('El nombre de la cuenta es obligatorio.')
      return
    }
    if (!termsAccepted) {
      setError(t('termsRequired'))
      return
    }
    try {
      const account = await createProvider.mutateAsync({
        payload: {
          display_name: displayName.trim(),
          kind,
          terms_accepted: termsAccepted,
        },
      })
      setAccount(account.id, account.display_name)
    } catch (err) {
      setError(cleaningErrorMessage(err))
    }
  }

  function handleManual() {
    setError(null)
    const parsed = Number(manualId)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError(t('accountIdInvalid'))
      return
    }
    setAccount(parsed, null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        {t('noProviderAccountSelected')}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">
            {t('accountsRecognised')}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map((item) => (
              <Button
                key={item.id}
                variant="secondary"
                size="sm"
                onClick={() => setAccount(item.id, item.display_name)}
              >
                {item.display_name} (#{item.id})
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">
            {t('alreadyHaveAccount')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('publicIdNote')}
          </p>
          <div className="mt-4">
            <Input
              label={t('accountIdentifier')}
              name="provider_account_id"
              inputMode="numeric"
              value={manualId}
              onChange={(event) => setManualId(event.target.value)}
              placeholder={t('accountIdentifierPlaceholder')}
            />
            <Button variant="secondary" className="w-full" onClick={handleManual}>
              {t('useThisAccount')}
            </Button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-master-navy">
            {t('createProviderAccount')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('accountCreationNote')}
          </p>
          <div className="mt-4">
            <Input
              label={t('publicName')}
              name="display_name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t('publicNamePlaceholder')}
            />

            <div className="mb-4">
              <label className="label" htmlFor="provider_kind">
                {t('type')}
              </label>
              <select
                id="provider_kind"
                className="input"
                value={kind}
                onChange={(event) => setKind(event.target.value as ProviderKind)}
              >
                <option value="individual">{t('individual')}</option>
                <option value="company">{t('company')}</option>
              </select>
            </div>

            <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>{t('acceptTerms')}</span>
            </label>

            <Button
              variant="primary"
              className="w-full"
              onClick={handleCreate}
              isLoading={createProvider.isPending}
            >
              {t('createAccount')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
