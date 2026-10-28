import { apiClient } from './client'

import type {
  City,
  CityAvailability,
  CreateVisibilityOrderResponse,
  PaginatedResponse,
  VisibilityPurchase,
} from '@/types/api'

export const visibilityApi = {
  async listCities(): Promise<PaginatedResponse<City>> {
    const { data } = await apiClient.get<PaginatedResponse<City>>(
      '/api/visibility/cities/',
    )
    return data
  },

  async cityAvailability(slug: string): Promise<CityAvailability> {
    const { data } = await apiClient.get<CityAvailability>(
      `/api/visibility/cities/${slug}/availability/`,
    )
    return data
  },

  async claimFreeSlot(
    slug: string,
    position: number,
  ): Promise<VisibilityPurchase> {
    const { data } = await apiClient.post<VisibilityPurchase>(
      `/api/visibility/cities/${slug}/claim/`,
      { position },
    )
    return data
  },

  async createOrder(
    slug: string,
    position: number,
  ): Promise<CreateVisibilityOrderResponse> {
    const { data } = await apiClient.post<CreateVisibilityOrderResponse>(
      `/api/visibility/cities/${slug}/buy/`,
      { position },
    )
    return data
  },

  async myPurchases(): Promise<PaginatedResponse<VisibilityPurchase>> {
    const { data } = await apiClient.get<
      PaginatedResponse<VisibilityPurchase>
    >('/api/visibility/me/')
    return data
  },

  async processSlotPayment(
    slug: string,
    payload: {
      position: number
      token: string
      payment_method_id: string
      issuer_id?: string | null
      installments: number
      identification_number: string
    },
  ): Promise<{
    payment_id: number
    status: string
    mp_status: string
    status_detail: string | null
    purchase_id: number
    purchase_status: string
  }> {
    const { data } = await apiClient.post(
      `/api/visibility/cities/${slug}/process/`,
      payload,
    )
    return data
  },
}