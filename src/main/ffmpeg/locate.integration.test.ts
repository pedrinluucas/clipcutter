import { describe, it, expect } from 'vitest'
import { locateBinaries } from './locate'

describe('locateBinaries (integração — exige ffmpeg instalado)', () => {
  it('encontra ffmpeg e ffprobe no PATH', async () => {
    const result = await locateBinaries()
    expect(result.ok).toBe(true)
  })
})
