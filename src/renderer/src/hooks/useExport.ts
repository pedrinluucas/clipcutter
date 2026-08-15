import { useCallback, useEffect, useState } from 'react'
import type { JobProgress, JobResult, Segment, VideoInfo } from '@shared/types'
import { outputExtension } from '@shared/naming'

export function useExport(video: VideoInfo, segments: Segment[]) {
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [exactMode, setExactModeState] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [result, setResult] = useState<JobResult | null>(null)

  useEffect(() => {
    window.clip.getPrefs().then((p) => {
      setOutputDir(p.outputDir)
      setExactModeState(p.exactMode)
    })
  }, [])

  useEffect(() => window.clip.onExportProgress(setProgress), [])

  const setExactMode = useCallback((value: boolean) => {
    setExactModeState(value)
    void window.clip.setPrefs({ exactMode: value })
  }, [])

  const chooseDir = useCallback(async () => {
    const dir = await window.clip.chooseOutputDir()
    if (!dir) return
    setOutputDir(dir)
    void window.clip.setPrefs({ outputDir: dir })
  }, [])

  const start = useCallback(async () => {
    if (!outputDir) return
    setRunning(true)
    setResult(null)
    setProgress(null)
    try {
      const jobResult = await window.clip.startExport({
        inputPath: video.path,
        outputDir,
        baseName: video.baseName,
        extension: outputExtension(exactMode ? 'exact' : 'fast', video.extension),
        segments,
        mode: exactMode ? 'exact' : 'fast',
      })
      setResult(jobResult)
    } catch (error) {
      // Rede de segurança: se o IPC rejeitar por qualquer motivo não previsto,
      // a UI precisa sair do estado "exportando" em vez de travar no botão
      // Cancelar para sempre.
      setResult({
        status: 'error',
        files: [],
        message: error instanceof Error ? error.message : String(error),
        failedIndex: 0,
      })
    } finally {
      setRunning(false)
    }
  }, [outputDir, exactMode, segments, video])

  const cancel = useCallback(() => window.clip.cancelExport(), [])

  const openFolder = useCallback(() => {
    if (outputDir) void window.clip.openFolder(outputDir)
  }, [outputDir])

  const reset = useCallback(() => setResult(null), [])

  return { outputDir, exactMode, running, progress, result, setExactMode, chooseDir, start, cancel, openFolder, reset }
}

export type ExportState = ReturnType<typeof useExport>
