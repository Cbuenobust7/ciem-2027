import { NavLink } from 'react-router-dom'

/**
 * Navegación interna de la vertical. No se toca el `Header` del núcleo (la única
 * pantalla existente que cambia es `ListingDetailPage`), así que las rutas
 * nuevas se enlazan entre sí desde aquí.
 */
const LINKS = [
  { to: '/cleaning/providers', label: 'Directorio de limpieza' },
  { to: '/my-bookings', label: 'Mis reservas' },
  { to: '/provider/dashboard', label: 'Panel de proveedor' },
  { to: '/provider/services', label: 'Mis servicios' },
  { to: '/provider/schedule', label: 'Mi agenda' },
]

export function CleaningNav() {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 pb-3 text-sm">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            isActive
              ? 'font-medium text-primary-600'
              : 'text-gray-600 hover:text-primary-600'
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
