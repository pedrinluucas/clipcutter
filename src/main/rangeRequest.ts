import { extname } from 'node:path'

export type ByteRange = { start: number; end: number }

/**
 * Interpreta o cabeçalho `Range` de uma requisição de mídia.
 *
 * Devolve:
 * - `null` quando não há Range (o chamador responde 200 com o arquivo inteiro)
 * - `'unsatisfiable'` quando a faixa não existe no arquivo (responde 416)
 * - `{ start, end }` inclusivo nos dois extremos, como manda o HTTP
 *
 * Só a PRIMEIRA faixa é usada. Múltiplas faixas são válidas no HTTP mas nenhum
 * elemento `<video>` pede, e implementar multipart/byteranges seria complexidade
 * sem cliente.
 */
export function parseRange(
  header: string | null | undefined,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  if (!header) return null

  const match = /^bytes=(.+)$/i.exec(header.trim())
  if (!match) return null

  const primeira = match[1].split(',')[0].trim()
  const partes = /^(\d*)-(\d*)$/.exec(primeira)
  if (!partes) return null

  const [, inicioCru, fimCru] = partes
  if (inicioCru === '' && fimCru === '') return null
  if (size <= 0) return 'unsatisfiable'

  // Sufixo: `bytes=-500` são os ÚLTIMOS 500 bytes. É assim que o player lê o
  // índice de um mp4, que fica no fim do arquivo — sem isto o vídeo nem abre
  // quando o índice não está no começo.
  if (inicioCru === '') {
    const quantos = Number(fimCru)
    if (!Number.isFinite(quantos) || quantos <= 0) return null
    return { start: Math.max(size - quantos, 0), end: size - 1 }
  }

  const start = Number(inicioCru)
  if (!Number.isFinite(start) || start >= size) return 'unsatisfiable'

  const end = fimCru === '' ? size - 1 : Math.min(Number(fimCru), size - 1)
  if (!Number.isFinite(end) || end < start) return 'unsatisfiable'

  return { start, end }
}

const TIPOS: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
}

/**
 * O Content-Type importa: sem ele o Chromium adivinha pelo conteúdo, e adivinhar
 * errado faz o elemento recusar o arquivo sem erro visível.
 */
export function contentTypeFor(filePath: string): string {
  return TIPOS[extname(filePath).toLowerCase()] ?? 'video/mp4'
}
