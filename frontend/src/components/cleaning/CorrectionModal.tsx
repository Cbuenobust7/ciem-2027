import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/i18n'
import { useCreateCorrection } from '@/hooks/useCleaning'
import { cleaningErrorMessage } from '@/lib/cleaning'
import type { ProviderDetail } from '@/types/api'

interface CorrectionModalProps {
  provider: ProviderDetail
  open: boolean
  onClose: () => void
}

/** Corrección o retirada de una ficha: público y sin cuenta. */
export function CorrectionModal({ provider, open, onClose }: CorrectionModalProps) {
  const { t } = useLanguage()
  const correction = useCreateCorrection(provider.id)

  const [kind, setKind] = useState<'correction' | 'removal' | 'data_issue'>(
    'correction',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (!open) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await correction.mutateAsync({
        kind,
        requester_name: name.trim(),
        requester_email: email.trim(),
        requester_phone: phone.trim() || undefined,
        message: message.trim(),
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
        aria-labelledby="correction-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="correction-title"
              className="text-xl font-bold text-master-navy"
            >
              {t('correctionTitle')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t('correctionIntro')}</p>
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

        {sent ? (
          <div className="mt-6">
            <p className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              {t('correctionSuccess')}
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
            <div className="mb-4">
              <label className="label" htmlFor="correction_kind">
                {t('correctionKind')}
              </label>
              <select
                id="correction_kind"
                className="input"
                value={kind}
                onChange={(event) =>
                  setKind(
                    event.target.value as
                      | 'correction'
                      | 'removal'
                      | 'data_issue',
                  )
                }
              >
                <option value="correction">{t('correction')}</option>
                <option value="removal">{t('removal')}</option>
                <option value="data_issue">{t('dataIssue')}</option>
              </select>
            </div>
            <Input
              label={t('correctionName')}
              name="requester_name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <Input
              label={t('correctionEmail')}
              name="requester_email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label={t('correctionPhone')}
              name="requester_phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <div className="mb-4">
              <label className="label" htmlFor="correction_message">
                {t('correctionMessage')}
              </label>
              <textarea
                id="correction_message"
                className="input min-h-24"
                rows={4}
                required
                minLength={20}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
            <p className="mb-4 text-xs text-gray-500">{t('privacyNote')}</p>
            <Button
              type="submit"
              variant="primary"
              isLoading={correction.isPending}
              className="w-full"
            >
              {t('correctionSubmit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
