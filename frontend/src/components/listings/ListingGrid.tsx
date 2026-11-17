import { ListingCard } from './ListingCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

import type { ListingListItem } from '@/types/api'

interface ListingGridProps {
  listings: ListingListItem[] | undefined
  isLoading?: boolean
  emptyMessage?: string
}

export function ListingGrid({
  listings,
  isLoading = false,
  emptyMessage = 'No hay anuncios para mostrar.',
}: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p className="text-lg">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {listings.map((listing, index) => (
        <ListingCard key={`${listing.id}-${index}`} listing={listing} />
      ))}
    </div>
  )
}
