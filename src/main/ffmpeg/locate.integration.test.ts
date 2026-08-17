import { describe, it, expect } from 'vitest'
import { locateBinaries } from './locate'

describe('locateBinaries (integração — usa os binários embutidos)', () => {
  it('encontra o ffmpeg e o ffprobe que vêm dentro do app', async () => {
    const result = await locateBinaries()
    expect(result.ok).toBe(true)
  })
})
