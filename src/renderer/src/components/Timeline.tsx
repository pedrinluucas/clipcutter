import { useRef, useState } from 'react'
import type { CutPoint, VideoInfo } from '@shared/types'
import { formatTime } from '@shared/time'

type Props = {
  video: VideoInfo
  points: CutPoint[]
  currentTime: number
  onSeek: (time: number) => void
  onMovePoint: (id: string, time: number) => void
  onRemovePoint: (id: string) => void
}

const TICK_TARGET_PX = 90

function tickStep(duration: number, widthPx: number): number {
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800]
  const wanted = (duration * TICK_TARGET_PX) / Math.max(widthPx, 1)
  return candidates.find((c) => c >= wanted) ?? 3600
}

export function Timeline({
  video,
  points,
  currentTime,
  onSeek,
  onMovePoint,
  onRemovePoint,
}: Props): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const timeFromEvent = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    const ratio = (clientX - rect.left) / rect.width
    return Math.min(Math.max(ratio, 0), 1) * video.duration
  }

  const percent = (time: number): string => `${(time / video.duration) * 100}%`

  const width = trackRef.current?.getBoundingClientRect().width ?? 800
  const step = tickStep(video.duration, width)
  const ticks: number[] = []
  for (let t = 0; t < video.duration; t += step) ticks.push(t)

  return (
    <div
      className="select-none rounded-lg bg-[#1a1a2e] p-4"
      onPointerMove={(e) => {
        if (dragging) onMovePoint(dragging, timeFromEvent(e.clientX))
      }}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
    >
      <div className="relative mb-1 h-4 font-mono text-[10px] text-[#e7e7f0]/40">
        {ticks.map((t) => (
          <span key={t} style={{ left: percent(t) }} className="absolute -translate-x-1/2">
            {formatTime(t)}
          </span>
        ))}
      </div>

      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSeek(timeFromEvent(e.clientX))
        }}
        className="relative h-16 cursor-pointer rounded bg-[#252547]"
      >
        {ticks.map((t) => (
          <div
            key={t}
            style={{ left: percent(t) }}
            className="pointer-events-none absolute top-0 h-2 w-px bg-[#e7e7f0]/20"
          />
        ))}

        {points.map((point) => (
          <div
            key={point.id}
            style={{ left: percent(point.time) }}
            onPointerDown={(e) => {
              e.stopPropagation()
              // Captura o ponteiro: sem isto, arrastar o marcador para além da borda do
              // contêiner dispara `pointerleave` e o marcador congela no meio do gesto. E
              // como o movePoint limita a [0.05, duração-0.05], arrastar até a borda é o
              // uso normal, não o caso extremo.
              e.currentTarget.setPointerCapture(e.pointerId)
              setDragging(point.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              onRemovePoint(point.id)
            }}
            title={`${formatTime(point.time)} — arraste para mover, botão direito para remover`}
            className="absolute top-0 h-full w-px cursor-ew-resize bg-[#ff6b35]"
          >
            <div className="absolute -left-1.5 -top-1 h-3 w-3 rounded-sm bg-[#ff6b35]" />
          </div>
        ))}

        <div
          style={{ left: percent(currentTime) }}
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-white"
        >
          <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rotate-45 bg-white" />
        </div>
      </div>
    </div>
  )
}
