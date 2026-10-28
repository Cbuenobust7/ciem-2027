import { useLanguage } from '@/i18n'
import { BrandLogo } from './BrandLogo'

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="mt-12 border-t border-[#243574] bg-[#101F65]">
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-white/75">
        <div className="mb-3 flex justify-center">
          <BrandLogo className="h-16 w-auto" />
        </div>
        <p>© {new Date().getFullYear()} CIEM Productos Digitales</p>
        <p className="mt-1">{t('madeIn')}</p>
      </div>
    </footer>
  )
}
