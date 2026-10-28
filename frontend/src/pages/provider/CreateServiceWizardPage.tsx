import { useLanguage, type TranslationKey } from '@/i18n'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { categoriesApi } from '@/api/categories'
import { cleaningApi, type ServiceAreaPayload, type CleaningServicePayload } from '@/api/cleaning'
import { visibilityApi } from '@/api/visibility'
import { CompanyAgendaEditor } from '@/components/provider/CompanyAgendaEditor'
import { ProviderAccountGate } from '@/components/provider/ProviderAccountGate'
import {
  EMPTY_FORM,
  ServiceFormFields,
  basePayload,
  cleaningSubcategories,
  isValidDuration,
  type ServiceFormState,
} from '@/components/provider/ServiceFormFields'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateService, useProvider, useProviderResources } from '@/hooks/useCleaning'
import { useSubmitListingReview } from '@/hooks/useListings'
import { cleaningErrorMessage } from '@/lib/cleaning'
import type { CleaningService } from '@/types/api'

/**
 * Asistente de publicación de un servicio (§4 del plan).
 *
 * Una sola puerta: el proveedor de limpieza no publica anuncios, publica
 * servicios. Pasos: 1) datos y duración · 2) agenda de la empresa y zonas de
 * cobertura · 3) enviar a revisión, con las cuatro validaciones de §4.1.
 */
export default function CreateServiceWizardPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ProviderAccountGate>
        {(accountId) => <Wizard accountId={accountId} />}
      </ProviderAccountGate>
    </div>
  )
}

const STEPS: readonly TranslationKey[] = ['stepDataDuration', 'stepScheduleCoverage', 'stepSubmitReview']

function Wizard({ accountId }: { accountId: number }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM)
  const [service, setService] = useState<CleaningService | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agendaRules, setAgendaRules] = useState(0)
  const [newArea, setNewArea] = useState({ city: '', label: '' })
  const [areaError, setAreaError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const createService = useCreateService()
  const submitReview = useSubmitListingReview()

  const { data: tree } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => categoriesApi.tree(),
  })
  const subcategories = cleaningSubcategories(tree)

  const { data: provider } = useProvider(accountId)
  const { data: resourcesPage } = useProviderResources(accountId)
  const resources = resourcesPage?.results ?? []
  const principal = resources.find((item) => item.name === 'Principal') ?? resources[0]

  const { data: citiesPage } = useQuery({
    queryKey: ['visibility', 'cities'],
    queryFn: () => visibilityApi.listCities(),
  })
  const cities = citiesPage?.results ?? []

  const createArea = useMutation({
    mutationFn: (payload: ServiceAreaPayload) =>
      cleaningApi.createServiceArea(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider', accountId] })
      setNewArea({ city: '', label: '' })
      setAreaError(null)
    },
    onError: (err) => setAreaError(cleaningErrorMessage(err)),
  })

  const areas = provider?.service_areas ?? []
  const verification = provider?.verification_status
  const verificationOk = verification === 'pending' || verification === 'verified'

  const dataOk =
    form.title.trim() !== '' &&
    form.description.trim() !== '' &&
    form.price.trim() !== '' &&
    form.category !== '' &&
    isValidDuration(form)

  const agendaOk = agendaRules > 0
  const coverageOk = areas.length > 0
  const readyToSubmit = dataOk && agendaOk && coverageOk && verificationOk

  async function handleContinueFromStep1() {
    setError(null)
    if (!dataOk) {
      setError(t('completeBeforeSubmit'))
      return
    }
    if (service) {
      setStep(2)
      return
    }
    try {
      const created = await createService.mutateAsync({
        ...basePayload(form),
        provider_account: accountId,
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.price.trim(),
        category: Number(form.category),
      } as CleaningServicePayload)
      setService(created)
      setStep(2)
    } catch (err) {
      setError(cleaningErrorMessage(err))
    }
  }

  function handleAddArea() {
    setAreaError(null)
    const label = newArea.label.trim()
    if (!newArea.city || label === '') {
      setAreaError('Elige la ciudad y escribe el distrito.')
      return
    }
    createArea.mutate({
      city: Number(newArea.city),
      district: label.toLowerCase(),
      district_label: label,
    })
  }

  async function handleSubmitReview() {
    if (!service) return
    setError(null)
    try {
      await submitReview.mutateAsync(service.listing)
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-managed-services', accountId] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    } catch (err) {
      setError(cleaningErrorMessage(err))
    }
  }

  if (done && service) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-master-navy">{t('serviceSubmitted')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t('pendingApprovalNote')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => navigate('/my-listings')}>{t('viewMyServices')}</Button>
          <Link to={`/listings/${service.listing}`}>
            <Button variant="secondary">{t('viewListing')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/provider/services" className="text-sm text-primary-600 hover:underline">
          ← Volver a mis servicios
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-master-navy">{t('createServicePlain')}</h1>
        <p className="mt-1 text-gray-600">{t('servicePublishNote')}</p>
      </div>

      <ol className="mb-6 flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3
          const active = step === number
          return (
            <li
              key={t(label)}
              className={`rounded px-3 py-1 ${
                active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {number}. {label}
            </li>
          )
        })}
      </ol>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <ServiceFormFields
            value={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            subcategories={subcategories}
          />
          <Button
            variant="primary"
            className="mt-2 w-full"
            onClick={handleContinueFromStep1}
            isLoading={createService.isPending}
          >
            {service ? 'Continuar' : 'Crear borrador y continuar'}
          </Button>
          <p className="mt-3 text-xs text-gray-500">{t('draftNote')}</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-master-navy">{t('companySchedule')}</h2>
            {principal ? (
              <div className="mt-3">
                <CompanyAgendaEditor
                  accountId={accountId}
                  resourceId={principal.id}
                  onRulesChange={setAgendaRules}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-red-700">{t('noResourceNote')}</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-master-navy">{t('coverageAreas')}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('noDistrictNote')}</p>

            {areas.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {areas.map((area) => (
                  <li
                    key={area.id}
                    className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-700"
                  >
                    {area.district_label || area.district} · {area.city_name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">{t('noDistricts')}</p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="mb-4">
                <label className="label" htmlFor="area_city">{t('city')}</label>
                <select
                  id="area_city"
                  className="input"
                  value={newArea.city}
                  onChange={(event) => setNewArea((current) => ({ ...current, city: event.target.value }))}
                >
                  <option value="">{t('chooseOption')}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label={t('district')}
                name="area_label"
                value={newArea.label}
                onChange={(event) => setNewArea((current) => ({ ...current, label: event.target.value }))}
                placeholder={t('districtPlaceholder')}
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddArea}
              isLoading={createArea.isPending}
            >
              + Añadir zona
            </Button>

            {areaError && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {areaError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>{t('back')}</Button>
            <Button
              variant="primary"
              disabled={!agendaOk || !coverageOk}
              onClick={() => setStep(3)}
            >{t('continue')}</Button>
          </div>

          {(!agendaOk || !coverageOk) && (
            <p className="text-sm text-gray-600">
              Para continuar necesitas{' '}
              {!agendaOk && 'al menos una franja de agenda'}
              {!agendaOk && !coverageOk && ' y '}
              {!coverageOk && 'al menos una zona de cobertura'}.
            </p>
          )}
        </div>
      )}

      {step === 3 && service && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-master-navy">{t('summary')}</h2>
            <dl className="mt-3 space-y-1 text-sm text-gray-700">
              <div>
                <dt className="inline font-medium">{t('serviceLabel')}</dt>
                <dd className="inline">{service.title}</dd>
              </div>
              <div>
                <dt className="inline font-medium">{t('durationLabel')}</dt>
                <dd className="inline">{service.duration_minutes} min</dd>
              </div>
              <div>
                <dt className="inline font-medium">{t('scheduleSlotsLabel')}</dt>
                <dd className="inline">{agendaRules}</dd>
              </div>
              <div>
                <dt className="inline font-medium">{t('coverageLabel')}</dt>
                <dd className="inline">{areas.length}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-master-navy">{t('beforeSubmitting')}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <Check ok={dataOk} label={t('checkDuration')} />
              <Check ok={agendaOk} label={t('checkSlot')} />
              <Check ok={coverageOk} label={t('checkCoverage')} />
              <Check
                ok={verificationOk}
                label={`Cuenta en proceso de verificación o verificada (estado: ${verification ?? 'desconocido'})`}
              />
            </ul>

            {!verificationOk && verification && (
              <p className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                Puedes preparar servicios y agenda; aún no recibirás reservas.
                Mientras la cuenta esté «{verification}» la reserva no podrá
                confirmarse.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>{t('back')}</Button>
            <Button
              variant="primary"
              disabled={!readyToSubmit}
              isLoading={submitReview.isPending}
              onClick={handleSubmitReview}
            >{t('stepSubmitReview')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? 'text-green-700' : 'text-red-700'}>
      {ok ? '✓' : '✗'} {label}
    </li>
  )
}
