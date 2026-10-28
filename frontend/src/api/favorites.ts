import { apiClient } from './client'

import type { Favorite, PaginatedResponse } from '@/types/api'

export const favoritesApi = {
  async list(): Promise<PaginatedResponse<Favorite>> {
    const { data } = await apiClient.get<PaginatedResponse<Favorite>>(
      '/api/favorites/',
    )
    return data
  },

  async create(listingId: number): Promise<Favorite> {
    const { data } = await apiClient.post<Favorite>('/api/favorites/', {
      listing: listingId,
    })
    return data
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/api/favorites/${id}/`)
  },
}
