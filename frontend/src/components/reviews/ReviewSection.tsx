import { useLanguage } from '@/i18n'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useCreateReview, useReviewsBySeller } from '@/hooks/useReviews'
import { useAuthStore } from '@/stores/auth'

interface ReviewSectionProps {
  sellerId: number
  listingId: number
  sellerUsername: string
}

const MINIMUM_PUBLIC_REVIEWS = 3

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <span key={index} className={index < rating ? 'text-yellow-500' : 'text-gray-300'}>
      ★
    </span>
  ))
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return Number.isNaN(date.getTime())
    ? 'Fecha desconocida'
    : date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export function ReviewSection({ sellerId, listingId, sellerUsername }: ReviewSectionProps) {
  const { t } = useLanguage()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const { data: reviews = [], isLoading } = useReviewsBySeller(sellerId)
  const createReview = useCreateReview()

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  }, [reviews])

  const userHasReviewed = reviews.some(
    (review) => review.listing === listingId && review.reviewer === user?.id,
  )

  const canReview =
    isAuthenticated &&
    !!user &&
    user.id !== sellerId &&
    !userHasReviewed

  const hasPublicReviews = reviews.length >= MINIMUM_PUBLIC_REVIEWS

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canReview) return

    createReview.mutate(
      {
        listing: listingId,
        rating,
        comment: comment.trim(),
      },
      {
        onSuccess: () => {
          setComment('')
          setRating(5)
        },
      },
    )
  }

  if (!isLoading && !hasPublicReviews && !canReview) {
    return null
  }

  return (
    <div className="card mt-6">
      {hasPublicReviews ? <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-master-navy">{t('sellerReviews')}</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <div className="flex text-base">{renderStars(Math.round(averageRating || 0))}</div>
            <span>
              {reviews.length > 0 ? `${averageRating.toFixed(1)} · ${reviews.length} reseñas` : t('noReviewsYet')}
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-500">{sellerUsername}</div>
      </div> : null}

      {isLoading ? (
        <div className="mt-6 flex justify-center py-6">
          <LoadingSpinner size="md" />
        </div>
      ) : hasPublicReviews ? (
        <div className="mt-6 space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noSellerReviews')}</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-master-navy">{review.reviewer_username}</p>
                    <div className="mt-1 flex text-sm">{renderStars(review.rating)}</div>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(review.created_at)}</span>
                </div>

                {review.comment && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{review.comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      <div className={hasPublicReviews ? 'mt-6 border-t border-gray-200 pt-6' : ''}>
        {!isAuthenticated ? (
          <p className="text-sm text-gray-500">
            {t('loginToReview')}
          </p>
        ) : user?.id === sellerId ? (
          <p className="text-sm text-gray-500">
            {t('cantReviewOwn')}
          </p>
        ) : userHasReviewed ? (
          <p className="text-sm text-gray-500">
            {t('alreadyReviewed')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!hasPublicReviews ? (
              <div>
                <h2 className="text-lg font-bold text-master-navy">Comparte tu experiencia</h2>
                <p className="mt-1 text-sm text-gray-500">Las reseñas se publicarán cuando exista una muestra suficiente.</p>
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('yourRating')}</label>
              <div className="flex gap-2">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`text-2xl ${value <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                      aria-label={`Puntuar con ${value} estrellas`}
                    >
                      ★
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="review-comment" className="mb-2 block text-sm font-medium text-gray-700">
                {t('commentOptional')}
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder={t('reviewPlaceholder')}
              />
            </div>

            <Button type="submit" variant="primary" isLoading={createReview.isPending}>
              {t('submitReview')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
