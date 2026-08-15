import Store from 'electron-store'
import type { Prefs } from '../shared/types'

const store = new Store<Prefs>({
  defaults: {
    outputDir: null,
    exactMode: true,
    chunkDuration: 30,
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
