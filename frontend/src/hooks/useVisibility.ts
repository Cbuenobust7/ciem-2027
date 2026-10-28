import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { visibilityApi } from '@/api/visibility'

export function useCities() {
  return useQuery({
    queryKey: ['visibility', 'cities'],
    queryFn: visibilityApi.listCities,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCityAvailability(slug: string | undefined) {
  return useQuery({
    queryKey: ['city-availability', slug],
    queryFn: () => visibilityApi.cityAvailability(slug!),
    enabled: !!slug,
  })
}

export function useClaimFreeSlot(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (position: number) =>
      visibilityApi.claimFreeSlot(slug, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['city-availability', slug] })
      queryClient.invalidateQueries({ queryKey: ['visibility', 'me'] })
    },
  })
}

export function useCreateVisibilityOrder(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (position: number) => visibilityApi.createOrder(slug, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['city-availability', slug] })
      queryClient.invalidateQueries({ queryKey: ['visibility', 'me'] })
    },
  })
}

export function useMyPurchases(
  enabled = true,
  refetchInterval?: number,
) {
  return useQuery({
    queryKey: ['visibility', 'me'],
    queryFn: visibilityApi.myPurchases,
    enabled,
    refetchInterval,
  })
}

export function useProcessSlotPayment(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      payload: Parameters<
        typeof visibilityApi.processSlotPayment
      >[1],
    ) => visibilityApi.processSlotPayment(slug, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['city-availability', slug],
      })
      queryClient.invalidateQueries({ queryKey: ['visibility', 'me'] })
    },
  })
}