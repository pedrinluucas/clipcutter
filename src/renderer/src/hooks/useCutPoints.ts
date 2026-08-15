import { useCallback, useMemo, useState } from 'react'
import type { CutPoint } from '@shared/types'
import {
  addPoint,
  dragPoint,
  generatePoints,
  movePoint,
  removePoint,
  segmentsFrom,
} from '@shared/cutPoints'

const makeId = (): string => crypto.randomUUID()

export function useCutPoints(duration: number) {
  const [points, setPoints] = useState<CutPoint[]>([])

  const segments = useMemo(() => segmentsFrom(points, duration), [points, duration])

  const generate = useCallback(
    (chunk: number) => setPoints((p) => generatePoints(chunk, duration, p, makeId)),
    [duration],
  )

  const addAt = useCallback(
    (time: number) => setPoints((p) => addPoint(p, time, duration, makeId())),
    [duration],
  )

  // Chamado a cada evento de ponteiro durante o arrasto: reposiciona sem colapsar
  // nem reordenar (ver comentário do `dragPoint`). `move` continua sendo o gesto
  // CONCLUÍDO — chamado uma vez, no pointerup — que reordena e colapsa de verdade.
  const drag = useCallback(
    (id: string, time: number) => setPoints((p) => dragPoint(p, id, time, duration)),
    [duration],
  )

  const move = useCallback(
    (id: string, time: number) => setPoints((p) => movePoint(p, id, time, duration)),
    [duration],
  )

  const remove = useCallback((id: string) => setPoints((p) => removePoint(p, id)), [])

  const clear = useCallback(() => setPoints([]), [])

  return { points, segments, generate, addAt, drag, move, remove, clear }
}

export type CutPointsState = ReturnType<typeof useCutPoints>
