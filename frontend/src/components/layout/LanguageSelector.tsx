import { LANGUAGES, useLanguage, type Language } from '@/i18n'

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()

  const current = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0]

  return (
    <label className="mc-language-selector">
      <span className="mc-language-selector__label">{t('language')}</span>
      <span aria-hidden="true" className="mc-language-selector__flag">{current.flag}</span>
      <span aria-hidden="true" className="mc-language-selector__value">{current.shortLabel}</span>
      <svg className="mc-language-selector__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="mc-language-selector__select"
        aria-label={t('language')}
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
}
