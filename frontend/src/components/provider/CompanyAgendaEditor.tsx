import { useLanguage, type TranslationKey } from '@/i18n'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useReplaceResourceSchedule, useResourceSchedule } from '@/hooks/useCleaning'
import { cleaningErrorMessage } from '@/lib/cleaning'
import type { ResourceSchedulePayload } from '@/types/api'

/** `weekday` 0 = lunes, como el modelo `AvailabilityRule`. */
const WEEKDAYS: readonly TranslationKey[] = [
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
  'weekdaySun',
]

interface RuleDraft {
  weekday: number
  start_time: string
  end_time: string
}

const PRESETS: { labelKey: TranslationKey; days: number[]; start: string; end: string }[] = [
  { labelKey: 'presetWeekdays', days: [0, 1, 2, 3, 4], start: '09:00', end: '18:00' },
  { labelKey: 'presetWeekdaysSat', days: [0, 1, 2, 3, 4, 5], start: '08:00', end: '17:00' },
]

function toDrafts(rules: { weekday: number; start_time: string; end_time: string }[]): RuleDraft[] {
  return rules.map((rule) => ({
    weekday: rule.weekday,
    start_time: rule.start_time.slice(0, 5),
    end_time: rule.end_time.slice(0, 5),
  }))
}

/**
 * Agenda semanal de la empresa (§5.2 del plan): una sola agenda, la del recurso
 * «Principal».
 *
 * El `PUT` del backend **reemplaza** la agenda completa del recurso, así que al
 * guardar se reenvían las excepciones ya cargadas para no borrarlas.
 *
 * `onRulesChange` debe ser una función estable (por ejemplo el `setState` del
 * padre) para no repetir el efecto en cada render.
 */
export function CompanyAgendaEditor({
  accountId,
  resourceId,
  onRulesChange,
}: {
  accountId: number
  resourceId: number
  onRulesChange?: (ruleCount: number) => void
}) {
  const { t } = useLanguage()
  const { data, isLoading, isError } = useResourceSchedule(accountId, resourceId)
  const replace = useReplaceResourceSchedule(accountId, resourceId)

  const [rules, setRules] = useState<RuleDraft[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!data || rules !== null) return
    setRules(toDrafts(data.rules))
    onRulesChange?.(data.rules.length)
  }, [data, rules, onRulesChange])

  if (isLoading || rules === null) {
    return <LoadingSpinner size="md" />
  }

  if (isError) {
    return (
      <p className="text-sm text-red-700">{t('agendaLoadError')}</p>
    )
  }

  function updateRule(index: number, patch: Partial<RuleDraft>) {
    setDirty(true)
    setRules((current) =>
      current ? current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)) : current,
    )
  }

  function addRule() {
    setDirty(true)
    setRules((current) => [
      ...(current ?? []),
      { weekday: 0, start_time: '09:00', end_time: '18:00' },
    ])
  }

  function removeRule(index: number) {
    setDirty(true)
    setRules((current) => (current ? current.filter((_, i) => i !== index) : current))
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setDirty(true)
    setRules(
      preset.days.map((weekday) => ({
        weekday,
        start_time: preset.start,
        end_time: preset.end,
      })),
    )
  }

  async function handleSave() {
    if (!rules) return
    setMessage(null)
    setError(null)

    const invalid = rules.some(
      (rule) => !rule.start_time || !rule.end_time || rule.start_time >= rule.end_time,
    )
    if (invalid) {
      setError('Cada franja necesita una hora de inicio anterior a la hora de fin.')
      return
    }

    const payload: ResourceSchedulePayload = {
      rules: rules.map((rule) => ({
        weekday: rule.weekday,
        start_time: rule.start_time,
        end_time: rule.end_time,
        valid_from: null,
        valid_to: null,
        is_active: true,
      })),
      // El PUT reemplaza todo: se conservan las excepciones ya existentes.
      exceptions: (data?.exceptions ?? []).map((exception) => ({
        kind: exception.kind,
        starts_at: exception.starts_at,
        ends_at: exception.ends_at,
        reason: exception.reason,
      })),
    }

    try {
      const saved = await replace.mutateAsync(payload)
      setRules(toDrafts(saved.rules))
      setDirty(false)
      setMessage(`Agenda guardada: ${saved.rules.length} franja(s) semanales.`)
      onRulesChange?.(saved.rules.length)
    } catch (err) {
      setError(cleaningErrorMessage(err))
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-600">{t('agendaIntro')}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button key={preset.labelKey} variant="ghost" size="sm" onClick={() => applyPreset(preset)}>
            {t(preset.labelKey)}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rules.length === 0 && (
          <p className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">{t('noSlotsWarning')}</p>
        )}

        {rules.map((rule, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="mb-4">
              <label className="label" htmlFor={`agenda_day_${index}`}>{t('day')}</label>
              <select
                id={`agenda_day_${index}`}
                className="input"
                value={rule.weekday}
                onChange={(event) => updateRule(index, { weekday: Number(event.target.value) })}
              >
                {WEEKDAYS.map((name, weekday) => (
                  <option key={name} value={weekday}>
                    {t(name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="label" htmlFor={`agenda_start_${index}`}>{t('from')}</label>
              <input
                id={`agenda_start_${index}`}
                type="time"
                className="input"
                value={rule.start_time}
                onChange={(event) => updateRule(index, { start_time: event.target.value })}
              />
            </div>

            <div className="mb-4">
              <label className="label" htmlFor={`agenda_end_${index}`}>{t('to')}</label>
              <input
                id={`agenda_end_${index}`}
                type="time"
                className="input"
                value={rule.end_time}
                onChange={(event) => updateRule(index, { end_time: event.target.value })}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => removeRule(index)}
            >{t('remove')}</Button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={addRule}>
          + Añadir franja
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          isLoading={replace.isPending}
          disabled={!dirty}
        >{t('saveSchedule')}</Button>
        {dirty && (
          <span className="text-xs text-yellow-700">{t('unsavedChanges')}</span>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-gray-500">{t('agendaSaveNote')}</p>
    </div>
  )
}
