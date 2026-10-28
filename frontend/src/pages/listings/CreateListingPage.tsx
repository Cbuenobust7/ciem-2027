import { useLanguage } from '@/i18n'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { ListingForm } from '@/components/listings/ListingForm'
import { useCreateListing } from '@/hooks/useListings'
import { useAuthStore } from '@/stores/auth'

export default function CreateListingPage() {
  const { t } = useLanguage()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const createListing = useCreateListing()

  // La vertical de limpieza no publica anuncios: un proveedor con permiso de
  // publicación va al asistente de servicios. El serializer de usuario no
  // expone `is_staff`, así que esto aplica a todo `can_publish` (el staff de
  // plataforma conserva el admin de Django).
  if (user?.can_publish) {
    return <Navigate to="/provider/services/new" replace />
  }

  async function handleSubmit(payload: {
    title: string
    description: string
    price: string | null
    currency: string
    is_negotiable: boolean
    is_free: boolean
    category: number | null
    condition: 'new' | 'like_new' | 'good' | 'fair' | 'for_parts'
    location: string
  }) {
    await createListing.mutateAsync(payload, {
      onSuccess: (listing) => {
        navigate(`/listings/${listing.id}`)
      },
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link to="/" className="text-sm text-primary-600 hover:underline">
          ← Volver a los anuncios
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-master-navy">
          {t('publishListing')}
        </h1>

        <p className="mt-1 text-gray-600">
          {t('publishListingSubtitle')}
        </p>
      </div>

      <ListingForm
        mode="create"
        onSubmit={handleSubmit}
        isSubmitting={createListing.isPending}
      />

      {createListing.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t('createListingError')}
        </div>
      )}
    </div>
  )
}
