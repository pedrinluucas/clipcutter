import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { CLIP_SCHEME, toClipUrl } from '../shared/clipUrl'

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

// Precisa rodar DEPOIS de app.whenReady()
export function handleClipProtocol(): void {
  protocol.handle(CLIP_SCHEME, (request) => {
    const filePath = new URL(request.url).searchParams.get('p')
    if (!filePath) return new Response('caminho ausente', { status: 400 })
    return net.fetch(pathToFileURL(filePath).toString())
  })
}
