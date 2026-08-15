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

// Se o `taskkill` falhar de verdade (não a corrida benigna comentada em
// `killTree`), `close` nunca dispara e a promise nunca se resolve. Sem um limite,
// isso trava `ipc.ts` pra sempre: o `finally` que zera `currentJob` depende desta
// promise assentar, e enquanto ela não assenta, toda exportação seguinte esbarra
// em "Já existe uma exportação em andamento" até reiniciar o app inteiro.
const KILL_TIMEOUT_MS = 5000

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    // No Windows, matar só o processo do Node deixa o ffmpeg filho vivo
    // segurando o arquivo de saída aberto. /T mata a árvore, /F força.
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, (err) => {
      // Não rejeitamos aqui: o taskkill devolve erro benigno quando o processo já
      // morreu sozinho na corrida com o cancelamento. O log existe para o caso em
      // que ele falha de verdade e o processo sobrevive.
      if (err) console.error('taskkill falhou:', err.message)
    })
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
  let closed = false
  let killTimer: ReturnType<typeof setTimeout> | null = null
  let forceCancel: (() => void) | null = null

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
    forceCancel = () => reject(new FfmpegCancelled())

    child.on('error', (err) =>
      reject(new Error(`Falha ao iniciar o FFmpeg: ${err.message}`)),
    )
    child.on('close', (code) => {
      closed = true
      if (killTimer) {
        clearTimeout(killTimer)
        killTimer = null
      }
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
      // Rede de segurança contra o `taskkill` que falha de verdade: se `close` não
      // disparar dentro do prazo, força o assentamento mesmo assim. O processo pode
      // continuar vivo — mas é o mal menor: `jobs.ts` tenta apagar o arquivo parcial
      // e tolera falhar (o processo zumbi pode segurar o arquivo), e o app volta a
      // aceitar exportações em vez de ficar preso pra sempre.
      killTimer = setTimeout(() => {
        if (!closed) forceCancel?.()
      }, KILL_TIMEOUT_MS)
    },
  }
}
