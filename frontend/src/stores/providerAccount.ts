import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProviderAccountState {
  /** Cuenta de proveedor con la que se opera en las pantallas /provider/*. */
  accountId: number | null
  accountName: string | null
  setAccount: (accountId: number | null, accountName?: string | null) => void
}

/**
 * La API no expone las memberships del usuario (§5.1 solo documenta el alta y el
 * detalle público), así que la cuenta activa se descubre por `?as=provider` y,
 * si no aparece ninguna, se puede fijar a mano. Persiste en localStorage.
 */
export const useProviderAccountStore = create<ProviderAccountState>()(
  persist(
    (set) => ({
      accountId: null,
      accountName: null,
      setAccount: (accountId, accountName = null) =>
        set({ accountId, accountName }),
    }),
    { name: 'marketplace-starter-provider' },
  ),
)
