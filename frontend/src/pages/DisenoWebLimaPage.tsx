import { useEffect } from 'react'

import { CiemHeroArt } from '@/components/home/CiemHeroArt'
import { trackWhatsAppClick } from '@/lib/analytics'
import './CiemHero.css'

const WA_BASE = 'https://wa.me/51999989709?text='
const WHATSAPP = WA_BASE + encodeURIComponent('Hola, quiero una cotización de diseño web en Lima.')

const INCLUYE = [
  {
    titulo: 'Diseño a medida',
    texto: 'Nada de plantillas recicladas: la estructura se piensa para tu negocio y tu cliente.',
  },
  {
    titulo: 'Adaptada a celulares',
    texto: 'Más del 70 % de las visitas en Lima llegan desde el móvil. Se diseña para esa pantalla primero.',
  },
  {
    titulo: 'Lista para posicionar',
    texto: 'Estructura de títulos, URLs limpias, velocidad y datos estructurados desde el primer día.',
  },
  {
    titulo: 'Hosting y dominio',
    texto: 'Servidor en Perú, certificado SSL y correo corporativo incluidos en la puesta en marcha.',
  },
  {
    titulo: 'Mantenimiento',
    texto: 'Actualizaciones, copias de seguridad y soporte por WhatsApp cuando algo falla.',
  },
  {
    titulo: 'Chat con IA',
    texto: 'Opcional: un asistente que responde dudas de tus clientes a cualquier hora.',
  },
]

const TIPOS = [
  {
    titulo: 'Web corporativa',
    texto: 'Para empresas de servicios que necesitan transmitir confianza y recibir consultas.',
    consulta: 'una web corporativa',
    icono: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M3 13h18" />
      </>
    ),
  },
  {
    titulo: 'Tienda online',
    texto: 'Catálogo, carrito y pagos con tarjeta, Yape o transferencia.',
    consulta: 'una tienda online',
    icono: (
      <>
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.5L21 7H6" />
      </>
    ),
  },
  {
    titulo: 'Landing page',
    texto: 'Una sola página enfocada en una campaña o un servicio concreto.',
    consulta: 'una landing page',
    icono: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M7 14h6M7 17h4" />
      </>
    ),
  },
  {
    titulo: 'Restaurantes y hoteles',
    texto: 'Carta digital, reservas y galería, pensadas para turismo en Lima y provincias.',
    consulta: 'una web para mi restaurante u hotel',
    icono: (
      <>
        <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
        <path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17" />
      </>
    ),
  },
  {
    titulo: 'Clínicas y consultorios',
    texto: 'Agenda de citas, especialidades y aviso de privacidad de datos de salud.',
    consulta: 'una web para mi clínica o consultorio',
    icono: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
  },
  {
    titulo: 'Marketplace',
    texto: 'Varios vendedores, comisiones y panel de administración.',
    consulta: 'un marketplace',
    icono: (
      <>
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        <path d="M5 12v8h14v-8" />
        <path d="M10 20v-5h4v5" />
      </>
    ),
  },
]

const PASOS = [
  {
    n: '1',
    titulo: 'Conversamos',
    texto: 'Nos cuentas qué vendes y a quién. Sin formularios largos: por WhatsApp o chat.',
    etiqueta: 'WhatsApp o chat',
  },
  {
    n: '2',
    titulo: 'Propuesta',
    texto: 'Recibes alcance, plazo y precio cerrado en 24-48 horas.',
    etiqueta: '24-48 horas',
  },
  {
    n: '3',
    titulo: 'Diseño y desarrollo',
    texto: 'Ves avances cada semana y corriges sobre algo real, no sobre un boceto.',
    etiqueta: 'Avances semanales',
  },
  {
    n: '4',
    titulo: 'Publicación',
    texto: 'Sale a producción, se conecta el dominio y te enseñamos a usarla.',
    etiqueta: 'Dominio y capacitación',
  },
]

const FAQ = [
  {
    p: '¿Cuánto cuesta una página web en Lima?',
    r: 'Depende del alcance: una landing de una sola página parte de un monto menor que una web corporativa con blog y catálogo, y una tienda online con pagos añade integraciones. Te damos un precio cerrado tras una conversación de diez minutos, sin sorpresas después.',
  },
  {
    p: '¿Cuánto tarda el desarrollo?',
    r: 'Una landing puede estar en una o dos semanas. Una web corporativa, entre tres y cinco. Una tienda online con pasarela de pagos, de cuatro a seis semanas. El plazo se fija en la propuesta y se respeta.',
  },
  {
    p: '¿La web incluye posicionamiento en Google?',
    r: 'Incluye lo técnico: velocidad, estructura de títulos, URLs limpias, sitemap y datos estructurados. El posicionamiento por palabras competidas es un trabajo continuo de contenidos y enlaces; si lo necesitas, se cotiza aparte.',
  },
  {
    p: '¿Puedo actualizar el contenido yo mismo?',
    r: 'Sí. Entregamos el sitio con un panel de administración y una sesión de capacitación grabada para que puedas cambiar textos, imágenes y productos sin depender de nosotros.',
  },
  {
    p: '¿Trabajan con negocios fuera de Lima?',
    r: 'Sí. Atendemos todo Perú de forma remota: Arequipa, Trujillo, Cusco, Piura y cualquier ciudad. Las reuniones son por videollamada y el soporte por WhatsApp.',
  },
  {
    p: '¿Qué pasa si algo falla después de publicar?',
    r: 'Incluimos un periodo de garantía tras la publicación y planes de mantenimiento mensual con copias de seguridad, actualizaciones y tiempo de soporte.',
  },
]

/**
 * Landing de campaña: «diseño web en Lima».
 *
 * Existe por la campaña de Google Ads. La home no es relevante para búsquedas
 * como «páginas web para restaurantes» o «diseño web lima», y sin relevancia de
 * página de destino el anuncio no gana subastas por mucho que se suba la puja.
 */
export default function DisenoWebLimaPage() {
  useEffect(() => {
    document.title = 'Diseño Web en Lima | Páginas Web Profesionales · CIEM'

    const descripcion = 'Diseño y desarrollo de páginas web profesionales en Lima para ' +
      'empresas, tiendas online, restaurantes y clínicas. Cotización cerrada en 24-48 horas.'
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', descripcion)

    // Datos estructurados: permite que Google muestre las preguntas desplegables
    // en los resultados de búsqueda para esta página.
    const previo = document.getElementById('faq-jsonld')
    previo?.remove()
    const script = document.createElement('script')
    script.id = 'faq-jsonld'
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(item => ({
        '@type': 'Question',
        name: item.p,
        acceptedAnswer: { '@type': 'Answer', text: item.r },
      })),
    })
    document.head.appendChild(script)

    window.scrollTo(0, 0)

    return () => {
      document.getElementById('faq-jsonld')?.remove()
    }
  }, [])

  return (
    <div className="home-page">
      {/* Portada: mismo hero (y mismos servidores) que la home, a todo el ancho */}
      <section className="ciem-hero ciem-hero--landing" aria-labelledby="landing-hero-title">
        <div className="ciem-hero__inner">
          <div className="ciem-hero__content">
            <p className="ciem-hero__eyebrow">CIEM · LIMA, PERÚ</p>
            <h1 id="landing-hero-title" className="ciem-hero__title">
              Diseño web en Lima para negocios que necesitan clientes, no una web&nbsp;bonita
            </h1>
            <p className="ciem-hero__copy">
              Creamos páginas web profesionales, rápidas y adaptadas a celulares. Te damos
              un precio cerrado en 24-48 horas y te acompañamos después de publicar: hosting,
              mantenimiento y soporte real por WhatsApp.
            </p>
            <div className="ciem-hero__actions">
              <a
                className="ciem-hero__button ciem-hero__button--primary"
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('landing_lima')}
              >
                Cotizar mi página web
              </a>
              <button
                type="button"
                className="ciem-hero__button ciem-hero__button--secondary"
                data-ciem-ask="Quiero una cotización de diseño web en Lima para mi negocio."
              >
                Hablar con un asesor
              </button>
            </div>
            <p className="mt-6 text-sm text-white/60">
              WhatsApp directo: +51 999 989 709 · Llamadas: 942 020 546
            </p>
          </div>
          <CiemHeroArt />
        </div>
      </section>

      <div className="home-content">
      {/* Qué incluye */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-master-navy sm:text-3xl">
          Qué incluye una página web con CIEM
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Todo lo que hace falta para que la web exista, cargue rápido y sirva para
          vender. Sin extras escondidos en la letra pequeña.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUYE.map(item => (
            <article key={item.titulo} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-master-navy">{item.titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Tipos: banda blanca a todo el ancho (la sombra de 100vmax pinta el fondo sin crear scroll horizontal) */}
      <section className="relative isolate mt-16 bg-white py-14 shadow-[0_0_0_100vmax_white] [clip-path:inset(0_-100vmax)] sm:py-16">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-500">Tipos de web</p>
        <h2 className="mt-3 text-2xl font-bold text-master-navy sm:text-3xl">Qué tipo de web necesitas</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Elige tu punto de partida. Todas se diseñan a medida de tu negocio y te respondemos con un precio cerrado.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TIPOS.map(item => (
            <a
              key={item.titulo}
              href={WA_BASE + encodeURIComponent(`Hola, quiero cotizar ${item.consulta} en Lima.`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick('landing_lima')}
              className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-primary-500 hover:shadow-lg hover:shadow-master-navy/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-master-light text-master-navy transition-colors group-hover:bg-master-navy group-hover:text-white">
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icono}
                </svg>
              </span>
              <h3 className="mt-5 text-lg font-bold text-master-navy">{item.titulo}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{item.texto}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary-500 group-hover:text-primary-600">
                Cotizar esta web
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform group-hover:translate-x-1"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Proceso: línea de tiempo horizontal en escritorio, vertical en móvil */}
      <section className="mt-16" aria-labelledby="proceso-title">
        <span aria-hidden="true" className="block h-1 w-14 rounded-full bg-master-cyan" />
        <h2 id="proceso-title" className="mt-4 text-2xl font-bold text-master-navy sm:text-3xl">
          Cómo trabajamos
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Cuatro pasos claros: sabes qué se hace, cuándo y cuánto cuesta antes de empezar.
        </p>

        <ol className="mt-10 lg:grid lg:grid-cols-4 lg:gap-8">
          {PASOS.map((paso, i) => (
            <li key={paso.n} className="relative pb-10 pl-16 last:pb-0 lg:pb-0 lg:pl-0 lg:pt-16">
              {i < PASOS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-[calc(1.375rem-1px)] top-[3.25rem] border-l-2 border-dashed border-master-cyan lg:-right-6 lg:bottom-auto lg:left-[3.25rem] lg:top-[calc(1.375rem-1px)] lg:border-l-0 lg:border-t-2"
                />
              )}
              <span className="absolute left-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-master-navy text-lg font-bold text-master-cyan">
                {paso.n}
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{paso.etiqueta}</p>
              <h3 className="mt-1 text-xl font-bold text-master-navy">{paso.titulo}</h3>
              <p className="mt-2 text-base leading-7 text-slate-600">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Preguntas frecuentes: bloque aparte */}
      <section className="mt-20" aria-labelledby="faq-title">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span aria-hidden="true" className="block h-1 w-14 rounded-full bg-master-cyan" />
              <h2 id="faq-title" className="mt-4 text-2xl font-bold text-master-navy sm:text-3xl">
                Preguntas frecuentes
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                Lo que más nos preguntan antes de empezar. Si tu duda no está aquí, escríbenos y te
                respondemos con un precio cerrado.
              </p>
            </div>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick('landing_lima')}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary-500 px-6 py-3 text-base font-bold text-white transition hover:bg-primary-600"
            >
              Preguntar por WhatsApp
            </a>
          </div>

          <div className="mt-8 divide-y divide-slate-200 border-t border-slate-200">
            {FAQ.map((item, i) => (
              <details key={item.p} open={i === 0} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-base font-bold text-master-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="w-8 shrink-0 text-sm font-bold tabular-nums text-primary-500">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">{item.p}</span>
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-master-navy transition-transform group-open:rotate-180"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="pb-6 pl-12 pr-8 text-base leading-7 text-slate-600">{item.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="mb-12 mt-16 overflow-hidden rounded-3xl bg-master-navy px-6 py-12 text-white sm:px-12 sm:py-14" aria-labelledby="cierre-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <span aria-hidden="true" className="block h-1 w-14 rounded-full bg-master-cyan" />
            <h2 id="cierre-title" className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Cuéntanos qué necesitas y te damos el precio hoy
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
              Sin formularios eternos ni llamadas comerciales. Nos escribes, te preguntamos lo
              justo y recibes una propuesta con alcance, plazo y precio cerrado.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('landing_lima')}
                className="inline-flex items-center rounded-xl bg-primary-500 px-6 py-3.5 text-base font-bold text-white transition hover:bg-primary-600"
              >
                Escribir por WhatsApp
              </a>
              <a
                href="tel:+51942020546"
                className="inline-flex items-center rounded-xl border border-white/30 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Llamar al 942 020 546
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              {['Precio cerrado', 'Respuesta en 24-48 horas', 'Soporte por WhatsApp'].map(punto => (
                <li key={punto} className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-master-cyan">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {punto}
                </li>
              ))}
            </ul>
          </div>

          {/* Módulos de marca: formas geométricas simples con íconos lineales */}
          <div aria-hidden="true" className="hidden grid-cols-2 gap-4 lg:grid">
            <span className="flex h-28 w-28 items-center justify-center rounded-2xl bg-master-cyan text-master-navy">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" />
                <path d="M7 9h10M7 13h7" />
              </svg>
            </span>
            <span className="flex h-28 w-28 translate-y-6 items-center justify-center rounded-2xl bg-primary-500 text-white">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
              </svg>
            </span>
            <span className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#7bd996] text-master-navy">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="flex h-28 w-28 translate-y-6 items-center justify-center rounded-2xl border border-white/25 text-white">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          </div>
        </div>
      </section>
      </div>
    </div>
  )
}