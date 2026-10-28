import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { CleaningNav } from '@/components/cleaning/CleaningNav'
import { ProviderAccountGate } from '@/components/provider/ProviderAccountGate'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  useAvailability,
  useProvider,
  useProviderResources,
  useProviderServices,
  useReplaceResourceSchedule,
  useResourceSchedule,
} from '@/hooks/useCleaning'
import {
  AVAILABILITY_REASON_LABELS,
  EXCEPTION_KIND_LABELS,
  WEEKDAY_LABELS,
  addDays,
  cleaningErrorMessage,
  formatDayLabel,
  formatTime,
  localInputToUtcIso,
  todayIso,
  utcIsoToLocalInput,
} from '@/lib/cleaning'
import type {
  ProviderResource,
  ProviderServiceSummary,
  ResourceSchedulePayload,
} from '@/types/api'

export default function ProviderSchedulePage() {
  const { t } = useLanguage()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <CleaningNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-master-navy">{t('mySchedule')}</h1>
        <p className="mt-1 text-gray-600">{t('scheduleSubtitle')}</p>
      </div>

      <ProviderAccountGate>
        {(accountId) => <SchedulePanel accountId={accountId} />}
      </ProviderAccountGate>
    </div>
  )
}

// ============================================================
// Panel: recursos de la cuenta y agenda del recurso elegido
// ============================================================

function SchedulePanel({ accountId }: { accountId: number }) {
  const { t } = useLanguage()
  const resourcesQuery = useProviderResources(accountId)
  const providerQuery = useProvider(accountId)
  const resources = resourcesQuery.data?.results ?? []
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // El recurso elegido sobrevive a los re-render, pero se corrige si desaparece.
  useEffect(() => {
    if (resources.length === 0) {
      setSelectedId(null)
      return
    }
    if (selectedId === null || !resources.some((r) => r.id === selectedId)) {
      setSelectedId(resources[0].id)
    }
  }, [resources, selectedId])

  const selected = resources.find((r) => r.id === selectedId) ?? null
  // La zona del recurso manda; si no define una, la de la cuenta (ADR-07).
  const timeZone =
    selected?.timezone || providerQuery.data?.timezone || 'America/Lima'

  if (resourcesQuery.isLoading) {
    return <LoadingSpinner size="lg" />
  }

  if (resourcesQuery.isError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t('resourcesLoadError')}</div>
    )
  }

  if (resources.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-gray-600">{t('noScheduleResources')}</p>
        <p className="mt-1 text-sm text-gray-500">{t('resourceOwnSchedule')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {resources.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {resources.map((resource) => (
            <button
              key={resource.id}
              type="button"
              onClick={() => setSelectedId(resource.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                resource.id === selectedId
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {resource.name}
              {!resource.is_active && (
                <span className="ml-1 text-xs text-gray-400">(inactivo)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ResourceScheduleEditor
          accountId={accountId}
          resource={selected}
          timeZone={timeZone}
        />
      )}

      <EffectiveAvailability accountId={accountId} />
    </div>
  )
}

// ============================================================
// Editor de la agenda de un recurso
// ============================================================

interface RuleDraft {
  weekday: number
  start_time: string
  end_time: string
  valid_from: string
  valid_to: string
  is_active: boolean
}

interface ExceptionDraft {
  kind: 'unavailable' | 'extra_available'
  /** Hora local del recurso, formato `YYYY-MM-DDTHH:mm` del input. */
  starts_at: string
  ends_at: string
  reason: string
}

const EMPTY_RULE: RuleDraft = {
  weekday: 0,
  start_time: '08:00',
  end_time: '12:00',
  valid_from: '',
  valid_to: '',
  is_active: true,
}

const EMPTY_EXCEPTION: ExceptionDraft = {
  kind: 'unavailable',
  starts_at: '',
  ends_at: '',
  reason: '',
}

function ResourceScheduleEditor({
  accountId,
  resource,
  timeZone,
}: {
  accountId: number
  resource: ProviderResource
  timeZone: string
}) {
  const { t } = useLanguage()
  const query = useResourceSchedule(accountId, resource.id)
  const mutation = useReplaceResourceSchedule(accountId, resource.id)
  const [rules, setRules] = useState<RuleDraft[]>([])
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!query.data) return
    setRules(
      query.data.rules.map((rule) => ({
        weekday: rule.weekday,
        start_time: rule.start_time.slice(0, 5),
        end_time: rule.end_time.slice(0, 5),
        valid_from: rule.valid_from ?? '',
        valid_to: rule.valid_to ?? '',
        is_active: rule.is_active,
      })),
    )
    setExceptions(
      query.data.exceptions.map((exception) => ({
        kind: exception.kind,
        starts_at: utcIsoToLocalInput(exception.starts_at, timeZone),
        ends_at: utcIsoToLocalInput(exception.ends_at, timeZone),
        reason: exception.reason,
      })),
    )
    setSaved(null)
    setProblem(null)
  }, [query.data, timeZone])

  const updateRule = (index: number, patch: Partial<RuleDraft>) => {
    setRules((current) =>
      current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    )
  }

  const updateException = (index: number, patch: Partial<ExceptionDraft>) => {
    setExceptions((current) =>
      current.map((exception, i) =>
        i === index ? { ...exception, ...patch } : exception,
      ),
    )
  }

  const save = async () => {
    setSaved(null)
    setProblem(null)

    // Validación local para avisar al instante; el servidor valida igual.
    if (rules.some((rule) => rule.end_time <= rule.start_time)) {
      setProblem('Hay una regla con la hora de fin anterior o igual a la de inicio.')
      return
    }
    if (rules.some((rule) => rule.valid_from && rule.valid_to && rule.valid_to < rule.valid_from)) {
      setProblem('Hay una regla con la fecha final anterior a la inicial.')
      return
    }
    if (
      exceptions.some(
        (exception) =>
          !exception.starts_at ||
          !exception.ends_at ||
          exception.ends_at <= exception.starts_at,
      )
    ) {
      setProblem('Revisa las excepciones: faltan fechas o el fin no es posterior al inicio.')
      return
    }

    const payload: ResourceSchedulePayload = {
      rules: rules.map((rule) => ({
        weekday: rule.weekday,
        start_time: rule.start_time,
        end_time: rule.end_time,
        valid_from: rule.valid_from || null,
        valid_to: rule.valid_to || null,
        is_active: rule.is_active,
      })),
      exceptions: exceptions.map((exception) => ({
        kind: exception.kind,
        starts_at: localInputToUtcIso(exception.starts_at, timeZone),
        ends_at: localInputToUtcIso(exception.ends_at, timeZone),
        reason: exception.reason,
      })),
    }

    try {
      await mutation.mutateAsync(payload)
      setSaved('Agenda guardada. La disponibilidad ya refleja los cambios.')
    } catch (caught) {
      setProblem(cleaningErrorMessage(caught))
    }
  }

  if (query.isLoading) {
    return <LoadingSpinner size="md" />
  }

  if (query.isError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se pudo cargar la agenda de {resource.name}.
      </div>
    )
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-master-navy">
            Agenda de {resource.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t('timesIn')}<strong>{timeZone}</strong>. Guardar reemplaza toda la
            agenda de este recurso.
          </p>
        </div>
        <Button onClick={save} isLoading={mutation.isPending}>{t('saveSchedule')}</Button>
      </div>

      {saved && (
        <p className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {saved}
        </p>
      )}
      {problem && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {problem}
        </p>
      )}

      {/* --- Reglas semanales --- */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-master-navy">{t('weeklyRules')}</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRules((current) => [...current, { ...EMPTY_RULE }])}
          >{t('addRule')}</Button>
        </div>

        {rules.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('noRules')}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-12"
              >
                <label className="sm:col-span-3">
                  <span className="label">{t('day')}</span>
                  <select
                    className="input"
                    value={rule.weekday}
                    onChange={(event) =>
                      updateRule(index, { weekday: Number(event.target.value) })
                    }
                  >
                    {WEEKDAY_LABELS.map((label, weekday) => (
                      <option key={weekday} value={weekday}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t('from')}</span>
                  <input
                    type="time"
                    className="input"
                    value={rule.start_time}
                    onChange={(event) =>
                      updateRule(index, { start_time: event.target.value })
                    }
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t('to')}</span>
                  <input
                    type="time"
                    className="input"
                    value={rule.end_time}
                    onChange={(event) =>
                      updateRule(index, { end_time: event.target.value })
                    }
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t('validFrom')}</span>
                  <input
                    type="date"
                    className="input"
                    value={rule.valid_from}
                    onChange={(event) =>
                      updateRule(index, { valid_from: event.target.value })
                    }
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t('validTo')}</span>
                  <input
                    type="date"
                    className="input"
                    value={rule.valid_to}
                    onChange={(event) =>
                      updateRule(index, { valid_to: event.target.value })
                    }
                  />
                </label>

                <div className="flex items-end justify-between gap-2 sm:col-span-1">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={rule.is_active}
                      onChange={(event) =>
                        updateRule(index, { is_active: event.target.checked })
                      }
                    />{t('activeRule')}</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRules((current) => current.filter((_, i) => i !== index))
                    }
                    aria-label={t('removeRule')}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Excepciones --- */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-master-navy">{t('exceptions')}</h3>
            <p className="text-sm text-gray-500">{t('exceptionsSubtitle')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setExceptions((current) => [...current, { ...EMPTY_EXCEPTION }])
            }
          >{t('addException')}</Button>
        </div>

        {exceptions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('noExceptions')}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {exceptions.map((exception, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-12"
              >
                <label className="sm:col-span-3">
                  <span className="label">{t('type')}</span>
                  <select
                    className="input"
                    value={exception.kind}
                    onChange={(event) =>
                      updateException(index, {
                        kind: event.target.value as ExceptionDraft['kind'],
                      })
                    }
                  >
                    {Object.entries(EXCEPTION_KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-3">
                  <span className="label">{t('from')}</span>
                  <input
                    type="datetime-local"
                    className="input"
                    value={exception.starts_at}
                    onChange={(event) =>
                      updateException(index, { starts_at: event.target.value })
                    }
                  />
                </label>

                <label className="sm:col-span-3">
                  <span className="label">{t('to')}</span>
                  <input
                    type="datetime-local"
                    className="input"
                    value={exception.ends_at}
                    onChange={(event) =>
                      updateException(index, { ends_at: event.target.value })
                    }
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t('reason')}</span>
                  <input
                    type="text"
                    className="input"
                    value={exception.reason}
                    placeholder={t('holidaysExample')}
                    onChange={(event) =>
                      updateException(index, { reason: event.target.value })
                    }
                  />
                </label>

                <div className="flex items-end sm:col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExceptions((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={t('removeException')}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ============================================================
// Disponibilidad efectiva (lo que ve el cliente)
// ============================================================

function EffectiveAvailability({ accountId }: { accountId: number }) {
  const { t } = useLanguage()
  const { data, isLoading, isError } = useProviderServices(accountId)
  const services = data?.results ?? []

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-master-navy">{t('effectiveAvailability')}</h2>
        <p className="text-sm text-gray-500">{t('effectiveAvailabilityNote')}</p>
      </div>

      {isLoading ? (
        <LoadingSpinner size="md" />
      ) : isError ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t('servicesLoadError')}</div>
      ) : services.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">{t('noServicesForAvailability')}</p>
          <Link
            to="/provider/services"
            className="mt-4 inline-block text-primary-600 hover:underline"
          >{t('createServicePlain')}</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {services.map((service) => (
            <ServiceAvailability
              key={service.listing_id}
              accountId={accountId}
              service={service}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ServiceAvailability({
  accountId,
  service,
}: {
  accountId: number
  service: ProviderServiceSummary
}) {
  const { t } = useLanguage()
  const from = todayIso()
  const to = addDays(from, 6)

  const { data, isLoading, isError } = useAvailability(accountId, {
    service: service.listing_id,
    from,
    to,
  })

  const timezone = data?.timezone
  const resources = new Map<number, string>()
  data?.days.forEach((day) => {
    day.slots.forEach((slot) => resources.set(slot.resource_id, slot.resource_name))
  })

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-master-navy">{service.title}</h3>
        <Link
          to={`/listings/${service.listing_id}`}
          className="text-sm text-primary-600 hover:underline"
        >{t('viewListingShort')}</Link>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {service.duration_minutes} min ·{' '}
        {resources.size > 0
          ? `recursos con huecos: ${Array.from(resources.values()).join(', ')}`
          : 'sin huecos en la ventana'}
      </p>

      {isLoading ? (
        <LoadingSpinner size="md" />
      ) : isError ? (
        <p className="mt-3 text-sm text-red-600">{t('availabilityQueryError')}</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.days ?? []).map((day) => (
            <div
              key={day.date}
              className={`rounded-lg border p-3 text-sm ${
                day.slots.length > 0
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <p className="font-medium capitalize text-master-navy">
                {formatDayLabel(day.date, timezone)}
              </p>

              {day.slots.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                  {day.slots.slice(0, 6).map((slot) => (
                    <li key={`${slot.start}-${slot.resource_id}`}>
                      {formatTime(slot.start, timezone)} –{' '}
                      {formatTime(slot.end, timezone)}
                      <span className="text-gray-400"> · {slot.resource_name}</span>
                    </li>
                  ))}
                  {day.slots.length > 6 && (
                    <li className="text-gray-400">
                      +{day.slots.length - 6} horario(s) más
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {t(AVAILABILITY_REASON_LABELS[day.reason ?? '']) ??
                    day.reason ??
                    'Sin horarios'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
