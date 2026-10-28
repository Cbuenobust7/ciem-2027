export interface CiemProduct {
  slug: string; title: string; category: string; kind: 'download' | 'plugin' | 'quote' | 'commercial';
  summary: string; description?: string; download: string | null; preview: string | null; purchaseUrl?: string;
}
export const ciemCatalog: readonly CiemProduct[] = [
  {
    "slug": "landing-negocio",
    "title": "Template landing para negocios",
    "category": "templates-web",
    "kind": "download",
    "summary": "Una página de presentación con servicios, beneficios y contacto. HTML y CSS editables.",
    "download": "/catalog/landing-negocio/landing-negocio.zip",
    "preview": "/catalog/landing-negocio/index.html"
  },
  {
    "slug": "portfolio-profesional",
    "title": "Template portfolio profesional",
    "category": "templates-web",
    "kind": "download",
    "summary": "Presentación personal, proyectos y contacto. Una base estática para profesionales independientes.",
    "download": "/catalog/portfolio-profesional/portfolio-profesional.zip",
    "preview": "/catalog/portfolio-profesional/index.html"
  },
  {
    "slug": "restaurante-menu",
    "title": "Template de carta para restaurante",
    "category": "templates-web",
    "kind": "download",
    "summary": "Carta digital con categorías y precios de ejemplo editables. Sin pagos ni pedidos automatizados.",
    "download": "/catalog/restaurante-menu/restaurante-menu.zip",
    "preview": "/catalog/restaurante-menu/index.html"
  },
  {
    "slug": "consultoria-servicios",
    "title": "Template para consultoría y servicios",
    "category": "templates-web",
    "kind": "download",
    "summary": "Presentación de servicios profesionales, proceso de trabajo y preguntas frecuentes.",
    "download": "/catalog/consultoria-servicios/consultoria-servicios.zip",
    "preview": "/catalog/consultoria-servicios/index.html"
  },
  {
    "slug": "wp-contacto-whatsapp",
    "title": "Plugin WordPress: contacto por WhatsApp",
    "category": "plugins-wordpress",
    "kind": "plugin",
    "summary": "Shortcode configurable para mostrar un enlace de WhatsApp. Incluye número y texto mediante atributos.",
    "download": "/catalog/wp-contacto-whatsapp/wp-contacto-whatsapp.zip",
    "preview": null
  },
  {
    "slug": "wp-barra-aviso",
    "title": "Plugin WordPress: aviso destacado",
    "category": "plugins-wordpress",
    "kind": "plugin",
    "summary": "Shortcode para publicar un aviso con texto y enlace opcional, sin dependencias externas.",
    "download": "/catalog/wp-barra-aviso/wp-barra-aviso.zip",
    "preview": null
  },
  {
    "slug": "wp-faq-simple",
    "title": "Plugin WordPress: preguntas frecuentes",
    "category": "plugins-wordpress",
    "kind": "plugin",
    "summary": "Shortcode para preguntas y respuestas desplegables con HTML nativo y contenido editable.",
    "download": "/catalog/wp-faq-simple/wp-faq-simple.zip",
    "preview": null
  },
  {
    "slug": "panel-indicadores",
    "title": "Componente: panel de indicadores",
    "category": "componentes-ui",
    "kind": "download",
    "summary": "Maqueta HTML de tarjetas de métricas y tabla. Datos ilustrativos; sin conexión a una base de datos.",
    "download": "/catalog/panel-indicadores/panel-indicadores.zip",
    "preview": "/catalog/panel-indicadores/index.html"
  },
  {
    "slug": "seccion-precios",
    "title": "Componente: comparador de planes",
    "category": "componentes-ui",
    "kind": "download",
    "summary": "Sección HTML para comparar planes. Los importes de la maqueta son ejemplos editables.",
    "download": "/catalog/seccion-precios/seccion-precios.zip",
    "preview": "/catalog/seccion-precios/index.html"
  },
  {
    "slug": "faq-contacto",
    "title": "Componente: preguntas frecuentes",
    "category": "componentes-ui",
    "kind": "download",
    "summary": "Sección accesible de preguntas desplegables con details y summary, lista para adaptar.",
    "download": "/catalog/faq-contacto/faq-contacto.zip",
    "preview": "/catalog/faq-contacto/index.html"
  },
  {
    "slug": "plataforma-reservas",
    "title": "Plataforma de reservas — desarrollo por encargo",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Propuesta para gestionar servicios, horarios y solicitudes de reserva. Roles, calendario y notificaciones se evalúan según el proyecto.",
    "download": null,
    "preview": "/demos/plataforma-reservas/"
  },
  {
    "slug": "plataforma-cursos",
    "title": "Plataforma de cursos — desarrollo por encargo",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Propuesta para organizar cursos, lecciones y acceso de alumnos. Pagos, evaluaciones y certificados requieren definición de alcance.",
    "download": null,
    "preview": null
  },
  {
    "slug": "crm-comercial",
    "title": "CRM para pequeños negocios — desarrollo por encargo",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Propuesta para organizar contactos, oportunidades y seguimiento comercial. Las integraciones se evalúan durante la cotización.",
    "download": null,
    "preview": "/demos/crm-comercial/"
  },
  {
    "slug": "gestion-inventario",
    "title": "Sistema de inventario — desarrollo por encargo",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Propuesta para registrar productos, entradas, salidas y reportes. Almacenes, permisos y reglas se acuerdan con el equipo.",
    "download": null,
    "preview": "/demos/gestion-inventario/"
  },
  {
    "slug": "portal-clientes",
    "title": "Portal de clientes — desarrollo por encargo",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Propuesta para centralizar solicitudes, documentos y seguimiento con acceso privado. Seguridad e integraciones se definen en el alcance.",
    "download": null,
    "preview": null
  },
  {
    "slug": "tienda-wordpress",
    "title": "Tienda con WordPress — implementación por encargo",
    "category": "tiendas-online",
    "kind": "quote",
    "summary": "Evaluación e implementación de una tienda sobre WordPress. Catálogo, pagos, envíos y licencias se cotizan según las necesidades.",
    "download": null,
    "preview": null
  },
  {
    "slug": "catalogo-whatsapp",
    "title": "Catálogo con pedidos por WhatsApp — por encargo",
    "category": "tiendas-online",
    "kind": "quote",
    "summary": "Propuesta para mostrar productos y derivar consultas o pedidos a WhatsApp. No incluye pagos ni gestión logística sin evaluación previa.",
    "download": null,
    "preview": null
  },
  {
    "slug": "plataforma-desde-cero",
    "title": "Tu plataforma a medida desde cero",
    "category": "desarrollo-a-medida",
    "kind": "quote",
    "summary": "Diseño y desarrollo de una plataforma según tu negocio. Definimos usuarios, funcionalidades, integraciones, prioridades y fases antes de cotizar.",
    "download": null,
    "preview": null
  },
  {
    "slug": "marketplace-starter",
    "title": "Marketplace Starter — Django y React",
    "category": "plataformas-web",
    "kind": "commercial",
    "summary": "Base de código editable de CIEM para crear marketplaces, directorios y plataformas de anuncios con Django REST Framework y React.",
    "description": "Marketplace Starter es un producto comercial de CIEM para construir un marketplace, directorio o plataforma de anuncios. Incluye backend Django REST Framework y frontend React con Vite.\n\nLa ficha comercial describe registro e inicio de sesión con JWT, gestión de anuncios, búsqueda y filtros, administración Django y una base para visibilidad destacada por ciudad. El proyecto utiliza PostgreSQL y Redis y requiere instalación y configuración.\n\nPrueba la demostración en demo.ciem.pe. La compra del código, el precio actualizado y las condiciones de licencia se consultan en Codester. No es una descarga gratuita ni un servicio alojado automáticamente.\n\n¿Necesitas adaptarlo a tu negocio? CIEM puede evaluar la instalación, personalización, integraciones o una plataforma a medida. Estos trabajos se cotizan por separado.",
    "download": null,
    "preview": "https://demo.ciem.pe/",
    "purchaseUrl": "https://www.codester.com/items/72042/marketplace-starter-django-and-react"
  },
  {
    "slug": "booking-starter-kit",
    "title": "Booking Starter Kit — plataforma de reservas de citas",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de una plataforma de citas inspirada en MasterClean Connect: servicios, profesionales, calendario, reserva en cuatro pasos y panel de agenda.",
    "description": "Booking Starter Kit es una demostración estática de una plataforma de reservas de citas de CIEM. Replica el recorrido de MasterClean Connect y lo adapta a servicios de distintos sectores.\n\nPrueba un catálogo de seis servicios de ejemplo, tres profesionales, calendario con horarios disponibles, reserva en cuatro pasos, consulta de citas y panel de agenda para confirmar, completar o cancelar. El calendario respeta duración, pausas y ocupación por profesional.\n\nLos datos son ficticios y los cambios se guardan solo en el navegador. La demo no incorpora usuarios reales, base de datos, cobros ni envío de recordatorios.\n\nPodemos evaluar la construcción o personalización de una plataforma de reservas para tu negocio. Usuarios, permisos, pagos, notificaciones, integraciones, precio y plazo se definen durante la cotización.",
    "download": null,
    "preview": "/booking-starter-kit/"
  },
  {
    "slug": "creator-platform-starter-kit",
    "title": "Creator Platform Starter Kit — plataforma de creadores y fans",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática inspirada en Fanely y la productización de CreatorHub: perfiles, feed, publicaciones públicas y exclusivas, membresías simuladas y Creator Studio.",
    "description": "Creator Platform Starter Kit es una demostración de CIEM para explorar una plataforma de creadores, fans, comunidad y contenido. Toma como referencia la experiencia de Fanely y la separación de capacidades reutilizables descrita en CreatorHub.\n\nPrueba cuatro perfiles ficticios, seguimiento, reacciones, publicaciones guardadas, contenido por audiencia y dos niveles de membresía simulada. Creator Studio permite crear borradores, publicar y archivar texto de ejemplo.\n\nLa demo es estática y guarda cambios solo en el navegador. Los importes y perfiles son ficticios. No incluye autenticación real, protección de archivos, pagos, renovaciones, billetera, retiros, chat ni mensajería real.\n\nEs una propuesta por encargo, no un paquete full-stack terminado ni una función incluida en Marketplace Starter v1.0. El alcance de usuarios, contenido, suscripciones, pagos e integraciones se evalúa y cotiza con CIEM.",
    "download": null,
    "preview": "/creator-platform-starter-kit/"
  },
  {
    "slug": "erp-starter-kit",
    "title": "ERP Starter Kit — gestión para pequeños negocios",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de un ERP para comercio y servicios: cotizaciones, pedidos, ventas, compras, inventario, contactos, cuentas pendientes y reportes CSV.",
    "description": "ERP Starter Kit es una demostración de CIEM para explorar una plataforma de gestión de pequeños negocios.\n\nPrueba el recorrido cotización → pedido → venta → salida de stock → cuenta por cobrar. Registra compras, confirma su recepción y observa el aumento de existencias y la cuenta por pagar. Los abonos parciales actualizan los saldos.\n\nIncluye catálogo de productos y servicios, ajustes de inventario con motivo, clientes, proveedores, vencimientos y reportes filtrados por período con exportación CSV. La demo valida cantidades, totales y saldos, e impide duplicar conversiones y recepciones o vender sin stock suficiente.\n\nLos datos e importes son ficticios y se guardan solo en este navegador. No hay usuarios reales, sincronización, base de datos, pagos, conexión bancaria, contabilidad tributaria, planillas ni facturación electrónica. Los documentos son internos de ejemplo.\n\nPodemos evaluar un ERP adaptado a tus procesos. Roles, integraciones, seguridad, instalación, soporte, precio y plazo se definen durante la cotización. Esta ficha es una propuesta por encargo, no un paquete productivo terminado.",
    "download": null,
    "preview": "/erp-starter-kit/"
  },
  {
    "slug": "lms-starter-kit",
    "title": "LMS Starter Kit — plataforma educativa",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de una plataforma educativa: catálogo de cursos, aula con lecciones, progreso del alumno, cuestionarios y gestión de contenido por instructor.",
    "description": "LMS Starter Kit es una demostración de CIEM para explorar una plataforma educativa para academias, capacitaciones o comunidades de aprendizaje.\n\nPrueba tres cursos introductorios de ejemplo, con nueve lecciones de texto, inscripción simulada, navegación secuencial y progreso por curso. Al completar las lecciones se habilita un cuestionario de tres preguntas, con resultado, reintentos y un logro claramente identificado como demostración sin validez académica.\n\nEl panel instructor permite crear borradores y publicar lecciones. Los cambios actualizan el recorrido y reinician la evaluación del curso en esta demo.\n\nLos datos se guardan solo en el navegador. No hay cuentas, matrículas, pagos, servidores de video, acreditaciones, SCORM, supervisión de exámenes ni control de acceso reales. El contenido es introductorio de ejemplo y las respuestas de los cuestionarios están en el código público.\n\nPodemos evaluar la construcción o adaptación de una plataforma LMS. Usuarios, permisos, contenidos, evaluaciones, integraciones, instalación, precio y plazo se acuerdan durante la cotización. Esta ficha es una propuesta por encargo, no una plataforma productiva terminada.",
    "download": null,
    "preview": "/lms-starter-kit/"
  },
  {
    "slug": "magazine-starter-kit",
    "title": "Magazine Starter Kit — revista digital",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de una revista digital con portada editorial, categorías, artículos, búsqueda, lecturas guardadas y panel de publicación.",
    "description": "Magazine Starter Kit es una demostración de CIEM para explorar una revista digital con identidad editorial propia. La edición ficticia MARGEN presenta seis artículos originales de ejemplo y seis fotografías de archivo de Pexels con créditos y enlaces a su licencia.\n\nPrueba la portada destacada, el archivo por categorías, la búsqueda, el lector de artículos, los guardados, el marcado de lectura, la copia del enlace y la impresión desde el navegador. El panel editorial permite crear, editar, publicar, archivar y destacar historias en portada.\n\nIncluye un formulario de boletín simulado: valida un correo de ejemplo sin enviarlo ni almacenarlo.\n\nLos autores y contenidos son ficticios. Los cambios se guardan solo en este navegador. No hay CMS privado, cuentas, subida de archivos, envío de boletines, paywall ni integración editorial reales. No es una cobertura periodística ni una plataforma productiva terminada.\n\nPodemos evaluar una revista o publicación digital adaptada a tu marca. Alcance editorial, usuarios, medios, integraciones, instalación, precio y plazo se definen durante la cotización.",
    "download": null,
    "preview": "/magazine-starter-kit/"
  },
  {
    "slug": "ticketing-starter-kit",
    "title": "Ticketing Starter Kit — portal de venta de entradas",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de un portal de eventos: cartelera, selección de entradas, compra simulada, pases digitales y panel de organización con control de acceso.",
    "description": "Ticketing Starter Kit es una demostración de CIEM para explorar una plataforma de venta de entradas con marca propia. PULSO presenta seis eventos ficticios, categorías, búsqueda por evento o ciudad y fotografías de archivo de Pexels con fuentes y licencia documentadas.\n\nPrueba entradas generales y preferenciales, selección de hasta seis unidades por compra, desglose de importes y cargo de servicio de ejemplo. La compra es simulada, sin tarjeta ni datos personales: genera pases de demostración en Mis entradas. Puedes anular una compra antes de usar sus entradas y recuperar la disponibilidad de ejemplo.\n\nEl panel de organización permite pausar y reactivar ventas y simular el control de acceso introduciendo el código del pase. Un código utilizado o anulado no puede registrarse nuevamente. El gráfico del pase es decorativo, no un código QR escaneable.\n\nDemo estática con datos en el navegador. Eventos, precios, cargos y capacidades son ficticios; no son tarifas comerciales de CIEM. Sin cobros, reservas concurrentes, cuentas, permisos privados, correos, PDF, asientos numerados, lectura de cámara ni validación real. No se emiten entradas válidas.\n\nPodemos evaluar un portal de ticketing adaptado a tus eventos y marca. Pasarelas de pago, control de acceso, usuarios, integraciones, alcance, instalación, precio y plazo se definen durante la cotización. Esta ficha es una propuesta por encargo, no un sistema productivo terminado.",
    "download": null,
    "preview": "/ticketing-starter-kit/"
  },
  {
    "slug": "ciem-gov",
    "title": "CIEM Gov — Gobierno Digital",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Portal institucional con acceso a servicios, trámites, transparencia y atención ciudadana. Demo con solicitudes, seguimiento, agenda de orientación y gestión simulada.",
    "description": "CIEM Gov es una propuesta de portal institucional de CIEM para acercar servicios e información a la ciudadanía. Su demo presenta una entidad ficticia con diseño adaptable a móviles, accesos frecuentes, buscador de servicios, fichas de orientación y publicaciones institucionales de ejemplo.\n\nExplora seis servicios: mesa de partes digital, orientación para negocios, consultas de desarrollo urbano, acceso a información pública, atención ciudadana y espacios comunitarios. Cada ficha ofrece una descripción, requisitos ilustrativos y un formulario con datos de ejemplo. No se solicitan DNI ni documentos personales.\n\nRegistra una solicitud simulada, consulta su código y revisa el historial. El panel de gestión público permite iniciar revisión, solicitar subsanación y finalizar la atención. La persona usuaria puede subsanar una solicitud observada o anular una solicitud abierta. La agenda permite reservar y anular turnos ficticios, sin duplicar un turno activo en este navegador.\n\nTransparencia incluye seis documentos de ejemplo, filtros por tema y año, lectura e impresión, una distribución presupuestal ficticia y descarga CSV. Incluye controles de contraste y ampliación de texto, foco visible, enlace para saltar contenido y soporte de movimiento reducido. No constituye una certificación de accesibilidad.\n\nDemo estática: los datos se guardan en el navegador. Sin entidad pública real, expedientes, firma digital, cuentas, permisos privados, documentos adjuntos, pagos, citas reales, notificaciones ni integraciones estatales. Contenidos, procedimientos, requisitos, presupuesto y jornadas son ficticios; no informan normas, tasas o plazos oficiales. La fotografía de archivo de Pexels es referencial e incluye créditos y licencia.\n\nPodemos evaluar una plataforma institucional adaptada a tu organización. Contenidos, usuarios, permisos, seguridad, accesibilidad, integraciones, instalación, precio y plazo se definen durante la cotización. Esta ficha es una propuesta por encargo, no un sistema productivo terminado.",
    "download": null,
    "preview": "/ciem-gov/"
  },
  {
    "slug": "ciem-participa",
    "title": "CIEM Participa — Gobernanza Colaborativa",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de gobernanza colaborativa: propuestas vecinales, deliberación, decisiones colectivas y seguimiento de acuerdos.",
    "description": "CIEM Participa es una propuesta de CIEM para explorar una plataforma de colaboración comunitaria. Incluye propuestas, aportes, apoyos locales, decisión colectiva de ejemplo y seguimiento de acuerdos ficticios. Los datos se guardan solo en el navegador; no hay participación ni decisiones reales.",
    "download": null,
    "preview": "/ciem-participa/"
  },
  {
    "slug": "ciem-expedientes",
    "title": "CIEM Expedientes — Gestión Documental",
    "category": "plataformas-web",
    "kind": "quote",
    "summary": "Demo estática de mesa de partes, consulta de expedientes, bandeja de documentos y seguimiento de trámites.",
    "description": "CIEM Expedientes es una propuesta de gestión documental con mesa de partes, bandeja, consulta y seguimiento local de expedientes ficticios. Sin documentos, trámites, identidad o validez administrativa real.",
    "download": null,
    "preview": "/ciem-expedientes/"
  },
  {"slug":"ciem-presupuesto-participativo","title":"CIEM Presupuesto Participativo","category":"plataformas-web","kind":"quote","summary":"Demo estática de proyectos vecinales, asignación ilustrativa de recursos, votaciones locales y visualización de avances.","description":"CIEM Presupuesto Participativo es una propuesta de CIEM para explorar proyectos comunitarios, prioridades locales y avances ficticios. Los datos viven solo en el navegador y no son presupuestos ni votaciones reales.","download":null,"preview":"/ciem-presupuesto-participativo/"}
  ,{"slug":"ciem-legal","title":"CIEM Legal — Gestión para estudios de abogados","category":"plataformas-web","kind":"quote","summary":"Demo estática de asuntos, agenda de hitos y documentos para estudios de abogados.","download":null,"preview":"/ciem-legal/"}
  ,{"slug":"ciem-salud","title":"CIEM Salud — Plataforma para clínicas y hospitales","category":"plataformas-web","kind":"quote","summary":"Demo estática de agenda, admisión, flujo de atención e indicadores para clínicas y hospitales.","download":null,"preview":"/ciem-salud/"}
];

export const digitalCategorySlugs = ["templates-web", "plugins-wordpress", "plataformas-web", "componentes-ui", "tiendas-online", "desarrollo-a-medida"]

export function getCiemProduct(title: string) { return ciemCatalog.find(item => item.title === title) }

const updatedCoverSlugs = new Set([
  'ciem-salud',
  'ciem-legal',
  'ciem-presupuesto-participativo',
  'ciem-expedientes',
])

export function getCiemProductCoverUrl(product: CiemProduct) {
  const filename = updatedCoverSlugs.has(product.slug) ? 'cover-v2.png' : 'cover.png'
  return `/catalog/${product.slug}/${filename}`
}

export function projectContact(title?: string) { return "https://wa.me/51999989709?text=" + encodeURIComponent(title ? `Hola, me interesa ${title}. Quisiera evaluar su personalización para mi proyecto.` : "Hola, me gustaría crear una plataforma a medida desde cero. Quiero evaluar mi proyecto con CIEM.") }
