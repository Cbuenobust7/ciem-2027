import { CatalogSection } from '@/components/catalog/CatalogSection'
import { PlatformBanner } from '@/components/home/PlatformBanner'
import { ClientsBar } from '@/components/home/ClientsBar'
import { AcademySection } from '@/components/home/AcademySection'
import { DevHostingSection } from '@/components/home/DevHostingSection'
import { CiemHeroArt } from '@/components/home/CiemHeroArt'
import './CiemHero.css'
import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'
import { analytics, trackAnalyticsEvent } from '@/lib/analytics'


export default function HomePage() {
  const { t } = useLanguage()
  const [autoScrollCancelled, setAutoScrollCancelled] = useState(false)

  useEffect(() => {
    if (autoScrollCancelled) return

    const timer = window.setTimeout(() => {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 20_000)

    const cancelOnIntent = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest('.mc-header, .ciem-hero')) {
        setAutoScrollCancelled(true)
      }
    }
    const cancelOnManualScroll = () => setAutoScrollCancelled(true)

    document.addEventListener('click', cancelOnIntent, true)
    window.addEventListener('wheel', cancelOnManualScroll, { passive: true })
    window.addEventListener('touchstart', cancelOnManualScroll, { passive: true })
    window.addEventListener('keydown', cancelOnManualScroll)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', cancelOnIntent, true)
      window.removeEventListener('wheel', cancelOnManualScroll)
      window.removeEventListener('touchstart', cancelOnManualScroll)
      window.removeEventListener('keydown', cancelOnManualScroll)
    }
  }, [autoScrollCancelled])

  return (
    <div className="home-page">
      <section className="ciem-hero" aria-labelledby="ciem-hero-title">
      <div className="ciem-hero__inner">
        <div className="ciem-hero__content">
          <p className="ciem-hero__eyebrow">DESARROLLO WEB · DISEÑO WEB · HOSTING</p>
          <h1 id="ciem-hero-title" className="ciem-hero__title">
            Cero webs genéricas.
            <br />
            <span className="ciem-hero__brand">CIEM</span> por ciento tu&nbsp;marca.
          </h1>
          <p className="ciem-hero__copy">Diseñamos y desarrollamos sitios web y aplicaciones a la medida de tu negocio. También te ayudamos con hosting, integración con IA y soporte técnico para mantener tu proyecto en línea.</p>
          <div className="ciem-hero__actions">
            <button type="button" className="ciem-hero__button ciem-hero__button--primary" data-ciem-ask="Quiero solicitar una cotización para mi proyecto web">Solicitar una cotización</button>
            <a className="ciem-hero__button ciem-hero__button--secondary" href="#servicios" onClick={() => trackAnalyticsEvent(analytics.heroServicesLink)}>¿Qué ofrecemos?</a>
          </div>
        </div>
        <CiemHeroArt />
      </div>
    </section>

      <section id="servicios" aria-labelledby="custom-platform-title" className="relative overflow-hidden bg-master-light">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <PlatformBanner />
        </div>
      </section>

      <section id="catalogo" aria-labelledby="catalog-title" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <CatalogSection />
          <p className="mt-8 rounded-lg bg-primary-50 p-4 text-sm text-master-navy">{t('catalogNotice')}</p>
        </div>
      </section>

      <section aria-labelledby="clientes-title" className="bg-master-light">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <ClientsBar />
        </div>
      </section>

      <AcademySection />
      <DevHostingSection />
    </div>
  )
}