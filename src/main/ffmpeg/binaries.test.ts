import { describe, it, expect } from 'vitest'
import { unpackedPath } from './binaries'

describe('unpackedPath', () => {
  it('reescreve app.asar para app.asar.unpacked', () => {
    // O empacotador põe os binários FORA do asar (senão o SO não consegue
    // executá-los), mas o caminho que o código recebe continua apontando para
    // DENTRO. Sem esta reescrita, o app empacotado não acha o ffmpeg — e o
    // sintoma é "funciona em desenvolvimento, quebra no .exe".
    expect(unpackedPath('C:\\app\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe')).toBe(
      'C:\\app\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe',
    )
  })

  it('deixa o caminho intacto quando não há asar', () => {
    // É o caso de desenvolvimento: o binário está em node_modules de verdade.
    const dev = 'C:\\projeto\\node_modules\\ffmpeg-static\\ffmpeg.exe'
    expect(unpackedPath(dev)).toBe(dev)
  })

  it('não reescreve um caminho que JÁ está desempacotado', () => {
    // Reescrever duas vezes produziria `app.asar.unpacked.unpacked`.
    const jaFeito = 'C:\\app\\resources\\app.asar.unpacked\\node_modules\\x\\ffmpeg.exe'
    expect(unpackedPath(jaFeito)).toBe(jaFeito)
  })

  it('funciona com separador de barra normal', () => {
    // O mesmo código roda no macOS, onde o separador é `/`.
    expect(unpackedPath('/Applications/App.app/Contents/Resources/app.asar/node_modules/f/ffmpeg')).toBe(
      '/Applications/App.app/Contents/Resources/app.asar.unpacked/node_modules/f/ffmpeg',
    )
  })

  it('não confunde uma pasta chamada app.asar-alguma-coisa', () => {
    const outro = 'C:\\app\\app.asarbackup\\ffmpeg.exe'
    expect(unpackedPath(outro)).toBe(outro)
  })

  it('reescreve só a primeira ocorrência do segmento', () => {
    expect(unpackedPath('C:\\a\\app.asar\\b\\app.asar\\ffmpeg.exe')).toBe(
      'C:\\a\\app.asar.unpacked\\b\\app.asar\\ffmpeg.exe',
    )
  })
})
