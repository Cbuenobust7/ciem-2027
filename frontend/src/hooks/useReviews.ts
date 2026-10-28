import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { reviewsApi } from '@/api/reviews'
import type { CreateReviewPayload } from '@/types/api'

export function useReviewsBySeller(sellerId: number | undefined) {
  return useQuery({
    queryKey: ['reviews', 'seller', sellerId],
    queryFn: () => reviewsApi.listBySeller(sellerId!),
    enabled: !!sellerId,
  })
}

export function useCreateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => reviewsApi.create(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'seller'] })
      queryClient.invalidateQueries({ queryKey: ['listing', variables.listing] })
    },
  })
}
