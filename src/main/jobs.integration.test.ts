import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { startExportJob } from './jobs'
import type { ExportRequest, JobProgress } from '../shared/types'

const run = promisify(execFile)
let dir = ''
let outDir = ''
let source = ''

const durationOf = async (file: string): Promise<number> => {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-print_format', 'default=nw=1:nk=1', file,
  ])
  return Number(stdout.trim())
}

const request = (overrides: Partial<ExportRequest> = {}): ExportRequest => ({
  inputPath: source,
  outputDir: outDir,
  baseName: 'fonte',
  extension: '.mp4',
  segments: [
    { index: 0, start: 0, end: 3 },
    { index: 1, start: 3, end: 6 },
    { index: 2, start: 6, end: 10 },
  ],
  mode: 'exact',
  ...overrides,
})

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clipcutter-jobs-'))
  outDir = join(dir, 'saida')
  // 1280x720/30s em vez de 320x240/10s: o teste de cancelamento precisa de um
  // fonte grande o bastante para que o export de três partes não termine
  // sozinho dentro da janela de 200ms até o cancel — ver ruling do controller.
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc=size=1280x720:rate=30:duration=30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-y', (source = join(dir, 'fonte.mp4'))])
}, 120_000)

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('startExportJob (integração — exige ffmpeg instalado)', () => {
  it('gera uma parte por segmento, com as durações certas', async () => {
    const dirPartes = join(dir, 'saida-partes')
    const job = startExportJob('ffmpeg', request({ outputDir: dirPartes }), () => {})
    const result = await job.promise

    expect(result.status).toBe('done')
    expect(result.files).toHaveLength(3)

    expect(await durationOf(result.files[0])).toBeCloseTo(3, 1)
    expect(await durationOf(result.files[2])).toBeCloseTo(4, 1)
  })

  it('nomeia as partes em ordem', async () => {
    const dirNomes = join(dir, 'saida-nomes')
    const job = startExportJob('ffmpeg', request({ outputDir: dirNomes }), () => {})
    await job.promise
    const files = (await readdir(dirNomes)).filter((f) => f.startsWith('fonte_parte_')).sort()
    expect(files.slice(0, 3)).toEqual([
      'fonte_parte_01.mp4',
      'fonte_parte_02.mp4',
      'fonte_parte_03.mp4',
    ])
  })

  it('nunca sobrescreve arquivo existente', async () => {
    const collisionDir = join(dir, 'colisao')
    const job1 = startExportJob('ffmpeg', request({ outputDir: collisionDir }), () => {})
    await job1.promise
    const job2 = startExportJob('ffmpeg', request({ outputDir: collisionDir }), () => {})
    const result = await job2.promise

    expect(result.files[0]).toContain('fonte_parte_01 (2).mp4')
  })

  it('reporta progresso geral crescente de 0 a 1', async () => {
    const dirProgresso = join(dir, 'saida-progresso')
    const seen: JobProgress[] = []
    const job = startExportJob('ffmpeg', request({ outputDir: dirProgresso }), (p) => seen.push(p))
    await job.promise

    expect(seen.length).toBeGreaterThan(0)
    const fractions = seen.map((p) => p.overallFraction)
    expect(Math.min(...fractions)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...fractions)).toBeLessThanOrEqual(1)
    expect(seen[seen.length - 1].totalSegments).toBe(3)
  })

  it('cancela no meio e devolve as partes já prontas', async () => {
    const cancelDir = join(dir, 'cancelado')
    const job = startExportJob(
      'ffmpeg',
      request({
        outputDir: cancelDir,
        segments: [
          { index: 0, start: 0, end: 10 },
          { index: 1, start: 10, end: 20 },
          { index: 2, start: 20, end: 30 },
        ],
      }),
      () => {},
    )
    setTimeout(() => job.cancel(), 200)
    const result = await job.promise

    expect(result.status).toBe('cancelled')
    expect(result.files.length).toBeLessThan(3)
  })

  it('para a fila e devolve erro quando o ffmpeg falha', async () => {
    const job = startExportJob('ffmpeg', request({ inputPath: join(dir, 'fantasma.mp4') }), () => {})
    const result = await job.promise

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.failedIndex).toBe(0)
      expect(result.message).toContain('FFmpeg')
    }
  })
})
