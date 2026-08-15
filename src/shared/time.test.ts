import { describe, it, expect } from 'vitest'
import { formatTime, parseTime } from './time'

describe('formatTime', () => {
  it('formata zero', () => {
    expect(formatTime(0)).toBe('00:00.000')
  })

  it('formata minutos, segundos e milissegundos', () => {
    expect(formatTime(90.5)).toBe('01:30.500')
  })

  it('vira pra hh:mm:ss.mmm assim que chega em 1 hora', () => {
    expect(formatTime(3600)).toBe('1:00:00.000')
  })

  it('mantém mm:ss.mmm logo abaixo de 1 hora', () => {
    expect(formatTime(3599.999)).toBe('59:59.999')
  })

  it('soma minutos e segundos corretamente acima de 1 hora', () => {
    expect(formatTime(3665.25)).toBe('1:01:05.250')
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

  it('lê o formato com hora', () => {
    expect(parseTime('1:00:00.000')).toBe(3600)
  })

  it('é a volta de formatTime abaixo de 1 hora', () => {
    expect(parseTime(formatTime(123.456))).toBeCloseTo(123.456, 3)
  })

  it('é a volta de formatTime acima de 1 hora', () => {
    expect(parseTime(formatTime(3665.25))).toBeCloseTo(3665.25, 3)
  })
})
