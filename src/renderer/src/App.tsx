import { useEffect, useState } from 'react'
import type { FfmpegCheck, VideoInfo } from '@shared/types'
import { WelcomeScreen } from './components/WelcomeScreen'
import { FileInfo } from './components/FileInfo'
import { FfmpegMissing } from './components/FfmpegMissing'

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
    <div className="grid h-full grid-cols-[1fr_320px] gap-4 p-4">
      <div className="rounded-lg bg-[#1a1a2e] p-4">
        <p className="text-sm text-[#e7e7f0]/50">Player entra na próxima etapa</p>
      </div>
      <FileInfo video={video} />
    </div>
  )
}
