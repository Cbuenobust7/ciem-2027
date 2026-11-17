/** Logo maestro local de CIEM 2027; conserva sus colores y proporciones. */
export function BrandLogo({ className = 'w-[180px] h-auto' }: { className?: string }) {
  return (
    <img
      className={className}
      src="/images/ciem-brand/logo-black-on-white-v2.png"
      width="1566"
      height="633"
      alt="CIEM Productos Digitales"
    />
  )
}
