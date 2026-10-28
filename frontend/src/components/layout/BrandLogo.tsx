/** Logo maestro compartido con ciem.pe; no se reconstruye ni se recolorea. */
export function BrandLogo({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    <img
      className={className}
      src="/images/ciem-logo.png"
      alt="CIEM Productos Digitales"
    />
  )
}
