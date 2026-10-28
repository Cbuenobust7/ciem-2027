// ============================================================
// TIPOS BASE
// ============================================================

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail?: string
  error?: string
  [key: string]: string | string[] | undefined
}

// ============================================================
// AUTH / USERS
// ============================================================

export type ProviderRole = 'owner' | 'admin' | 'staff'

/** Cuenta donde el usuario tiene una `ProviderMembership` activa (ADR-11). */
export interface ProviderAccountSummary {
  id: number
  display_name: string
  role: ProviderRole
}

export interface User {
  /** Read-only flag from the server; reserved for CIEM administrators. */
  is_ciem_manager?: boolean;
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  is_verified: boolean
  /** Vestigial: el rol real vive en `ProviderMembership` (ADR-11). */
  is_seller: boolean
  is_buyer: boolean
  preferred_city: string
  date_joined: string
  /** Tiene alguna membership activa en una cuenta activa. */
  is_provider: boolean
  /** Es `owner`/`admin` de alguna cuenta, o `is_staff` de plataforma. */
  can_publish: boolean
  provider_accounts: ProviderAccountSummary[]
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User
}

export interface RegisterResponse {
  user: User
  tokens: AuthTokens
}

// ============================================================
// CATEGORIES
// ============================================================

export interface Category {
  id: number
  name: string
  slug: string
  parent: number | null
  parent_name: string | null
  icon: string
  order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CategoryTree {
  id: number
  name: string
  slug: string
  icon: string
  order: number
  children: CategoryTree[]
}

// ============================================================
// LISTINGS
// ============================================================

export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'paused' | 'sold' | 'expired'
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'for_parts'

export interface ListingImage {
  id: number
  image: string
  image_url: string | null
  alt_text: string
  order: number
  is_cover: boolean
  created_at: string
}

export interface ListingListItem {
  id: number
  title: string
  price: string | null
  currency: string
  is_negotiable: boolean
  is_free: boolean
  condition: ListingCondition
  location: string
  status: ListingStatus
  rejection_reason?: string
  reviewed_at?: string | null
  view_count: number
  favorite_count: number
  seller_username: string
  cover_image: string | null
  created_at: string
  published_at: string | null
}

export interface ListingDetail {
  id: number
  seller_id: number
  seller_username: string
  title: string
  description: string
  price: string | null
  currency: string
  is_negotiable: boolean
  is_free: boolean
  category: number | null
  category_name: string | null
  condition: ListingCondition
  location: string
  latitude: string | null
  longitude: string | null
  status: ListingStatus
  rejection_reason?: string
  reviewed_at?: string | null
  view_count: number
  favorite_count: number
  images: ListingImage[]
  created_at: string
  updated_at: string
  published_at: string | null
  expires_at: string | null
  // Presente solo en los anuncios que son servicios de la vertical de limpieza
  // (ListingDetailSerializer.get_service_details). Si falta o es `null`, la
  // pantalla se comporta como cualquier otro anuncio del núcleo.
  service_details?: ServiceDetails | null
}

export interface CreateListingPayload {
  title: string
  description: string
  price?: string | null
  currency?: string
  is_negotiable?: boolean
  is_free?: boolean
  category?: number | null
  condition?: ListingCondition
  location?: string
}

// ============================================================
// FAVORITES
// ============================================================

export interface Favorite {
  id: number
  listing: number
  listing_title: string
  listing_seller: string
  created_at: string
}

// ============================================================
// REVIEWS
// ============================================================

export interface Review {
  id: number
  reviewer: number
  reviewer_username: string
  seller: number
  seller_username: string
  listing: number | null
  listing_title: string | null
  rating: number
  comment: string
  created_at: string
  updated_at: string
}

export interface CreateReviewPayload {
  listing: number  // obligatorio en la práctica; seller se deriva en el backend
  rating: number
  comment?: string
}

// ============================================================
// PAYMENTS
// ============================================================

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface Payment {
  id: number
  payer: number | null
  amount: string
  currency: string
  payment_type: string
  status: PaymentStatus
  gateway: string
  external_reference: string | null
  platform_fee: string
  created_at: string
}

// ============================================================
// VISIBILITY
// ============================================================

export type VisibilityStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'

export interface City {
  id: number
  name: string
  slug: string
  premium_slots_count: number
  price: string
  currency: string
  duration_days: number
  is_promo_mode: boolean
}

export interface Slot {
  position: number
  status: 'available' | 'occupied'
  price: string
  currency: string
  is_free: boolean
  occupied_until: string | null
}

// Alias para compatibilidad con código existente
export type VisibilitySlot = Slot

export interface CityAvailability {
  city: City
  slots: Slot[]
}

export interface VisibilityPurchase {
  id: number
  seller: number
  city: number
  city_name: string
  position: number
  starts_at: string
  ends_at: string
  price: string
  currency: string
  is_promo: boolean
  status: VisibilityStatus
  mp_preference_id: string
  mp_order_id: string
  payment: number | null
  created_at: string
}

export interface CreateVisibilityOrderResponse extends VisibilityPurchase {
  checkout_url: string
  order_id: string
}

// ============================================================
// LIMPIEZA (vertical de limpieza) — §9.6 del plan técnico
// ============================================================

export type ProviderKind = 'individual' | 'company'

export type ProviderVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'suspended'

/** Relación comercial con la plataforma (especificación §4). */
export type ProviderParticipationStatus =
  | 'directory'
  | 'claimed'
  | 'partner'
  | 'verified_partner'
  | 'suspended'
  | 'removed'

export interface ProviderServiceCategory {
  id: number
  name: string
  slug: string
}

/** Zona de cobertura de una cuenta (`ProviderServiceAreaSerializer`). */
export interface ProviderServiceArea {
  id: number
  city: number
  city_name: string
  district: string
  district_label: string
  extra_fee: string
}

/** Servicio de una cuenta en el perfil público (`ProviderServiceSummarySerializer`). */
export interface ProviderServiceSummary {
  status: ListingStatus
  rejection_reason: string
  listing_id: number
  title: string
  price: string | null
  currency: string
  category: number | null
  duration_minutes: number
  is_active: boolean
}

/** Cuenta en el directorio (`ProviderDirectorySerializer`). */
export interface Provider {
  id: number
  display_name: string
  slug: string
  kind: ProviderKind
  description: string
  logo: string | null
  participation_status: ProviderParticipationStatus
  verification_status: ProviderVerificationStatus
  is_informative: boolean
  can_book: boolean
  rating_avg: string
  rating_count: number
  services_summary: string
  service_categories: ProviderServiceCategory[]
  service_areas: ProviderServiceArea[]
}

/** Perfil público (`ProviderPublicSerializer`): añade contacto y servicios. */
export interface ProviderDetail extends Provider {
  phone: string
  contact_email: string
  address: string
  website: string
  whatsapp: string
  instagram: string
  facebook: string
  timezone: string
  is_published: boolean
  services: ProviderServiceSummary[]
}

/** Cuerpo de `POST /api/cleaning/providers/` (`ProviderCreateSerializer`). */
export interface CreateProviderPayload {
  display_name: string
  legal_name?: string
  tax_id?: string
  kind?: ProviderKind
  description?: string
  phone?: string
  contact_email?: string
  address?: string
  website?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  timezone?: string
  terms_accepted: boolean
}

/** Reclamación de una ficha de directorio (`ProviderClaim`). */
export interface ProviderClaim {
  id: number
  account: number
  account_name: string
  claimant: number
  claimant_email: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  contact_email: string
  contact_phone: string
  message: string
  evidence_url: string
  created_at: string
}

export interface CreateProviderClaimPayload {
  contact_email?: string
  contact_phone?: string
  message: string
  evidence_url?: string
  terms_accepted: boolean
}

/** Corrección o retirada de una ficha (`DirectoryCorrectionRequest`). */
export interface ProviderCorrection {
  id: number
  account: number
  account_name: string
  kind: 'correction' | 'removal' | 'data_issue'
  requester_name: string
  requester_email: string
  requester_phone: string
  message: string
  status: 'pending' | 'resolved' | 'rejected'
  created_at: string
}

export interface CreateProviderCorrectionPayload {
  kind: 'correction' | 'removal' | 'data_issue'
  requester_name: string
  requester_email: string
  requester_phone?: string
  message: string
}

/** Respuesta de crear/editar servicio (`CleaningServiceReadSerializer`). */
export interface CleaningService {
  id: number
  listing: number
  provider_account_id: number
  title: string
  description: string
  price: string | null
  currency: string
  category: number | null
  location: string
  status: ListingStatus
  rejection_reason?: string
  reviewed_at?: string | null
  duration_minutes: number
  buffer_minutes: number
  capacity: number
  min_notice_hours: number
  max_horizon_days: number
  cancellation_hours: number
  requires_deposit: boolean
  deposit_amount: string
  resolves_address: boolean
  is_instant: boolean
  max_per_day: number | null
  is_active: boolean
}

/** Atributos operativos del servicio (`service_details` del detalle de anuncio). */
export interface ServiceDetails {
  provider_account: number
  duration_minutes: number
  buffer_minutes: number
  capacity: number
  min_notice_hours: number
  max_horizon_days: number
  cancellation_hours: number
  requires_deposit: boolean
  deposit_amount: string
  resolves_address: boolean
  is_instant: boolean
  max_per_day: number | null
  is_active: boolean
}

export interface AvailabilitySlot {
  start: string
  end: string
  resource_id: number
  resource_name: string
}

export interface AvailabilityDay {
  date: string
  weekday: number
  slots: AvailabilitySlot[]
  reason?: string
}

/** Respuesta de `GET /api/cleaning/providers/{id}/availability/` (§5.2). */
export interface AvailabilityResponse {
  service: number
  duration_minutes: number
  timezone: string
  days: AvailabilityDay[]
  generated_at: string
}

/** Recurso de agenda de una cuenta (`ProviderResourceSerializer`, §3.1). */
export interface ProviderResource {
  id: number
  name: string
  kind: 'human' | 'crew' | 'machine'
  /** Vacío = hereda la zona de la cuenta (ADR-07). */
  timezone: string
  capacity: number
  is_active: boolean
  members: number[]
}

/** Regla semanal recurrente (`AvailabilityRuleSerializer`). `weekday` 0 = lunes. */
export interface AvailabilityRule {
  id?: number
  weekday: number
  /** `HH:MM[:SS]` en la zona del recurso. */
  start_time: string
  end_time: string
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
}

/** Excepción puntual (`AvailabilityExceptionSerializer`), en UTC. */
export interface AvailabilityException {
  id?: number
  kind: 'unavailable' | 'extra_available'
  starts_at: string
  ends_at: string
  reason: string
}

/** Agenda de un recurso (`GET .../resources/{rid}/schedule/`). */
export interface ResourceSchedule {
  resource: number
  resource_name: string
  rules: AvailabilityRule[]
  exceptions: AvailabilityException[]
}

/** Cuerpo de `PUT .../schedule/`: **reemplaza** la agenda completa del recurso. */
export interface ResourceSchedulePayload {
  rules: Omit<AvailabilityRule, 'id'>[]
  exceptions: Omit<AvailabilityException, 'id'>[]
}

export type BookingStatus =
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'

export type BookingPaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'paid'
  | 'refunded'

export interface BookingServiceRef {
  listing: number
  title: string
  duration_minutes: number | null
  buffer_minutes: number
}

export interface BookingAccountRef {
  id: number
  display_name: string
}

export interface BookingResourceRef {
  id: number
  name: string
}

/** Forma del contrato §5.2 (`BookingSerializer`): lista, creación y transiciones. */
export interface Booking {
  code: string
  status: BookingStatus
  hold_expires_at: string | null
  start_at: string
  end_at: string
  occupies_until: string
  service: BookingServiceRef
  account: BookingAccountRef
  resource: BookingResourceRef
  price: string
  zone_fee: string
  currency: string
  platform_fee: string
  provider_amount: string
  deposit_amount: string
  payment_status: BookingPaymentStatus
}

export interface BookingEvent {
  id: number
  event_type: 'status' | 'payment'
  from_status: string
  to_status: string
  actor_role: string
  actor_username: string | null
  reason: string
  created_at: string
}

/** Detalle (`BookingDetailSerializer`): contexto e historial de eventos. */
export interface BookingDetail extends Booking {
  address: string
  district: string
  city: number | null
  customer_notes: string
  provider_notes: string
  cancel_reason: string
  cancel_detail: string
  confirmed_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  events: BookingEvent[]
}

/** Cuerpo de `POST /api/cleaning/bookings/`. El importe no viaja (§5.2). */
export interface CreateBookingPayload {
  listing: number
  resource?: number | null
  start_at: string
  city?: number | null
  address: string
  district: string
  customer_notes?: string
}

/** Acciones de `POST /api/cleaning/bookings/{code}/{action}/`. */
export type BookingAction =
  | 'confirm'
  | 'decline'
  | 'start'
  | 'complete'
  | 'cancel'
  | 'mark-paid'

/** Error uniforme de la vertical: `{code, detail, extra}` (§5.2). */
export interface CleaningApiError {
  code: string
  detail: string
  extra?: Record<string, unknown>
}
