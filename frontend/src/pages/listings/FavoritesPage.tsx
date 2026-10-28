import { useLanguage } from '@/i18n'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useFavorites, useRemoveFavorite } from '@/hooks/useFavorites'
import type { Favorite } from '@/types/api'

export default function FavoritesPage() {
  const { t } = useLanguage()
  const { data, isLoading, isError } = useFavorites()
  const removeFavorite = useRemoveFavorite()

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
          {t('favoritesLoadError')}
        </div>
      </div>
    )
  }

  const favorites = data?.results ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-master-navy">{t('myFavorites')}</h1>
        <p className="mt-1 text-gray-600">
          {t('myFavoritesSubtitle')}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">{t('noFavoritesYet')}</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="primary">{t('exploreListings')}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((favorite) => (
            <FavoriteRow
              key={favorite.id}
              favorite={favorite}
              onRemove={() =>
                removeFavorite.mutate({
                  favoriteId: favorite.id,
                  listingId: favorite.listing,
                })
              }
              isRemoving={removeFavorite.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FavoriteRowProps {
  favorite: Favorite
  onRemove: () => void
  isRemoving: boolean
}

function FavoriteRow({ favorite, onRemove, isRemoving }: FavoriteRowProps) {
  const { t } = useLanguage()
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to={`/listings/${favorite.listing}`}
            className="font-semibold text-master-navy hover:text-primary-600"
          >
            {favorite.listing_title}
          </Link>
          <p className="mt-1 text-sm text-gray-500">
            por {favorite.listing_seller}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/listings/${favorite.listing}`}>
            <Button variant="ghost" size="sm">
              {t('view')}
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            isLoading={isRemoving}
          >
            ❤ Quitar
          </Button>
        </div>
      </div>
    </div>
  )
}
