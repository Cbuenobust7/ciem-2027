import { useLanguage } from '@/i18n'
import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'

import { categoriesApi } from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ListingCondition, ListingDetail } from '@/types/api'

export type ListingFormMode = 'create' | 'edit'

interface ListingFormProps {
  mode: ListingFormMode
  initialValues?: Partial<ListingDetail>
  onSubmit: (payload: {
    title: string
    description: string
    price: string | null
    currency: string
    is_negotiable: boolean
    is_free: boolean
    category: number | null
    condition: ListingCondition
    location: string
  }) => Promise<void> | void
  isSubmitting?: boolean
  submitLabel?: string
}

const EMPTY_FORM = {
  title: '',
  description: '',
  price: '',
  currency: 'PEN',
  is_negotiable: false,
  is_free: false,
  category: '',
  condition: 'good' as ListingCondition,
  location: '',
}

export function ListingForm({
  mode,
  initialValues,
  onSubmit,
  isSubmitting = false,
  submitLabel,
}: ListingFormProps) {
  const { t } = useLanguage()

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categories = categoriesData?.results ?? []

  const [title, setTitle] = useState(initialValues?.title ?? EMPTY_FORM.title)
  const [description, setDescription] = useState(initialValues?.description ?? EMPTY_FORM.description)
  const [price, setPrice] = useState(
    initialValues?.price !== null && initialValues?.price !== undefined ? String(initialValues.price) : EMPTY_FORM.price,
  )
  const [currency, setCurrency] = useState(initialValues?.currency ?? EMPTY_FORM.currency)
  const [isNegotiable, setIsNegotiable] = useState(initialValues?.is_negotiable ?? EMPTY_FORM.is_negotiable)
  const [isFree, setIsFree] = useState(initialValues?.is_free ?? EMPTY_FORM.is_free)
  const [category, setCategory] = useState(
    initialValues?.category != null ? String(initialValues.category) : EMPTY_FORM.category,
  )
  const [condition, setCondition] = useState<ListingCondition>(
    initialValues?.condition ?? EMPTY_FORM.condition,
  )
  const [location, setLocation] = useState(initialValues?.location ?? EMPTY_FORM.location)

  useEffect(() => {
    if (initialValues?.title !== undefined) setTitle(initialValues.title)
    if (initialValues?.description !== undefined) setDescription(initialValues.description)
    if (initialValues?.price !== undefined) {
      setPrice(initialValues.price !== null ? String(initialValues.price) : '')
    }
    if (initialValues?.currency !== undefined) setCurrency(initialValues.currency)
    if (initialValues?.is_negotiable !== undefined) setIsNegotiable(initialValues.is_negotiable)
    if (initialValues?.is_free !== undefined) setIsFree(initialValues.is_free)
    if (initialValues?.category !== undefined) {
      setCategory(initialValues.category != null ? String(initialValues.category) : '')
    }
    if (initialValues?.condition !== undefined) setCondition(initialValues.condition)
    if (initialValues?.location !== undefined) setLocation(initialValues.location)
  }, [initialValues])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await onSubmit({
      title,
      description,
      price: isFree || price === '' ? null : price,
      currency,
      is_negotiable: isNegotiable,
      is_free: isFree,
      category: category ? Number(category) : null,
      condition,
      location,
    })
  }

  const actionLabel = submitLabel ?? (mode === 'create' ? 'Crear anuncio' : 'Guardar cambios')

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"
    >
      <Input
        label={t('title')}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('description')}
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('price')}
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          disabled={isFree}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('currency')}
          </label>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            disabled={isFree}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('category')}
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t('selectCategory')}</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">{t('condition')}</label>
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as ListingCondition)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="new">{t('conditionNew')}</option>
          <option value="like_new">{t('conditionLikeNew')}</option>
          <option value="good">{t('conditionGood')}</option>
          <option value="fair">{t('conditionFair')}</option>
          <option value="for_parts">{t('conditionForParts')}</option>
        </select>
      </div>

      <Input
        label={t('location')}
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        placeholder={t('locationPlaceholder')}
        required
      />

      <div className="space-y-3 border-t border-gray-200 pt-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(event) => {
              setIsFree(event.target.checked)
              if (event.target.checked) {
                setPrice('')
                setIsNegotiable(false)
              }
            }}
          />
          {t('publishFree')}
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isNegotiable}
            onChange={(event) => setIsNegotiable(event.target.checked)}
            disabled={isFree}
          />
          {t('negotiablePrice')}
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => window.history.back()}>
          {t('cancel')}
        </Button>

        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {actionLabel}
        </Button>
      </div>
    </form>
  )
}
