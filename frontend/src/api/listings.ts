import { apiClient } from './client'

import type {
  CreateListingPayload,
  ListingDetail,
  ListingImage,
  ListingListItem,
  PaginatedResponse,
} from '@/types/api'

export interface ListingsQuery {
  search?: string
  category?: number
  condition?: string
  location?: string
  ordering?: string
  page?: number
}

export const listingsApi = {
  async list(params: ListingsQuery = {}): Promise<PaginatedResponse<ListingListItem>> {
    const { data } = await apiClient.get<PaginatedResponse<ListingListItem>>(
      '/api/listings/',
      { params },
    )
    return data
  },

  async detail(id: number): Promise<ListingDetail> {
    const { data } = await apiClient.get<ListingDetail>(`/api/listings/${id}/`)
    return data
  },

  async create(payload: CreateListingPayload): Promise<ListingDetail> {
    const { data } = await apiClient.post<ListingDetail>('/api/listings/', payload)
    return data
  },

  async update(id: number, payload: Partial<CreateListingPayload>): Promise<ListingDetail> {
    const { data } = await apiClient.patch<ListingDetail>(`/api/listings/${id}/`, payload)
    return data
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/api/listings/${id}/`)
  },

  async submitReview(id: number): Promise<ListingDetail> {
    const { data } = await apiClient.post<ListingDetail>(`/api/listings/${id}/submit-review/`)
    return data
  },

  async publish(id: number): Promise<ListingDetail> {
    const { data } = await apiClient.post<ListingDetail>(`/api/listings/${id}/publish/`)
    return data
  },

  async markAsSold(id: number): Promise<ListingDetail> {
    const { data } = await apiClient.post<ListingDetail>(`/api/listings/${id}/mark_as_sold/`)
    return data
  },

  async toggleFavorite(id: number): Promise<{ status: string; favorite_count: number }> {
    const { data } = await apiClient.post<{ status: string; favorite_count: number }>(
      `/api/listings/${id}/favorite/`,
    )
    return data
  },

  async myListings(): Promise<ListingListItem[]> {
    const { data } = await apiClient.get<ListingListItem[]>('/api/listings/my_listings/')
    return data
  },

  async uploadImage(
    listingId: number,
    file: File,
    altText?: string,
  ): Promise<ListingImage> {
    const formData = new FormData()
    formData.append('listing', String(listingId))
    formData.append('image', file)
    if (altText) formData.append('alt_text', altText)

    const { data } = await apiClient.post<ListingImage>(
      '/api/listing-images/',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  },

  async deleteImage(imageId: number): Promise<void> {
    await apiClient.delete(`/api/listing-images/${imageId}/`)
  },

  async setCover(imageId: number): Promise<ListingImage> {
    const { data } = await apiClient.post<ListingImage>(
      `/api/listing-images/${imageId}/set_cover/`,
    )
    return data
  },
}
