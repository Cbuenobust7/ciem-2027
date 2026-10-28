import { useLanguage } from '@/i18n'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ListingForm } from '@/components/listings/ListingForm'
import { ImageUploader } from '@/components/listings/ImageUploader'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  useListing,
  useUpdateListing,
  useUploadImage,
  useDeleteImage,
  useSetCover,
} from '@/hooks/useListings'
import { useAuthStore } from '@/stores/auth'

export default function EditListingPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const listingId = Number(id)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: listing, isLoading, isError } = useListing(listingId)
  const updateListing = useUpdateListing()
  const uploadImage = useUploadImage()
  const deleteImage = useDeleteImage()
  const setCover = useSetCover()

  useEffect(() => {
    if (!listing || !user) return

    if (listing.seller_id !== user.id) {
      navigate(`/listings/${listing.id}`, { replace: true })
      return
    }

    if (listing.status === 'sold' || listing.status === 'expired') {
      navigate(`/listings/${listing.id}`, { replace: true })
    }
  }, [listing, user, navigate])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">{t('listingNotFound')}</h1>
        <p className="mt-2 text-gray-600">{t('editListingLoadError')}</p>
        <Link to="/" className="mt-6 inline-block text-primary-600 hover:underline">
          ← Volver a los anuncios
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/listings/${listing.id}`}
          className="text-sm text-primary-600 hover:underline"
        >
          ← Volver al anuncio
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-master-navy">{t('editListing')}</h1>
        <p className="mt-1 text-gray-600">
          {t('editListingSubtitle')}
        </p>
      </div>

      {/* Formulario de datos */}
      <ListingForm
        mode="edit"
        initialValues={listing}
        isSubmitting={updateListing.isPending}
        onSubmit={async (payload) => {
          await updateListing.mutateAsync({
            id: listing.id,
            payload,
          })
          navigate(`/listings/${listing.id}`)
        }}
      />

      {/* Gestión de imágenes */}
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-master-navy">{t('images')}</h2>
        <p className="mt-1 mb-4 text-sm text-gray-600">
          {t('imagesHelp')}
        </p>

        <ImageUploader
          images={listing.images}
          onUpload={async (file) => {
            await uploadImage.mutateAsync({ listingId: listing.id, file })
          }}
          onDelete={async (imageId) => {
            await deleteImage.mutateAsync({ imageId, listingId: listing.id })
          }}
          onSetCover={async (imageId) => {
            await setCover.mutateAsync({ imageId, listingId: listing.id })
          }}
          isUploading={uploadImage.isPending}
          deletingImageId={
            deleteImage.isPending ? deleteImage.variables?.imageId ?? null : null
          }
          settingCoverImageId={
            setCover.isPending ? setCover.variables?.imageId ?? null : null
          }
        />
      </div>
    </div>
  )
}
