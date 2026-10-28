import { apiClient } from './client'

import type {
  LoginResponse,
  RegisterResponse,
  User,
} from '@/types/api'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  username: string
  password: string
}

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
      '/api/auth/login/',
      payload,
    )

    return data
  },

  async register(
    payload: RegisterPayload,
  ): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>(
      '/api/auth/register/',
      payload,
    )

    return data
  },

  async getProfile(): Promise<User> {
    const { data } = await apiClient.get<User>(
      '/api/auth/profile/',
    )

    return data
  },
}
