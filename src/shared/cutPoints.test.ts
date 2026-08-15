import { describe, it, expect } from 'vitest'
import {
  MIN_GAP,
  clampTime,
  generateTimesByDuration,
  pointsFromTimes,
  generatePoints,
  addPoint,
  movePoint,
  dragPoint,
  removePoint,
  segmentsFrom,
} from './cutPoints'
import type { CutPoint } from './types'

const makeIdGen = () => {
  let n = 0
  return () => `id${++n}`
}

const pts = (...times: number[]): CutPoint[] =>
  times.map((time, i) => ({ id: `id${i + 1}`, time }))

describe('clampTime', () => {
  it('mantém um tempo válido', () => {
    expect(clampTime(30, 100)).toBe(30)
  })

  it('não deixa passar da borda inicial', () => {
    expect(clampTime(0, 100)).toBe(MIN_GAP)
    expect(clampTime(-10, 100)).toBe(MIN_GAP)
  })

  it('não deixa passar da borda final', () => {
    expect(clampTime(100, 100)).toBe(99.95)
    expect(clampTime(999, 100)).toBe(99.95)
  })

  it('arredonda para milissegundos', () => {
    expect(clampTime(30.00049, 100)).toBe(30)
  })
})

describe('generateTimesByDuration', () => {
  it('gera os pontos internos a cada X segundos', () => {
    expect(generateTimesByDuration(29.5, 100)).toEqual([29.5, 59, 88.5])
  })

  it('não gera ponto colado no fim do vídeo', () => {
    // 29.5 entra; 59 cairia exatamente no fim e criaria parte vazia
    expect(generateTimesByDuration(29.5, 59)).toEqual([29.5])
  })

  it('devolve lista vazia quando a duração pedida cobre o vídeo inteiro', () => {
    expect(generateTimesByDuration(120, 100)).toEqual([])
    expect(generateTimesByDuration(100, 100)).toEqual([])
  })

  it('devolve lista vazia para entradas inválidas', () => {
    expect(generateTimesByDuration(0, 100)).toEqual([])
    expect(generateTimesByDuration(-5, 100)).toEqual([])
    expect(generateTimesByDuration(0.01, 100)).toEqual([])
    expect(generateTimesByDuration(29.5, 0)).toEqual([])
  })

  it('não acumula erro de ponto flutuante', () => {
    expect(generateTimesByDuration(0.1, 1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
  })
})

describe('pointsFromTimes', () => {
  it('transforma tempos em pontos com id', () => {
    expect(pointsFromTimes([10, 20], makeIdGen())).toEqual([
      { id: 'id1', time: 10 },
      { id: 'id2', time: 20 },
    ])
  })
})

describe('generatePoints', () => {
  it('gera normalmente quando não havia pontos antes', () => {
    const result = generatePoints(29.5, 100, [], makeIdGen())
    expect(result.map((p) => p.time)).toEqual([29.5, 59, 88.5])
  })

  it('substitui a lista quando o resultado novo não é vazio, mesmo com pontos antigos', () => {
    const previous = pts(10)
    const result = generatePoints(29.5, 100, previous, makeIdGen())
    expect(result.map((p) => p.time)).toEqual([29.5, 59, 88.5])
  })

  it('recusa substituir marcadores existentes por uma lista vazia', () => {
    // 120s de duração pedida numa timeline de 100s não gera ponto nenhum. Sem a
    // guarda, isto apagaria em silêncio os marcadores que o usuário já tinha
    // colocado na mão só porque ele mexeu no campo de duração.
    const previous = pts(10, 30)
    const result = generatePoints(120, 100, previous, makeIdGen())
    expect(result).toBe(previous)
  })

  it('permite lista vazia quando já não havia pontos — "uma parte só" é resultado legítimo', () => {
    const result = generatePoints(120, 100, [], makeIdGen())
    expect(result).toEqual([])
  })
})

describe('addPoint', () => {
  it('insere mantendo a ordem', () => {
    const result = addPoint(pts(10, 30), 20, 100, 'novo')
    expect(result.map((p) => p.time)).toEqual([10, 20, 30])
  })

  it('ignora ponto colado em outro existente', () => {
    const before = pts(10)
    const after = addPoint(before, 10.02, 100, 'novo')
    expect(after).toBe(before)
  })

  it('aceita ponto a exatamente MIN_GAP de distância', () => {
    expect(addPoint(pts(10), 10.05, 100, 'novo')).toHaveLength(2)
  })

  it('aceita ponto a exatamente MIN_GAP mesmo com erro de ponto flutuante', () => {
    // 59.05 - 59 dá 0.04999999999999716 em ponto flutuante cru
    expect(addPoint(pts(59), 59.05, 100, 'novo')).toHaveLength(2)
  })

  it('limita o ponto às bordas do vídeo', () => {
    expect(addPoint([], 999, 100, 'novo')[0].time).toBe(99.95)
    expect(addPoint([], 0, 100, 'novo')[0].time).toBe(0.05)
  })
})

describe('movePoint', () => {
  it('move e reordena', () => {
    const result = movePoint(pts(10, 30, 50), 'id1', 40, 100)
    expect(result.map((p) => p.time)).toEqual([30, 40, 50])
    expect(result.find((p) => p.id === 'id1')!.time).toBe(40)
  })

  it('colapsa quando cai em cima de outro ponto', () => {
    const result = movePoint(pts(10, 30), 'id1', 30.01, 100)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('id1')
    expect(result[0].time).toBe(30.01)
  })

  it('limita às bordas do vídeo', () => {
    expect(movePoint(pts(10), 'id1', 999, 100)[0].time).toBe(99.95)
  })

  it('ignora id inexistente', () => {
    expect(movePoint(pts(10), 'fantasma', 50, 100).map((p) => p.time)).toEqual([10])
  })

  it('não colapsa vizinho a exatamente MIN_GAP com erro de ponto flutuante', () => {
    const result = movePoint(pts(59, 80), 'id2', 59.05, 100)
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.time)).toEqual([59, 59.05])
  })
})

describe('dragPoint', () => {
  it('move livremente quando há espaço de sobra', () => {
    const result = dragPoint(pts(10, 30, 50), 'id2', 35, 100)
    expect(result.find((p) => p.id === 'id2')!.time).toBe(35)
  })

  it('não deixa cruzar o vizinho da direita, mesmo pedindo além dele', () => {
    // pts(10, 30, 50): arrastar id1 (10) até 45 tentaria passar por cima de id2 (30).
    // Sem a trava, isto colapsaria id1 em cima de id2 NO MEIO do gesto.
    const result = dragPoint(pts(10, 30, 50), 'id1', 45, 100)
    expect(result.map((p) => p.time)).toEqual([29.95, 30, 50])
    expect(result.find((p) => p.id === 'id1')!.time).toBe(29.95)
  })

  it('não deixa cruzar o vizinho da esquerda', () => {
    const result = dragPoint(pts(10, 30, 50), 'id2', 5, 100)
    expect(result.find((p) => p.id === 'id2')!.time).toBe(10.05)
  })

  it('nunca colapsa nem reordena — a lista sai do mesmo tamanho e na mesma ordem', () => {
    const before = pts(10, 30, 50)
    const result = dragPoint(before, 'id1', 999, 100)
    expect(result).toHaveLength(3)
    expect(result.map((p) => p.id)).toEqual(['id1', 'id2', 'id3'])
  })

  it('sem vizinho à esquerda, limita à borda inicial do vídeo', () => {
    const result = dragPoint(pts(30, 50), 'id1', -10, 100)
    expect(result.find((p) => p.id === 'id1')!.time).toBe(MIN_GAP)
  })

  it('sem vizinho à direita, limita à borda final do vídeo', () => {
    const result = dragPoint(pts(30, 50), 'id2', 999, 100)
    expect(result.find((p) => p.id === 'id2')!.time).toBe(99.95)
  })

  it('ignora id inexistente', () => {
    const before = pts(10, 30)
    expect(dragPoint(before, 'fantasma', 50, 100)).toBe(before)
  })
})

describe('removePoint', () => {
  it('remove pelo id', () => {
    expect(removePoint(pts(10, 30), 'id1').map((p) => p.time)).toEqual([30])
  })

  it('ignora id inexistente', () => {
    expect(removePoint(pts(10), 'fantasma')).toHaveLength(1)
  })
})

describe('segmentsFrom', () => {
  it('sem pontos, o vídeo inteiro é uma parte só', () => {
    expect(segmentsFrom([], 100)).toEqual([{ index: 0, start: 0, end: 100 }])
  })

  it('N pontos viram N+1 partes', () => {
    expect(segmentsFrom(pts(29.5, 59), 100)).toEqual([
      { index: 0, start: 0, end: 29.5 },
      { index: 1, start: 29.5, end: 59 },
      { index: 2, start: 59, end: 100 },
    ])
  })

  it('ordena os pontos antes de derivar', () => {
    expect(segmentsFrom(pts(59, 29.5), 100).map((s) => s.start)).toEqual([0, 29.5, 59])
  })

  it('devolve vazio para duração inválida', () => {
    expect(segmentsFrom(pts(10), 0)).toEqual([])
  })

  it('a última parte pode ser menor que as outras', () => {
    const segments = segmentsFrom(pts(29.5, 59, 88.5), 100)
    expect(segments).toHaveLength(4)
    expect(segments[3].end - segments[3].start).toBeCloseTo(11.5, 3)
  })
})
