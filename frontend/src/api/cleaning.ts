import { apiClient } from './client'

import type {
  AvailabilityResponse,
  Booking,
  BookingAction,
  BookingDetail,
  CleaningService,
  CreateBookingPayload,
  CreateProviderClaimPayload,
  CreateProviderCorrectionPayload,
  CreateProviderPayload,
  PaginatedResponse,
  Provider,
  ProviderClaim,
  ProviderCorrection,
  ProviderDetail,
  ProviderResource,
  ProviderServiceArea,
  ProviderServiceSummary,
  ResourceSchedule,
  ResourceSchedulePayload,
} from '@/types/api'

/** Filtros del directorio (§5.1). `category` viaja como slug, no como id. */
export interface ProviderDirectoryQuery {
  city?: number
  district?: string
  /** Compatibilidad: el backend acepta `category` como alias. */
  category?: string
  service_category?: string
  q?: string
  modality?: 'all' | 'directory' | 'partners'
  min_rating?: number
  kind?: string
  ordering?: string
  page?: number
}

export interface BookingListQuery {
  as?: 'provider'
  account?: number
  status?: string
  from?: string
  to?: string
  resource?: number
  page?: number
}

export interface AvailabilityQuery {
  service: number
  from: string
  to: string
  resource?: number
}

/** Cuerpo de `POST /api/cleaning/services/` (los campos de escritura del serializer). */
export interface CleaningServicePayload {
  provider_account: number
  title: string
  description: string
  price: string
  currency?: string
  category: number
  location?: string
  duration_minutes?: number
  buffer_minutes?: number
  capacity?: number
  min_notice_hours?: number
  max_horizon_days?: number
  cancellation_hours?: number
  requires_deposit?: boolean
  deposit_amount?: string
  resolves_address?: boolean
  is_instant?: boolean
  max_per_day?: number | null
  is_active?: boolean
}

export interface ServiceAreaPayload {
  city: number
  district: string
  district_label: string
  extra_fee?: string
}

export const cleaningApi = {
  async providers(
    params: ProviderDirectoryQuery = {},
  ): Promise<PaginatedResponse<Provider>> {
    const { data } = await apiClient.get<PaginatedResponse<Provider>>(
      '/api/cleaning/providers/',
      { params },
    )
    return data
  },

  async provider(id: number): Promise<ProviderDetail> {
    const { data } = await apiClient.get<ProviderDetail>(
      `/api/cleaning/providers/${id}/`,
    )
    return data
  },

  /** Reclama una ficha de directorio (requiere sesión; no verifica). */
  async claimProvider(
    id: number,
    payload: CreateProviderClaimPayload,
  ): Promise<ProviderClaim> {
    const { data } = await apiClient.post<ProviderClaim>(
      `/api/cleaning/providers/${id}/claim/`,
      payload,
    )
    return data
  },

  /** Corrección o retirada de una ficha; público y limitado por tasa. */
  async createCorrection(
    id: number,
    payload: CreateProviderCorrectionPayload,
  ): Promise<ProviderCorrection> {
    const { data } = await apiClient.post<ProviderCorrection>(
      `/api/cleaning/providers/${id}/corrections/`,
      payload,
    )
    return data
  },

  /**
   * Vuelve a pedir la verificación de la cuenta.
   *
   * En el backend `rejected` pasa a `pending`; `pending` y `verified` responden 200
   * sin cambios (idempotente) y `suspended` devuelve 403.
   */
  async requestVerification(id: number): Promise<ProviderDetail> {
    const { data } = await apiClient.post<ProviderDetail>(
      `/api/cleaning/providers/${id}/request-verification/`,
    )
    return data
  },

  /**
   * Alta como proveedor: crea la cuenta y la membership `owner` (§5.1).
   *
   * Con logo la petición viaja como `multipart/form-data` (en el backend `logo`
   * es un `ImageField`); sin logo, como JSON de siempre. No se fija el
   * `Content-Type` a mano: axios detecta el `FormData` y deja que el navegador
   * ponga el `boundary`, que es lo que un header manual rompería.
   */
  async createProvider(
    payload: CreateProviderPayload,
    logo?: File | null,
  ): Promise<ProviderDetail> {
    if (logo) {
      const form = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'logo') return
        if (value !== undefined && value !== null) {
          form.append(key, String(value))
        }
      })
      form.append('logo', logo)

      const { data } = await apiClient.post<ProviderDetail>(
        '/api/cleaning/providers/',
        form,
      )
      return data
    }

    const { data } = await apiClient.post<ProviderDetail>(
      '/api/cleaning/providers/',
      payload,
    )
    return data
  },

  async providerManagedServices(
    id: number,
  ): Promise<PaginatedResponse<ProviderServiceSummary>> {
    const { data } = await apiClient.get<PaginatedResponse<ProviderServiceSummary>>(
      `/api/cleaning/providers/${id}/services/manage/`,
    )
    return data
  },

  async providerServices(
    id: number,
  ): Promise<PaginatedResponse<ProviderServiceSummary>> {
    const { data } = await apiClient.get<PaginatedResponse<ProviderServiceSummary>>(
      `/api/cleaning/providers/${id}/services/`,
    )
    return data
  },

  /** Recursos de agenda de la cuenta (`GET .../resources/`, §5.1). */
  async providerResources(
    accountId: number,
  ): Promise<PaginatedResponse<ProviderResource>> {
    const { data } = await apiClient.get<PaginatedResponse<ProviderResource>>(
      `/api/cleaning/providers/${accountId}/resources/`,
    )
    return data
  },

  async resourceSchedule(
    accountId: number,
    resourceId: number,
  ): Promise<ResourceSchedule> {
    const { data } = await apiClient.get<ResourceSchedule>(
      `/api/cleaning/providers/${accountId}/resources/${resourceId}/schedule/`,
    )
    return data
  },

  /** `PUT`: la agenda del recurso se **reemplaza** por lo que viaje aquí. */
  async replaceResourceSchedule(
    accountId: number,
    resourceId: number,
    payload: ResourceSchedulePayload,
  ): Promise<ResourceSchedule> {
    const { data } = await apiClient.put<ResourceSchedule>(
      `/api/cleaning/providers/${accountId}/resources/${resourceId}/schedule/`,
      payload,
    )
    return data
  },

  async serviceAreas(
    accountId: number,
  ): Promise<PaginatedResponse<ProviderServiceArea>> {
    const { data } = await apiClient.get<PaginatedResponse<ProviderServiceArea>>(
      `/api/cleaning/providers/${accountId}/service-areas/`,
    )
    return data
  },

  async createServiceArea(
    accountId: number,
    payload: ServiceAreaPayload,
  ): Promise<ProviderServiceArea> {
    const { data } = await apiClient.post<ProviderServiceArea>(
      `/api/cleaning/providers/${accountId}/service-areas/`,
      payload,
    )
    return data
  },

  async deleteServiceArea(accountId: number, areaId: number): Promise<void> {
    await apiClient.delete(
      `/api/cleaning/providers/${accountId}/service-areas/${areaId}/`,
    )
  },

  async availability(
    accountId: number,
    query: AvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    const { data } = await apiClient.get<AvailabilityResponse>(
      `/api/cleaning/providers/${accountId}/availability/`,
      { params: query },
    )
    return data
  },

  async providerBookings(
    accountId: number,
    params: BookingListQuery = {},
  ): Promise<PaginatedResponse<Booking>> {
    const { data } = await apiClient.get<PaginatedResponse<Booking>>(
      `/api/cleaning/providers/${accountId}/bookings/`,
      { params },
    )
    return data
  },

  async bookings(
    params: BookingListQuery = {},
  ): Promise<PaginatedResponse<Booking>> {
    const { data } = await apiClient.get<PaginatedResponse<Booking>>(
      '/api/cleaning/bookings/',
      { params },
    )
    return data
  },

  async booking(code: string): Promise<BookingDetail> {
    const { data } = await apiClient.get<BookingDetail>(
      `/api/cleaning/bookings/${code}/`,
    )
    return data
  },

  /** La cabecera `Idempotency-Key` evita duplicar la reserva al reintentar. */
  async createBooking(
    payload: CreateBookingPayload,
    idempotencyKey?: string,
  ): Promise<Booking> {
    const { data } = await apiClient.post<Booking>(
      '/api/cleaning/bookings/',
      payload,
      idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : undefined,
    )
    return data
  },

  async bookingAction(
    code: string,
    action: BookingAction,
    body: Record<string, unknown> = {},
  ): Promise<Booking> {
    const { data } = await apiClient.post<Booking>(
      `/api/cleaning/bookings/${code}/${action}/`,
      body,
    )
    return data
  },

  async createService(payload: CleaningServicePayload): Promise<CleaningService> {
    const { data } = await apiClient.post<CleaningService>(
      '/api/cleaning/services/',
      payload,
    )
    return data
  },

  /** `PATCH /api/cleaning/services/{listing_id}/` (no hay DELETE ni GET). */
  async updateService(
    listingId: number,
    payload: Partial<CleaningServicePayload>,
  ): Promise<CleaningService> {
    const { data } = await apiClient.patch<CleaningService>(
      `/api/cleaning/services/${listingId}/`,
      payload,
    )
    return data
  },
}
