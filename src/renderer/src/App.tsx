import { useEffect, useRef, useState } from 'react'
import type { FfmpegCheck, VideoInfo } from '@shared/types'
import { WelcomeScreen } from './components/WelcomeScreen'
import { FileInfo } from './components/FileInfo'
import { FfmpegMissing } from './components/FfmpegMissing'
import { usePlayer } from './hooks/usePlayer'
import { useCutPoints } from './hooks/useCutPoints'
import { useExport } from './hooks/useExport'
import { VideoPlayer } from './components/VideoPlayer'
import { PlayerControls } from './components/PlayerControls'
import { Timeline } from './components/Timeline'
import { CutPanel } from './components/CutPanel'
import { ExportBar } from './components/ExportBar'

// Componente separado para que os hooks do player só rodem quando já existe vídeo carregado.
function Editor({ video, onReset }: { video: VideoInfo; onReset: () => void }): React.JSX.Element {
  const player = usePlayer(video)
  const cuts = useCutPoints(video.duration)
  const exp = useExport(video, cuts.segments)
  const [chunk, setChunk] = useState(30)
  const saveChunkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.clip.getPrefs().then((p) =>
      // A duração vem da sessão anterior e pode ser maior que este vídeo. Sem o
      // limite, o slider trava no máximo e o campo numérico não — os dois passam a
      // discordar na tela — e "Gerar cortes" gera zero pontos, substituindo por
      // vazio os marcadores que o usuário já tinha colocado na mão.
      setChunk(Math.min(Math.max(p.chunkDuration, 1), Math.max(video.duration, 1))),
    )
  }, [video.duration])

  // Some ao desmontar (troca de vídeo) para não gravar preferência de uma sessão
  // que já não existe mais.
  useEffect(() => {
    return () => {
      if (saveChunkTimer.current) clearTimeout(saveChunkTimer.current)
    }
  }, [])

  const changeChunk = (value: number): void => {
    // `Number('')` é 0, `Number('-')` é NaN. Sem esta guarda, esvaziar o campo ou
    // digitar um sinal solto grava um `chunkDuration` inválido — e como `min`/`max`
    // do <input type="number"> não travam o que foi DIGITADO (só o que o
    // clique-arrasto das setinhas produz), um valor acima da duração do vídeo
    // também passaria direto. Os dois casos fazem `generateTimesByDuration`
    // devolver `[]`, e sem a guarda irmã em `useCutPoints.generate` isso apagaria
    // os marcadores manuais em silêncio.
    if (!Number.isFinite(value)) return
    const clamped = Math.min(Math.max(value, 1), Math.max(video.duration, 1))
    setChunk(clamped)

    // Debounce: o slider dispara `onChange` a cada pixel arrastado, e gravar no
    // disco (electron-store) em cada tique é síncrono e caro — num vídeo de 1h,
    // milhares de escritas por arrasto. O valor exibido (`chunk`) atualiza na
    // hora; só a persistência espera o usuário parar de mexer.
    if (saveChunkTimer.current) clearTimeout(saveChunkTimer.current)
    saveChunkTimer.current = setTimeout(() => {
      void window.clip.setPrefs({ chunkDuration: clamped })
    }, 300)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return

      const actions: Record<string, () => void> = {
        ' ': player.toggle,
        k: player.toggle,
        ArrowLeft: () => player.nudge(-5),
        ArrowRight: () => player.nudge(5),
        j: () => player.nudge(-10),
        l: () => player.nudge(10),
        ',': () => player.stepFrame(-1),
        '.': () => player.stepFrame(1),
        s: () => cuts.addAt(player.currentTime),
      }

      const action = actions[e.key.toLowerCase()] ?? actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player, cuts])

  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-4 p-4">
      <div className="flex min-h-0 flex-col gap-3">
        <VideoPlayer video={video} player={player} />
        <PlayerControls video={video} player={player} />
        <Timeline
          video={video}
          points={cuts.points}
          currentTime={player.currentTime}
          onSeek={player.seek}
          onDragPoint={cuts.drag}
          onMovePoint={cuts.move}
          onRemovePoint={cuts.remove}
        />
        <CutPanel
          video={video}
          cuts={cuts}
          chunk={chunk}
          onChunkChange={changeChunk}
          currentTime={player.currentTime}
        />
        <ExportBar exp={exp} partCount={cuts.segments.length} />
      </div>
      <FileInfo video={video} onReset={onReset} />
    </div>
  )
}

export default function App(): React.JSX.Element {
  const [check, setCheck] = useState<FfmpegCheck | null>(null)
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.clip.checkFfmpeg().then(setCheck)
  }, [])

  const load = async (loader: () => Promise<VideoInfo | null>): Promise<void> => {
    setError(null)
    try {
      const info = await loader()
      if (info) setVideo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (check === null) return <div className="p-8 text-sm text-[#e7e7f0]/50">Carregando…</div>
  if (!check.ok) return <FfmpegMissing message={check.message} />

  if (!video) {
    return (
      <WelcomeScreen
        error={error}
        onPick={() => load(() => window.clip.openVideoDialog())}
        onDropFile={(path) => load(() => window.clip.probeVideo(path))}
      />
    )
  }

  return (
    <Editor
      video={video}
      onReset={() => {
        // Desmontar o Editor (via video === null) é o reset certo: limpa pontos de
        // corte, estado do player e estado de exportação juntos, de uma vez —
        // tentar zerar cada hook individualmente arriscaria esquecer um.
        setVideo(null)
        setError(null)
      }}
    />
  )
}
