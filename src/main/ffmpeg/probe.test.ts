import { describe, it, expect } from 'vitest'
import { parseFps, parseProbeOutput } from './probe'

const sample = {
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      r_frame_rate: '30000/1001',
    },
    { codec_type: 'audio', codec_name: 'aac' },
  ],
  format: { duration: '125.400000', size: '52428800', bit_rate: '3345000' },
}

describe('parseFps', () => {
  it('resolve a fração NTSC', () => {
    expect(parseFps('30000/1001')).toBe(29.97)
  })

  it('resolve fração inteira', () => {
    expect(parseFps('30/1')).toBe(30)
  })

  it('devolve 0 para entrada ausente ou zerada', () => {
    expect(parseFps(undefined)).toBe(0)
    expect(parseFps('0/0')).toBe(0)
  })
})

describe('parseProbeOutput', () => {
  it('extrai os metadados do vídeo', () => {
    const info = parseProbeOutput(sample, 'C:\\videos\\aula final.mp4')
    expect(info.duration).toBe(125.4)
    expect(info.width).toBe(1920)
    expect(info.height).toBe(1080)
    expect(info.fps).toBe(29.97)
    expect(info.videoCodec).toBe('h264')
    expect(info.audioCodec).toBe('aac')
    expect(info.sizeBytes).toBe(52428800)
    expect(info.bitrate).toBe(3345000)
  })

  it('quebra o caminho em nome, base e extensão', () => {
    const info = parseProbeOutput(sample, 'C:\\videos\\aula final.mp4')
    expect(info.path).toBe('C:\\videos\\aula final.mp4')
    expect(info.fileName).toBe('aula final.mp4')
    expect(info.baseName).toBe('aula final')
    expect(info.extension).toBe('.mp4')
  })

  it('aceita vídeo sem faixa de áudio', () => {
    const mudo = { ...sample, streams: [sample.streams[0]] }
    expect(parseProbeOutput(mudo, 'C:\\v\\a.mp4').audioCodec).toBeNull()
  })

  it('recusa arquivo sem faixa de vídeo', () => {
    const audio = { ...sample, streams: [sample.streams[1]] }
    expect(() => parseProbeOutput(audio, 'C:\\v\\a.mp3')).toThrow(/faixa de vídeo/)
  })

  it('recusa duração ilegível', () => {
    const quebrado = { ...sample, format: { ...sample.format, duration: 'N/A' } }
    expect(() => parseProbeOutput(quebrado, 'C:\\v\\a.mp4')).toThrow(/duração/)
  })

  it('aceita bitrate ausente', () => {
    const semBitrate = { ...sample, format: { duration: '10', size: '100' } }
    expect(parseProbeOutput(semBitrate, 'C:\\v\\a.mp4').bitrate).toBeNull()
  })

  it('ignora capa embutida e usa o fluxo de vídeo real', () => {
    const comCapa = {
      ...sample,
      streams: [
        {
          codec_type: 'video',
          codec_name: 'mjpeg',
          width: 300,
          height: 169,
          r_frame_rate: '90000/1',
          disposition: { attached_pic: 1 },
        },
        ...sample.streams,
      ],
    }
    const info = parseProbeOutput(comCapa, 'C:\\videos\\baixado.mp4')
    expect(info.videoCodec).toBe('h264')
    expect(info.width).toBe(1920)
    expect(info.height).toBe(1080)
    expect(info.fps).toBe(29.97)
  })

  it('recusa arquivo cujo único fluxo de vídeo é capa embutida', () => {
    const soCapa = {
      ...sample,
      streams: [
        { codec_type: 'video', codec_name: 'png', width: 300, height: 300, disposition: { attached_pic: 1 } },
        sample.streams[1],
      ],
    }
    expect(() => parseProbeOutput(soCapa, 'C:\\musica\\faixa.mp3')).toThrow(/faixa de vídeo/)
  })
})
