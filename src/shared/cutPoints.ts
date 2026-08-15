import type { CutPoint, Segment } from './types'

export const MIN_GAP = 0.05

const round3 = (n: number): number => Math.round(n * 1000) / 1000

const tooClose = (a: number, b: number): boolean => round3(Math.abs(a - b)) < MIN_GAP

export function clampTime(time: number, duration: number): number {
  const lo = MIN_GAP
  const hi = round3(duration - MIN_GAP)
  if (!Number.isFinite(time)) return lo
  if (hi < lo) return lo
  return round3(Math.min(Math.max(time, lo), hi))
}

export function generateTimesByDuration(chunk: number, duration: number): number[] {
  if (!(chunk >= MIN_GAP) || !(duration > 0)) return []
  const limit = round3(duration - MIN_GAP)
  const times: number[] = []
  for (let i = 1; ; i++) {
    const time = round3(chunk * i)
    if (time >= limit) break
    times.push(time)
  }
  return times
}

export function pointsFromTimes(times: number[], makeId: () => string): CutPoint[] {
  return times.map((time) => ({ id: makeId(), time }))
}

// Gerar zero pontos é um resultado legítimo por si só (spec §5 abençoa "uma parte
// só"). O que não é legítimo é usar isso pra apagar em silêncio marcadores que o
// usuário já colocou na mão: se o cálculo por duração não produz nada E já existem
// pontos, mantém a lista atual em vez de substituir por vazio.
export function generatePoints(
  chunk: number,
  duration: number,
  previous: CutPoint[],
  makeId: () => string,
): CutPoint[] {
  const next = pointsFromTimes(generateTimesByDuration(chunk, duration), makeId)
  if (next.length === 0 && previous.length > 0) return previous
  return next
}

const byTime = (a: CutPoint, b: CutPoint): number => a.time - b.time

export function addPoint(
  points: CutPoint[],
  time: number,
  duration: number,
  id: string,
): CutPoint[] {
  const target = clampTime(time, duration)
  if (points.some((p) => tooClose(p.time, target))) return points
  return [...points, { id, time: target }].sort(byTime)
}

export function movePoint(
  points: CutPoint[],
  id: string,
  time: number,
  duration: number,
): CutPoint[] {
  if (!points.some((p) => p.id === id)) return points
  const target = clampTime(time, duration)
  return points
    .filter((p) => p.id === id || !tooClose(p.time, target))
    .map((p) => (p.id === id ? { ...p, time: target } : p))
    .sort(byTime)
}

export function removePoint(points: CutPoint[], id: string): CutPoint[] {
  return points.filter((p) => p.id !== id)
}

// Reposiciona SEM colapsar e SEM reordenar — usado quadro a quadro durante um
// arrasto. `movePoint` colapsa qualquer ponto a menos de MIN_GAP do alvo, o que é
// certo para o gesto CONCLUÍDO (soltar em cima de outro deve fundir os dois), mas
// destrutivo demais para cada evento de ponteiro no caminho: numa faixa de 10s a
// zona de colapso tem ~9px, e arrastar um marcador cruzando três outros apagaria
// os três sem aviso. Por isso o ponto fica travado a MIN_GAP do vizinho mais
// próximo em vez de engolir a lista inteira — o valor bruto do ponteiro (sem esse
// travamento) continua disponível pra quem quiser aplicar o `movePoint` de verdade
// ao soltar o botão.
export function dragPoint(
  points: CutPoint[],
  id: string,
  time: number,
  duration: number,
): CutPoint[] {
  const index = points.findIndex((p) => p.id === id)
  if (index === -1) return points

  const prev = index > 0 ? points[index - 1] : undefined
  const next = index < points.length - 1 ? points[index + 1] : undefined
  const lo = prev ? round3(prev.time + MIN_GAP) : MIN_GAP
  const hi = next ? round3(next.time - MIN_GAP) : round3(Math.max(duration - MIN_GAP, lo))
  const wanted = Number.isFinite(time) ? time : lo
  const bounded = round3(Math.min(Math.max(wanted, lo), Math.max(lo, hi)))

  return points.map((p) => (p.id === id ? { ...p, time: bounded } : p))
}

export function segmentsFrom(points: CutPoint[], duration: number): Segment[] {
  if (!(duration > 0)) return []
  const times = points.map((p) => p.time).sort((a, b) => a - b)
  const bounds = [0, ...times, round3(duration)]
  const segments: Segment[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    segments.push({ index: i, start: bounds[i], end: bounds[i + 1] })
  }
  return segments
}
