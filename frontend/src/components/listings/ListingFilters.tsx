import { useLanguage, type TranslationKey } from '@/i18n'
import { Input } from '@/components/ui/Input'

import type { Category } from '@/types/api'

export interface FiltersValue {
  search: string
  category: number | null
  condition: string
  location: string
  ordering: string
}

interface ListingFiltersProps {
  value: FiltersValue
  onChange: (value: FiltersValue) => void
  categories: Category[]
}

const ORDERING_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: '-created_at', labelKey: 'orderNewest' },
  { value: 'price', labelKey: 'orderPriceLow' },
  { value: '-price', labelKey: 'orderPriceHigh' },
  { value: '-view_count', labelKey: 'orderMostViewed' },
]

export function ListingFilters({ value, onChange, categories }: ListingFiltersProps) {
  const { t } = useLanguage()

  function update<K extends keyof FiltersValue>(key: K, newValue: FiltersValue[K]) {
    onChange({ ...value, [key]: newValue })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Input
            label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={value.search}
            onChange={(e) => update('search', e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="label">{t('category')}</label>
          <select
            className="input"
            value={value.category ?? ''}
            onChange={(e) =>
              update('category', e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">{t('allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="label">{t('ordering')}</label>
          <select
            className="input"
            value={value.ordering}
            onChange={(e) => update('ordering', e.target.value)}
          >
            {ORDERING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
