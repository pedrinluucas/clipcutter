/**
 * Sonda: o Electron entrega mesmo requisição parcial (Range) por protocol.handle?
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * Sem Range, o <video> toca o arquivo do começo ao fim mas NÃO consegue
 * posicionar: clicar na timeline, arrastar o playhead e as setas do teclado
 * ficam todos inertes. O sintoma para quem usa é "a agulha travou".
 *
 * Isso aconteceu de verdade. O spec §6 afirmava que `net.fetch(pathToFileURL(...))`
 * já trazia suporte a Range. NÃO traz — devolve 200 com o arquivo inteiro (medido:
 * 911 MB para um pedido de 1.000 bytes). A afirmação atravessou 15 tasks, a revisão
 * de cada uma e uma revisão da branch inteira sem ser questionada, porque
 * verificá-la exige um runtime de Electron e nenhum agente do processo conseguia
 * abrir janela.
 *
 * O QUE ESTA SONDA PROVA, E O QUE NÃO PROVA
 * -----------------------------------------
 * Prova: que o mecanismo funciona — `protocol.handle` + `Response` com stream
 * devolvem 206 com o pedaço certo num Electron real.
 *
 * Não prova: que o handler do app está correto. Ela REPLICA o handler de
 * `src/main/protocol.ts` em vez de importá-lo, porque o main é empacotado num
 * bundle único e não expõe as peças. A interpretação do cabeçalho — que é onde a
 * lógica pode errar — está coberta por `src/main/rangeRequest.test.ts` (16 casos).
 * Se você mudar o handler, mude aqui também.
 *
 * USO
 * ---
 *   npm run probe:range -- "C:\\caminho\\para\\video.mp4"
 *
 * ESPERADO: 200 com `accept-ranges: bytes`; depois 206 com exatamente 1.000 bytes;
 * depois 206 com exatamente 500 bytes no pedido por sufixo. Sai com código 1 se
 * qualquer um falhar.
 */
const { app, protocol, net } = require('electron')
const { createReadStream } = require('node:fs')
const { stat } = require('node:fs/promises')
const { Readable } = require('node:stream')
const { extname } = require('node:path')

const ALVO = process.argv[2]

if (!ALVO) {
  console.error('uso: npm run probe:range -- "C:\\caminho\\para\\video.mp4"')
  process.exit(1)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'clip',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// --- réplica de src/main/protocol.ts + src/main/rangeRequest.ts ---
function parseRange(header, size) {
  if (!header) return null
  const m = /^bytes=(.+)$/i.exec(header.trim())
  if (!m) return null
  const p = /^(\d*)-(\d*)$/.exec(m[1].split(',')[0].trim())
  if (!p) return null
  const [, a, b] = p
  if (a === '' && b === '') return null
  if (size <= 0) return 'unsatisfiable'
  if (a === '') {
    const q = Number(b)
    if (!Number.isFinite(q) || q <= 0) return null
    return { start: Math.max(size - q, 0), end: size - 1 }
  }
  const start = Number(a)
  if (!Number.isFinite(start) || start >= size) return 'unsatisfiable'
  const end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  if (!Number.isFinite(end) || end < start) return 'unsatisfiable'
  return { start, end }
}

const TIPOS = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
}
const contentTypeFor = (f) => TIPOS[extname(f).toLowerCase()] ?? 'video/mp4'
const corpo = (f, s, e) => Readable.toWeb(createReadStream(f, { start: s, end: e }))

app.whenReady().then(async () => {
  protocol.handle('clip', async (request) => {
    const filePath = new URL(request.url).searchParams.get('p')
    if (!filePath) return new Response('caminho ausente', { status: 400 })
    let size
    try {
      size = (await stat(filePath)).size
    } catch {
      return new Response('arquivo não encontrado', { status: 404 })
    }
    const tipo = contentTypeFor(filePath)
    const faixa = parseRange(request.headers.get('Range'), size)
    if (faixa === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
      })
    }
    if (faixa === null) {
      return new Response(corpo(filePath, 0, size - 1), {
        status: 200,
        headers: { 'Content-Type': tipo, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
      })
    }
    return new Response(corpo(filePath, faixa.start, faixa.end), {
      status: 206,
      headers: {
        'Content-Type': tipo,
        'Content-Length': String(faixa.end - faixa.start + 1),
        'Content-Range': `bytes ${faixa.start}-${faixa.end}/${size}`,
        'Accept-Ranges': 'bytes',
      },
    })
  })

  const url = `clip://local/?p=${encodeURIComponent(ALVO)}`
  let falhou = false

  console.log('=== 1. requisição INTEIRA ===')
  const inteira = await net.fetch(url)
  console.log('status:', inteira.status)
  console.log('accept-ranges:', inteira.headers.get('accept-ranges'))
  console.log('content-type:', inteira.headers.get('content-type'))
  if (inteira.status !== 200 || inteira.headers.get('accept-ranges') !== 'bytes') {
    console.log('FALHOU: sem accept-ranges o player nem tenta posicionar')
    falhou = true
  }

  console.log('')
  console.log('=== 2. requisição PARCIAL (Range: bytes=1000-1999) ===')
  const parcial = await net.fetch(url, { headers: { Range: 'bytes=1000-1999' } })
  const recebidos = (await parcial.arrayBuffer()).byteLength
  console.log('status:', parcial.status)
  console.log('content-range:', parcial.headers.get('content-range'))
  console.log('bytes recebidos:', recebidos)
  if (parcial.status !== 206 || recebidos !== 1000) {
    console.log('FALHOU: esperado 206 com exatamente 1000 bytes')
    falhou = true
  }

  console.log('')
  console.log('=== 3. sufixo (Range: bytes=-500) — como o player lê o índice do mp4 ===')
  const sufixo = await net.fetch(url, { headers: { Range: 'bytes=-500' } })
  const bytesSufixo = (await sufixo.arrayBuffer()).byteLength
  console.log('status:', sufixo.status, '| bytes:', bytesSufixo)
  if (sufixo.status !== 206 || bytesSufixo !== 500) {
    console.log('FALHOU: sem o pedido por sufixo o mp4 pode nem abrir')
    falhou = true
  }

  console.log('')
  console.log(falhou ? 'RESULTADO: QUEBRADO' : 'RESULTADO: OK — o vídeo consegue posicionar')
  app.exit(falhou ? 1 : 0)
})
