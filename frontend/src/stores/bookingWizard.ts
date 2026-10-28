import { create } from 'zustand'

import { newIdempotencyKey } from '@/lib/cleaning'
import type { AvailabilitySlot } from '@/types/api'

export type BookingWizardStep = 1 | 2 | 3 | 4

interface BookingWizardState {
  listingId: number | null
  step: BookingWizardStep
  date: string | null
  slot: AvailabilitySlot | null
  address: string
  district: string
  districtLabel: string
  city: number | null
  notes: string
  idempotencyKey: string

  /** Arranca (o reinicia) el asistente para un servicio concreto. */
  start: (listingId: number) => void
  setStep: (step: BookingWizardStep) => void
  setDate: (date: string) => void
  setSlot: (slot: AvailabilitySlot | null) => void
  setAddress: (address: string) => void
  setArea: (area: { district: string; districtLabel: string; city: number | null }) => void
  setNotes: (notes: string) => void
  reset: () => void
}

const emptyDraft = () => ({
  step: 1 as BookingWizardStep,
  date: null,
  slot: null,
  address: '',
  district: '',
  districtLabel: '',
  city: null as number | null,
  notes: '',
  idempotencyKey: newIdempotencyKey(),
})

export const useBookingWizardStore = create<BookingWizardState>()((set, get) => ({
  listingId: null,
  ...emptyDraft(),

  start: (listingId) => {
    if (get().listingId === listingId) return
    set({ listingId, ...emptyDraft() })
  },

  setStep: (step) => set({ step }),
  setDate: (date) => set({ date, slot: null }),
  setSlot: (slot) => set({ slot }),

  setAddress: (address) => set({ address }),

  setArea: ({ district, districtLabel, city }) =>
    set({ district, districtLabel, city }),

  setNotes: (notes) => set({ notes }),

  // Se conserva `listingId` para no reiniciar el asistente al limpiar el
  // formulario tras una reserva creada.
  reset: () => set({ ...emptyDraft() }),
}))
