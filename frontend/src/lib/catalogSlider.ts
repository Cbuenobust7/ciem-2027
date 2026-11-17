export const CATALOG_PAGE_SIZE = 8

/** Completa la última página retomando el catálogo filtrado desde el principio. */
export function circularCatalogPage<T>(items: T[], page: number): T[] {
  if (items.length === 0) return []
  const count = Math.ceil(items.length / CATALOG_PAGE_SIZE)
  const safePage = Math.max(1, Math.min(count, Math.floor(page) || 1))
  const start = (safePage - 1) * CATALOG_PAGE_SIZE
  return Array.from({ length: CATALOG_PAGE_SIZE }, (_, offset) => items[(start + offset) % items.length])
}
