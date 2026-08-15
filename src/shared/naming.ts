import type { CutMode } from './types'

export function partFileName(
  baseName: string,
  index: number,
  total: number,
  extension: string,
): string {
  const width = Math.max(2, String(total).length)
  const number = String(index + 1).padStart(width, '0')
  return `${baseName}_parte_${number}${extension}`
}

export function uniqueFileName(fileName: string, exists: (name: string) => boolean): string {
  if (!exists(fileName)) return fileName
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!exists(candidate)) return candidate
  }
}

export function outputExtension(mode: CutMode, originalExtension: string): string {
  if (mode === 'exact') return '.mp4'
  return originalExtension || '.mp4'
}
