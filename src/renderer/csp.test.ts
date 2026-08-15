import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Isto é o teste que teria pego o defeito crítico C1 sem precisar de uma janela
// aberta: o player carrega `clip://local/?p=...` (ver src/renderer/src/components/
// VideoPlayer.tsx e src/shared/clipUrl.ts), e sem `media-src` cobrindo o esquema
// `clip:` o `<video>` é recusado pela CSP — tela preta, sem nenhum erro visível
// fora do console do DevTools. Lê o `<meta http-equiv="Content-Security-Policy">`
// cru do HTML e confere, por regra, que cada esquema que o renderer de fato usa
// está liberado na diretiva certa.

function readCsp(): string {
  const html = readFileSync(join(__dirname, 'index.html'), 'utf8')
  const match = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/>/.exec(html)
  if (!match) throw new Error('Não encontrei a tag <meta> de Content-Security-Policy em index.html')
  return match[1]
}

function directive(csp: string, name: string): string[] {
  const rule = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name)
  return rule ? rule.split(/\s+/).slice(1) : []
}

describe('Content-Security-Policy do index.html', () => {
  const csp = readCsp()

  it('libera o esquema clip: em media-src, para o <video> do player', () => {
    // Player carrega window.clip.fileUrl(video.path), que é clip://local/?p=...
    expect(directive(csp, 'media-src')).toContain('clip:')
  })

  it('libera data: em img-src', () => {
    expect(directive(csp, 'img-src')).toContain('data:')
  })

  it('libera unsafe-inline em style-src (estilos inline do React/Tailwind)', () => {
    expect(directive(csp, 'style-src')).toContain("'unsafe-inline'")
  })

  it('script-src continua restrito a self — nenhum script externo deveria valer', () => {
    expect(directive(csp, 'script-src')).toEqual(["'self'"])
  })
})
