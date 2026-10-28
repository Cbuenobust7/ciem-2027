import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cleaningApi,
  type AvailabilityQuery,
  type BookingListQuery,
  type CleaningServicePayload,
  type ProviderDirectoryQuery,
} from '@/api/cleaning'
import { useAuthStore } from '@/stores/auth'
import type {
  BookingAction,
  CreateBookingPayload,
  CreateProviderClaimPayload,
  CreateProviderCorrectionPayload,
  CreateProviderPayload,
  ResourceSchedulePayload,
} from '@/types/api'

/**
 * Tope de páginas al recorrer `?as=provider` (PAGE_SIZE=20 en el backend). Sirve
 * para descubrir cuentas y para excluir las reservas del lado proveedor de la
 * vista de cliente; no es una fuente de datos completa.
 */
const PROVIDER_INDEX_MAX_PAGES = 3

// ============================================================
// QUERIES
// ============================================================

export function useProviderDirectory(params: ProviderDirectoryQuery) {
  return useQuery({
    queryKey: ['cleaning', 'providers', params],
    queryFn: () => cleaningApi.providers(params),
  })
}

export function useProvider(id: number | undefined) {
  return useQuery({
    queryKey: ['cleaning', 'provider', id],
    queryFn: () => cleaningApi.provider(id!),
    enabled: !!id,
  })
}

export function useProviderServices(id: number | undefined) {
  return useQuery({
    queryKey: ['cleaning', 'provider-services', id],
    queryFn: () => cleaningApi.providerServices(id!),
    enabled: !!id,
  })
}

export function useProviderManagedServices(id: number | undefined) {
  return useQuery({
    queryKey: ['cleaning', 'provider-managed-services', id],
    queryFn: () => cleaningApi.providerManagedServices(id!),
    enabled: !!id,
  })
}

export function useAvailability(
  accountId: number | undefined,
  query: AvailabilityQuery | undefined,
) {
  return useQuery({
    queryKey: ['cleaning', 'availability', accountId, query],
    queryFn: () => cleaningApi.availability(accountId!, query!),
    enabled: !!accountId && !!query,
  })
}

/** Recursos de agenda de la cuenta: cada uno tiene su propia agenda (§3.1). */
export function useProviderResources(accountId: number | undefined) {
  return useQuery({
    queryKey: ['cleaning', 'provider-resources', accountId],
    queryFn: () => cleaningApi.providerResources(accountId!),
    enabled: !!accountId,
  })
}

export function useResourceSchedule(
  accountId: number | undefined,
  resourceId: number | undefined,
) {
  return useQuery({
    queryKey: ['cleaning', 'resource-schedule', accountId, resourceId],
    queryFn: () => cleaningApi.resourceSchedule(accountId!, resourceId!),
    enabled: !!accountId && !!resourceId,
  })
}

export function useProviderBookings(
  accountId: number | undefined,
  params: BookingListQuery,
) {
  return useQuery({
    queryKey: ['cleaning', 'provider-bookings', accountId, params],
    queryFn: () => cleaningApi.providerBookings(accountId!, params),
    enabled: !!accountId,
  })
}

export function useMyBookings(params: BookingListQuery) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: ['cleaning', 'my-bookings', params],
    queryFn: () => cleaningApi.bookings(params),
    enabled: isAuthenticated,
  })
}

export function useBooking(code: string | undefined) {
  return useQuery({
    queryKey: ['cleaning', 'booking', code],
    queryFn: () => cleaningApi.booking(code!),
    enabled: !!code,
  })
}

export interface ProviderSideIndex {
  codes: string[]
  accounts: { id: number; display_name: string }[]
}

/**
 * Índice del lado proveedor del usuario: exactamente lo que devuelve
 * `?as=provider` (reservas de las cuentas donde es miembro) y las cuentas que
 * aparecen en ellas.
 *
 * Hace falta porque `GET /api/cleaning/bookings/` sin filtro devuelve la unión
 * cliente + proveedor y `BookingSerializer` no expone `customer`, así que el
 * frontend no puede distinguir el origen de cada reserva por sí solo: la vista
 * de cliente resta estos códigos.
 */
export function useProviderSideIndex(enabled: boolean) {
  return useQuery<ProviderSideIndex>({
    queryKey: ['cleaning', 'provider-side-index'],
    queryFn: async () => {
      const codes: string[] = []
      const accounts = new Map<number, string>()

      for (let page = 1; page <= PROVIDER_INDEX_MAX_PAGES; page += 1) {
        const data = await cleaningApi.bookings({ as: 'provider', page })
        data.results.forEach((booking) => {
          codes.push(booking.code)
          accounts.set(booking.account.id, booking.account.display_name)
        })
        if (!data.next) break
      }

      return {
        codes,
        accounts: Array.from(
          accounts,
          ([id, display_name]) => ({ id, display_name }),
        ),
      }
    },
    enabled,
    staleTime: 30_000,
  })
}

// ============================================================
// MUTATIONS
// ============================================================

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateBookingPayload
      idempotencyKey?: string
    }) => cleaningApi.createBooking(payload, idempotencyKey),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-side-index'] })
    },
  })
}

export function useBookingAction(code: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      action,
      body,
    }: {
      action: BookingAction
      body?: Record<string, unknown>
    }) => cleaningApi.bookingAction(code!, action, body),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'booking', code] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-side-index'] })
    },
  })
}

/**
 * Guarda la agenda de un recurso. El `PUT` reemplaza reglas y excepciones, así
 * que al volver se invalidan la agenda y la disponibilidad calculada.
 */
export function useReplaceResourceSchedule(
  accountId: number,
  resourceId: number,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ResourceSchedulePayload) =>
      cleaningApi.replaceResourceSchedule(accountId, resourceId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['cleaning', 'resource-schedule', accountId, resourceId],
      })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'availability'] })
    },
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      payload,
      logo,
    }: {
      payload: CreateProviderPayload
      logo?: File | null
    }) => cleaningApi.createProvider(payload, logo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-side-index'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'providers'] })
    },
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CleaningServicePayload) =>
      cleaningApi.createService(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-services'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'providers'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      listingId,
      payload,
    }: {
      listingId: number
      payload: Partial<CleaningServicePayload>
    }) => cleaningApi.updateService(listingId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-services'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

/** Reclama una ficha de directorio; al volver se refresca la ficha pública. */
export function useCreateClaim(accountId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateProviderClaimPayload) =>
      cleaningApi.claimProvider(accountId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning'] })
    },
  })
}

/** Envía una corrección o retirada; no modifica la ficha hasta que se resuelva. */
export function useCreateCorrection(accountId: number | undefined) {
  return useMutation({
    mutationFn: (payload: CreateProviderCorrectionPayload) =>
      cleaningApi.createCorrection(accountId as number, payload),
  })
}

/** Entrega C: vuelve a pedir la verificación de la cuenta de proveedor. */
export function useRequestVerification(accountId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => cleaningApi.requestVerification(accountId as number),
    // Se invalidan todas las consultas de limpieza: el estado de verificación
    // aparece en el panel, en el directorio y en el asistente de servicio.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaning'] })
    },
  })
}
