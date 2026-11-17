import { CatalogSection } from '@/components/catalog/CatalogSection'
import { PlatformBanner } from '@/components/home/PlatformBanner'
import { ClientsBar } from '@/components/home/ClientsBar'
import { AcademySection } from '@/components/home/AcademySection'
import { DevHostingSection } from '@/components/home/DevHostingSection'
import type { CSSProperties } from 'react'
import './CiemHero.css'
import { projectContact } from '@/data/ciemCatalog'
import { useLanguage } from '@/i18n'
import { useEffect, useState } from 'react'


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
          <h1 id="ciem-hero-title" className="ciem-hero__title">Desarrollo web para impulsar tu negocio</h1>
          <p className="ciem-hero__copy">Diseñamos y desarrollamos sitios web y aplicaciones para negocios. También te ayudamos con hosting y soporte técnico para mantener tu proyecto en línea.</p>
          <div className="ciem-hero__actions">
            <a className="ciem-hero__button ciem-hero__button--primary" href={projectContact()} target="_blank" rel="noopener noreferrer" data-ciem-ask="Quiero solicitar una cotización para mi proyecto web">Solicitar una cotización</a>
            <a className="ciem-hero__button ciem-hero__button--secondary" href="#servicios">¿Qué ofrecemos?</a>
          </div>
        </div>
        <div className="ciem-hero__art" aria-hidden="true">
          <img className="ciem-hero__pattern" src="/images/ciem-hero/banner-pattern-4-1.png" alt="" />
          <img className="ciem-hero__cloud ciem-hero__cloud--back" src="/images/ciem-hero/cloud2.png" alt="" />
          <div className="ciem-hero__servers" aria-hidden="true">

            <img className="ciem-server" style={{'--x': '-108px', '--y': '365px', '--z': '27'} as CSSProperties} src="/images/ciem-hero/box2.png" alt="" />
            <img className="ciem-server" style={{'--x': '14px', '--y': '296px', '--z': '17'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-229px', '--y': '294px', '--z': '22'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-106px', '--y': '221px', '--z': '12'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-108px', '--y': '289px', '--z': '28'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '14px', '--y': '219px', '--z': '18'} as CSSProperties} src="/images/ciem-hero/box2.png" alt="" />
            <img className="ciem-server" style={{'--x': '-106px', '--y': '146px', '--z': '13'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-229px', '--y': '218px', '--z': '23'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-108px', '--y': '212px', '--z': '29'} as CSSProperties} src="/images/ciem-hero/box2.png" alt="" />
            <img className="ciem-server" style={{'--x': '14px', '--y': '144px', '--z': '19'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-229px', '--y': '142px', '--z': '24'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-106px', '--y': '77px', '--z': '14'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-108px', '--y': '136px', '--z': '30'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '14px', '--y': '67px', '--z': '20'} as CSSProperties} src="/images/ciem-hero/box2.png" alt="" />
            <img className="ciem-server" style={{'--x': '-107px', '--y': '0', '--z': '15'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />
            <img className="ciem-server" style={{'--x': '-231px', '--y': '66px', '--z': '25'} as CSSProperties} src="/images/ciem-hero/box1.png" alt="" />

            <img className="ciem-server ciem-server--lid" style={{'--x': '-108px', '--y': '-1px', '--z': '16'} as CSSProperties} src="/images/ciem-hero/box3.png" alt="" />
            <img className="ciem-server ciem-server--lid" style={{'--x': '-108px', '--y': '135px', '--z': '31'} as CSSProperties} src="/images/ciem-hero/box3.png" alt="" />
            <img className="ciem-server ciem-server--lid" style={{'--x': '-231px', '--y': '66px', '--z': '26'} as CSSProperties} src="/images/ciem-hero/box3.png" alt="" />
          </div>
          <img className="ciem-hero__cloud ciem-hero__cloud--front" src="/images/ciem-hero/cloud1.png" alt="" />
        </div>
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
