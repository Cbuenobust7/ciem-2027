import { projectContact } from '@/data/ciemCatalog'
import { trackWhatsAppClick } from '@/lib/analytics'

/*
 * Paleta según el Manual de Identidad Corporativa (pág. 05):
 *   #101F65 azul institucional → fondos y titulares
 *   #06D69A verde CIEM         → identidad y acentos
 *   #087DFA azul acción        → botones
 *   #FFFFFF blanco             → contraste
 * Tipografía: DejaVu Sans (pág. 06), la del propio sitio.
 */

const FEATURES = [
  'Plataformas web a medida',
  'Web con IA integrada',
  'Hosting rápido y seguro',
  'Mantenimiento continuo',
  'Ciberseguridad',
]

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-primary-500"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  )
}

/**
 * Sección de plataforma a medida: azul institucional de fondo, verde CIEM para
 * los acentos y azul acción para el botón, según el manual de marca.
 */
export function PlatformBanner() {
  return (
    <div className="relative text-master-navy">
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -right-44 h-[640px] w-[640px] rounded-full border border-master-navy/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-20 h-[440px] w-[440px] rounded-full border border-master-cyan/20" />

      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-12">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-master-cyan text-2xl font-bold text-master-navy">C</div>
            <div>
              <b className="block text-lg font-bold tracking-[0.08em]">CIEM</b>
              <small className="block text-[13px] text-master-navy/70">Productos &amp; Servicios Digitales</small>
            </div>
          </div>

          <div>
            <h2 id="custom-platform-title" className="text-3xl font-bold leading-[1.06] tracking-tight text-master-navy md:text-5xl">
              <span className="block">Tu negocio online,</span>
              <span className="mt-2 inline-block bg-master-cyan px-1 text-master-navy">rápido y blindado.</span>
            </h2>
            <p className="mt-5 max-w-[600px] text-base leading-relaxed text-master-navy/80 md:text-xl">
              Creamos tu plataforma web, la potenciamos con inteligencia artificial y nos encargamos de
              alojarla, mantenerla y protegerla.
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-6">
              <a
                href={projectContact()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('platform_banner')}
                className="inline-flex items-center gap-3 rounded-xl bg-primary-500 px-6 py-4 text-xl font-bold text-white transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-master-navy"
              >
                Cotiza gratis por WhatsApp
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <div>
                <small className="block text-[13px] text-master-navy/70">Escríbenos ahora</small>
                <strong className="block text-xl font-bold text-master-navy">+51 999 989 709</strong>
              </div>
            </div>
            <p className="mt-4 text-sm text-master-navy/70">Hecho en Perú · Cotización sin costo · ciem.pe</p>
          </div>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-master-navy/10 bg-white text-master-navy">
          <div className="flex h-11 items-center gap-2 border-b border-master-navy/15 px-4">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-master-navy/25" />
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-master-navy/25" />
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-master-navy/25" />
            <span className="ml-2 text-xs text-master-navy/70">tu-negocio.pe</span>
          </div>
          <div className="flex flex-col items-center gap-2.5 px-4 pb-4 pt-6">
            <svg
              width="88"
              height="88"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
              aria-label="Escudo de protección"
              className="text-primary-500"
            >
              <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-base font-semibold">Tu sitio, protegido</span>
          </div>
          <div className="flex flex-col gap-2.5 px-5 pb-5">
            {FEATURES.map(feature => (
              <div
                key={feature}
                className="flex items-center gap-3 rounded-xl border border-master-navy/15 bg-master-light px-3.5 py-3 text-[15px] font-medium text-master-navy"
              >
                <CheckIcon />
                {feature}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
