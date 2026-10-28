import { BrandLogo } from '@/components/layout/BrandLogo'
import './mcc-preload.css'

export default function MccPreload({ isReady }: { isReady: boolean }) {
  if (isReady) return null

  return (
    <div className="mcc-preload" aria-live="polite" aria-busy="true">
      <BrandLogo className="mcc-preload__logo" />
    </div>
  )
}
