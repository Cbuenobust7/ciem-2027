import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ProviderAccountSummary, User } from '@/types/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  setAuth: (
    user: User,
    accessToken: string,
    refreshToken: string,
  ) => void

  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)

        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      setUser: (user) => {
        set({ user })
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'marketplace-starter-auth',
    },
  ),
)

/** Lista vacía estable: evita re-render en bucle al usar `provider_accounts`. */
const SIN_CUENTAS: ProviderAccountSummary[] = []

/**
 * Helpers de rol de la sesión. Leen los campos que calcula el backend desde
 * `ProviderMembership` (ADR-11); nunca `is_seller`/`is_buyer`.
 */
export function useIsProvider(): boolean {
  return useAuthStore((s) => s.user?.is_provider === true)
}

export function useCanPublish(): boolean {
  return useAuthStore((s) => s.user?.can_publish === true)
}

export function useProviderAccounts(): ProviderAccountSummary[] {
  return useAuthStore((s) => s.user?.provider_accounts ?? SIN_CUENTAS)
}
