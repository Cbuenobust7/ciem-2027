import { getCiemProduct, getCiemProductCoverUrl } from '@/data/ciemCatalog'
import { useLanguage, type TranslationKey } from '@/i18n'
import { Link } from 'react-router-dom'

import type { ListingListItem } from '@/types/api'

interface ListingCardProps {
  listing: ListingListItem
}

const CONDITION_LABELS: Record<string, TranslationKey> = {
  new: 'conditionNew',
  like_new: 'conditionLikeNew',
  good: 'conditionGood',
  fair: 'conditionFair',
  for_parts: 'conditionForParts',
}

export function ListingCard({ listing }: ListingCardProps) {
  const { t } = useLanguage()

  const hasImage = !!listing.cover_image
  const product = getCiemProduct(listing.title)

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group block bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className={`${product ? "aspect-video" : "aspect-square"} bg-gray-100 relative overflow-hidden`}>
        {hasImage ? (
          <img
            src={product ? getCiemProductCoverUrl(product) : listing.cover_image!}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {listing.status !== 'active' && (
          <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs font-medium px-2 py-1 rounded">
            {listing.status === 'draft' ? 'Borrador' : listing.status}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-master-navy line-clamp-2 mb-1">{listing.title}</h3>
        <p className="text-lg font-bold text-primary-600 mb-2">
          {product ? t(product.kind === 'commercial' ? 'commercialLicense' : product.kind === 'quote' ? 'quoteProduct' : 'freeBase') : listing.is_free ? 'Gratis' : listing.price ? `${listing.currency} ${listing.price}` : 'A convenir'}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{listing.location || t('noLocationShort')}</span>
          <span>{product ? t(product.kind === 'commercial' ? 'commercialLicense' : product.kind === 'quote' ? 'byRequest' : 'digitalDownload') : t(CONDITION_LABELS[listing.condition] ?? 'conditionGood')}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>{t('bySeller', { username: product ? 'CIEM' : listing.seller_username })}</span>
          <div className="flex items-center gap-3">
            <span>👁 {listing.view_count}</span>
            <span>❤ {listing.favorite_count}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
