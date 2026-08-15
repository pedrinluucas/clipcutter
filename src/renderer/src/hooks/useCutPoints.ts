import { useCallback, useMemo, useState } from 'react'
import type { CutPoint } from '@shared/types'
import {
  addPoint,
  generateTimesByDuration,
  movePoint,
  pointsFromTimes,
  removePoint,
  segmentsFrom,
} from '@shared/cutPoints'

const makeId = (): string => crypto.randomUUID()

export function useCutPoints(duration: number) {
  const [points, setPoints] = useState<CutPoint[]>([])

  const segments = useMemo(() => segmentsFrom(points, duration), [points, duration])

  const generate = useCallback(
    (chunk: number) => setPoints(pointsFromTimes(generateTimesByDuration(chunk, duration), makeId)),
    [duration],
  )

  const addAt = useCallback(
    (time: number) => setPoints((p) => addPoint(p, time, duration, makeId())),
    [duration],
  )

  const move = useCallback(
    (id: string, time: number) => setPoints((p) => movePoint(p, id, time, duration)),
    [duration],
  )

  const remove = useCallback((id: string) => setPoints((p) => removePoint(p, id)), [])

  const clear = useCallback(() => setPoints([]), [])

  return { points, segments, generate, addAt, move, remove, clear }
}

export type CutPointsState = ReturnType<typeof useCutPoints>
