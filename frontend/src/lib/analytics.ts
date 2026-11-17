const googleMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
const clarityProjectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim()

const GOOGLE_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/i
const CLARITY_PROJECT_ID_PATTERN = /^[A-Z0-9]{10}$/i

const CLARITY_ENABLED_PATHS = new Set([
  '/',
  '/marketplace',
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
  navigationContact: 'navigation_contact',
  heroQuoteRequest: 'hero_quote_request',
  heroServicesLink: 'hero_services_link',
  quoteRequest: 'quote_request',
  listingOpen: 'listing_open',
  catalogPageChange: 'catalog_page_change',
} as const

export type AnalyticsEvent = (typeof analyticsEvents)[keyof typeof analyticsEvents]

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
  window.gtag?.('config', googleMeasurementId, {
    send_page_view: false,
    page_path: pagePath,
    page_location: pageLocation,
    page_referrer: `${window.location.origin}/`,
    page_title: 'CIEM',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
  window.gtag?.('event', 'page_view', {
    page_path: pagePath,
    page_location: pageLocation,
    page_referrer: `${window.location.origin}/`,
    page_title: 'CIEM',
  })
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

export function trackAnalyticsEvent(event: AnalyticsEvent) {
  if (initializeGoogleAnalytics()) {
    window.gtag?.('event', event)
  }

  if (clarityRecordingAllowed) {
    window.clarity?.('event', event)
  }
}

export const analytics = analyticsEvents
