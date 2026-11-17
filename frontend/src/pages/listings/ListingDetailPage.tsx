import { getCiemProduct, getCiemProductCoverUrl, projectContact } from '@/data/ciemCatalog'
import { useLanguage } from '@/i18n'
import { AvailabilityCalendar } from '@/components/cleaning/AvailabilityCalendar'
import { Link, useParams } from 'react-router-dom'

import { ReviewSection } from '@/components/reviews/ReviewSection'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useListing } from '@/hooks/useListings'
import { useFavorites, useAddFavorite, useRemoveFavorite } from '@/hooks/useFavorites'
import { useAuthStore } from '@/stores/auth'
import { trackWhatsAppClick } from '@/lib/analytics'

const CONDITION_LABELS: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  for_parts: 'Para repuestos',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  sold: 'Vendido',
  expired: 'Expirado',
}

export default function ListingDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const listingId = id ? Number(id) : undefined

  const { data: listing, isLoading, isError } = useListing(listingId)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data: favoritesData } = useFavorites(isAuthenticated)
  const addFavorite = useAddFavorite()
  const removeFavorite = useRemoveFavorite()
  const canEdit =
    Boolean(listing) &&
    (user?.is_ciem_manager === true) &&
    listing!.status !== 'sold' &&
    listing!.status !== 'expired'

  // Encontrar si este listing está en favoritos
  const existingFavorite = favoritesData?.results.find(
    (fav) => fav.listing === listing?.id,
  )

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
        <h1 className="text-2xl font-bold text-master-navy">
          {t('listingNotFound')}
        </h1>
        <p className="mt-2 text-gray-600">
          {t('listingUnavailable')}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          ← Volver a los anuncios
        </Link>
      </div>
    )
  }

  const product = getCiemProduct(listing.title)
  const cover = listing.images.find((img) => img.is_cover) ?? listing.images[0]

  function handleToggleFavorite() {
    if (!listing || !isAuthenticated) return

    if (existingFavorite) {
      removeFavorite.mutate({
        favoriteId: existingFavorite.id,
        listingId: listing.id,
      })
    } else {
      addFavorite.mutate(listing.id)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link to="/" className="hover:text-primary-600">
          {t('listingsNav')}
        </Link>
        {listing.category_name && (
          <>
            <span className="mx-2">/</span>
            <span>{listing.category_name}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-gray-700">{listing.title}</span>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Columna izquierda: imágenes + descripción */}
        <div className="lg:col-span-2">
          {/* Imagen principal */}
          <div className="aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            {cover ? (
              <img
                src={product ? getCiemProductCoverUrl(product) : cover.image_url || cover.image}
                alt={cover.alt_text || listing.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <svg
                  className="h-24 w-24"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Miniaturas */}
          {listing.images.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {listing.images.map((img) => (
                <div
                  key={img.id}
                  className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100"
                >
                  {img.image_url && (
                    <img
                      src={img.image_url}
                      alt={img.alt_text || listing.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Descripción */}
          <div className="card mt-6">
            <h2 className="text-xl font-bold text-master-navy">{t('description')}</h2>
            <p className="mt-3 whitespace-pre-wrap text-gray-700">
              {listing.description || t('noDescriptionShort')}
            </p>
          </div>

          <ReviewSection
            sellerId={listing.seller_id}
            listingId={listing.id}
            sellerUsername={listing.seller_username}
          />
        </div>

        {/* Columna derecha: info + acciones */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            {/* Badge de status (solo si no es active) */}
            {listing.status !== 'active' && (
              <div className="mb-4 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                {STATUS_LABELS[listing.status] || listing.status}
              </div>
            )}

            <h1 className="text-2xl font-bold text-master-navy">
              {listing.title}
            </h1>

            {/* Precio */}
            <p className="mt-4 text-3xl font-bold text-primary-600">
              {product ? t(product.kind === 'commercial' ? 'commercialLicense' : product.kind === 'quote' ? 'quoteProduct' : 'freeBase') : listing.is_free
                ? 'Gratis'
                : listing.price !== null
                  ? `${listing.currency} ${listing.price}`
                  : 'A convenir'}
            </p>

            {listing.is_negotiable && !listing.is_free && (
              <p className="mt-1 text-sm text-gray-500">{t('negotiablePrice')}</p>
            )}

            {/* Metadata */}
            <div className="mt-6 space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('locationColon')}</span>
                <span>{listing.location || 'No especificada'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('conditionColon')}</span>
                <span>
                  {product ? t(product.kind === 'commercial' ? 'commercialLicense' : product.kind === 'quote' ? 'byRequest' : 'digitalDownload') : CONDITION_LABELS[listing.condition] || listing.condition}
                </span>
              </div>
              {listing.category_name && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('categoryColon')}</span>
                  <span>{listing.category_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('sellerColon')}</span>
                <span>{product ? 'CIEM' : listing.seller_username}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 flex items-center gap-4 border-b border-gray-200 pb-6 text-sm text-gray-500">
              <span>👁 {listing.view_count} vistas</span>
              <span>❤ {listing.favorite_count} favoritos</span>
            </div>

            {/* Acciones */}
            <div className="mt-6 space-y-3">
              {product && (
                <div className="space-y-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
                  <p className="text-sm leading-6 text-master-navy">{t(product.kind === 'commercial' ? 'commercialNote' : product.kind === 'quote' ? 'quoteNote' : 'digitalNote')}</p>
                  {product.purchaseUrl && <a className="btn btn-primary w-full" href={product.purchaseUrl} target="_blank" rel="noopener noreferrer">{t('buyCodester')}</a>}
                  {product.download && <a className="btn btn-primary w-full" href={product.download} download>{t('downloadBase')}</a>}
                  {product.preview && <a className="btn btn-secondary w-full" href={product.preview} target="_blank" rel="noopener noreferrer">{t(product.kind === 'quote' || product.kind === 'commercial' ? 'tryDemo' : 'previewBase')}</a>}
                  <a className="btn btn-secondary w-full" href={projectContact(product.title)} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('listing_detail')}>{t(product.kind === 'quote' ? 'quoteProduct' : 'customizeProduct')}</a>
                </div>
              )}

              {/* CTA de la vertical de limpieza (§9.6): aparece solo cuando la
                  respuesta trae `service_details`. Si no viene, esta pantalla se
                  comporta exactamente como antes. */}
              {listing.service_details && (
                <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
                  <p className="text-sm font-medium text-primary-900">
                    {t('bookableCleaningService')}
                  </p>
                  <p className="mt-1 text-xs text-primary-800">
                    {listing.service_details.duration_minutes} min
                    {listing.service_details.requires_deposit
                      ? ` · depósito ${listing.currency} ${listing.service_details.deposit_amount}`
                      : ''}
                    {listing.service_details.is_active
                      ? ''
                      : ' · ahora mismo no disponible'}
                  </p>

                  {listing.service_details.is_active && (
                    <AvailabilityCalendar listingId={listing.id} details={listing.service_details} />
                  )}

                  {listing.service_details.is_active ? (
                    <Link to={`/cleaning/book/${listing.id}`} className="mt-3 block">
                      <Button variant="primary" className="w-full">
                        {t('book')}
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" className="mt-3 w-full" disabled>
                      {t('book')}
                    </Button>
                  )}

                  <Link
                    to="/my-bookings"
                    className="mt-2 block text-center text-xs text-primary-700 hover:underline"
                  >
                    {t('viewMyBookings')}
                  </Link>
                </div>
              )}

              {isAuthenticated ? (
                <>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleToggleFavorite}
                    isLoading={addFavorite.isPending || removeFavorite.isPending}
                  >
                    {existingFavorite ? '❤ Quitar de favoritos' : t('addFavorite')}
                  </Button>
                  <Button variant="secondary" className="w-full">
                    💬 Contactar vendedor
                  </Button>
                  {canEdit && (
                    <Link to={`/listings/${listing.id}/edit`}>
                      <Button variant="secondary" className="w-full">
                        ✏️ Editar anuncio
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <Link to="/login">
                  <Button variant="primary" className="w-full">
                    {t('loginToContact')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
