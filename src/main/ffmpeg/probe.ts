import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, extname } from 'node:path'
import type { VideoInfo } from '../../shared/types'

const run = promisify(execFile)

type ProbeStream = {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  disposition?: { attached_pic?: number }
}

type ProbeOutput = {
  streams?: ProbeStream[]
  format?: { duration?: string; size?: string; bit_rate?: string }
}

export function parseFps(rate: string | undefined): number {
  if (!rate) return 0
  const [num, den] = rate.split('/').map(Number)
  if (!Number.isFinite(num)) return 0
  if (!den) return Number.isFinite(num) ? num : 0
  return Math.round((num / den) * 100) / 100
}

export function parseProbeOutput(raw: unknown, filePath: string): VideoInfo {
  const data = raw as ProbeOutput
  const streams = data.streams ?? []

  const video = streams.find(
    (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1,
  )
  if (!video) throw new Error('O arquivo não tem faixa de vídeo.')

  const audio = streams.find((s) => s.codec_type === 'audio')

  const duration = Number(data.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Não foi possível ler a duração do vídeo.')
  }

  const extension = extname(filePath)
  const fileName = basename(filePath)
  const bitrate = Number(data.format?.bit_rate)

  return {
    path: filePath,
    fileName,
    baseName: basename(filePath, extension),
    extension,
    sizeBytes: Number(data.format?.size) || 0,
    duration: Math.round(duration * 1000) / 1000,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: parseFps(video.r_frame_rate),
    videoCodec: video.codec_name ?? 'desconhecido',
    audioCodec: audio?.codec_name ?? null,
    bitrate: Number.isFinite(bitrate) && bitrate > 0 ? bitrate : null,
  }
}

export async function probeVideo(ffprobePath: string, filePath: string): Promise<VideoInfo> {
  const { stdout } = await run(
    ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
  )
  return parseProbeOutput(JSON.parse(stdout), filePath)
}
