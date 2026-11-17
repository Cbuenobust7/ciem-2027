import { Link } from 'react-router-dom'
import './CiemFooter.css'

export function Footer() {
  return (
    <footer className="ciem-site-footer">
      <div className="footer-container">
        <div className="footer-column">
          <h3>CIEM</h3>
          <ul>
            <li><Link to="/nosotros">Sobre CIEM</Link></li>
            <li><Link to="/contacto">Contacto</Link></li>
            <li><a href="https://wa.me/51999989709" data-analytics-event="quote_request">Conversar por WhatsApp</a></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Información legal</h3>
          <ul>
            <li><Link to="/legal/terminos">Términos y condiciones</Link></li>
            <li><Link to="/legal/privacidad">Política de privacidad</Link></li>
            <li><Link to="/legal/devoluciones">Cambios y devoluciones</Link></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Atención</h3>
          <ul>
            <li><Link to="/ayuda">Ayuda y soporte</Link></li>
            <li><Link to="/legal/reclamaciones">Atención de reclamos</Link></li>
            <li className="ruc-info">RUC: 20608645846</li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Productos digitales</h3>
          <ul>
            <li><Link to="/">Explorar el catálogo</Link></li>
            <li><a href="https://marketplace.ciem.pe/">Marketplace CIEM</a></li>
            <li><Link to="/contacto">Solicitar una cotización</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} CIEM. Todos los derechos reservados.</p>
        <p style={{ fontSize: 11 }}>CIEM PRODUCTOS &amp; SERVICIOS DIGITALES E.I.R.L.</p>
      </div>
    </footer>
  )
}
