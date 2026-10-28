import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  useDeleteListing,
  useMarkAsSold,
  useMyListings,
  usePublishListing,
} from '@/hooks/useListings'
import type { ListingListItem } from '@/types/api'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  sold: 'Vendido',
  expired: 'Expirado',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-gray-100 text-gray-800',
  sold: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
}

export default function MyListingsPage() {
  const { t } = useLanguage()
  const { data: listings, isLoading, isError } = useMyListings()
  const publishListing = usePublishListing()
  const markAsSold = useMarkAsSold()
  const deleteListing = useDeleteListing()

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('myListingsLoadError')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-master-navy">{t('myListings')}</h1>
          <p className="mt-1 text-gray-600">
            {t('myListingsSubtitle')}
          </p>
        </div>
        <Link to="/listings/new">
          <Button variant="primary">+ Publicar anuncio</Button>
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">{t('noListingsYet')}</p>
          <Link to="/listings/new" className="mt-4 inline-block">
            <Button variant="primary">{t('createFirstListing')}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onPublish={() => publishListing.mutate(listing.id)}
              onMarkAsSold={() => markAsSold.mutate(listing.id)}
              onDelete={() => {
                if (confirm(`¿Eliminar "${listing.title}"?`)) {
                  deleteListing.mutate(listing.id)
                }
              }}
              isPublishing={publishListing.isPending}
              isMarkingSold={markAsSold.isPending}
              isDeleting={deleteListing.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ListingRowProps {
  listing: ListingListItem
  onPublish: () => void
  onMarkAsSold: () => void
  onDelete: () => void
  isPublishing: boolean
  isMarkingSold: boolean
  isDeleting: boolean
}

function ListingRow({
  listing,
  onPublish,
  onMarkAsSold,
  onDelete,
  isPublishing,
  isMarkingSold,
  isDeleting,
}: ListingRowProps) {
  const { t } = useLanguage()
  const statusClass =
    STATUS_COLORS[listing.status] || 'bg-gray-100 text-gray-800'

  return (
    <div className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100">
            {listing.cover_image ? (
              <img
                src={listing.cover_image}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <svg
                  className="h-6 w-6"
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

          {/* Info */}
          <div>
            <Link
              to={`/listings/${listing.id}`}
              className="font-semibold text-master-navy hover:text-primary-600"
            >
              {listing.title}
            </Link>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                {STATUS_LABELS[listing.status] || listing.status}
              </span>
              <span className="text-gray-500">
                {listing.is_free
                  ? 'Gratis'
                  : listing.price
                    ? `${listing.currency} ${listing.price}`
                    : 'A convenir'}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2">
          {listing.status === 'draft' && (
            <Button
              variant="primary"
              size="sm"
              onClick={onPublish}
              isLoading={isPublishing}
            >
              {t('publish')}
            </Button>
          )}

          {listing.status === 'active' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onMarkAsSold}
              isLoading={isMarkingSold}
            >
              {t('markSold')}
            </Button>
          )}

          {(listing.status === 'draft' ||
            listing.status === 'active' ||
            listing.status === 'paused') && (
            <Link to={`/listings/${listing.id}/edit`}>
              <Button variant="ghost" size="sm">
                {t('edit')}
              </Button>
            </Link>
          )}

          <Link to={`/listings/${listing.id}`}>
            <Button variant="ghost" size="sm">
              {t('view')}
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            isLoading={isDeleting}
          >
            🗑
          </Button>
        </div>
      </div>
    </div>
  )
}
