import Store from 'electron-store'
import type { Prefs } from '../shared/types'

const store = new Store<Prefs>({
  defaults: {
    outputDir: null,
    exactMode: true,
    // 29.9, não 30. O Facebook Stories diz "up to 30 seconds" e RECUSA um arquivo
    // de 30,000s exatos com "Video is too long" — verificado por Pedro em
    // 15/08/2026, com o mesmo vídeo passando a 29,9s. "Até 30" ali significa
    // menos que 30.
    //
    // 29.9 também é imune a uma segunda armadilha: num vídeo de 29,97fps, pedir
    // 30,000s produz 30,03s (o quadro 900 começa em 29,9967, antes do corte, e
    // entra). Material americano costuma ser 29,97fps.
    chunkDuration: 29.9,
  },
})

export function getPrefs(): Prefs {
  return {
    outputDir: store.get('outputDir'),
    exactMode: store.get('exactMode'),
    chunkDuration: store.get('chunkDuration'),
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  for (const [key, value] of Object.entries(patch)) {
    store.set(key as keyof Prefs, value as never)
  }
  return getPrefs()
}
