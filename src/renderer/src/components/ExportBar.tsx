import { FolderOpen, Download, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ExportState } from '../hooks/useExport'

export function ExportBar({
  exp,
  partCount,
}: {
  exp: ExportState
  partCount: number
}): React.JSX.Element {
  const pct = Math.round((exp.progress?.overallFraction ?? 0) * 100)
  const segPct = Math.round((exp.progress?.segmentFraction ?? 0) * 100)

  return (
    <div className="rounded-lg bg-[#1a1a2e] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={exp.chooseDir}
          className="flex items-center gap-2 rounded bg-[#252547] px-3 py-2 text-sm transition-colors duration-150 hover:bg-[#252547]/70"
        >
          <FolderOpen size={16} /> Escolher pasta
        </button>

        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-[#e7e7f0]/50"
          title={exp.outputDir ?? ''}
        >
          {exp.outputDir ?? 'nenhuma pasta escolhida'}
        </span>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={exp.exactMode}
            onChange={(e) => exp.setExactMode(e.target.checked)}
            className="accent-[#4361ee]"
          />
          Corte exato
          <span className="text-xs text-[#e7e7f0]/40">
            {exp.exactMode ? '(recodifica, mais lento)' : '(cópia rápida, cai no ponto-chave)'}
          </span>
        </label>

        {exp.running ? (
          <button
            onClick={exp.cancel}
            className="flex items-center gap-2 rounded bg-[#ef476f] px-4 py-2 font-medium transition-colors duration-150 hover:bg-[#ef476f]/80"
          >
            <X size={16} /> Cancelar
          </button>
        ) : (
          <button
            onClick={exp.start}
            disabled={!exp.outputDir}
            className="flex items-center gap-2 rounded bg-[#06d6a0] px-4 py-2 font-medium text-[#0f0f1a] transition-colors duration-150 hover:bg-[#06d6a0]/80 disabled:opacity-30"
          >
            <Download size={16} /> Exportar {partCount} {partCount === 1 ? 'parte' : 'partes'}
          </button>
        )}
      </div>

      {exp.running && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded bg-[#252547]" title="Progresso geral">
            <div
              className="h-full bg-[#4361ee] transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Barra mais fina: progresso DENTRO da parte atual. A de cima é a fila
              inteira; sem esta, "progresso por parte e geral" (spec §7) só metade
              existia — o dado já era calculado e enviado (jobs.ts), só não tinha
              onde aparecer. */}
          <div className="mt-1 h-1 overflow-hidden rounded bg-[#252547]" title="Progresso da parte atual">
            <div
              className="h-full bg-[#06d6a0] transition-[width] duration-150"
              style={{ width: `${segPct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-[#e7e7f0]/60">
            {pct}% · parte {(exp.progress?.segmentIndex ?? 0) + 1} de{' '}
            {exp.progress?.totalSegments ?? partCount} · {exp.progress?.currentFile}
          </p>
        </div>
      )}

      {exp.result?.status === 'done' && (
        <div className="mt-3 flex items-center gap-3 text-sm text-[#06d6a0]">
          <CheckCircle2 size={18} />
          {exp.result.files.length} arquivos gerados.
          <button onClick={exp.openFolder} className="underline hover:text-white">
            Abrir pasta
          </button>
        </div>
      )}

      {exp.result?.status === 'cancelled' && (
        <p className="mt-3 text-sm text-[#e7e7f0]/60">
          Cancelado. {exp.result.files.length} partes já concluídas foram mantidas.
        </p>
      )}

      {exp.result?.status === 'error' && (
        <div className="mt-3 flex items-start gap-3 text-sm text-[#ef476f]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p>Falhou na parte {exp.result.failedIndex + 1}.</p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs opacity-80">
              {exp.result.message}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
