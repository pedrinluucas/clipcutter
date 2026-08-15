export const CLIP_SCHEME = 'clip'

// O caminho vai como parâmetro de busca, não como caminho da URL, justamente pra
// não brigar com `C:\` — a barra invertida e os dois pontos da letra do drive
// quebram o parser de URL.
export function toClipUrl(filePath: string): string {
  return `${CLIP_SCHEME}://local/?p=${encodeURIComponent(filePath)}`
}
