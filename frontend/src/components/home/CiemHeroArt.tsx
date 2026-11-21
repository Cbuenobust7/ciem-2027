import type { CSSProperties } from 'react'

/**
 * Ilustración del hero (nubes + servidores isométricos).
 * Compartida por la home y por las landings para que siempre sea la misma.
 * Los estilos viven en CiemHero.css (.ciem-hero__art, .ciem-server, etc.).
 */
export function CiemHeroArt() {
  return (
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
  )
}