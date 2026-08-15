import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ExportRequest, FfmpegCheck, JobProgress, JobResult, Prefs, VideoInfo,
} from '../shared/types'
import { toClipUrl } from '../shared/clipUrl'

const api = {
  checkFfmpeg: (): Promise<FfmpegCheck> => ipcRenderer.invoke('app:checkFfmpeg'),

  openVideoDialog: (): Promise<VideoInfo | null> => ipcRenderer.invoke('video:openDialog'),

  probeVideo: (path: string): Promise<VideoInfo> => ipcRenderer.invoke('video:probe', path),

  chooseOutputDir: (): Promise<string | null> => ipcRenderer.invoke('export:chooseDir'),

  startExport: (request: ExportRequest): Promise<JobResult> =>
    ipcRenderer.invoke('export:start', request),

  cancelExport: (): void => ipcRenderer.send('export:cancel'),

  onExportProgress: (handler: (progress: JobProgress) => void): (() => void) => {
    const listener = (_event: unknown, progress: JobProgress): void => handler(progress)
    ipcRenderer.on('export:progress', listener)
    return () => ipcRenderer.off('export:progress', listener)
  },

  openFolder: (path: string): Promise<void> => ipcRenderer.invoke('shell:openFolder', path),

  getPrefs: (): Promise<Prefs> => ipcRenderer.invoke('prefs:get'),

  setPrefs: (patch: Partial<Prefs>): Promise<Prefs> => ipcRenderer.invoke('prefs:set', patch),

  fileUrl: (path: string): string => toClipUrl(path),
}

export type ClipApi = typeof api

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('clip', api)
