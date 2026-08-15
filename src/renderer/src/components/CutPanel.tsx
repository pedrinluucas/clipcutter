import { Scissors, Trash2, Wand2 } from 'lucide-react'
import { formatTime } from '@shared/time'
import type { VideoInfo } from '@shared/types'
import type { CutPointsState } from '../hooks/useCutPoints'

type Props = {
  video: VideoInfo
  cuts: CutPointsState
  chunk: number
  onChunkChange: (value: number) => void
  currentTime: number
}

export function CutPanel({
  video,
  cuts,
  chunk,
  onChunkChange,
  currentTime,
}: Props): React.JSX.Element {
  const last = cuts.segments[cuts.segments.length - 1]
  const lastDuration = last ? last.end - last.start : 0
  const shorter = cuts.segments.length > 1 && lastDuration < chunk - 0.05

  return (
    <div className="rounded-lg bg-[#1a1a2e] p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#e7e7f0]/50">Duração de cada parte (s)</span>
          <input
            type="number"
            min={1}
            max={Math.max(video.duration, 1)}
            step={0.1}
            value={chunk}
            onChange={(e) => onChunkChange(Number(e.target.value))}
            className="w-28 rounded bg-[#252547] px-3 py-2 font-mono"
          />
        </label>

        <input
          type="range"
          min={1}
          max={Math.max(video.duration, 1)}
          step={0.1}
          value={chunk}
          onChange={(e) => onChunkChange(Number(e.target.value))}
          className="min-w-40 flex-1 accent-[#4361ee]"
        />

        <button
          onClick={() => cuts.generate(chunk)}
          className="flex items-center gap-2 rounded bg-[#4361ee] px-4 py-2 font-medium transition-colors duration-150 hover:bg-[#4361ee]/80"
        >
          <Wand2 size={16} /> Gerar cortes
        </button>

        <button
          onClick={() => cuts.addAt(currentTime)}
          title="Marcar corte na posição atual (S)"
          className="flex items-center gap-2 rounded bg-[#252547] px-4 py-2 transition-colors duration-150 hover:bg-[#252547]/70"
        >
          <Scissors size={16} /> Cortar aqui
        </button>

        <button
          onClick={cuts.clear}
          disabled={cuts.points.length === 0}
          className="flex items-center gap-2 rounded px-3 py-2 text-[#e7e7f0]/60 transition-colors duration-150 hover:text-[#ef476f] disabled:opacity-30"
        >
          <Trash2 size={16} /> Limpar
        </button>
      </div>

      <p className="mt-3 font-mono text-sm">
        <span className="text-[#06d6a0]">
          {cuts.segments.length} {cuts.segments.length === 1 ? 'parte' : 'partes'}
        </span>
        {last && (
          <>
            <span className="text-[#e7e7f0]/40"> · última com </span>
            <span className={shorter ? 'text-[#ff6b35]' : ''}>{formatTime(lastDuration)}</span>
          </>
        )}
      </p>
    </div>
  )
}
