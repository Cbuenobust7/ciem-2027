import { useLanguage } from '@/i18n'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

import { Button } from '@/components/ui/Button'
import type { ListingImage } from '@/types/api'

interface ImageUploaderProps {
  images: ListingImage[]
  onUpload: (file: File) => Promise<void>
  onDelete: (imageId: number) => Promise<void>
  onSetCover: (imageId: number) => Promise<void>
  isUploading?: boolean
  deletingImageId?: number | null
  settingCoverImageId?: number | null
  maxImages?: number
  disabled?: boolean
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp'
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

export function ImageUploader({
  images,
  onUpload,
  onDelete,
  onSetCover,
  isUploading = false,
  deletingImageId = null,
  settingCoverImageId = null,
  maxImages = 10,
  disabled = false,
}: ImageUploaderProps) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remainingSlots = Math.max(0, maxImages - images.length)
  const canUploadMore = remainingSlots > 0
  const isDisabled = disabled || isUploading || !canUploadMore

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    setError(null)

    const selected = Array.from(files)

    // Verificar límite global ANTES de procesar
    if (images.length + selected.length > maxImages) {
      setError(
        `Solo puedes subir ${remainingSlots} imagen${remainingSlots === 1 ? '' : 'es'} más. ` +
        `Máximo ${maxImages} por anuncio.`,
      )
      return
    }

    // Validación previa por archivo
    const validFiles: File[] = []
    const localErrors: string[] = []

    for (const file of selected) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        localErrors.push(`"${file.name}": formato no permitido (usa JPEG, PNG o WebP).`)
        continue
      }
      if (file.size > MAX_SIZE_BYTES) {
        localErrors.push(`"${file.name}": supera los ${MAX_SIZE_MB} MB.`)
        continue
      }
      validFiles.push(file)
    }

    if (localErrors.length > 0) {
      setError(localErrors.join(' '))
    }

    // Subida secuencial (respeta orden, evita saturar el backend)
    for (const file of validFiles) {
      try {
        await onUpload(file)
      } catch {
        setError(`Error subiendo "${file.name}". Inténtalo de nuevo.`)
      }
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (isDisabled) return
    handleFiles(event.dataTransfer.files)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (isDisabled) return
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleZoneClick() {
    if (!isDisabled) inputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleZoneClick}
        className={[
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400',
          isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={isDisabled}
        />

        <svg
          className="h-10 w-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>

        <p className="mt-2 text-sm font-medium text-gray-700">
          {isUploading
            ? 'Subiendo...'
            : canUploadMore
              ? t('dropImagesHint')
              : `Máximo ${maxImages} imágenes alcanzado`}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG o WebP. Máx {MAX_SIZE_MB} MB por imagen. {remainingSlots} de {maxImages} restantes.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Galería de imágenes actuales */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => {
            const isDeletingThis = deletingImageId === image.id
            const isSettingThisCover = settingCoverImageId === image.id
            const isBusy = isDeletingThis || isSettingThisCover

            return (
              <div
                key={image.id}
                className={[
                  'group relative aspect-square overflow-hidden rounded-lg border bg-gray-100 transition-opacity',
                  image.is_cover ? 'border-primary-500' : 'border-gray-200',
                  isBusy ? 'opacity-50' : '',
                ].join(' ')}
              >
                {image.image_url && (
                  <img
                    src={image.image_url}
                    alt={image.alt_text || 'Imagen del anuncio'}
                    className="h-full w-full object-cover"
                  />
                )}

                {image.is_cover && (
                  <div className="absolute top-1 left-1 rounded bg-primary-600 px-2 py-0.5 text-xs font-medium text-white">
                    {t('cover')}
                  </div>
                )}

                {/* Overlay de acciones */}
                {!isBusy && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {!image.is_cover && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onSetCover(image.id)}
                      >
                        {t('cover')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(image.id)}
                    >
                      🗑
                    </Button>
                  </div>
                )}

                {isBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
