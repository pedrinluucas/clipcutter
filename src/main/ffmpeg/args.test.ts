import { describe, it, expect } from 'vitest'
import { buildCutArgs } from './args'

const base = { inputPath: 'C:\\v\\in.mp4', outputPath: 'C:\\out\\p1.mp4', start: 29.5, duration: 30 }

describe('buildCutArgs', () => {
  it('coloca -ss ANTES de -i (seek rápido)', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
  })

  it('coloca -t DEPOIS de -i (limita a duração da SAÍDA, não da leitura)', () => {
    // -t antes de -i muda de significado: vira limite de leitura do arquivo de
    // ENTRADA, não duração do que é escrito na saída. Silencioso — o ffmpeg não
    // recusa o comando, só corta errado.
    for (const mode of ['fast', 'exact'] as const) {
      const args = buildCutArgs({ ...base, mode })
      expect(args.indexOf('-t')).toBeGreaterThan(args.indexOf('-i'))
    }
  })

  it('formata os tempos com 3 casas decimais', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args[args.indexOf('-ss') + 1]).toBe('29.500')
    expect(args[args.indexOf('-t') + 1]).toBe('30.000')
  })

  it('modo rápido copia o stream sem recodificar', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args).toContain('-c')
    expect(args[args.indexOf('-c') + 1]).toBe('copy')
    expect(args).toContain('-avoid_negative_ts')
    expect(args).not.toContain('libx264')
  })

  it('modo exato recodifica em H.264/AAC', () => {
    const args = buildCutArgs({ ...base, mode: 'exact' })
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264')
    expect(args[args.indexOf('-crf') + 1]).toBe('20')
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac')
    expect(args).not.toContain('copy')
  })

  it('sempre pede progresso em formato legível por máquina', () => {
    for (const mode of ['fast', 'exact'] as const) {
      const args = buildCutArgs({ ...base, mode })
      expect(args).toContain('-progress')
      expect(args[args.indexOf('-progress') + 1]).toBe('pipe:1')
      expect(args).toContain('-nostats')
    }
  })

  it('o caminho de saída é sempre o último argumento', () => {
    for (const mode of ['fast', 'exact'] as const) {
      const args = buildCutArgs({ ...base, mode })
      expect(args[args.length - 1]).toBe('C:\\out\\p1.mp4')
    }
  })

  it('passa os caminhos crus, sem aspas', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args[args.indexOf('-i') + 1]).toBe('C:\\v\\in.mp4')
  })
})
