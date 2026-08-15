import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FfmpegCheck } from '../../shared/types'

const run = promisify(execFile)

async function isAvailable(binary: string): Promise<boolean> {
  try {
    await run(binary, ['-version'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function locateBinaries(): Promise<FfmpegCheck> {
  const [hasFfmpeg, hasFfprobe] = await Promise.all([
    isAvailable('ffmpeg'),
    isAvailable('ffprobe'),
  ])

  if (hasFfmpeg && hasFfprobe) {
    return { ok: true, ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }
  }

  const faltando = [!hasFfmpeg && 'ffmpeg', !hasFfprobe && 'ffprobe']
    .filter(Boolean)
    .join(' e ')

  return {
    ok: false,
    message: `Não encontrei ${faltando} no PATH do sistema. Instale com:\n\nwinget install ffmpeg\n\nDepois feche e abra o terminal de novo.`,
  }
}
