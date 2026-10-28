import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/i18n'
import { useCreateClaim } from '@/hooks/useCleaning'
import { cleaningErrorMessage } from '@/lib/cleaning'
import { useAuthStore } from '@/stores/auth'
import type { ProviderDetail } from '@/types/api'

interface ClaimModalProps {
  provider: ProviderDetail
  open: boolean
  onClose: () => void
}

/** Reclamación de una ficha de directorio. No verifica: solo inicia la revisión. */
export function ClaimModal({ provider, open, onClose }: ClaimModalProps) {
  const { t } = useLanguage()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const claim = useCreateClaim(provider.id)

  const [email, setEmail] = useState(provider.contact_email || '')
  const [phone, setPhone] = useState(provider.phone || '')
  const [message, setMessage] = useState('')
  const [evidence, setEvidence] = useState('')
  const [terms, setTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!terms) {
      setError(t('termsRequired'))
      return
    }
    try {
      await claim.mutateAsync({
        contact_email: email.trim() || undefined,
        contact_phone: phone.trim() || undefined,
        message: message.trim(),
        evidence_url: evidence.trim() || undefined,
        terms_accepted: terms,
      })
      setSent(true)
    } catch (caught) {
      setError(cleaningErrorMessage(caught))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="claim-title" className="text-xl font-bold text-master-navy">
              {t('claimTitle')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t('claimIntro')}</p>
          </div>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800"
            onClick={onClose}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="mt-6">
            <p className="text-sm text-gray-700">{t('loginToClaim')}</p>
            <Link to="/login" className="mt-4 inline-block">
              <Button variant="primary">{t('login')}</Button>
            </Link>
          </div>
        ) : sent ? (
          <div className="mt-6">
            <p className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              {t('claimSuccess')}
            </p>
            <Button variant="secondary" className="mt-4" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form className="mt-6" onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Input
              label={t('claimContactEmail')}
              name="claim_email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label={t('claimContactPhone')}
              name="claim_phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <div className="mb-4">
              <label className="label" htmlFor="claim_message">
                {t('claimMessage')}
              </label>
              <textarea
                id="claim_message"
                className="input min-h-24"
                rows={4}
                required
                minLength={20}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
            <Input
              label={t('claimEvidence')}
              name="claim_evidence"
              type="url"
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
            />
            <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
              />
              <span>{t('claimTerms')}</span>
            </label>
            <p className="mb-4 text-xs text-gray-500">{t('privacyNote')}</p>
            <Button
              type="submit"
              variant="primary"
              isLoading={claim.isPending}
              className="w-full"
            >
              {t('claimSubmit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
