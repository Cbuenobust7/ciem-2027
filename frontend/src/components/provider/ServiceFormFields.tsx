import { useLanguage } from '@/i18n'
import { Input } from '@/components/ui/Input'
import type { CleaningServicePayload } from '@/api/cleaning'
import type { CategoryTree } from '@/types/api'

/**
 * Estado y campos del alta/edición de un servicio de limpieza.
 *
 * Vive fuera de `ProviderServicesPage` porque lo comparten tres sitios: el alta
 * desde el panel, la edición de un servicio y el asistente de publicación
 * (`/provider/services/new`). Una sola fuente de verdad para el formulario.
 */
export interface ServiceFormState {
  title: string
  description: string
  price: string
  currency: string
  category: string
  location: string
  duration_minutes: string
  buffer_minutes: string
  capacity: string
  min_notice_hours: string
  max_horizon_days: string
  cancellation_hours: string
  max_per_day: string
  requires_deposit: boolean
  deposit_amount: string
  resolves_address: boolean
  is_instant: boolean
  is_active: boolean
}

export const EMPTY_FORM: ServiceFormState = {
  title: '',
  description: '',
  price: '',
  currency: 'PEN',
  category: '',
  location: '',
  duration_minutes: '120',
  buffer_minutes: '30',
  capacity: '1',
  min_notice_hours: '12',
  max_horizon_days: '30',
  cancellation_hours: '24',
  max_per_day: '',
  requires_deposit: false,
  deposit_amount: '0',
  resolves_address: false,
  is_instant: false,
  is_active: true,
}

export function intOrUndefined(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Campos de escritura del serializer, sin `provider_account` ni validaciones. */
export function basePayload(form: ServiceFormState): Partial<CleaningServicePayload> {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    price: form.price.trim(),
    currency: form.currency,
    category: intOrUndefined(form.category),
    location: form.location.trim(),
    duration_minutes: intOrUndefined(form.duration_minutes),
    buffer_minutes: intOrUndefined(form.buffer_minutes),
    capacity: intOrUndefined(form.capacity),
    min_notice_hours: intOrUndefined(form.min_notice_hours),
    max_horizon_days: intOrUndefined(form.max_horizon_days),
    cancellation_hours: intOrUndefined(form.cancellation_hours),
    max_per_day: intOrUndefined(form.max_per_day) ?? null,
    requires_deposit: form.requires_deposit,
    deposit_amount: form.deposit_amount.trim() || '0',
    resolves_address: form.resolves_address,
    is_instant: form.is_instant,
    is_active: form.is_active,
  }
}

/** Subcategorías de la raíz `limpieza`, las únicas válidas para un servicio. */
export function cleaningSubcategories(tree: CategoryTree[] | undefined): CategoryTree[] {
  return tree?.find((item) => item.slug === 'limpieza')?.children ?? []
}

/**
 * ¿La duración es válida? Las mismas reglas que el `clean()` del modelo
 * (`ServiceDetails`): entre 1 y 720 minutos.
 */
export function isValidDuration(form: ServiceFormState): boolean {
  const minutes = intOrUndefined(form.duration_minutes)
  return minutes !== undefined && minutes >= 1 && minutes <= 720
}

export function ServiceFormFields({
  value,
  onChange,
  subcategories,
}: {
  value: ServiceFormState
  onChange: (patch: Partial<ServiceFormState>) => void
  subcategories: CategoryTree[]
}) {
  const { t } = useLanguage()
  return (
    <div>
      <Input
        label={t('title')}
        name="title"
        value={value.title}
        onChange={(event) => onChange({ title: event.target.value })}
        placeholder={t('serviceTitlePlaceholder')}
      />

      <div className="mb-4">
        <label className="label" htmlFor="service_description">
          {t('description')}
        </label>
        <textarea
          id="service_description"
          className="input"
          rows={3}
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder={t('serviceDescriptionPlaceholder')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={t('price')}
          name="price"
          inputMode="decimal"
          value={value.price}
          onChange={(event) => onChange({ price: event.target.value })}
          placeholder={t('priceExample')}
        />

        <div className="mb-4">
          <label className="label" htmlFor="service_currency">
            {t('currency')}
          </label>
          <select
            id="service_currency"
            className="input"
            value={value.currency}
            onChange={(event) => onChange({ currency: event.target.value })}
          >
            <option value="PEN">PEN</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="label" htmlFor="service_category">
            {t('category')}
          </label>
          <select
            id="service_category"
            className="input"
            value={value.category}
            onChange={(event) => onChange({ category: event.target.value })}
          >
            <option value="">{t('chooseOption')}</option>
            {subcategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Input
        label={t('location')}
        name="location"
        value={value.location}
        onChange={(event) => onChange({ location: event.target.value })}
        placeholder={t('cityPlaceholder')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={t('durationMinutes')}
          name="duration_minutes"
          inputMode="numeric"
          value={value.duration_minutes}
          onChange={(event) => onChange({ duration_minutes: event.target.value })}
        />
        <Input
          label={t('bufferMinutes')}
          name="buffer_minutes"
          inputMode="numeric"
          value={value.buffer_minutes}
          onChange={(event) => onChange({ buffer_minutes: event.target.value })}
        />
        <Input
          label={t('capacityPerSlot')}
          name="capacity"
          inputMode="numeric"
          value={value.capacity}
          onChange={(event) => onChange({ capacity: event.target.value })}
        />
        <Input
          label={t('minNoticeHours')}
          name="min_notice_hours"
          inputMode="numeric"
          value={value.min_notice_hours}
          onChange={(event) => onChange({ min_notice_hours: event.target.value })}
        />
        <Input
          label={t('bookingHorizonDays')}
          name="max_horizon_days"
          inputMode="numeric"
          value={value.max_horizon_days}
          onChange={(event) => onChange({ max_horizon_days: event.target.value })}
        />
        <Input
          label={t('freeCancellationHours')}
          name="cancellation_hours"
          inputMode="numeric"
          value={value.cancellation_hours}
          onChange={(event) => onChange({ cancellation_hours: event.target.value })}
        />
        <Input
          label={t('maxPerDay')}
          name="max_per_day"
          inputMode="numeric"
          value={value.max_per_day}
          onChange={(event) => onChange({ max_per_day: event.target.value })}
          hint={t('emptyMeansUnlimited')}
        />
        <Input
          label={t('deposit')}
          name="deposit_amount"
          inputMode="decimal"
          value={value.deposit_amount}
          onChange={(event) => onChange({ deposit_amount: event.target.value })}
        />
      </div>

      <div className="mb-4 space-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.requires_deposit}
            onChange={(event) => onChange({ requires_deposit: event.target.checked })}
          />
          {t('requiresDeposit')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.is_instant}
            onChange={(event) => onChange({ is_instant: event.target.checked })}
          />
          {t('instantConfirmation')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.resolves_address}
            onChange={(event) => onChange({ resolves_address: event.target.checked })}
          />
          {t('serviceResolvesAddress')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.is_active}
            onChange={(event) => onChange({ is_active: event.target.checked })}
          />
          {t('serviceActive')}
        </label>
      </div>
    </div>
  )
}
