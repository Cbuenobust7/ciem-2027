import { Link } from 'react-router-dom'
import './AcademySection.css'

export function AcademySection() {
  return (
    <section id="academia" className="ciem-academy" aria-labelledby="ciem-academy-title">
      <div className="ciem-academy__container">
        <h2 id="ciem-academy-title">Aprende a impulsar tu proyecto con <span>CIEM</span></h2>
        <p className="ciem-academy__intro">Conoce cómo gestionar tu sitio y aprovechar los productos digitales. Consulta con el equipo las opciones de orientación según tu plataforma y tus objetivos.</p>
        <div className="ciem-academy__row">
          <div className="ciem-academy__column">
            <div className="ciem-academy__card">
              <h5>Gestión de tu sitio web</h5>
              <p>Aprende a organizar tus páginas, actualizar contenidos y utilizar las funciones de tu plataforma.</p>
            </div>
          </div>
          <div className="ciem-academy__column">
            <div className="ciem-academy__card">
              <h5>Productos digitales en acción</h5>
              <p>Conoce los requisitos de cada solución y los pasos para adaptarla a las necesidades de tu negocio.</p>
            </div>
          </div>
        </div>
        <Link className="ciem-academy__button" to="/contacto">Consultar orientación CIEM</Link>
      </div>
    </section>
  )
}
