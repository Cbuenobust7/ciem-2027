import axios from 'axios'

import type {
  BookingPaymentStatus,
  BookingStatus,
  CleaningApiError,
  ProviderKind,
  ProviderParticipationStatus,
  ProviderVerificationStatus,
} from '@/types/api'
import type { TranslationKey } from '@/i18n'

// ============================================================
// Etiquetas y colores de la vertical
// ============================================================

export const KIND_LABELS: Record<ProviderKind, TranslationKey> = {
  individual: 'individual',
  company: 'company',

}

export const PARTICIPATION_LABELS: Record<ProviderParticipationStatus, TranslationKey> = {
  directory: 'participationDirectory',
  claimed: 'participationClaimed',
  partner: 'participationPartner',
  verified_partner: 'participationVerifiedPartner',
  suspended: 'participationSuspended',
  removed: 'participationRemoved',
}

export const PARTICIPATION_CLASSES: Record<ProviderParticipationStatus, string> = {
  directory: 'bg-slate-100 text-slate-700',
  claimed: 'bg-amber-100 text-amber-800',
  partner: 'bg-blue-100 text-blue-800',
  verified_partner: 'bg-green-100 text-green-800',
  suspended: 'bg-gray-100 text-gray-700',
  removed: 'bg-gray-100 text-gray-500',
}

export const VERIFICATION_LABELS: Record<ProviderVerificationStatus, TranslationKey> = {
  pending: 'verificationLabelPending',
  verified: 'verificationLabelVerified',
  rejected: 'verificationLabelRejected',
  suspended: 'verificationLabelSuspended',

}

export const VERIFICATION_CLASSES: Record<ProviderVerificationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-700',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, TranslationKey> = {
  requested: 'bookingLabelRequested',
  confirmed: 'bookingLabelConfirmed',
  in_progress: 'bookingLabelInProgress',
  completed: 'bookingLabelCompleted',
  cancelled: 'bookingLabelCancelled',
  expired: 'bookingLabelExpired',

}

export const BOOKING_STATUS_CLASSES: Record<BookingStatus, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-700',
}

export const PAYMENT_STATUS_LABELS: Record<BookingPaymentStatus, TranslationKey> = {
  unpaid: 'paymentLabelUnpaid',
  deposit_paid: 'paymentLabelDepositPaid',
  paid: 'paymentLabelPaid',
  refunded: 'paymentLabelRefunded',

}

/** `reason` informativo de un día sin huecos (§5.2). */
export const AVAILABILITY_REASON_LABELS: Record<string, TranslationKey> = {
  fuera_de_horario: 'reasonOutsideHours',
  excepcion_no_disponible: 'reasonException',
  sin_disponibilidad: 'reasonNoAvailability',
  sin_recurso: 'reasonNoResource',
  reservado: 'reasonFullyBooked',
  pasado: 'reasonPast',
  demasiado_pronto: 'reasonTooSoon',

}

/** Mensajes por `code` estable del contrato de error (§5.2/§5.3). */
export const CLEANING_ERROR_MESSAGES: Record<string, string> = {
  slot_unavailable: 'Ese horario se acaba de ocupar. Elige otro, por favor.',
  too_soon: 'Falta muy poca antelación para ese horario.',
  beyond_horizon: 'Esa fecha queda más allá del horizonte de reserva del servicio.',
  outside_service_area: 'La dirección indicada queda fuera de la zona de cobertura.',
  provider_not_verified: 'El proveedor aún no está habilitado para recibir reservas.',
  provider_not_operational: 'Esta ficha no tiene operativa habilitada.',
  provider_not_bookable: 'Esta ficha no puede recibir reservas.',
  claim_not_available: 'Esta ficha ya no admite una reclamación.',
  claim_already_pending: 'Ya hay una reclamación pendiente para esta ficha.',
  provider_suspended: 'La cuenta está suspendida.',
  provider_inactive: 'La cuenta está desactivada.',
  throttled: 'Has enviado demasiadas solicitudes. Espera unos minutos.',
  service_inactive: 'El servicio no está disponible para reservar ahora mismo.',
  idempotency_key_reused: 'Esa solicitud ya se envió antes con otros datos.',
  hold_expired: 'La reserva temporal caducó. Vuelve a elegir horario.',
  invalid_transition: 'La reserva ya no admite esa acción en su estado actual.',
  forbidden_role: 'Tu rol en esta cuenta no permite esa acción.',
  not_participant: 'No participas en esta reserva.',
  not_found: 'No encontramos ese recurso.',
  validation_error: 'Revisa los datos del formulario.',
  not_authenticated: 'Inicia sesión para continuar.',
  network: 'No se pudo contactar con el servidor.',
}

// ============================================================
// Errores
// ============================================================

export function cleaningError(error: unknown): CleaningApiError | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<CleaningApiError> | undefined
    if (data && typeof data === 'object' && 'detail' in data) {
      return {
        code: typeof data.code === 'string' ? data.code : 'error',
        detail: String(data.detail ?? ''),
        extra: (data.extra as Record<string, unknown> | undefined) ?? {},
      }
    }
    if (error.response?.status === 401) {
      return { code: 'not_authenticated', detail: 'Inicia sesión para continuar.' }
    }
    if (error.response?.status === 403) {
      return { code: 'forbidden_role', detail: 'No tienes permiso para esa acción.' }
    }
    return { code: 'network', detail: 'No se pudo contactar con el servidor.' }
  }
  return null
}

export function cleaningErrorMessage(error: unknown): string {
  const api = cleaningError(error)
  if (!api) return 'Ocurrió un error inesperado.'
  return CLEANING_ERROR_MESSAGES[api.code] ?? api.detail ?? 'Ocurrió un error inesperado.'
}

// ============================================================
// Formato
// ============================================================

export function formatMoney(
  amount: string | null | undefined,
  currency: string,
): string {
  if (amount === null || amount === undefined || amount === '') return 'A convenir'
  return `${currency} ${amount}`
}

/** Los `start`/`end` de disponibilidad llegan en UTC; se pintan en `timeZone`. */
export function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })
}

export function formatDateTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })
}

/** `date` es YYYY-MM-DD del calendario del proveedor: se ancla a mediodía UTC. */
export function formatDayLabel(date: string, timeZone?: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  })
}

export function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return isoDate(new Date())
}

export function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** Extremos del día local, en ISO con zona (la agenda exige zona horaria). */
export function startOfDayIso(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toISOString()
}

export function endOfDayIso(dateIso: string): string {
  return new Date(`${dateIso}T23:59:59`).toISOString()
}

/**
 * Clave de idempotencia del asistente de reserva. `crypto.randomUUID` no existe
 * fuera de contexto seguro (el despliegue va por HTTP en una IP), así que hay
 * respaldo.
 */
export function newIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }
  return `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ============================================================
// Agenda: días, tipos de excepción y conversión de zona horaria
// ============================================================

/** 0 = lunes, igual que `AvailabilityRule.weekday` (§3.3). */
export const WEEKDAY_LABELS = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
]

export const EXCEPTION_KIND_LABELS: Record<string, string> = {
  unavailable: 'No disponible',
  extra_available: 'Disponible extra',
}

/**
 * Desfase de `timeZone` respecto a UTC en ese instante, en milisegundos.
 * Se calcula con `Intl` para no depender de la zona del navegador (ADR-07).
 */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}

/**
 * `2026-10-10T15:00` (hora local del recurso) → ISO UTC.
 *
 * Las excepciones de agenda son instantes absolutos y `<input
 * type="datetime-local">` no lleva zona, así que hay que interpretarlo en la
 * zona del recurso y no en la del navegador (ADR-07).
 */
export function localInputToUtcIso(value: string, timeZone: string): string {
  const base = value.slice(0, 16)
  const naive = new Date(`${base}:00Z`)
  const offset = zoneOffsetMs(naive, timeZone)
  return new Date(naive.getTime() - offset).toISOString()
}

/** ISO UTC → `2026-10-10T15:00` en la zona del recurso (para el input). */
export function utcIsoToLocalInput(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value
      return acc
    }, {})

  const hour = String(Number(parts.hour) % 24).padStart(2, '0')
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
}

// ============================================================
// Sesión
// ============================================================

function primerMensaje(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null
  if (typeof data.detail === 'string') return data.detail
  for (const valor of Object.values(data)) {
    if (typeof valor === 'string' && valor) return valor
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
  }
  return null
}

/**
 * Mensaje para los formularios de sesión (login y registro).
 *
 * DRF no usa aquí el contrato `{code, detail, extra}` de la vertical: un login
 * fallido llega como 400 con `non_field_errors` y un 401 suele venir sin
 * detalle. Por eso se lee el primer mensaje disponible y, si no hay ninguno, se
 * responde con la causa probable en lenguaje claro.
 */
export function authErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const mensaje = primerMensaje(
      error.response?.data as Record<string, unknown> | undefined,
    )
    if (mensaje) return mensaje

    const status = error.response?.status
    if (status === 401) {
      return 'Credenciales inválidas. Revisa tu email y tu contraseña.'
    }
    if (status === 400) {
      return 'Revisa los datos del formulario.'
    }
    if (!error.response) {
      return CLEANING_ERROR_MESSAGES.network
    }
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}
