import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { MainLayout } from '@/components/layout/MainLayout'
import { MccPreload } from '@/components/preload'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { RequirePublisher } from '@/components/ui/RequirePublisher'
import HomePage from '@/pages/HomePage'
import MarketplacePage from '@/pages/MarketplacePage'

// Carga perezosa: en el primer render solo hace falta el catálogo. Así el panel
// de proveedor, el asistente de reserva, la agenda y los pagos no engordan el
// bundle inicial (antes todo viajaba en un único chunk de ~505 kB).
const CiemInfoPage = lazy(() => import('@/pages/info/CiemInfoPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ListingDetailPage = lazy(() => import('@/pages/listings/ListingDetailPage'))
const CreateListingPage = lazy(() => import('@/pages/listings/CreateListingPage'))
const EditListingPage = lazy(() => import('@/pages/listings/EditListingPage'))
const MyListingsPage = lazy(() => import('@/pages/listings/MyListingsPage'))
const FavoritesPage = lazy(() => import('@/pages/listings/FavoritesPage'))
const VisibilityLandingPage = lazy(() => import('@/pages/visibility/VisibilityLandingPage'))
const CityAvailabilityPage = lazy(() => import('@/pages/visibility/CityAvailabilityPage'))
const MyVisibilityPage = lazy(() => import('@/pages/visibility/MyVisibilityPage'))
const PaymentSuccessPage = lazy(() => import('@/pages/payment/PaymentSuccessPage'))
const PaymentPendingPage = lazy(() => import('@/pages/payment/PaymentPendingPage'))
const PaymentFailurePage = lazy(() => import('@/pages/payment/PaymentFailurePage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const MyBookingsPage = lazy(() => import('@/pages/cleaning/MyBookingsPage'))

/** El splash del logo no se muestra en las páginas que entran directas al catálogo. */
function PreloadByRoute({ isReady }: { isReady: boolean }) {
  const { pathname } = useLocation()
  const skip = pathname === '/marketplace' || pathname === '/markeplace'
  return skip ? null : <MccPreload isReady={isReady} />
}

function App() {
  const [showPreloader, setShowPreloader] = useState(true)

  useEffect(() => {
    const minDisplayTime = 1800
    const startTime = Date.now()

    const handleLoad = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(minDisplayTime - elapsed, 0)
      window.setTimeout(() => setShowPreloader(false), remaining)
    }

    if (document.readyState === 'complete') {
      handleLoad()
    } else {
      window.addEventListener('load', handleLoad)
    }

    const maxTimeTimer = window.setTimeout(() => setShowPreloader(false), 4500)

    return () => {
      window.removeEventListener('load', handleLoad)
      window.clearTimeout(maxTimeTimer)
    }
  }, [])

  return (
    <BrowserRouter>
      <PreloadByRoute isReady={!showPreloader} />
      <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <Routes>
          {/* Rutas públicas con layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/markeplace" element={<Navigate to="/marketplace" replace />} />
            <Route path="/nosotros" element={<CiemInfoPage />} />
            <Route path="/contacto" element={<CiemInfoPage />} />
            <Route path="/ayuda" element={<CiemInfoPage />} />
            <Route path="/legal/terminos" element={<CiemInfoPage />} />
            <Route path="/legal/privacidad" element={<CiemInfoPage />} />
            <Route path="/legal/devoluciones" element={<CiemInfoPage />} />
            <Route path="/legal/reclamaciones" element={<CiemInfoPage />} />
            <Route path="/unete" element={<Navigate to="/" replace />} />
            <Route path="/proveedores" element={<Navigate to="/" replace />} />
            <Route path="/provider/*" element={<Navigate to="/" replace />} />
            <Route path="/cleaning/*" element={<Navigate to="/" replace />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/visibility" element={<VisibilityLandingPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/pending" element={<PaymentPendingPage />} />
            <Route path="/payment/failure" element={<PaymentFailurePage />} />
            {/* Vertical de limpieza: la disponibilidad es pública, así que el
                asistente de reserva también lo es (pide sesión al confirmar). */}

            {/* Alta de proveedores: pública y con el formulario enriquecido. */}


          </Route>

          {/* Publicación: exige `can_publish`; si no lo tiene, /unete con aviso */}
          <Route element={<RequirePublisher />}>
            <Route element={<MainLayout />}>
              <Route path="/listings/new" element={<CreateListingPage />} />

              <Route path="/listings/:id/edit" element={<EditListingPage />} />
              <Route path="/my-listings" element={<MyListingsPage />} />
            </Route>
          </Route>

          {/* Rutas protegidas con layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/visibility/:slug" element={<CityAvailabilityPage />} />
              <Route path="/my-visibility" element={<MyVisibilityPage />} />
              <Route path="/my-bookings" element={<MyBookingsPage />} />

            </Route>
          </Route>

          {/* Rutas sin layout (auth) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
