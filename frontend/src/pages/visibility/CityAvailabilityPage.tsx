import { useLanguage } from '@/i18n'
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { VisibilityPaymentModal } from '@/components/visibility/VisibilityPaymentModal'
import {
  useCreateVisibilityOrder,
  useCityAvailability,
  useClaimFreeSlot,
} from '@/hooks/useVisibility'
import { useAuthStore } from '@/stores/auth'

export default function CityAvailabilityPage() {
  const { t } = useLanguage()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const { data, isLoading, isError } = useCityAvailability(slug)
  const claimFreeSlot = useClaimFreeSlot(slug ?? '')
  const createOrder = useCreateVisibilityOrder(slug ?? '')

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">{t('cityNotFound')}</h1>
        <Link to="/" className="mt-6 inline-block text-primary-600 hover:underline">
          &larr; Volver a los anuncios
        </Link>
      </div>
    )
  }

  const { city, slots } = data

  async function handleAction(position: number) {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    setActionError(null)
    setSelectedPosition(position)

    if (city.is_promo_mode) {
      try {
        await claimFreeSlot.mutateAsync(position)
      } catch (err: any) {
        const detail =
          err?.response?.data?.error || 'No se pudo procesar la solicitud.'
        setActionError(detail)
      } finally {
        setSelectedPosition(null)
      }
    }
  }

  async function handleCheckoutPro() {
    if (selectedPosition === null) return
    const order = await createOrder.mutateAsync(selectedPosition)
    window.location.assign(order.checkout_url)
  }

  function handleModalClose() {
    setSelectedPosition(null)
  }

  const isActing = claimFreeSlot.isPending

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link to="/" className="text-sm text-primary-600 hover:underline">
          &larr; Volver a los anuncios
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-master-navy">
          Espacios destacados en {city.name}
        </h1>
        <p className="mt-1 text-gray-600">
          {city.is_promo_mode
            ? `Modo promoción activo: reclama un espacio destacado en ${city.name} sin costo.`
            : `Elige una posición destacada en ${city.name} por ${city.duration_days} días.`}
        </p>
      </div>

      {actionError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {slots.map((slot) => {
          const isAvailable = slot.status === 'available'
          const isThisBusy = isActing && selectedPosition === slot.position

          return (
            <button
              key={slot.position}
              type="button"
              disabled={!isAvailable || isActing}
              onClick={() => handleAction(slot.position)}
              className={[
                'flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-4 text-center transition-colors',
                isAvailable
                  ? 'cursor-pointer border-primary-300 bg-primary-50 hover:border-primary-500 hover:bg-primary-100'
                  : 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-60',
              ].join(' ')}
            >
              <span className="text-lg font-bold text-master-navy">#{slot.position}</span>

              {isThisBusy ? (
                <LoadingSpinner size="sm" />
              ) : isAvailable ? (
                <span className="text-sm font-medium text-primary-700">
                  {slot.is_free ? 'Gratis' : `${slot.currency} ${slot.price}`}
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  Ocupado
                  {slot.occupied_until && (
                    <>
                      {' '}
                      hasta{' '}
                      {new Date(slot.occupied_until).toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        {city.is_promo_mode
          ? t('promoSpotsActive')
          : t('checkoutOpensNote')}
      </p>

      {!city.is_promo_mode && selectedPosition !== null && (
        <VisibilityPaymentModal
          citySlug={city.slug}
          cityName={city.name}
          position={selectedPosition}
          price={slots.find((slot) => slot.position === selectedPosition)?.price ?? 0}
          onClose={handleModalClose}
          onSuccess={handleModalClose}
          onCheckoutPro={handleCheckoutPro}
        />
      )}

    </div>
  )
}
