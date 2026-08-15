import { spawn, execFile } from 'node:child_process'
import { createProgressReader } from './progress'

export class FfmpegCancelled extends Error {
  constructor() {
    super('Operação cancelada.')
    this.name = 'FfmpegCancelled'
  }
}

export type FfmpegHandle = {
  promise: Promise<void>
  cancel: () => void
}

const STDERR_LINES_KEPT = 12

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    // No Windows, matar só o processo do Node deixa o ffmpeg filho vivo
    // segurando o arquivo de saída aberto. /T mata a árvore, /F força.
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
  } else {
    process.kill(-pid, 'SIGKILL')
  }
}

export function runFfmpeg(
  ffmpegPath: string,
  args: string[],
  onProgress: (seconds: number) => void,
): FfmpegHandle {
  const child = spawn(ffmpegPath, args, {
    windowsHide: true,
    detached: process.platform !== 'win32',
  })

  const reader = createProgressReader()
  const errors: string[] = []
  let cancelled = false

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    const seconds = reader.push(chunk)
    if (seconds !== null) onProgress(seconds)
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) errors.push(trimmed)
    }
    if (errors.length > STDERR_LINES_KEPT) errors.splice(0, errors.length - STDERR_LINES_KEPT)
  })

  const promise = new Promise<void>((resolve, reject) => {
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (cancelled) return reject(new FfmpegCancelled())
      if (code === 0) return resolve()
      const detail = errors.length > 0 ? errors.join('\n') : `código de saída ${code}`
      reject(new Error(`FFmpeg falhou:\n${detail}`))
    })
  })

  return {
    promise,
    cancel: () => {
      if (cancelled || child.pid === undefined) return
      cancelled = true
      killTree(child.pid)
    },
  }
}
