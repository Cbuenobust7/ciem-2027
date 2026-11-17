import { projectContact } from '@/data/ciemCatalog'
import { trackWhatsAppClick } from '@/lib/analytics'

const CLIENTS = [
  { file: 'apufest-300x150.png', name: 'APU Fest' },
  { file: 'ombligo-300x150.png', name: 'Ombligo' },
  { file: 'lape-300x150.png', name: 'Lape' },
  { file: 'msclean-300x150.png', name: 'MS Clean' },
  { file: 'capcleaner-300x150.png', name: 'CapCleaner' },
  { file: 'rosapino-300x150.png', name: 'Rosa Pino' },
  { file: 'ps-300x150.png', name: 'PS' },
  { file: 'snatural-300x150.png', name: 'S Natural' },
  { file: 'anawi-300x150.png', name: 'Anawi' },
  { file: 'soluciones-virtuales-300x150.png', name: 'Soluciones Virtuales' },
]

/** Logos de clientes y proyectos de CIEM, recuperados de la web anterior. */
export function ClientsBar() {
  return (
    <section
      aria-labelledby="clientes-title"
      className="rounded-3xl bg-[#F4F6FB] px-5 py-10 sm:px-8 md:px-10 md:py-14"
    >
      {/* Encabezado */}
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-master-navy/15 bg-white px-4 py-1.5 text-sm font-semibold text-master-navy">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-master-cyan" />
          Clientes
        </span>
        <h2 id="clientes-title" className="mt-5 text-3xl font-bold leading-[1.1] tracking-tight text-master-navy md:text-5xl">
          <span className="block">Empresas que</span>
          <span className="block text-primary-500">confían en CIEM</span>
        </h2>
        <div aria-hidden="true" className="mx-auto mb-4 mt-4 h-[5px] w-[72px] rounded bg-master-cyan" />
        <p className="text-base leading-relaxed text-master-navy/70 md:text-lg">
          Marcas y proyectos que hemos acompañado con su presencia digital.
        </p>
      </div>

      {/* Logos: 2 columnas en móvil, 5 desde md (10 logos = 2 filas completas) */}
      <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {CLIENTS.map(client => (
          <li
            key={client.file}
            className="group flex h-28 items-center justify-center rounded-2xl border border-[#DCE2F2] bg-white p-5 shadow-[0_6px_16px_rgba(20,31,102,0.06)] transition duration-200 hover:-translate-y-1 hover:border-master-cyan hover:shadow-[0_12px_24px_rgba(20,31,102,0.12)] md:h-32"
          >
            <img
              src={`/images/ciem-clients/${client.file}`}
              alt={client.name}
              width={300}
              height={150}
              loading="lazy"
              className="h-full w-auto max-w-full object-contain opacity-75 grayscale transition duration-200 group-hover:opacity-100 group-hover:grayscale-0"
            />
          </li>
        ))}
      </ul>

      {/* Llamado a la acción */}
      <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-[18px] bg-master-navy px-6 py-5 text-white sm:flex-row">
        <p className="text-center text-base font-medium text-white/90 sm:text-left">
          ¿Quieres que tu marca sea la siguiente?
        </p>
        <a
          href={projectContact()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('clients_bar')}
          className="inline-flex flex-none items-center gap-2.5 rounded-xl bg-master-cyan px-5 py-3 text-base font-bold text-master-navy transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Solicitar cotización
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
    </section>
  )
}