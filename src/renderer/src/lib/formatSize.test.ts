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
})
