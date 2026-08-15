import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { formatTime } from '@shared/time'
import type { VideoInfo } from '@shared/types'
import type { Player } from '../hooks/usePlayer'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function PlayerControls({
  video,
  player,
}: {
  video: VideoInfo
  player: Player
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-[#1a1a2e] px-4 py-3">
      <button onClick={() => player.nudge(-5)} title="Voltar 5s (←)" className="text-[#e7e7f0]/70 hover:text-white">
        <SkipBack size={18} />
      </button>

      <button
        onClick={player.toggle}
        title="Play/Pause (Espaço)"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4361ee] text-white transition-colors duration-150 hover:bg-[#4361ee]/80"
      >
        {player.playing ? <Pause size={18} /> : <Play size={18} />}
      </button>

      <button onClick={() => player.nudge(5)} title="Avançar 5s (→)" className="text-[#e7e7f0]/70 hover:text-white">
        <SkipForward size={18} />
      </button>

      <span className="font-mono text-sm">
        {formatTime(player.currentTime)}
        <span className="text-[#e7e7f0]/40"> / {formatTime(video.duration)}</span>
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Volume2 size={16} className="text-[#e7e7f0]/50" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={player.volume}
          onChange={(e) => player.setVolume(Number(e.target.value))}
          className="w-24 accent-[#4361ee]"
        />
      </div>

      <select
        value={player.rate}
        onChange={(e) => player.setRate(Number(e.target.value))}
        className="rounded bg-[#252547] px-2 py-1 text-sm"
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>
    </div>
  )
}
