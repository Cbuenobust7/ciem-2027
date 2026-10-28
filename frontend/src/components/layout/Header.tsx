import { projectContact } from '@/data/ciemCatalog'
import { BrandLogo } from './BrandLogo'
import { LanguageSelector } from './LanguageSelector'
import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { authApi } from '@/api/auth'
import { LoginModal } from '@/components/auth/LoginModal'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/auth'

const navItems = [
  { label: 'Ofertas', href: '/#servicios' },
  { label: 'Licencias y condiciones', href: '/register' },
]

/** Public storefront for the CIEM-owned catalog. */
export function Header() {
  const { t } = useLanguage()

  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  const [loginOpen, setLoginOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 8)
    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollState)
  }, [])

  const canPublish = user?.is_ciem_manager === true

  // Refresca los roles al cargar: una membership puede haber cambiado (o la
  // sesión persistida puede ser anterior a `can_publish`).
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    authApi
      .getProfile()
      .then((perfil) => {
        if (!cancelled) setUser(perfil)
      })
      .catch(() => {
        // Sin red o token caducado: se conserva lo que ya había en la sesión.
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setUser])

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <>
      <header className={`mc-header${location.pathname === '/' ? ' mc-header--home' : ''}${isScrolled ? ' mc-header--scrolled' : ''}`}>
        <div className="mc-header__inner">
          <Link to="/" className="mc-header__brand" aria-label="CIEM Marketplace, inicio">
            <BrandLogo className="mc-header__logo" />
          </Link>

          <nav className="mc-header__nav" aria-label="Navegación principal">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="mc-header__nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          {user ? (
            <div className="mc-header__actions mc-header__actions--user">
              {canPublish && (
                <>
                  <Link to="/listings/new">
                    <Button variant="primary" size="sm" className="mc-header__btn-primary">
                      Nuevo producto CIEM
                    </Button>
                  </Link>

                  <Link to="/my-listings" className="mc-header__text-link">
                    {t('myListings')}
                  </Link>
                </>
              )}

              <Link to="/favorites" className="mc-header__text-link hidden sm:inline">
                {t('favorites')}
              </Link>

              <span className="mc-header__user-pill">
                {user.username}
                <span className={`mc-header__role ${canPublish ? 'is-provider' : ''}`}>
                  {canPublish ? 'CIEM' : 'Cliente'}
                </span>
              </span>

              <Button variant="ghost" size="sm" className="mc-header__btn-ghost" onClick={handleLogout}>
                {t('logout')}
              </Button>
            </div>
          ) : (
            <div className="mc-header__actions">
              <a href={projectContact()} target="_blank" rel="noopener noreferrer" className="mc-header__btn-secondary mc-header__cta-desktop">
                <svg className="mc-header__provider-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 10h16v10H4zM3 6h18v4H3zM7 3h10v3H7zM8 14h2M14 14h2M8 18h2M14 18h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="mc-header__provider-copy">
                  <strong>¿Necesitas una plataforma?</strong>
                  <small>CIEM la desarrolla a tu medida.</small>
                </span>
                <svg className="mc-header__provider-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>

              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="mc-header__btn-ghost mc-header__login-btn"
              >
                {t('login')}
              </button>

              <Link to="/register" className="mc-header__register-link">
                <Button variant="primary" size="sm" className="mc-header__btn-primary">
                  {t('register')}
                </Button>
              </Link>

              <div className="mc-header__language-wrap mc-header__language-wrap--desktop">
                <LanguageSelector />
              </div>

              <button
                type="button"
                className="mc-header__menu-button"
                aria-label="Abrir menú"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          )}
        </div>

        {mobileMenuOpen && (
          <div className="mc-header__mobile-menu" aria-label="Menú móvil">
            <nav className="mc-header__mobile-nav">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="mc-header__mobile-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mc-header__mobile-actions">
              <div className="mc-header__language-wrap mc-header__language-wrap--mobile">
                <LanguageSelector />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setLoginOpen(true)
                }}
                className="mc-header__btn-ghost"
              >
                {t('login')}
              </button>

              <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="mc-header__btn-primary">
                  {t('register')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  )
}
