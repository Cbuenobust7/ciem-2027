import './mcc-preload.css'

export default function MccPreload({ isReady }: { isReady: boolean }) {
  if (isReady) return null

  return (
    <div className="mcc-preload" aria-live="polite" aria-busy="true">
      <img
        className="mcc-preload__logo"
        src="/images/ciem-logo.png"
        width="1566"
        height="633"
        alt="CIEM Productos Digitales"
      />
    </div>
  )
}
