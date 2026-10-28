import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useProcessSlotPayment } from '@/hooks/useVisibility'
import { useAuthStore } from '@/stores/auth'

interface VisibilityPaymentModalProps {
  citySlug: string
  cityName: string
  position: number
  price: number | string
  onClose: () => void
  onSuccess: () => void
  onCheckoutPro: () => Promise<void>
}

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_BRICKS_PUBLIC_KEY as string | undefined
type Phase = 'method' | 'api' | 'processing' | 'success' | 'pending' | 'error'

export function VisibilityPaymentModal({ citySlug, cityName, position, price, onClose, onSuccess, onCheckoutPro }: VisibilityPaymentModalProps) {
  const { t } = useLanguage()

  const [phase, setPhase] = useState<Phase>('method')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const user = useAuthStore((state) => state.user)
  const processPayment = useProcessSlotPayment(citySlug)

  useEffect(() => {
    if (MP_PUBLIC_KEY) initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' })
  }, [])

  async function handleCheckoutPro() {
    setPhase('processing')
    setErrorMessage('')
    setMessage('Redirigiendo a Mercado Pago...')
    try {
      await onCheckoutPro()
    } catch (err: any) {
      setPhase('error')
      setErrorMessage(err?.response?.data?.error || 'No se pudo iniciar el checkout.')
    }
  }

  async function handleSubmit({ token, payment_method_id: methodId, issuer_id: methodIssuerId, installments: methodInstallments, payer }: any) {
    setPhase('processing')
    setErrorMessage('')
    setMessage('Procesando pago...')
    try {
      const result = await processPayment.mutateAsync({
        position,
        token,
        payment_method_id: methodId,
        issuer_id: methodIssuerId ?? null,
        installments: methodInstallments ?? 1,
        identification_number: payer?.identification?.number ?? '',
      })
      if (result.status === 'completed') {
        setPhase('success')
        setMessage(t('paymentConfirmedActive'))
        onSuccess()
      } else if (result.status === 'pending') {
        setPhase('pending')
        setMessage('Pago pendiente. Te avisaremos cuando se confirme.')
      } else {
        setPhase('error')
        setErrorMessage(result.status_detail || 'El pago fue rechazado.')
      }
    } catch (err: any) {
      setPhase('error')
      setErrorMessage(err?.response?.data?.error || 'No se pudo completar el pago.')
    }
  }

  const isProcessing = phase === 'processing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4" onClick={isProcessing ? undefined : onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">{t('checkout')}</p>
            <h3 className="mt-2 text-2xl font-bold text-white">{t('featuredSpot', { city: cityName, position })}</h3>
          </div>
          {!isProcessing && <button type="button" onClick={onClose} className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:border-slate-400">{t('close')}</button>}
        </div>

        <div className="mb-5 rounded-xl bg-slate-800 p-4 text-sm text-slate-200"><div className="flex items-center justify-between"><span>{t('amount')}</span><strong className="text-lg text-white">S/ {Number(price).toFixed(2)}</strong></div></div>

        {phase === 'method' && (
          <div className="space-y-3">
            <button type="button" onClick={handleCheckoutPro} className="w-full rounded-xl border border-emerald-500 bg-emerald-500/10 p-4 text-left transition hover:bg-emerald-500/20"><span className="block font-semibold text-emerald-200">{t('checkoutPro')}</span><span className="mt-1 block text-sm text-slate-300">{t('mpSecure')}</span></button>
            {/* Checkout API oculto temporalmente mientras se corrige la configuración de credenciales. */}
          </div>
        )}

        {phase === 'api' && <><button type="button" onClick={() => setPhase('method')} className="mb-4 text-sm text-emerald-300 hover:text-emerald-200">{t('chooseOtherMethod')}</button><CardPayment initialization={{ amount: Number(price), payer: { email: user?.email ?? '' } }} customization={{ paymentMethods: { maxInstallments: 12 } }} onSubmit={handleSubmit} onError={(err: any) => { setPhase('error'); setErrorMessage(err?.message || t('mpInitError')) }} locale="es-PE" /></>}
        {phase === 'processing' && <div className="py-8 text-center"><div className="flex justify-center"><LoadingSpinner size="lg" /></div><p className="mt-4 text-sm text-slate-300">{message}</p></div>}
        {phase === 'success' && <div className="py-8 text-center text-slate-200"><p className="text-lg font-bold text-white">{t('paymentConfirmed')}</p><p className="mt-2 text-sm">{message}</p><div className="mt-6"><Button variant="primary" size="md" onClick={onClose}>{t('close')}</Button></div></div>}
        {phase === 'pending' && <div className="py-8 text-center text-slate-200"><p className="text-lg font-bold text-white">{t('paymentPending')}</p><p className="mt-2 text-sm">{message}</p><div className="mt-6"><Button variant="primary" size="md" onClick={onClose}>{t('understood')}</Button></div></div>}
        {phase === 'error' && <div className="py-6 text-center text-slate-200"><p className="text-lg font-bold text-white">{t('paymentFailed')}</p><p className="mt-2 text-sm text-rose-300">{errorMessage}</p><div className="mt-6 flex justify-center gap-3"><Button variant="primary" size="md" onClick={() => setPhase('method')}>{t('chooseMethod')}</Button><Button variant="secondary" size="md" onClick={onClose}>{t('cancel')}</Button></div></div>}
      </div>
    </div>
  )
}
