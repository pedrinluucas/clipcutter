import type { CutMode } from '../../shared/types'

export type CutArgsOptions = {
  inputPath: string
  outputPath: string
  start: number
  duration: number
  mode: CutMode
}

export function buildCutArgs(options: CutArgsOptions): string[] {
  const head = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostats',
    '-progress',
    'pipe:1',
    '-ss',
    options.start.toFixed(3),
    '-i',
    options.inputPath,
    '-t',
    options.duration.toFixed(3),
  ]

  const codec =
    options.mode === 'fast'
      ? ['-c', 'copy', '-avoid_negative_ts', 'make_zero']
      : [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '20',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
        ]

  return [...head, ...codec, '-y', options.outputPath]
}
