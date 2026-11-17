import './DevHostingSection.css'

export function DevHostingSection() {
  return (
    <section id="dev" className="ciem-dev" aria-labelledby="ciem-dev-title">
      <div className="ciem-dev__inner">
        <div className="ciem-dev__content">
          <h2 id="ciem-dev-title">Desarrollo Dev &amp; <span>Hosting</span></h2>
          <p>Infraestructura robusta para proyectos exigentes.</p>
          <ul>
            <li><span aria-hidden="true">✓</span> Hosting de alta disponibilidad.</li>
            <li><span aria-hidden="true">✓</span> Web Apps en React y WordPress avanzado.</li>
            <li><span aria-hidden="true">✓</span> Soporte técnico especializado 24/7.</li>
          </ul>
        </div>
        <div className="ciem-dev__art">
          <img src="/images/ciem-dev/integracion.png" alt="Integración" loading="lazy" />
        </div>
      </div>
    </section>
  )
}
