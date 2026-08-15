import { describe, it, expect } from 'vitest'
import { formatTime, parseTime } from './time'

describe('formatTime', () => {
  it('formata zero', () => {
    expect(formatTime(0)).toBe('00:00.000')
  })

  it('formata minutos, segundos e milissegundos', () => {
    expect(formatTime(90.5)).toBe('01:30.500')
  })

  it('deixa os minutos passarem de 59 em vez de virar hora', () => {
    expect(formatTime(3600)).toBe('60:00.000')
  })

  it('arredonda para o milissegundo mais próximo', () => {
    expect(formatTime(1.9999)).toBe('00:02.000')
  })

  it('trata negativo e NaN como zero', () => {
    expect(formatTime(-5)).toBe('00:00.000')
    expect(formatTime(NaN)).toBe('00:00.000')
  })
})

describe('parseTime', () => {
  it('lê o formato completo', () => {
    expect(parseTime('01:30.500')).toBe(90.5)
  })

  it('aceita milissegundos abreviados', () => {
    expect(parseTime('01:30.5')).toBe(90.5)
  })

  it('aceita sem a parte decimal', () => {
    expect(parseTime('60:00')).toBe(3600)
  })

  it('devolve null para texto inválido', () => {
    expect(parseTime('abc')).toBeNull()
    expect(parseTime('')).toBeNull()
  })

  it('devolve null para segundos acima de 59', () => {
    expect(parseTime('01:75')).toBeNull()
  })

  it('é a volta de formatTime', () => {
    expect(parseTime(formatTime(123.456))).toBeCloseTo(123.456, 3)
  })
})
