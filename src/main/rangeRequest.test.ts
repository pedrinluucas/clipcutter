import { describe, it, expect } from 'vitest'
import { parseRange, contentTypeFor } from './rangeRequest'

describe('parseRange', () => {
  it('lê início e fim explícitos', () => {
    expect(parseRange('bytes=1000-1999', 5000)).toEqual({ start: 1000, end: 1999 })
  })

  it('sem fim, vai até o último byte', () => {
    // É a forma que o <video> mais usa: "me dá daqui pra frente".
    expect(parseRange('bytes=1000-', 5000)).toEqual({ start: 1000, end: 4999 })
  })

  it('sufixo negativo pede os últimos N bytes', () => {
    // O player usa isto para ler o índice do mp4, que fica no FIM do arquivo.
    expect(parseRange('bytes=-500', 5000)).toEqual({ start: 4500, end: 4999 })
  })

  it('sufixo maior que o arquivo devolve o arquivo inteiro', () => {
    expect(parseRange('bytes=-99999', 5000)).toEqual({ start: 0, end: 4999 })
  })

  it('limita o fim ao último byte do arquivo', () => {
    expect(parseRange('bytes=4000-99999', 5000)).toEqual({ start: 4000, end: 4999 })
  })

  it('aceita o arquivo inteiro', () => {
    expect(parseRange('bytes=0-', 5000)).toEqual({ start: 0, end: 4999 })
  })

  it('devolve null quando não há cabeçalho', () => {
    expect(parseRange(null, 5000)).toBeNull()
    expect(parseRange('', 5000)).toBeNull()
  })

  it('devolve null para unidade que não seja bytes', () => {
    expect(parseRange('items=0-10', 5000)).toBeNull()
  })

  it('devolve null para texto malformado', () => {
    expect(parseRange('bytes=abc-def', 5000)).toBeNull()
    expect(parseRange('bytes=', 5000)).toBeNull()
  })

  it('devolve "inatingível" quando o início passa do fim do arquivo', () => {
    // Precisa virar 416, não 206 com faixa negativa.
    expect(parseRange('bytes=9999-', 5000)).toBe('unsatisfiable')
  })

  it('devolve "inatingível" quando o início é maior que o fim', () => {
    expect(parseRange('bytes=2000-1000', 5000)).toBe('unsatisfiable')
  })

  it('trata arquivo vazio como inatingível', () => {
    expect(parseRange('bytes=0-', 0)).toBe('unsatisfiable')
  })

  it('ignora múltiplas faixas e usa a primeira', () => {
    // Multipart/byteranges é legal no HTTP, mas nenhum <video> pede — e
    // implementar seria complexidade sem cliente.
    expect(parseRange('bytes=0-99,200-299', 5000)).toEqual({ start: 0, end: 99 })
  })
})

describe('contentTypeFor', () => {
  it('mapeia os formatos que o app aceita', () => {
    expect(contentTypeFor('a.mp4')).toBe('video/mp4')
    expect(contentTypeFor('a.mov')).toBe('video/quicktime')
    expect(contentTypeFor('a.mkv')).toBe('video/x-matroska')
    expect(contentTypeFor('a.webm')).toBe('video/webm')
    expect(contentTypeFor('a.avi')).toBe('video/x-msvideo')
    expect(contentTypeFor('a.wmv')).toBe('video/x-ms-wmv')
    expect(contentTypeFor('a.flv')).toBe('video/x-flv')
  })

  it('não se importa com maiúsculas', () => {
    expect(contentTypeFor('C:\\v\\AULA.MP4')).toBe('video/mp4')
  })

  it('cai num tipo genérico de vídeo para extensão desconhecida', () => {
    expect(contentTypeFor('a.xyz')).toBe('video/mp4')
    expect(contentTypeFor('semextensao')).toBe('video/mp4')
  })
})
