import type { VideoInfo } from '@shared/types'
import type { Player } from '../hooks/usePlayer'

type Props = { video: VideoInfo; player: Player }

export function VideoPlayer({ video, player }: Props): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-black">
      <video
        ref={player.videoRef}
        src={window.clip.fileUrl(video.path)}
        className="max-h-full max-w-full"
        onClick={player.toggle}
        onEnded={() => player.seek(video.duration)}
      />
    </div>
  )
}
