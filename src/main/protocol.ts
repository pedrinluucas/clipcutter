import { protocol } from 'electron'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { CLIP_SCHEME, toClipUrl } from '../shared/clipUrl'
import { parseRange, contentTypeFor } from './rangeRequest'

export { CLIP_SCHEME, toClipUrl }

// Precisa rodar ANTES de app.whenReady()
export function registerClipScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CLIP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

function corpo(filePath: string, start: number, end: number): ReadableStream {
  // `end` é inclusivo tanto no HTTP quanto no createReadStream — não somar 1.
  return Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
}

// Precisa rodar DEPOIS de app.whenReady()
export function handleClipProtocol(): void {
  protocol.handle(CLIP_SCHEME, async (request) => {
    const filePath = new URL(request.url).searchParams.get('p')
    if (!filePath) return new Response('caminho ausente', { status: 400 })

    let size: number
    try {
      size = (await stat(filePath)).size
    } catch {
      return new Response('arquivo não encontrado', { status: 404 })
    }

    const tipo = contentTypeFor(filePath)
    const faixa = parseRange(request.headers.get('Range'), size)

    // 416 precisa vir com Content-Range dizendo o tamanho real, senão o player
    // não sabe para onde corrigir o pedido.
    if (faixa === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
      })
    }

    // Sem Range: arquivo inteiro. O `Accept-Ranges` é o que ANUNCIA ao player que
    // ele pode pedir pedaços — sem esse cabeçalho o Chromium nem tenta buscar, e
    // o vídeo toca do começo ao fim sem conseguir posicionar.
    if (faixa === null) {
      return new Response(corpo(filePath, 0, size - 1), {
        status: 200,
        headers: {
          'Content-Type': tipo,
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
        },
      })
    }

    const tamanho = faixa.end - faixa.start + 1
    return new Response(corpo(filePath, faixa.start, faixa.end), {
      status: 206,
      headers: {
        'Content-Type': tipo,
        'Content-Length': String(tamanho),
        'Content-Range': `bytes ${faixa.start}-${faixa.end}/${size}`,
        'Accept-Ranges': 'bytes',
      },
    })
  })
}
