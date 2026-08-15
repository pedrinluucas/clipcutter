import { useCallback, useEffect, useRef, useState } from 'react'
import type { JobProgress, JobResult, Segment, VideoInfo } from '@shared/types'
import { outputExtension } from '@shared/naming'

export function useExport(video: VideoInfo, segments: Segment[]) {
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [exactMode, setExactModeState] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [result, setResult] = useState<JobResult | null>(null)
  const emAndamento = useRef(false)

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
    // Guarda SÍNCRONA. Usar o estado `running` não fecharia a corrida: estado só
    // atualiza no próximo render, então dois eventos no mesmo tique leriam `false`
    // nos dois. O ref muda na hora.
    //
    // Isto não compete com a guarda do processo principal: aquela é a autoridade
    // sobre "existe job rodando"; esta só impede o hook de se invocar duas vezes e
    // deixar a recusa rápida do main sobrescrever o estado do job verdadeiro.
    if (!outputDir || emAndamento.current) return
    emAndamento.current = true
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
      emAndamento.current = false
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
