import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { locateBinaries } from './ffmpeg/locate'
import { probeVideo } from './ffmpeg/probe'
import { startExportJob } from './jobs'
import { getPrefs, setPrefs } from './store'
import type { ExportRequest, FfmpegCheck, JobResult, Prefs } from '../shared/types'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv']

let ffprobePath = 'ffprobe'
let ffmpegPath = 'ffmpeg'
let currentJob: { cancel: () => void } | null = null

export function registerIpc(): void {
  ipcMain.handle('app:checkFfmpeg', async (): Promise<FfmpegCheck> => {
    const result = await locateBinaries()
    if (result.ok) {
      ffmpegPath = result.ffmpeg
      ffprobePath = result.ffprobe
    }
    return result
  })

  ipcMain.handle('video:openDialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Escolher vídeo',
      properties: ['openFile'],
      filters: [{ name: 'Vídeos', extensions: VIDEO_EXTENSIONS }],
    })
    if (canceled || filePaths.length === 0) return null
    return probeVideo(ffprobePath, filePaths[0])
  })

  ipcMain.handle('video:probe', (_event, path: string) => probeVideo(ffprobePath, path))

  ipcMain.handle('export:chooseDir', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Escolher pasta de saída',
      properties: ['openDirectory', 'createDirectory'],
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('export:start', async (event, request: ExportRequest): Promise<JobResult> => {
    // Um trabalho por vez. O guard vive aqui, e não na UI, porque um duplo clique
    // dispara o handler duas vezes antes do React re-renderizar — e com dois jobs
    // no mesmo slot, o `finally` do primeiro a terminar zera a referência e o
    // Cancelar deixa de funcionar contra o que ainda está rodando.
    if (currentJob) {
      return {
        status: 'error',
        files: [],
        message: 'Já existe uma exportação em andamento.',
        failedIndex: 0,
      }
    }

    const job = startExportJob(ffmpegPath, request, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('export:progress', progress)
    })
    currentJob = job
    try {
      return await job.promise
    } finally {
      currentJob = null
    }
  })

  ipcMain.on('export:cancel', () => cancelCurrentJob())

  ipcMain.handle('shell:openFolder', (_event, path: string) => shell.openPath(path))

  ipcMain.handle('prefs:get', (): Prefs => getPrefs())
  ipcMain.handle('prefs:set', (_event, patch: Partial<Prefs>): Prefs => setPrefs(patch))
}

// Exportado para o `before-quit` do processo principal (src/main/index.ts). Nada
// prende a exportação ao ciclo de vida do app: fechar a janela encerra o processo,
// e o `ffmpeg.exe` filho ou segue rodando sem cabeça, ou morre num pipe quebrado —
// e nesse segundo caso ninguém roda a limpeza do arquivo parcial, deixando um
// `_parte_NN.mp4` truncado com a mesma cara de um arquivo pronto.
export function cancelCurrentJob(): void {
  currentJob?.cancel()
}
