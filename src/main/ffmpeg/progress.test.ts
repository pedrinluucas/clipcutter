import { describe, it, expect } from 'vitest'
import { createProgressReader } from './progress'

describe('createProgressReader', () => {
  it('lê out_time_us e converte para segundos', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=5000000\nprogress=continue\n')).toBe(5)
  })

  it('devolve null quando o pedaço não tem tempo', () => {
    const reader = createProgressReader()
    expect(reader.push('frame=10\nfps=25\n')).toBeNull()
  })

  it('devolve o ÚLTIMO tempo quando o pedaço tem vários blocos', () => {
    const reader = createProgressReader()
    const chunk = 'out_time_us=1000000\nprogress=continue\nout_time_us=2000000\nprogress=continue\n'
    expect(reader.push(chunk)).toBe(2)
  })

  it('remonta linha cortada entre dois pedaços', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_')).toBeNull()
    expect(reader.push('us=3000000\n')).toBe(3)
  })

  it('ignora N/A que o ffmpeg emite no começo', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=N/A\n')).toBeNull()
  })

  it('ignora valores negativos', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=-42\n')).toBeNull()
  })

  it('ignora linha sem quebra no fim até ela fechar', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=7000000')).toBeNull()
    expect(reader.push('\n')).toBe(7)
  })

  it('lida com quebra de linha do Windows', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=9000000\r\n')).toBe(9)
  })
})
