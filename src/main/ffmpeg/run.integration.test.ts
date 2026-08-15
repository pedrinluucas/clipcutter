import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runFfmpeg, FfmpegCancelled } from './run'
import { buildCutArgs } from './args'

const run = promisify(execFile)
let dir = ''
let source = ''
let heavy = ''

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clipcutter-'))
  source = join(dir, 'fonte.mp4')
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=10',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', '-y', source,
  ])

  heavy = join(dir, 'pesado.mp4')
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-y', heavy,
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
      'ffmpeg',
      buildCutArgs({ inputPath: source, outputPath: output, start: 2, duration: 3, mode: 'exact' }),
      (s) => tempos.push(s),
    )
    await handle.promise

    expect((await stat(output)).size).toBeGreaterThan(0)
    expect(tempos.length).toBeGreaterThan(0)
    expect(tempos[tempos.length - 1]).toBeGreaterThan(0)
  })

  it('rejeita com a mensagem do ffmpeg quando o comando falha', async () => {
    const handle = runFfmpeg('ffmpeg', ['-i', join(dir, 'nao-existe.mp4'), join(dir, 'x.mp4')], () => {})
    await expect(handle.promise).rejects.toThrow()
  })

  it('cancela e rejeita com FfmpegCancelled', async () => {
    const output = join(dir, 'cancelado.mp4')
    const handle = runFfmpeg(
      'ffmpeg',
      buildCutArgs({ inputPath: heavy, outputPath: output, start: 0, duration: 30, mode: 'exact' }),
      () => {},
    )
    const iniciou = Date.now()
    setTimeout(() => handle.cancel(), 150)
    await expect(handle.promise).rejects.toBeInstanceOf(FfmpegCancelled)

    // Se o taskkill não matasse nada, o ffmpeg terminaria o encode natural (vários
    // segundos) e o close ainda rejeitaria como cancelado — o teste passaria sem
    // provar nada. O tempo decorrido é o que prova que o processo morreu cedo.
    expect(Date.now() - iniciou).toBeLessThan(3000)
  })
})
