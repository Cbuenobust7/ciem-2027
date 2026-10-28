import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { favoritesApi } from '@/api/favorites'

// ============================================================
// QUERIES
// ============================================================

export function useFavorites(enabled: boolean = true) {
  // El hook puede desactivarse cuando el usuario no está autenticado.
  return useQuery({
    queryKey: ['favorites'],
    queryFn: () => favoritesApi.list(),
    enabled,
  })
}

// ============================================================
// MUTATIONS
// ============================================================

export function useAddFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (listingId: number) => favoritesApi.create(listingId),
    onSuccess: (_, listingId) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
    },
  })
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ favoriteId }: { favoriteId: number; listingId: number }) =>
      favoritesApi.remove(favoriteId),
    onSuccess: (_, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
    },
  })
}
