/// <reference types="vite/client" />
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { ClipApi } from '../../preload'

declare global {
  interface Window {
    electron: ElectronAPI
    clip: ClipApi
  }
}
