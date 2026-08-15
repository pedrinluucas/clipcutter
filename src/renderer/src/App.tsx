import { useEffect, useState } from 'react'
import type { FfmpegCheck, VideoInfo } from '@shared/types'
import { WelcomeScreen } from './components/WelcomeScreen'
import { FileInfo } from './components/FileInfo'
import { FfmpegMissing } from './components/FfmpegMissing'
import { usePlayer } from './hooks/usePlayer'
import { VideoPlayer } from './components/VideoPlayer'
import { PlayerControls } from './components/PlayerControls'

// Componente separado para que os hooks do player só rodem quando já existe vídeo carregado.
function Editor({ video }: { video: VideoInfo }): React.JSX.Element {
  const player = usePlayer(video)

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
      }

      const action = actions[e.key.toLowerCase()] ?? actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-4 p-4">
      <div className="flex min-h-0 flex-col gap-3">
        <VideoPlayer video={video} player={player} />
        <PlayerControls video={video} player={player} />
      </div>
      <FileInfo video={video} />
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

  return <Editor video={video} />
}
