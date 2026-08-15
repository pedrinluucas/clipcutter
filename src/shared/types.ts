export type CutPoint = { id: string; time: number }

export type Segment = { index: number; start: number; end: number }

export type CutMode = 'exact' | 'fast'

export type VideoInfo = {
  path: string
  fileName: string
  baseName: string
  extension: string
  sizeBytes: number
  duration: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string | null
  bitrate: number | null
}

export type ExportRequest = {
  inputPath: string
  outputDir: string
  baseName: string
  extension: string
  segments: Segment[]
  mode: CutMode
}

export type JobProgress = {
  segmentIndex: number
  totalSegments: number
  segmentFraction: number
  overallFraction: number
  currentFile: string
}

export type JobResult =
  | { status: 'done'; files: string[] }
  | { status: 'cancelled'; files: string[] }
  | { status: 'error'; files: string[]; message: string; failedIndex: number }

export type FfmpegCheck =
  | { ok: true; ffmpeg: string; ffprobe: string }
  | { ok: false; message: string }

export type Prefs = {
  outputDir: string | null
  exactMode: boolean
  chunkDuration: number
}
