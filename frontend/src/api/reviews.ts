import { apiClient } from './client'

import type { CreateReviewPayload, Review } from '@/types/api'

export const reviewsApi = {
  async listBySeller(sellerId: number): Promise<Review[]> {
    const { data } = await apiClient.get<Review[]>(`/api/reviews/by_seller/`, {
      params: { seller_id: sellerId },
    })
    return data
  },

  async create(payload: CreateReviewPayload): Promise<Review> {
    const { data } = await apiClient.post<Review>('/api/reviews/', payload)
    return data
  },
}
