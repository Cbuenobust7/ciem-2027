import { BrandLogo } from './BrandLogo'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './CiemNavbar.css'

const links = [
  { label: 'Dev & Hosting', href: '/#dev', event: 'navigation_dev_hosting' },
  { label: 'Servicios', href: '/#servicios', event: 'navigation_services' },
  { label: 'Catálogo', href: '/#catalogo', event: 'navigation_catalog' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="ciem-navbar">
      <div className="ciem-navbar__inner">
        <Link to="/" className="ciem-navbar__brand" aria-label="CIEM, inicio" onClick={() => setMenuOpen(false)}>
          <BrandLogo />
        </Link>
        <nav className="ciem-navbar__links" aria-label="Navegación principal">
          {links.map(({ label, href, event }) => <a key={href} href={href} data-analytics-event={event}>{label}</a>)}
          <a href="https://wa.me/51999989709" className="ciem-navbar__contact" target="_blank" rel="noopener noreferrer" data-analytics-event="navigation_contact">Contacto</a>
        </nav>
        <div className="ciem-navbar__tools">
          <button type="button" className="ciem-navbar__toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="ciem-navbar-mobile" onClick={() => setMenuOpen(!menuOpen)} data-analytics-event="navigation_menu_toggle">
            <span /><span /><span />
          </button>
        </div>
      </div>
      {menuOpen && <nav id="ciem-navbar-mobile" className="ciem-navbar__mobile" aria-label="Navegación móvil">
        {links.map(({ label, href, event }) => <a key={href} href={href} onClick={() => setMenuOpen(false)} data-analytics-event={event}>{label}</a>)}
        <a href="https://wa.me/51999989709" className="ciem-navbar__contact" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} data-analytics-event="navigation_contact">Contacto</a>
      </nav>}
    </header>
  )
}
