import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runFfmpeg, FfmpegCancelled } from './run'
import { buildCutArgs } from './args'
import { FFMPEG_PATH, FFPROBE_PATH } from './binaries'

const run = promisify(execFile)
let dir = ''
let source = ''
let heavy = ''

// Devolve a duração do arquivo, ou null se o ffprobe não conseguir lê-lo.
const duracaoOuNull = async (file: string): Promise<number | null> => {
  try {
    const { stdout } = await run(FFPROBE_PATH, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-print_format',
      'default=nw=1:nk=1',
      file
    ])
    const valor = Number(stdout.trim())
    return Number.isFinite(valor) ? valor : null
  } catch {
    return null
  }
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clipcutter-'))
  source = join(dir, 'fonte.mp4')
  await run(FFMPEG_PATH, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=320x240:rate=30:duration=10',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=10',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    '-y',
    source
  ])

  heavy = join(dir, 'pesado.mp4')
  await run(FFMPEG_PATH, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=1280x720:rate=30:duration=30',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-y',
    heavy
  ])
}, 120_000)

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('runFfmpeg (integração — exige ffmpeg instalado)', () => {
  it('corta e reporta progresso crescente', async () => {
    const output = join(dir, 'saida.mp4')
    const tempos: number[] = []

    const handle = runFfmpeg(
      FFMPEG_PATH,
      buildCutArgs({ inputPath: source, outputPath: output, start: 2, duration: 3, mode: 'exact' }),
      (s) => tempos.push(s)
    )
    await handle.promise

    expect((await stat(output)).size).toBeGreaterThan(0)
    expect(tempos.length).toBeGreaterThan(0)
    expect(tempos[tempos.length - 1]).toBeGreaterThan(0)
  })

  it('rejeita com a mensagem do ffmpeg quando o comando falha', async () => {
    const handle = runFfmpeg(
      FFMPEG_PATH,
      ['-i', join(dir, 'nao-existe.mp4'), join(dir, 'x.mp4')],
      () => {}
    )
    await expect(handle.promise).rejects.toThrow()
  })

  it('cancela, mata o processo e deixa o arquivo incompleto', async () => {
    const output = join(dir, 'cancelado.mp4')
    const handle = runFfmpeg(
      FFMPEG_PATH,
      buildCutArgs({ inputPath: heavy, outputPath: output, start: 0, duration: 30, mode: 'exact' }),
      () => {}
    )
    const iniciou = Date.now()
    setTimeout(() => handle.cancel(), 150)
    await expect(handle.promise).rejects.toBeInstanceOf(FfmpegCancelled)

    // Prova categórica de que o processo morreu no meio: se o taskkill falhasse, o
    // ffmpeg terminaria o encode e o arquivo teria os 30s completos e legíveis.
    // Truncado, o `-movflags +faststart` deixa o arquivo sem índice, ilegível.
    const duracao = await duracaoOuNull(output)
    expect(duracao === null || duracao < 5).toBe(true)

    // Limite frouxo, só para detectar travamento — não é a prova do cancelamento.
    expect(Date.now() - iniciou).toBeLessThan(10_000)
  })
})
