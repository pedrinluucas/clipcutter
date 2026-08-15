import { describe, it, expect } from 'vitest'
import { formatSize } from './formatSize'

describe('formatSize', () => {
  it('formata bytes', () => {
    expect(formatSize(512)).toBe('512 B')
  })

  it('formata megabytes com uma casa', () => {
    expect(formatSize(52428800)).toBe('50.0 MB')
  })

  it('formata gigabytes', () => {
    expect(formatSize(2147483648)).toBe('2.0 GB')
  })

  it('trata zero', () => {
    expect(formatSize(0)).toBe('0 B')
  })

  it('promove a unidade quando o arredondamento chegaria a 1024', () => {
    // 1048575 bytes dá 1023.999 KB: não promove pela comparação crua, mas
    // toFixed(1) exibiria "1024.0 KB".
    expect(formatSize(1048575)).toBe('1.0 MB')
  })

  it('promove na fronteira de GB pelo mesmo motivo', () => {
    expect(formatSize(1073741823)).toBe('1.0 GB')
  })
})
