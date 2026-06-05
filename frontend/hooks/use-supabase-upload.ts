// Despite the name (kept for backwards compatibility), this hook no longer talks to
// Supabase. It provides the dropzone state used by the upload UIs; actual file uploads
// happen via the backend proxy POST /api/models, which the caller invokes directly.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type FileError, type FileRejection, useDropzone } from 'react-dropzone'

interface FileWithPreview extends File {
  preview?: string
  errors: readonly FileError[]
}

type UseSupabaseUploadOptions = {
  /** Unused in demo mode; kept for backwards compatibility with existing call sites. */
  bucketName?: string
  /** Unused in demo mode; kept for backwards compatibility. */
  path?: string
  allowedMimeTypes?: string[]
  maxFileSize?: number
  maxFiles?: number
  /** Unused in demo mode; kept for backwards compatibility. */
  cacheControl?: number
  /** Unused in demo mode; kept for backwards compatibility. */
  upsert?: boolean
}

type UseSupabaseUploadReturn = ReturnType<typeof useSupabaseUpload>

const useSupabaseUpload = (options: UseSupabaseUploadOptions) => {
  const {
    allowedMimeTypes = [],
    maxFileSize = Number.POSITIVE_INFINITY,
    maxFiles = 1,
  } = options

  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([])
  const [successes, setSuccesses] = useState<string[]>([])

  const isSuccess = useMemo(() => {
    if (errors.length === 0 && successes.length === 0) return false
    if (errors.length === 0 && successes.length === files.length) return true
    return false
  }, [errors.length, successes.length, files.length])

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const validFiles = acceptedFiles
        .filter((file) => !files.find((x) => x.name === file.name))
        .map((file) => {
          ;(file as FileWithPreview).preview = URL.createObjectURL(file)
          ;(file as FileWithPreview).errors = []
          return file as FileWithPreview
        })

      const invalidFiles = fileRejections.map(({ file, errors }) => {
        ;(file as FileWithPreview).preview = URL.createObjectURL(file)
        ;(file as FileWithPreview).errors = errors
        return file as FileWithPreview
      })

      setFiles([...files, ...validFiles, ...invalidFiles])
    },
    [files, setFiles],
  )

  const dropzoneProps = useDropzone({
    onDrop,
    noClick: true,
    accept: allowedMimeTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize,
    maxFiles: maxFiles,
    multiple: maxFiles !== 1,
  })

  // Fallback upload path for callers that rely on the hook's onUpload (current pages
  // POST the file themselves). Each file is sent to /api/models in parallel; the
  // backend handles validation, persistence, and vector indexing.
  const onUpload = async () => {
    setLoading(true)
    const filesWithErrors = errors.map((x) => x.name)
    const filesToUpload =
      filesWithErrors.length > 0
        ? [
            ...files.filter((f) => filesWithErrors.includes(f.name)),
            ...files.filter((f) => !successes.includes(f.name)),
          ]
        : files

    const responses = await Promise.all(
      filesToUpload.map(async (file) => {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const response = await fetch('/api/models', { method: 'POST', body: formData })
          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            return { name: file.name, message: data.error ?? `Upload failed (${response.status})` }
          }
          return { name: file.name, message: undefined }
        } catch (err) {
          return { name: file.name, message: err instanceof Error ? err.message : 'Upload failed' }
        }
      }),
    )

    setErrors(responses.filter((x) => x.message !== undefined) as { name: string; message: string }[])
    setSuccesses(
      Array.from(
        new Set([
          ...successes,
          ...responses.filter((x) => x.message === undefined).map((x) => x.name),
        ]),
      ),
    )
    setLoading(false)
  }

  useEffect(() => {
    if (files.length === 0) {
      // Clearing the selection also clears any prior upload errors. This is a deliberate
      // state sync in an effect: `files` is controlled externally via the returned setFiles,
      // so deriving it during render is not an option.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrors([])
      return
    }
    if (files.length <= maxFiles) {
      let changed = false
      const newFiles = files.map((file) => {
        if (file.errors.some((e) => e.code === 'too-many-files')) {
          changed = true
          return { ...file, errors: file.errors.filter((e) => e.code !== 'too-many-files') }
        }
        return file
      })
      if (changed) setFiles(newFiles)
    }
  }, [files, setFiles, maxFiles])

  return {
    files,
    setFiles,
    successes,
    isSuccess,
    loading,
    errors,
    setErrors,
    onUpload,
    maxFileSize,
    maxFiles,
    allowedMimeTypes,
    ...dropzoneProps,
  }
}

export { useSupabaseUpload, type UseSupabaseUploadOptions, type UseSupabaseUploadReturn }
