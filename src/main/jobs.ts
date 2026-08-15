import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildCutArgs } from './ffmpeg/args'
import { runFfmpeg, FfmpegCancelled, type FfmpegHandle } from './ffmpeg/run'
import { partFileName, uniqueFileName } from '../shared/naming'
import type { ExportRequest, JobProgress, JobResult } from '../shared/types'

export function startExportJob(
  ffmpegPath: string,
  request: ExportRequest,
  onProgress: (progress: JobProgress) => void,
): { promise: Promise<JobResult>; cancel: () => void } {
  const done: string[] = []
  let current: FfmpegHandle | null = null
  let cancelled = false

  const promise = (async (): Promise<JobResult> => {
    try {
      mkdirSync(request.outputDir, { recursive: true })
    } catch (error) {
      // Pasta apagada durante a sessão, drive removido, ou sem permissão de
      // escrita. Precisa virar JobResult, não exceção: a promise desta função
      // atravessa o IPC e uma rejeição deixaria a UI travada em "exportando".
      return {
        status: 'error',
        files: [],
        message: `Não consegui usar a pasta de saída:\n${
          error instanceof Error ? error.message : String(error)
        }`,
        failedIndex: 0,
      }
    }

    const total = request.segments.length

    for (const segment of request.segments) {
      if (cancelled) return { status: 'cancelled', files: done }

      const fileName = uniqueFileName(
        partFileName(request.baseName, segment.index, total, request.extension),
        (name) => existsSync(join(request.outputDir, name)),
      )
      const outputPath = join(request.outputDir, fileName)
      const duration = segment.end - segment.start

      onProgress({
        segmentIndex: segment.index,
        totalSegments: total,
        segmentFraction: 0,
        overallFraction: segment.index / total,
        currentFile: fileName,
      })

      const handle = runFfmpeg(
        ffmpegPath,
        buildCutArgs({
          inputPath: request.inputPath,
          outputPath,
          start: segment.start,
          duration,
          mode: request.mode,
        }),
        (seconds) => {
          const segmentFraction = duration > 0 ? Math.min(seconds / duration, 1) : 1
          onProgress({
            segmentIndex: segment.index,
            totalSegments: total,
            segmentFraction,
            overallFraction: (segment.index + segmentFraction) / total,
            currentFile: fileName,
          })
        },
      )
      current = handle

      try {
        await handle.promise
        done.push(outputPath)
      } catch (error) {
        rmSync(outputPath, { force: true })
        if (error instanceof FfmpegCancelled || cancelled) {
          return { status: 'cancelled', files: done }
        }
        return {
          status: 'error',
          files: done,
          message: error instanceof Error ? error.message : String(error),
          failedIndex: segment.index,
        }
      } finally {
        current = null
      }
    }

    onProgress({
      segmentIndex: total - 1,
      totalSegments: total,
      segmentFraction: 1,
      overallFraction: 1,
      currentFile: '',
    })

    return { status: 'done', files: done }
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      current?.cancel()
    },
  }
}
