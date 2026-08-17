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

/**
 * Durações prontas para os limites de rede social.
 *
 * Os valores são 29,9 e 59,9 — não 30 e 60 — de propósito. Verificado com a
 * própria plataforma em 15/08/2026: o Facebook Stories diz "up to 30 seconds" e
 * RECUSA um arquivo de 30,000s exatos com "Video is too long"; o mesmo vídeo a
 * 29,9s passa inteiro. "Até N" ali significa MENOS que N.
 *
 * A margem também cobre uma armadilha independente da plataforma: num vídeo de
 * 29,97fps, pedir 30,000s produz 30,03s, porque o quadro 900 começa em 29,9967 —
 * antes do corte — e entra.
 *
 * O rótulo mostra o VALOR e não o nome da rede: um botão escrito "30s" que
 * preenche o campo com 29,9 pareceria bug, e nome de plataforma envelhece
 * (Stories, Reels, Shorts mudam de nome e de limite; o número não). O porquê vai
 * no tooltip.
 */
const PRESETS = [
  { valor: 29.9, para: 'Stories, Shorts — limite de 30s, com margem' },
  { valor: 59.9, para: 'Reels, TikTok — limite de 60s, com margem' },
]

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
        <div className="flex flex-col gap-1">
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

          {/*
            Ficam embaixo do campo, e não na linha do slider: aquela linha já tem
            input, slider e três botões, e a 1100px de largura mínima mais dois
            competiriam por espaço. Aqui ficam no mesmo grupo visual do controle
            que alteram.
          */}
          <div className="flex gap-1">
            {PRESETS.map((preset) => {
              const cabe = preset.valor <= video.duration
              const ativo = Math.abs(chunk - preset.valor) < 0.001
              return (
                <button
                  key={preset.valor}
                  onClick={() => onChunkChange(preset.valor)}
                  disabled={!cabe}
                  title={
                    cabe
                      ? preset.para
                      : `O vídeo tem ${formatTime(video.duration)} — mais curto que ${preset.valor}s`
                  }
                  className={`rounded px-2 py-1 font-mono text-xs transition-colors duration-150 ${
                    ativo
                      ? 'bg-[#4361ee] text-white'
                      : 'bg-[#252547] text-[#e7e7f0]/70 hover:text-white'
                  } disabled:opacity-30 disabled:hover:text-[#e7e7f0]/70`}
                >
                  {String(preset.valor).replace('.', ',')}s
                </button>
              )
            })}
          </div>
        </div>

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
