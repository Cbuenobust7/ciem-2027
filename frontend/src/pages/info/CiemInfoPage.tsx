import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './ciem-info.css'

type Section = { title: string; text: string }
type Page = { title: string; intro: string; sections: Section[] }
const pages: Record<string, Page> = {
  '/nosotros': {
    title: 'Sobre CIEM',
    intro: 'Productos digitales y desarrollo web para dar forma a tu proyecto.',
    sections: [
      { title: 'Qué hacemos', text: 'CIEM desarrolla sitios y aplicaciones web, soluciones con WordPress y React, y ofrece hosting, mantenimiento y soporte según el alcance de cada proyecto.' },
      { title: 'Nuestro catálogo', text: 'Aquí puedes explorar bases editables, templates, aplicaciones y componentes digitales. Revisa la ficha de cada producto para conocer su propósito, requisitos, licencia y modalidad de entrega.' },
      { title: 'Cómo trabajamos', text: 'Partimos de tu objetivo, los usuarios y las funcionalidades que necesitas. El equipo evalúa el alcance antes de confirmar tecnología, precio y plazo. La personalización, implementación y desarrollo a medida se cotizan por separado de las descargas básicas gratuitas.' },
      { title: 'Identidad', text: 'CIEM PRODUCTOS & SERVICIOS DIGITALES E.I.R.L. · RUC 20608645846.' },
    ],
  },
  '/contacto': {
    title: 'Conversemos sobre tu proyecto',
    intro: 'Cuéntanos qué necesitas construir o mejorar para que el equipo evalúe tu solicitud.',
    sections: [
      { title: 'Solicitar una cotización', text: 'Indica el objetivo de tu proyecto, si ya tienes una web, las funcionalidades necesarias y el plazo deseado. Si consultas por un producto, incluye su nombre o enlace.' },
      { title: 'Canal de contacto', text: 'Escríbenos por WhatsApp al +51 999 989 709 mediante el botón de esta página. La propuesta, disponibilidad y tiempos de atención se confirman con el equipo.' },
      { title: 'Sobre el asistente', text: 'El asistente orienta con respuestas aprobadas. Una conversación en el chat no constituye una cotización ni se envía automáticamente al equipo por WhatsApp. Comparte allí el resumen que deseas que revisemos.' },
    ],
  },
  '/ayuda': {
    title: 'Ayuda y soporte',
    intro: 'Encuentra el siguiente paso para usar un producto o solicitar asistencia.',
    sections: [
      { title: 'Antes de descargar', text: 'Lee la descripción del producto y comprueba sus requisitos técnicos, licencia e instrucciones. Una base editable puede necesitar instalación y configuración antes de utilizarse en producción.' },
      { title: 'Problemas de instalación o descarga', text: 'Comparte el nombre del producto, su enlace, la versión utilizada, el mensaje de error y los pasos para reproducirlo. Puedes adjuntar una captura ocultando cualquier dato personal o credencial.' },
      { title: 'Personalización y mantenimiento', text: 'La descarga básica no incluye automáticamente adaptación, hosting, instalación ni soporte continuo. Consulta los servicios incluidos en la ficha o propuesta y solicita una evaluación para tareas adicionales.' },
      { title: 'Cuida tus accesos', text: 'No envíes contraseñas, claves API ni datos de pago por el chat. Si el trabajo requiere acceso a tu plataforma, coordina con el equipo un procedimiento apropiado.' },
    ],
  },
  '/legal/terminos': {
    title: 'Términos y condiciones',
    intro: 'Condiciones de uso del catálogo y de las solicitudes de productos y servicios de CIEM.',
    sections: [
      { title: 'Productos y servicios', text: 'El catálogo presenta productos digitales y servicios por encargo. La ficha de cada producto describe su modalidad. Las descargas básicas gratuitas y los servicios de pago tienen alcances distintos; una descarga no incluye por sí sola desarrollo a medida, alojamiento o mantenimiento.' },
      { title: 'Propuestas y contratación', text: 'Una consulta, un mensaje al asistente o una solicitud de cotización no confirma una contratación. Antes de contratar, revisa con el equipo el alcance, entregables, precio, moneda, impuestos aplicables, plazos, forma de pago y condiciones de soporte.' },
      { title: 'Licencias y uso', text: 'Respeta la licencia que acompaña a cada producto y las licencias de sus dependencias. La disponibilidad de una descarga no autoriza a redistribuir marcas, imágenes o componentes de terceros fuera de los permisos correspondientes.' },
      { title: 'Responsabilidades de uso', text: 'Verifica la compatibilidad con tu entorno, conserva copias de seguridad antes de instalar cambios y protege tus credenciales. No utilices el sitio para vulnerar derechos de otras personas ni interferir con su funcionamiento.' },
      { title: 'Información y derechos', text: 'Los precios, plazos y niveles de servicio deben constar en la ficha o propuesta aplicable. Estas condiciones no restringen los derechos que te correspondan conforme a la normativa de protección al consumidor. Puedes comunicar incidencias mediante nuestros canales de atención.' },
    ],
  },
  '/legal/privacidad': {
    title: 'Política de privacidad',
    intro: 'Información sobre el uso de datos al navegar, gestionar una cuenta o contactar con CIEM.',
    sections: [
      { title: 'Responsable y contacto', text: 'Este sitio se presenta bajo CIEM PRODUCTOS & SERVICIOS DIGITALES E.I.R.L., RUC 20608645846. Para consultas sobre tus datos utiliza la página de contacto e identifica tu solicitud como privacidad.' },
      { title: 'Información que proporcionas', text: 'Según las funciones que utilices, puedes proporcionar datos de registro, contacto y detalles de tu proyecto. El asistente procesa los mensajes enviados para seleccionar una respuesta. Evita incluir información sensible, contraseñas o datos de pago.' },
      { title: 'Para qué se utiliza', text: 'La información se utiliza para gestionar el acceso a tu cuenta, responder solicitudes, atender incidencias y prestar los servicios solicitados. Los sistemas de alojamiento y entrega del sitio pueden procesar datos técnicos de conexión necesarios para su operación y seguridad.' },
      { title: 'Almacenamiento en el navegador', text: 'La sesión utiliza almacenamiento local del navegador para los tokens de acceso y renovación. Puedes cerrar sesión para eliminarlos. Borrar los datos del sitio desde el navegador también puede restablecer preferencias y requerir que inicies sesión nuevamente.' },
      { title: 'Medición de uso', text: 'En ciem.pe podemos utilizar Google Analytics 4 para medir visitas y acciones generales del sitio. Microsoft Clarity puede registrar interacciones de navegación únicamente en páginas públicas seleccionadas; no se activa en páginas de cuenta, reservas ni detalle de anuncios. Estos proveedores pueden utilizar tecnologías de almacenamiento o identificadores y procesar datos técnicos de uso conforme a sus políticas. La medición no se usa para personalizar anuncios. Puedes limitar cookies y almacenamiento desde tu navegador.' },
      { title: 'Servicios externos', text: 'Al abrir WhatsApp, Google Analytics o Microsoft Clarity, interactúas también con esos servicios y sus condiciones de privacidad. No incluyas datos sensibles en los mensajes que compartas. El asistente utiliza infraestructura de inferencia para procesar las consultas enviadas.' },
      { title: 'Solicitudes sobre tus datos', text: 'Puedes solicitar información sobre el tratamiento y ejercer tus derechos de acceso, rectificación, cancelación u oposición mediante el canal de contacto. Indica el derecho que deseas ejercer; el equipo coordinará la identificación necesaria sin pedirte credenciales de acceso.' },
    ],
  },
  '/legal/devoluciones': {
    title: 'Cambios y devoluciones',
    intro: 'Cómo comunicar una incidencia relacionada con un producto digital o un servicio contratado.',
    sections: [
      { title: 'Descargas gratuitas', text: 'Si encuentras un archivo incompleto, un enlace roto o una diferencia respecto de la descripción, envíanos el enlace del producto y los detalles para que el equipo lo revise. Una descarga gratuita no genera un importe que devolver.' },
      { title: 'Productos y servicios de pago', text: 'Si realizaste un pago y existe una incidencia, indica el producto o servicio, la fecha, la referencia de la operación y la solución solicitada. No compartas el número completo de tu tarjeta ni códigos de seguridad.' },
      { title: 'Evaluación de la solicitud', text: 'El equipo revisará lo ofrecido, las condiciones acordadas, el estado de la entrega y la incidencia reportada para determinar la solución correspondiente. Esta página no establece una exclusión general de devoluciones para productos digitales ni limita tus derechos legales.' },
      { title: 'Cambios de alcance', text: 'Las nuevas funcionalidades o cambios solicitados después de acordar una propuesta deben evaluarse con el equipo. Antes de continuar, confirma cómo afectan a los entregables, al precio y al plazo.' },
    ],
  },
  '/legal/reclamaciones': {
    title: 'Atención de reclamos',
    intro: 'Comunica una disconformidad sobre un producto o servicio de CIEM.',
    sections: [
      { title: 'Qué información enviar', text: 'Indica tu nombre, un medio de respuesta, el producto o servicio, la fecha de la operación, una descripción de lo ocurrido y la solución que solicitas. Comparte documentos de respaldo ocultando datos de pago y otra información innecesaria.' },
      { title: 'Contactar con el equipo', text: 'Utiliza el botón de WhatsApp de esta página para comunicar tu caso y solicitar el canal formal de presentación. Conserva una copia de tu comunicación y de la respuesta recibida.' },
      { title: 'Alcance de esta página', text: 'Esta página es informativa: no registra hojas ni emite constancias del Libro de Reclamaciones. Abrir WhatsApp tampoco genera una hoja de reclamación. Solicita al equipo el acceso al libro correspondiente.' },
      { title: 'Información al consumidor', text: 'Puedes consultar la orientación oficial de Indecopi sobre el Libro de Reclamaciones y los canales disponibles para resolver problemas de consumo mediante el enlace que aparece a continuación.' },
    ],
  },
}

export default function CiemInfoPage() {
  const { pathname } = useLocation()
  const page = pages[pathname]
  useEffect(() => {
    document.title = page ? `${page.title} | CIEM` : 'CIEM'
    window.scrollTo(0, 0)
    return () => { document.title = 'CIEM Productos Digitales' }
  }, [page])
  if (!page) return null
  return (
    <article className="ciem-info">
      <Link className="ciem-info__back" to="/">← Volver al catálogo</Link>
      <header>
        <p className="ciem-info__eyebrow">CIEM · PRODUCTOS Y SERVICIOS DIGITALES</p>
        <h1>{page.title}</h1>
        <p className="ciem-info__intro">{page.intro}</p>
      </header>
      {page.sections.map(section => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.text}</p>
        </section>
      ))}
      {pathname === '/legal/reclamaciones' && <p><a href="https://consumidor.gob.pe/libro-de-reclamaciones/" target="_blank" rel="noopener noreferrer">Orientación oficial de Indecopi sobre el Libro de Reclamaciones ↗</a></p>}
      {pathname === '/legal/privacidad' && <p><a href="https://www.gob.pe/institucion/anpd/tema/derechos-arco" target="_blank" rel="noopener noreferrer">Información oficial sobre derechos ARCO ↗</a></p>}
      <aside className="ciem-info__contact">
        <h2>¿Necesitas conversar con el equipo?</h2>
        <p>Comparte tu consulta o el enlace del producto que te interesa.</p>
        <a className="ciem-info__button" href="https://wa.me/51999989709" data-analytics-event="navigation_contact">Contactar con CIEM por WhatsApp</a>
      </aside>
    </article>
  )
}
