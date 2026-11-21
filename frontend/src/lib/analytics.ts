const googleMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
const clarityProjectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim()

// Conversiones «Clic saliente». Se envían a las dos cuentas de CIEM:
//  - 589-693-3829: la original (bloqueada para servir, pero se conserva el envío)
//  - 497-616-1054: la nueva, con facturación aprobada
const adsConversions = [
  { id: 'AW-10942395648', label: 'bljrCI2MhrsdEIDq3uEo' },
  { id: 'AW-18586947239', label: '_o9PCMryq7wdEKed-Z5F' },
]

const GOOGLE_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/i
const CLARITY_PROJECT_ID_PATTERN = /^[A-Z0-9]{10}$/i

const CLARITY_ENABLED_PATHS = new Set([
  '/',
  '/marketplace',
  '/diseno-web-lima',
  '/nosotros',
  '/contacto',
  '/ayuda',
  '/legal/terminos',
  '/legal/privacidad',
  '/legal/devoluciones',
  '/legal/reclamaciones',
])

const analyticsEvents = {
  navigationMenuToggle: 'navigation_menu_toggle',
  navigationDevHosting: 'navigation_dev_hosting',
  navigationServices: 'navigation_services',
  navigationCatalog: 'navigation_catalog',
  heroServicesLink: 'hero_services_link',
  listingOpen: 'listing_open',
  catalogPageChange: 'catalog_page_change',
  whatsappClick: 'whatsapp_click',
  assistantChatOpen: 'assistant_chat_open',
} as const

export type AnalyticsEvent = (typeof analyticsEvents)[keyof typeof analyticsEvents]
export type WhatsAppPlacement =
  | 'header'
  | 'home_hero'
  | 'catalog'
  | 'clients_bar'
  | 'platform_banner'
  | 'listing_detail'
  | 'info_contact'
  | 'footer'
  | 'assistant_message'
  | 'landing_lima'

type GtagFunction = (...args: unknown[]) => void
type ClarityFunction = ((...args: unknown[]) => void) & { q?: IArguments[] }

declare global {
  interface Window {
    dataLayer?: IArguments[]
    gtag?: GtagFunction
    clarity?: ClarityFunction
  }
}

let googleAnalyticsInitialized = false
let googleAnalyticsConfigErrorLogged = false
let clarityInitialized = false
let clarityConfigErrorLogged = false
let clarityRecordingAllowed = false

function isCiemDomain() {
  // Solo el dominio principal. marketplace.ciem.pe queda fuera a propósito: la
  // campaña se mide en ciem.pe y no queremos mezclar las dos propiedades.
  return window.location.hostname === 'ciem.pe' || window.location.hostname === 'www.ciem.pe'
}

function initializeGoogleAnalytics() {
  if (!isCiemDomain()) return false
  if (!googleMeasurementId) return false
  if (!GOOGLE_MEASUREMENT_ID_PATTERN.test(googleMeasurementId)) {
    if (!googleAnalyticsConfigErrorLogged) {
      console.error(
        '[analytics] VITE_GA_MEASUREMENT_ID must be a GA4 measurement ID such as G-XXXXXXXXXX. Google Analytics is disabled.',
      )
      googleAnalyticsConfigErrorLogged = true
    }
    return false
  }
  if (googleAnalyticsInitialized) return true

  window.dataLayer = window.dataLayer ?? []
  window.gtag = function () {
    window.dataLayer?.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', googleMeasurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
  // Mismo tag, destinos de Google Ads: sin el config, el evento de conversión se
  // envía a una cuenta que el contenedor desconoce y se descarta.
  for (const conversion of adsConversions) {
    window.gtag('config', conversion.id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleMeasurementId)}`
  script.dataset.analytics = 'google'
  document.head.appendChild(script)

  googleAnalyticsInitialized = true
  return true
}

function initializeClarity() {
  if (!clarityProjectId) return false
  if (!CLARITY_PROJECT_ID_PATTERN.test(clarityProjectId)) {
    if (!clarityConfigErrorLogged) {
      console.error(
        '[analytics] VITE_CLARITY_PROJECT_ID must be the 10-character Microsoft Clarity project ID. Clarity is disabled.',
      )
      clarityConfigErrorLogged = true
    }
    return false
  }
  if (clarityInitialized) return true

  const clarity: ClarityFunction = function () {
    ;(clarity.q ??= []).push(arguments)
  }
  clarity.q = []
  window.clarity = clarity

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(clarityProjectId)}`
  script.dataset.analytics = 'clarity'
  document.head.appendChild(script)

  clarityInitialized = true
  return true
}

export function getAnalyticsPagePath(pathname: string) {
  const routePatterns: Array<[RegExp, string]> = [
    [/^\/listings\/[^/]+(?=\/|$)/, '/listings/:id'],
    [/^\/visibility\/[^/]+(?=\/|$)/, '/visibility/:slug'],
    [/^\/cleaning\/book\/[^/]+(?=\/|$)/, '/cleaning/book/:id'],
  ]

  for (const [pattern, routeTemplate] of routePatterns) {
    if (pattern.test(pathname)) {
      return pathname.replace(pattern, routeTemplate)
    }
  }

  return pathname || '/'
}

export function trackPageView(pathname: string) {
  if (!initializeGoogleAnalytics()) return

  const pagePath = getAnalyticsPagePath(pathname)
  const pageLocation = `${window.location.origin}${pagePath}`
  const params: Record<string, unknown> = {
    page_path: pagePath,
    page_location: pageLocation,
  }
  // Referente real del navegador. Si no hay, no se envía y GA usa su propio `dr`.
  if (document.referrer) params.page_referrer = document.referrer

  // Las páginas fijan document.title en su propio useEffect, que se ejecuta
  // después que este componente: se envía en el siguiente tick para no arrastrar
  // el título de la página anterior.
  window.setTimeout(() => {
    window.gtag?.('event', 'page_view', { ...params, page_title: document.title || 'CIEM' })
  }, 0)
}

function isClarityAllowed(pathname: string, search: string) {
  if (!CLARITY_ENABLED_PATHS.has(pathname)) return false

  const params = new URLSearchParams(search)
  for (const [key, value] of params) {
    if (key !== 'page' || !/^\d{1,4}$/.test(value)) return false
  }

  return true
}

export function syncClarityRecording(pathname: string, search: string) {
  if (!isCiemDomain()) return
  if (!clarityProjectId) return

  const shouldRecord = isClarityAllowed(pathname, search)
  if (shouldRecord && !initializeClarity()) return
  if (!clarityInitialized || clarityRecordingAllowed === shouldRecord) return

  window.clarity?.('consent', shouldRecord)
  clarityRecordingAllowed = shouldRecord
}

function dispatchAnalyticsEvent(event: AnalyticsEvent, parameters?: Record<string, string>) {
  if (initializeGoogleAnalytics()) {
    window.gtag?.('event', event, parameters)
  }

  if (clarityRecordingAllowed) {
    window.clarity?.('event', event)
  }
}

/**
 * Envía la conversión «Clic saliente» de Google Ads.
 *
 * Es una conversión por clic, no por página de agradecimiento: la define el
 * anunciante para medir cuántos visitantes salen hacia WhatsApp.
 */
export function trackAdsConversion() {
  if (!initializeGoogleAnalytics()) return
  for (const conversion of adsConversions) {
    window.gtag?.('event', 'conversion', {
      send_to: `${conversion.id}/${conversion.label}`,
    })
  }
}

let outboundConversionInstalled = false

/**
 * Un único oyente en fase de captura: cubre los botones de React del sitio y
 * también el enlace que el widget del chat construye por su cuenta.
 */
export function installOutboundConversionTracking() {
  if (outboundConversionInstalled) return
  outboundConversionInstalled = true
  document.addEventListener(
    'click',
    event => {
      const target = event.target as Element | null
      if (target?.closest?.('a[href*="wa.me"]')) trackAdsConversion()
    },
    true,
  )
}

export function trackAnalyticsEvent(event: AnalyticsEvent) {
  dispatchAnalyticsEvent(event)
}

export function trackWhatsAppClick(placement: WhatsAppPlacement) {
  dispatchAnalyticsEvent(analyticsEvents.whatsappClick, {
    contact_method: 'whatsapp',
    placement,
  })
}

export function trackAssistantChatOpen() {
  dispatchAnalyticsEvent(analyticsEvents.assistantChatOpen, {
    placement: 'floating_launcher',
  })
}

export const analytics = analyticsEvents
