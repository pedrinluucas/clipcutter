import type { VideoInfo } from '@shared/types'
import { formatTime } from '@shared/time'
import { formatSize } from '../lib/formatSize'

const Row = ({ label, value }: { label: string; value: string }): React.JSX.Element => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-[#e7e7f0]/50">{label}</span>
    <span className="font-mono">{value}</span>
  </div>
)

export function FileInfo({ video }: { video: VideoInfo }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-[#1a1a2e] p-4">
      <p className="mb-3 truncate font-medium" title={video.fileName}>
        {video.fileName}
      </p>
      <Row label="Duração" value={formatTime(video.duration)} />
      <Row label="Resolução" value={`${video.width}×${video.height}`} />
      <Row label="FPS" value={String(video.fps)} />
      <Row label="Vídeo" value={video.videoCodec} />
      <Row label="Áudio" value={video.audioCodec ?? 'sem áudio'} />
      <Row label="Tamanho" value={formatSize(video.sizeBytes)} />
      {video.bitrate !== null && (
        <Row label="Bitrate" value={`${Math.round(video.bitrate / 1000)} kbps`} />
      )}
    </div>
  )
}
