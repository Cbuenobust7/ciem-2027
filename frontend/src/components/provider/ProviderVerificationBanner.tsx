import { Button } from '@/components/ui/Button'
import { useProvider, useRequestVerification } from '@/hooks/useCleaning'
import { useLanguage } from '@/i18n'

/**
 * Aviso del estado de verificación en el panel del proveedor.
 *
 * Mientras la cuenta no esté verificada el proveedor puede preparar servicios y
 * agenda, pero no recibirá reservas: el backend las rechaza con
 * `provider_not_verified`. Para las cuentas rechazadas —que hasta ahora no tenían
 * camino de vuelta, porque `ProviderDetailView` las excluye del queryset— ofrece
 * el botón para volver a pedir la verificación.
 */
export function ProviderVerificationBanner({ accountId }: { accountId: number }) {
  const { t } = useLanguage()
  const { data: provider } = useProvider(accountId)
  const request = useRequestVerification(accountId)

  const status = provider?.verification_status
  if (!status || status === 'verified') return null

  return (
    <div className="card mb-6 border-yellow-200 bg-yellow-50">
      <p className="text-sm text-yellow-900">{t('verificationNotice')}</p>
      <p className="mt-1 text-sm font-bold text-yellow-900">
        {status === 'rejected' && t('verificationRejected')}
        {status === 'pending' && t('verificationPending')}
        {status === 'suspended' && t('verificationSuspended')}
      </p>
      {status === 'rejected' && (
        <div className="mt-3">
          <Button variant="primary" size="sm" isLoading={request.isPending} onClick={() => request.mutate()}>
            {t('requestVerification')}
          </Button>
          {request.isSuccess && (
            <span className="ml-3 text-sm text-green-700">{t('requestVerificationSent')}</span>
          )}
        </div>
      )}
    </div>
  )
}
