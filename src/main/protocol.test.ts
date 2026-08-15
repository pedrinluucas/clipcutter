import { describe, it, expect } from 'vitest'
import { toClipUrl } from './protocol'

describe('toClipUrl', () => {
  it('codifica um caminho do Windows', () => {
    expect(toClipUrl('C:\\videos\\aula.mp4')).toBe('clip://local/?p=C%3A%5Cvideos%5Caula.mp4')
  })

  it('codifica espaços e acentos', () => {
    const url = toClipUrl('C:\\Meus Vídeos\\aula final.mp4')
    expect(url.startsWith('clip://local/?p=')).toBe(true)
    expect(new URL(url).searchParams.get('p')).toBe('C:\\Meus Vídeos\\aula final.mp4')
  })

  it('sobrevive a & e ? no nome do arquivo', () => {
    const caminho = 'C:\\v\\q&a? final.mp4'
    expect(new URL(toClipUrl(caminho)).searchParams.get('p')).toBe(caminho)
  })
})
