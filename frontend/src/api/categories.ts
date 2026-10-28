import { apiClient } from './client'

import type { Category, CategoryTree, PaginatedResponse } from '@/types/api'

export const categoriesApi = {
  async list(): Promise<PaginatedResponse<Category>> {
    const { data } = await apiClient.get<PaginatedResponse<Category>>('/api/categories/')
    return data
  },

  async roots(): Promise<Category[]> {
    const { data } = await apiClient.get<Category[]>('/api/categories/roots/')
    return data
  },

  async tree(): Promise<CategoryTree[]> {
    const { data } = await apiClient.get<CategoryTree[]>('/api/categories/tree/')
    return data
  },
}
