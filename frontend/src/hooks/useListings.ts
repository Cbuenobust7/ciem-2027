import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listingsApi, type ListingsQuery } from '@/api/listings'
import type { CreateListingPayload } from '@/types/api'

// ============================================================
// QUERIES
// ============================================================

export function useListings(params: ListingsQuery = {}) {
  return useQuery({
    queryKey: ['listings', params],
    queryFn: () => listingsApi.list(params),
  })
}

export function useListing(id: number | undefined) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsApi.detail(id!),
    enabled: !!id,
  })
}

export function useMyListings() {
  return useQuery({
    queryKey: ['my-listings'],
    queryFn: () => listingsApi.myListings(),
  })
}

// ============================================================
// MUTATIONS — LISTINGS
// ============================================================

export function useCreateListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateListingPayload) => listingsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function useUpdateListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateListingPayload> }) =>
      listingsApi.update(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function useDeleteListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => listingsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function usePublishListing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => listingsApi.publish(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function useSubmitListingReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => listingsApi.submitReview(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'provider-services'] })
      queryClient.invalidateQueries({ queryKey: ['cleaning', 'providers'] })
    },
  })
}


export function useMarkAsSold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => listingsApi.markAsSold(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => listingsApi.toggleFavorite(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}

// ============================================================
// MUTATIONS — IMAGES
// ============================================================

export function useUploadImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      listingId,
      file,
      altText,
    }: {
      listingId: number
      file: File
      altText?: string
    }) => listingsApi.uploadImage(listingId, file, altText),

    onSuccess: (_, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function useDeleteImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ imageId }: { imageId: number; listingId: number }) =>
      listingsApi.deleteImage(imageId),

    onSuccess: (_, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}

export function useSetCover() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ imageId }: { imageId: number; listingId: number }) =>
      listingsApi.setCover(imageId),

    onSuccess: (_, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    },
  })
}
