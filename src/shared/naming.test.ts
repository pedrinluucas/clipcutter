import { describe, it, expect } from 'vitest'
import { partFileName, uniqueFileName, outputExtension } from './naming'

describe('partFileName', () => {
  it('numera a partir de 1 com dois dígitos', () => {
    expect(partFileName('aula', 0, 6, '.mp4')).toBe('aula_parte_01.mp4')
    expect(partFileName('aula', 5, 6, '.mp4')).toBe('aula_parte_06.mp4')
  })

  it('cresce a numeração quando há mais de 99 partes', () => {
    expect(partFileName('aula', 0, 120, '.mp4')).toBe('aula_parte_001.mp4')
    expect(partFileName('aula', 119, 120, '.mp4')).toBe('aula_parte_120.mp4')
  })

  it('mantém dois dígitos mesmo com poucas partes', () => {
    expect(partFileName('aula', 0, 2, '.mp4')).toBe('aula_parte_01.mp4')
  })

  it('respeita a extensão pedida', () => {
    expect(partFileName('aula', 0, 3, '.mkv')).toBe('aula_parte_01.mkv')
  })

  it('preserva pontos e espaços no nome original', () => {
    expect(partFileName('live 12.03 final', 0, 3, '.mp4')).toBe('live 12.03 final_parte_01.mp4')
  })
})

describe('uniqueFileName', () => {
  it('devolve o nome original quando não há colisão', () => {
    expect(uniqueFileName('a_parte_01.mp4', () => false)).toBe('a_parte_01.mp4')
  })

  it('adiciona sufixo numérico na colisão', () => {
    const taken = new Set(['a_parte_01.mp4'])
    expect(uniqueFileName('a_parte_01.mp4', (n) => taken.has(n))).toBe('a_parte_01 (2).mp4')
  })

  it('continua incrementando enquanto houver colisão', () => {
    const taken = new Set(['a.mp4', 'a (2).mp4', 'a (3).mp4'])
    expect(uniqueFileName('a.mp4', (n) => taken.has(n))).toBe('a (4).mp4')
  })

  it('não confunde ponto do meio do nome com extensão', () => {
    const taken = new Set(['live 12.03.mp4'])
    expect(uniqueFileName('live 12.03.mp4', (n) => taken.has(n))).toBe('live 12.03 (2).mp4')
  })
})

describe('outputExtension', () => {
  it('força mp4 no modo exato', () => {
    expect(outputExtension('exact', '.mkv')).toBe('.mp4')
  })

  it('mantém a extensão original no modo rápido', () => {
    expect(outputExtension('fast', '.mkv')).toBe('.mkv')
  })

  it('cai para mp4 quando não há extensão original', () => {
    expect(outputExtension('fast', '')).toBe('.mp4')
  })
})
