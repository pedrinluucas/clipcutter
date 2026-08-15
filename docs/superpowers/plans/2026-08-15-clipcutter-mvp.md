# ClipCutter MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App desktop que carrega um vídeo, deixa marcar pontos de corte (gerados por duração ou marcados à mão) e exporta cada trecho como arquivo separado.

**Architecture:** Electron com dois processos. O renderer (React) só desenha e manda pedidos; todo acesso a disco e ao FFmpeg vive no main, atrás de uma ponte tipada no `preload`. A lógica de negócio (pontos de corte, tempo, nomes, argumentos de FFmpeg, leitura de progresso) mora em módulos puros testados com Vitest — nenhum deles importa Electron ou React.

**Tech Stack:** Electron · React 19 · TypeScript · Tailwind CSS v4 · Vite (via `electron-vite`) · Vitest · electron-store · Lucide React · FFmpeg/FFprobe do PATH do sistema

**Spec:** `docs/superpowers/specs/2026-08-15-clipcutter-mvp-design.md`

## Global Constraints

- **Plataforma alvo:** Windows. Nada de empacotamento (`electron-builder`) neste plano — o app roda por `npm start`.
- **FFmpeg vem do PATH do sistema.** Não instalar `ffmpeg-static` nem embutir binário.
- **`MIN_GAP = 0.05`** segundos: distância mínima entre dois pontos de corte, e também a margem mínima das bordas do vídeo.
- **Tempos são `number` em segundos decimais**, arredondados a 3 casas (milissegundos). Nunca strings.
- **Nomes de saída:** `<baseName>_parte_NN<ext>`, largura da numeração = `max(2, dígitos do total)`. Colisão vira ` (2)`, ` (3)`… Nunca sobrescrever em silêncio.
- **Extensão de saída:** `.mp4` no modo `exact`; extensão original do arquivo no modo `fast`.
- **Renderer nunca importa `node:*`, `electron` ou `child_process`.** Só `window.clip`, exposto pelo preload.
- **Cores (Tailwind):** fundo `#0f0f1a`, painéis `#1a1a2e`, cards `#252547`, destaque `#4361ee`, sucesso `#06d6a0`, marcadores `#ff6b35`, erro `#ef476f`.
- **Idioma da UI:** português do Brasil.
- **Commits:** um por task, em português, prefixo `feat:` / `test:` / `chore:`.

**Desvio consciente do spec:** o spec desenhou a árvore como `electron/` + `src/`. Este plano usa a convenção do `electron-vite` (`src/main`, `src/preload`, `src/renderer`, mais `src/shared` para o código puro compartilhado entre os dois processos). Mesmos módulos, mesmas responsabilidades — só a pasta muda, e seguir o template evita brigar com a configuração de build.

**Sobre testes de UI:** as tasks 11–15 (React) não têm teste automatizado. Toda a lógica que pode dar errado foi empurrada para os módulos puros das tasks 2–9, que têm cobertura completa. Os componentes ficam sendo casca fina, e cada task de UI termina com um roteiro de verificação manual explícito. Adicionar jsdom + Testing Library para testar `<div>`s renderizando não pagaria o próprio custo neste MVP.

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `.gitignore`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/styles.css`

**Interfaces:**
- Consumes: nada
- Produces: `npm start` abre a janela; `npm test` roda o Vitest

- [ ] **Step 1: Criar o projeto com o template do electron-vite**

Rodar na raiz `SAAS/clipcutter` (a pasta já existe e já é um repo git com o spec commitado):

```bash
npm create @quick-start/electron@latest . -- --template react-ts
```

Responder: sobrescrever a pasta atual **não** (o `.git` e `docs/` devem sobreviver — se a ferramenta insistir, gerar em `tmp-scaffold/` e mover o conteúdo pra raiz, preservando `.git` e `docs/`).

- [ ] **Step 2: Instalar as dependências do projeto**

```bash
npm install
npm install electron-store lucide-react
npm install -D tailwindcss @tailwindcss/vite vitest
```

- [ ] **Step 3: Ligar o Tailwind v4 no renderer**

Em `electron.vite.config.ts`, adicionar o plugin no bloco `renderer`:

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
```

Substituir todo o conteúdo de `src/renderer/src/styles.css` (ou `assets/main.css`, conforme o template gerar) por:

```css
@import "tailwindcss";

@theme {
  --color-base: #0f0f1a;
  --color-panel: #1a1a2e;
  --color-card: #252547;
  --color-accent: #4361ee;
  --color-ok: #06d6a0;
  --color-marker: #ff6b35;
  --color-bad: #ef476f;
}

html, body, #root { height: 100%; }
body { background: var(--color-base); color: #e7e7f0; font-family: Inter, system-ui, sans-serif; }
```

- [ ] **Step 4: Configurar a janela**

Substituir a criação da janela em `src/main/index.ts` pelos valores do spec (o resto do arquivo gerado pelo template continua igual):

```ts
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 820,
  minWidth: 1100,
  minHeight: 750,
  show: false,
  backgroundColor: '#0f0f1a',
  autoHideMenuBar: true,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

Em `tsconfig.web.json`, registrar os mesmos aliases para o TypeScript enxergar (o Vite resolve em runtime, mas o editor e o `tsc` precisam da declaração):

```json
"compilerOptions": {
  "baseUrl": ".",
  "paths": {
    "@renderer/*": ["src/renderer/src/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```

E em `tsconfig.web.json`, garantir que `src/shared` está no `include`:

```json
"include": ["src/renderer/src/**/*", "src/shared/**/*", "src/preload/*.d.ts"]
```

- [ ] **Step 5: Configurar o Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
  },
  resolve: {
    alias: { '@shared': resolve('src/shared') },
  },
})
```

Adicionar os scripts em `package.json` (mantendo os que o template criou):

```json
"scripts": {
  "start": "electron-vite dev",
  "dev": "electron-vite dev",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: Verificar que a janela abre**

Run: `npm start`
Expected: janela de 1280×820 com fundo escuro `#0f0f1a` e a tela padrão do template. Fechar a janela.

- [ ] **Step 7: Verificar que o Vitest roda**

Run: `npm test`
Expected: `No test files found` — sem erro de configuração. Isso confirma que o Vitest está instalado e configurado antes de existir qualquer teste.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold do projeto com electron-vite, tailwind e vitest"
```

---

### Task 2: Tipos compartilhados e formatação de tempo

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/time.ts`
- Test: `src/shared/time.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `CutPoint`, `Segment`, `VideoInfo`, `CutMode`, `ExportRequest`, `JobProgress`, `JobResult` — usados por todas as tasks seguintes
  - `formatTime(seconds: number): string` → `"mm:ss.mmm"`
  - `parseTime(text: string): number | null`

- [ ] **Step 1: Criar os tipos compartilhados**

Criar `src/shared/types.ts`:

```ts
export type CutPoint = { id: string; time: number }

export type Segment = { index: number; start: number; end: number }

export type CutMode = 'exact' | 'fast'

export type VideoInfo = {
  path: string
  fileName: string
  baseName: string
  extension: string
  sizeBytes: number
  duration: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string | null
  bitrate: number | null
}

export type ExportRequest = {
  inputPath: string
  outputDir: string
  baseName: string
  extension: string
  segments: Segment[]
  mode: CutMode
}

export type JobProgress = {
  segmentIndex: number
  totalSegments: number
  segmentFraction: number
  overallFraction: number
  currentFile: string
}

export type JobResult =
  | { status: 'done'; files: string[] }
  | { status: 'cancelled'; files: string[] }
  | { status: 'error'; files: string[]; message: string; failedIndex: number }

export type FfmpegCheck =
  | { ok: true; ffmpeg: string; ffprobe: string }
  | { ok: false; message: string }

export type Prefs = {
  outputDir: string | null
  exactMode: boolean
  chunkDuration: number
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/shared/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatTime, parseTime } from './time'

describe('formatTime', () => {
  it('formata zero', () => {
    expect(formatTime(0)).toBe('00:00.000')
  })

  it('formata minutos, segundos e milissegundos', () => {
    expect(formatTime(90.5)).toBe('01:30.500')
  })

  it('deixa os minutos passarem de 59 em vez de virar hora', () => {
    expect(formatTime(3600)).toBe('60:00.000')
  })

  it('arredonda para o milissegundo mais próximo', () => {
    expect(formatTime(1.9999)).toBe('00:02.000')
  })

  it('trata negativo e NaN como zero', () => {
    expect(formatTime(-5)).toBe('00:00.000')
    expect(formatTime(NaN)).toBe('00:00.000')
  })
})

describe('parseTime', () => {
  it('lê o formato completo', () => {
    expect(parseTime('01:30.500')).toBe(90.5)
  })

  it('aceita milissegundos abreviados', () => {
    expect(parseTime('01:30.5')).toBe(90.5)
  })

  it('aceita sem a parte decimal', () => {
    expect(parseTime('60:00')).toBe(3600)
  })

  it('devolve null para texto inválido', () => {
    expect(parseTime('abc')).toBeNull()
    expect(parseTime('')).toBeNull()
  })

  it('devolve null para segundos acima de 59', () => {
    expect(parseTime('01:75')).toBeNull()
  })

  it('é a volta de formatTime', () => {
    expect(parseTime(formatTime(123.456))).toBeCloseTo(123.456, 3)
  })
})
```

- [ ] **Step 3: Rodar o teste para confirmar que falha**

Run: `npm test -- time`
Expected: FAIL — `Failed to resolve import "./time"`

- [ ] **Step 4: Implementar**

Criar `src/shared/time.ts`:

```ts
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const totalMs = Math.round(safe * 1000)
  const ms = totalMs % 1000
  const totalSec = (totalMs - ms) / 1000
  const sec = totalSec % 60
  const min = (totalSec - sec) / 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export function parseTime(text: string): number | null {
  const match = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(text.trim())
  if (!match) return null
  const min = Number(match[1])
  const sec = Number(match[2])
  const ms = match[3] ? Number(match[3].padEnd(3, '0')) : 0
  return Math.round((min * 60 + sec + ms / 1000) * 1000) / 1000
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `npm test -- time`
Expected: PASS — 11 testes

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/time.ts src/shared/time.test.ts
git commit -m "feat: tipos compartilhados e formatacao de tempo"
```

---

### Task 3: Pontos de corte — o coração do app

**Files:**
- Create: `src/shared/cutPoints.ts`
- Test: `src/shared/cutPoints.test.ts`

**Interfaces:**
- Consumes: `CutPoint`, `Segment` da Task 2
- Produces:
  - `MIN_GAP: 0.05`
  - `clampTime(time: number, duration: number): number`
  - `generateTimesByDuration(chunk: number, duration: number): number[]`
  - `pointsFromTimes(times: number[], makeId: () => string): CutPoint[]`
  - `addPoint(points: CutPoint[], time: number, duration: number, id: string): CutPoint[]`
  - `movePoint(points: CutPoint[], id: string, time: number, duration: number): CutPoint[]`
  - `removePoint(points: CutPoint[], id: string): CutPoint[]`
  - `segmentsFrom(points: CutPoint[], duration: number): Segment[]`

Este é o módulo que unifica os dois modos de corte. Toda função é pura: recebe a lista, devolve uma lista nova. A geração de `id` entra por injeção (`makeId`) justamente pra que o teste possa usar ids previsíveis.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/shared/cutPoints.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  MIN_GAP,
  clampTime,
  generateTimesByDuration,
  pointsFromTimes,
  addPoint,
  movePoint,
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
    // 59.05 - 59 dá 0.04999999999999716 em ponto flutuante cru. O caso 10.05
    // acima cai do lado seguro por acaso e não protege contra isso.
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

  it('não colapsa vizinho a exatamente MIN_GAP com erro de ponto flutuante', () => {
    const result = movePoint(pts(59, 80), 'id2', 59.05, 100)
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.time)).toEqual([59, 59.05])
  })

  it('ignora id inexistente', () => {
    expect(movePoint(pts(10), 'fantasma', 50, 100).map((p) => p.time)).toEqual([10])
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- cutPoints`
Expected: FAIL — `Failed to resolve import "./cutPoints"`

- [ ] **Step 3: Implementar**

Criar `src/shared/cutPoints.ts`:

```ts
import type { CutPoint, Segment } from './types'

export const MIN_GAP = 0.05

const round3 = (n: number): number => Math.round(n * 1000) / 1000

// A diferença é arredondada ANTES de comparar. Sem isso, `59.05 - 59` dá
// 0.04999999999999716 em ponto flutuante e um ponto exatamente a MIN_GAP de
// distância seria rejeitado por engano — em 48% dos valores de uma varredura
// de 0 a 1000s, incluindo 59 e 88.5, que é o que gerar cortes a cada 29.5s
// produz.
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
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- cutPoints`
Expected: PASS — 27 testes

- [ ] **Step 5: Commit**

```bash
git add src/shared/cutPoints.ts src/shared/cutPoints.test.ts
git commit -m "feat: pontos de corte com geracao por duracao e edicao manual"
```

---

### Task 4: Nomes dos arquivos de saída

**Files:**
- Create: `src/shared/naming.ts`
- Test: `src/shared/naming.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `partFileName(baseName: string, index: number, total: number, extension: string): string` — `index` é 0-based
  - `uniqueFileName(fileName: string, exists: (name: string) => boolean): string`
  - `outputExtension(mode: CutMode, originalExtension: string): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/shared/naming.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { partFileName, uniqueFileName, outputExtension } from './naming'

describe('partFileName', () => {
  it('numera a partir de 1 com dois dígitos', () => {
    expect(partFileName('aula', 0, 6, '.mp4')).toBe('aula_parte_01.mp4')
    expect(partFileName('aula', 5, 6, '.mp4')).toBe('aula_parte_06.mp4')
  })

  it('cresce a numeração quando há mais de 99 partes', () => {
    expect(partFileName('aula', 0, 120, '.mp4')).toBe('aula_parte_001.mp4')
    expect(partFileName('aula', 119, 120, '.mp4')).toBe('aula_parte_120.mp4')
  })

  it('mantém dois dígitos mesmo com poucas partes', () => {
    expect(partFileName('aula', 0, 2, '.mp4')).toBe('aula_parte_01.mp4')
  })

  it('respeita a extensão pedida', () => {
    expect(partFileName('aula', 0, 3, '.mkv')).toBe('aula_parte_01.mkv')
  })

  it('preserva pontos e espaços no nome original', () => {
    expect(partFileName('live 12.03 final', 0, 3, '.mp4')).toBe('live 12.03 final_parte_01.mp4')
  })
})

describe('uniqueFileName', () => {
  it('devolve o nome original quando não há colisão', () => {
    expect(uniqueFileName('a_parte_01.mp4', () => false)).toBe('a_parte_01.mp4')
  })

  it('adiciona sufixo numérico na colisão', () => {
    const taken = new Set(['a_parte_01.mp4'])
    expect(uniqueFileName('a_parte_01.mp4', (n) => taken.has(n))).toBe('a_parte_01 (2).mp4')
  })

  it('continua incrementando enquanto houver colisão', () => {
    const taken = new Set(['a.mp4', 'a (2).mp4', 'a (3).mp4'])
    expect(uniqueFileName('a.mp4', (n) => taken.has(n))).toBe('a (4).mp4')
  })

  it('não confunde ponto do meio do nome com extensão', () => {
    const taken = new Set(['live 12.03.mp4'])
    expect(uniqueFileName('live 12.03.mp4', (n) => taken.has(n))).toBe('live 12.03 (2).mp4')
  })
})

describe('outputExtension', () => {
  it('força mp4 no modo exato', () => {
    expect(outputExtension('exact', '.mkv')).toBe('.mp4')
  })

  it('mantém a extensão original no modo rápido', () => {
    expect(outputExtension('fast', '.mkv')).toBe('.mkv')
  })

  it('cai para mp4 quando não há extensão original', () => {
    expect(outputExtension('fast', '')).toBe('.mp4')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- naming`
Expected: FAIL — `Failed to resolve import "./naming"`

- [ ] **Step 3: Implementar**

Criar `src/shared/naming.ts`:

```ts
import type { CutMode } from './types'

export function partFileName(
  baseName: string,
  index: number,
  total: number,
  extension: string,
): string {
  const width = Math.max(2, String(total).length)
  const number = String(index + 1).padStart(width, '0')
  return `${baseName}_parte_${number}${extension}`
}

export function uniqueFileName(fileName: string, exists: (name: string) => boolean): string {
  if (!exists(fileName)) return fileName
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!exists(candidate)) return candidate
  }
}

export function outputExtension(mode: CutMode, originalExtension: string): string {
  if (mode === 'exact') return '.mp4'
  return originalExtension || '.mp4'
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- naming`
Expected: PASS — 12 testes

- [ ] **Step 5: Commit**

```bash
git add src/shared/naming.ts src/shared/naming.test.ts
git commit -m "feat: nomenclatura dos arquivos de saida com resolucao de colisao"
```

---

### Task 5: Argumentos do FFmpeg

**Files:**
- Create: `src/main/ffmpeg/args.ts`
- Test: `src/main/ffmpeg/args.test.ts`

**Interfaces:**
- Consumes: `CutMode` da Task 2
- Produces: `buildCutArgs(options: CutArgsOptions): string[]` e o tipo `CutArgsOptions`

Testar a montagem do comando sem rodar o FFmpeg é o que dá confiança barata: um `-ss` no lugar errado é o bug mais caro do projeto e aqui ele custa um teste de string.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/main/ffmpeg/args.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCutArgs } from './args'

const base = { inputPath: 'C:\\v\\in.mp4', outputPath: 'C:\\out\\p1.mp4', start: 29.5, duration: 30 }

describe('buildCutArgs', () => {
  it('coloca -ss ANTES de -i (seek rápido)', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
  })

  it('formata os tempos com 3 casas decimais', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args[args.indexOf('-ss') + 1]).toBe('29.500')
    expect(args[args.indexOf('-t') + 1]).toBe('30.000')
  })

  it('modo rápido copia o stream sem recodificar', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args).toContain('-c')
    expect(args[args.indexOf('-c') + 1]).toBe('copy')
    expect(args).toContain('-avoid_negative_ts')
    expect(args).not.toContain('libx264')
  })

  it('modo exato recodifica em H.264/AAC', () => {
    const args = buildCutArgs({ ...base, mode: 'exact' })
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264')
    expect(args[args.indexOf('-crf') + 1]).toBe('20')
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac')
    expect(args).not.toContain('copy')
  })

  it('sempre pede progresso em formato legível por máquina', () => {
    for (const mode of ['fast', 'exact'] as const) {
      const args = buildCutArgs({ ...base, mode })
      expect(args).toContain('-progress')
      expect(args[args.indexOf('-progress') + 1]).toBe('pipe:1')
      expect(args).toContain('-nostats')
    }
  })

  it('o caminho de saída é sempre o último argumento', () => {
    for (const mode of ['fast', 'exact'] as const) {
      const args = buildCutArgs({ ...base, mode })
      expect(args[args.length - 1]).toBe('C:\\out\\p1.mp4')
    }
  })

  it('passa os caminhos crus, sem aspas', () => {
    const args = buildCutArgs({ ...base, mode: 'fast' })
    expect(args[args.indexOf('-i') + 1]).toBe('C:\\v\\in.mp4')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- args`
Expected: FAIL — `Failed to resolve import "./args"`

- [ ] **Step 3: Implementar**

Criar `src/main/ffmpeg/args.ts`:

```ts
import type { CutMode } from '../../shared/types'

export type CutArgsOptions = {
  inputPath: string
  outputPath: string
  start: number
  duration: number
  mode: CutMode
}

export function buildCutArgs(options: CutArgsOptions): string[] {
  const head = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostats',
    '-progress',
    'pipe:1',
    '-ss',
    options.start.toFixed(3),
    '-i',
    options.inputPath,
    '-t',
    options.duration.toFixed(3),
  ]

  const codec =
    options.mode === 'fast'
      ? ['-c', 'copy', '-avoid_negative_ts', 'make_zero']
      : [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '20',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
        ]

  return [...head, ...codec, '-y', options.outputPath]
}
```

O `-y` é seguro aqui porque o nome de saída já passou por `uniqueFileName` antes de chegar: o arquivo nunca existe. Ele serve para o caso de retentativa depois de um cancelamento que deixou um arquivo parcial.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- args`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add src/main/ffmpeg/args.ts src/main/ffmpeg/args.test.ts
git commit -m "feat: montagem dos argumentos de corte do ffmpeg"
```

---

### Task 6: Leitor de progresso do FFmpeg

**Files:**
- Create: `src/main/ffmpeg/progress.ts`
- Test: `src/main/ffmpeg/progress.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `createProgressReader(): ProgressReader` com `push(chunk: string): number | null` — devolve o último tempo de saída visto, em segundos, ou `null` se o pedaço não trouxe nenhum

O FFmpeg escreve em blocos `chave=valor`, e o stdout chega picado em pedaços arbitrários — uma linha pode ser cortada no meio. Por isso o leitor guarda o resto num buffer em vez de tratar cada pedaço isoladamente.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/main/ffmpeg/progress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProgressReader } from './progress'

describe('createProgressReader', () => {
  it('lê out_time_us e converte para segundos', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=5000000\nprogress=continue\n')).toBe(5)
  })

  it('devolve null quando o pedaço não tem tempo', () => {
    const reader = createProgressReader()
    expect(reader.push('frame=10\nfps=25\n')).toBeNull()
  })

  it('devolve o ÚLTIMO tempo quando o pedaço tem vários blocos', () => {
    const reader = createProgressReader()
    const chunk = 'out_time_us=1000000\nprogress=continue\nout_time_us=2000000\nprogress=continue\n'
    expect(reader.push(chunk)).toBe(2)
  })

  it('remonta linha cortada entre dois pedaços', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_')).toBeNull()
    expect(reader.push('us=3000000\n')).toBe(3)
  })

  it('ignora N/A que o ffmpeg emite no começo', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=N/A\n')).toBeNull()
  })

  it('ignora valores negativos', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=-42\n')).toBeNull()
  })

  it('ignora linha sem quebra no fim até ela fechar', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=7000000')).toBeNull()
    expect(reader.push('\n')).toBe(7)
  })

  it('lida com quebra de linha do Windows', () => {
    const reader = createProgressReader()
    expect(reader.push('out_time_us=9000000\r\n')).toBe(9)
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- progress`
Expected: FAIL — `Failed to resolve import "./progress"`

- [ ] **Step 3: Implementar**

Criar `src/main/ffmpeg/progress.ts`:

```ts
export type ProgressReader = {
  push(chunk: string): number | null
}

export function createProgressReader(): ProgressReader {
  let buffer = ''

  return {
    push(chunk: string): number | null {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let latest: number | null = null
      for (const line of lines) {
        const match = /^out_time_us=(-?\d+)$/.exec(line.trim())
        if (!match) continue
        const microseconds = Number(match[1])
        if (microseconds >= 0) latest = microseconds / 1_000_000
      }
      return latest
    },
  }
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- progress`
Expected: PASS — 8 testes

- [ ] **Step 5: Commit**

```bash
git add src/main/ffmpeg/progress.ts src/main/ffmpeg/progress.test.ts
git commit -m "feat: leitor de progresso do ffmpeg tolerante a linha cortada"
```

---

### Task 7: Localizar o FFmpeg e ler os metadados do vídeo

**Files:**
- Create: `src/main/ffmpeg/locate.ts`
- Create: `src/main/ffmpeg/probe.ts`
- Test: `src/main/ffmpeg/probe.test.ts`
- Test: `src/main/ffmpeg/locate.integration.test.ts`

**Interfaces:**
- Consumes: `VideoInfo`, `FfmpegCheck` da Task 2
- Produces:
  - `locateBinaries(): Promise<FfmpegCheck>`
  - `parseFps(rate: string | undefined): number`
  - `parseProbeOutput(raw: unknown, filePath: string): VideoInfo`
  - `probeVideo(ffprobePath: string, filePath: string): Promise<VideoInfo>`

- [ ] **Step 1: Escrever o teste do parser**

Criar `src/main/ffmpeg/probe.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseFps, parseProbeOutput } from './probe'

const sample = {
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      r_frame_rate: '30000/1001',
    },
    { codec_type: 'audio', codec_name: 'aac' },
  ],
  format: { duration: '125.400000', size: '52428800', bit_rate: '3345000' },
}

describe('parseFps', () => {
  it('resolve a fração NTSC', () => {
    expect(parseFps('30000/1001')).toBe(29.97)
  })

  it('resolve fração inteira', () => {
    expect(parseFps('30/1')).toBe(30)
  })

  it('devolve 0 para entrada ausente ou zerada', () => {
    expect(parseFps(undefined)).toBe(0)
    expect(parseFps('0/0')).toBe(0)
  })
})

describe('parseProbeOutput', () => {
  it('extrai os metadados do vídeo', () => {
    const info = parseProbeOutput(sample, 'C:\\videos\\aula final.mp4')
    expect(info.duration).toBe(125.4)
    expect(info.width).toBe(1920)
    expect(info.height).toBe(1080)
    expect(info.fps).toBe(29.97)
    expect(info.videoCodec).toBe('h264')
    expect(info.audioCodec).toBe('aac')
    expect(info.sizeBytes).toBe(52428800)
    expect(info.bitrate).toBe(3345000)
  })

  it('quebra o caminho em nome, base e extensão', () => {
    const info = parseProbeOutput(sample, 'C:\\videos\\aula final.mp4')
    expect(info.path).toBe('C:\\videos\\aula final.mp4')
    expect(info.fileName).toBe('aula final.mp4')
    expect(info.baseName).toBe('aula final')
    expect(info.extension).toBe('.mp4')
  })

  it('aceita vídeo sem faixa de áudio', () => {
    const mudo = { ...sample, streams: [sample.streams[0]] }
    expect(parseProbeOutput(mudo, 'C:\\v\\a.mp4').audioCodec).toBeNull()
  })

  it('recusa arquivo sem faixa de vídeo', () => {
    const audio = { ...sample, streams: [sample.streams[1]] }
    expect(() => parseProbeOutput(audio, 'C:\\v\\a.mp3')).toThrow(/faixa de vídeo/)
  })

  it('recusa duração ilegível', () => {
    const quebrado = { ...sample, format: { ...sample.format, duration: 'N/A' } }
    expect(() => parseProbeOutput(quebrado, 'C:\\v\\a.mp4')).toThrow(/duração/)
  })

  it('aceita bitrate ausente', () => {
    const semBitrate = { ...sample, format: { duration: '10', size: '100' } }
    expect(parseProbeOutput(semBitrate, 'C:\\v\\a.mp4').bitrate).toBeNull()
  })

  it('ignora capa embutida e usa o fluxo de vídeo real', () => {
    const comCapa = {
      ...sample,
      streams: [
        {
          codec_type: 'video',
          codec_name: 'mjpeg',
          width: 300,
          height: 169,
          r_frame_rate: '90000/1',
          disposition: { attached_pic: 1 },
        },
        ...sample.streams,
      ],
    }
    const info = parseProbeOutput(comCapa, 'C:\\videos\\baixado.mp4')
    expect(info.videoCodec).toBe('h264')
    expect(info.width).toBe(1920)
    expect(info.fps).toBe(29.97)
  })

  it('recusa arquivo cujo único fluxo de vídeo é capa embutida', () => {
    const soCapa = {
      ...sample,
      streams: [
        {
          codec_type: 'video',
          codec_name: 'png',
          width: 300,
          height: 300,
          disposition: { attached_pic: 1 },
        },
        sample.streams[1],
      ],
    }
    expect(() => parseProbeOutput(soCapa, 'C:\\musica\\faixa.mp3')).toThrow(/faixa de vídeo/)
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- probe`
Expected: FAIL — `Failed to resolve import "./probe"`

- [ ] **Step 3: Implementar o localizador**

Criar `src/main/ffmpeg/locate.ts`:

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FfmpegCheck } from '../../shared/types'

const run = promisify(execFile)

async function isAvailable(binary: string): Promise<boolean> {
  try {
    await run(binary, ['-version'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function locateBinaries(): Promise<FfmpegCheck> {
  const [hasFfmpeg, hasFfprobe] = await Promise.all([
    isAvailable('ffmpeg'),
    isAvailable('ffprobe'),
  ])

  if (hasFfmpeg && hasFfprobe) {
    return { ok: true, ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' }
  }

  const faltando = [!hasFfmpeg && 'ffmpeg', !hasFfprobe && 'ffprobe']
    .filter(Boolean)
    .join(' e ')

  return {
    ok: false,
    message: `Não encontrei ${faltando} no PATH do sistema. Instale com:\n\nwinget install ffmpeg\n\nDepois feche e abra o terminal de novo.`,
  }
}
```

- [ ] **Step 4: Implementar o leitor de metadados**

Criar `src/main/ffmpeg/probe.ts`:

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, extname } from 'node:path'
import type { VideoInfo } from '../../shared/types'

const run = promisify(execFile)

type ProbeStream = {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  disposition?: { attached_pic?: number }
}

type ProbeOutput = {
  streams?: ProbeStream[]
  format?: { duration?: string; size?: string; bit_rate?: string }
}

export function parseFps(rate: string | undefined): number {
  if (!rate) return 0
  const [num, den] = rate.split('/').map(Number)
  if (!Number.isFinite(num)) return 0
  if (!den) return Number.isFinite(num) ? num : 0
  return Math.round((num / den) * 100) / 100
}

export function parseProbeOutput(raw: unknown, filePath: string): VideoInfo {
  const data = raw as ProbeOutput
  const streams = data.streams ?? []

  // `attached_pic` é capa embutida — o ffprobe reporta como fluxo de vídeo, e a
  // ordem depende do muxer. Sem esse filtro, um arquivo de `yt-dlp
  // --embed-thumbnail` faria a ficha mostrar a resolução e o FPS da miniatura.
  // Sem fallback de propósito: se o único fluxo de vídeo for capa (MP3 com capa),
  // o arquivo realmente não tem vídeo e deve ser recusado.
  const video = streams.find(
    (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1,
  )
  if (!video) throw new Error('O arquivo não tem faixa de vídeo.')

  const audio = streams.find((s) => s.codec_type === 'audio')

  const duration = Number(data.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Não foi possível ler a duração do vídeo.')
  }

  const extension = extname(filePath)
  const fileName = basename(filePath)
  const bitrate = Number(data.format?.bit_rate)

  return {
    path: filePath,
    fileName,
    baseName: basename(filePath, extension),
    extension,
    sizeBytes: Number(data.format?.size) || 0,
    duration: Math.round(duration * 1000) / 1000,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: parseFps(video.r_frame_rate),
    videoCodec: video.codec_name ?? 'desconhecido',
    audioCodec: audio?.codec_name ?? null,
    bitrate: Number.isFinite(bitrate) && bitrate > 0 ? bitrate : null,
  }
}

export async function probeVideo(ffprobePath: string, filePath: string): Promise<VideoInfo> {
  const { stdout } = await run(
    ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
  )
  return parseProbeOutput(JSON.parse(stdout), filePath)
}
```

`parseFps` arredonda para 2 casas — `29.97`, não `29.97003`. É o número que a UI mostra e o que o passo quadro a quadro usa.

- [ ] **Step 5: Escrever o teste de integração do localizador**

Criar `src/main/ffmpeg/locate.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { locateBinaries } from './locate'

describe('locateBinaries (integração — exige ffmpeg instalado)', () => {
  it('encontra ffmpeg e ffprobe no PATH', async () => {
    const result = await locateBinaries()
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 6: Rodar todos os testes**

Run: `npm test`
Expected: PASS — todos, incluindo os 11 de `probe` e o de integração do `locate`
(suíte total: 77)

- [ ] **Step 7: Commit**

```bash
git add src/main/ffmpeg/locate.ts src/main/ffmpeg/probe.ts src/main/ffmpeg/probe.test.ts src/main/ffmpeg/locate.integration.test.ts
git commit -m "feat: localizacao do ffmpeg e leitura de metadados via ffprobe"
```

---

### Task 8: Executar o FFmpeg com progresso e cancelamento

**Files:**
- Create: `src/main/ffmpeg/run.ts`
- Test: `src/main/ffmpeg/run.integration.test.ts`

**Interfaces:**
- Consumes: `createProgressReader` da Task 6
- Produces:
  - `runFfmpeg(ffmpegPath: string, args: string[], onProgress: (seconds: number) => void): FfmpegHandle`
  - `type FfmpegHandle = { promise: Promise<void>; cancel: () => void }`
  - `class FfmpegCancelled extends Error`

O teste de integração gera o próprio vídeo com o FFmpeg (`testsrc`), então não depende de nenhum arquivo externo e roda igual em qualquer máquina que tenha FFmpeg.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/main/ffmpeg/run.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runFfmpeg, FfmpegCancelled } from './run'
import { buildCutArgs } from './args'

const run = promisify(execFile)
let dir = ''
let source = ''
let heavy = ''

// Devolve a duração do arquivo, ou null se o ffprobe não conseguir lê-lo.
const duracaoOuNull = async (file: string): Promise<number | null> => {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-print_format', 'default=nw=1:nk=1', file,
    ])
    const valor = Number(stdout.trim())
    return Number.isFinite(valor) ? valor : null
  } catch {
    return null
  }
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clipcutter-'))
  source = join(dir, 'fonte.mp4')
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=10',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', '-y', source,
  ])

  // Fonte maior, só para o teste de cancelamento: o encode precisa durar o
  // suficiente para o cancelamento pegar o processo no meio.
  heavy = join(dir, 'pesado.mp4')
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-y', heavy,
  ])
}, 120_000)

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('runFfmpeg (integração — exige ffmpeg instalado)', () => {
  it('corta e reporta progresso crescente', async () => {
    const output = join(dir, 'saida.mp4')
    const tempos: number[] = []

    const handle = runFfmpeg(
      'ffmpeg',
      buildCutArgs({ inputPath: source, outputPath: output, start: 2, duration: 3, mode: 'exact' }),
      (s) => tempos.push(s),
    )
    await handle.promise

    expect((await stat(output)).size).toBeGreaterThan(0)
    expect(tempos.length).toBeGreaterThan(0)
    expect(tempos[tempos.length - 1]).toBeGreaterThan(0)
  })

  it('rejeita com a mensagem do ffmpeg quando o comando falha', async () => {
    const handle = runFfmpeg('ffmpeg', ['-i', join(dir, 'nao-existe.mp4'), join(dir, 'x.mp4')], () => {})
    await expect(handle.promise).rejects.toThrow()
  })

  it('cancela, mata o processo e deixa o arquivo incompleto', async () => {
    const output = join(dir, 'cancelado.mp4')
    const handle = runFfmpeg(
      'ffmpeg',
      buildCutArgs({ inputPath: heavy, outputPath: output, start: 0, duration: 30, mode: 'exact' }),
      () => {},
    )
    const iniciou = Date.now()
    setTimeout(() => handle.cancel(), 150)
    await expect(handle.promise).rejects.toBeInstanceOf(FfmpegCancelled)

    // Prova CATEGÓRICA de que o processo morreu no meio, e não medida de tempo.
    // O muxer de mp4 grava o índice (moov) só no fim do encode, e o taskkill é
    // encerramento forçado — então um processo morto nunca chega a gravar índice
    // e o ffprobe não consegue ler o arquivo. Se o taskkill falhasse, o encode
    // terminaria e o arquivo teria os 30s legíveis.
    //
    // Uma versão anterior deste teste media tempo decorrido (< 3000ms). Não tinha
    // dente: com o killTree quebrado de propósito, o encode natural terminava em
    // 889ms e o teste passava igual. Limite calibrado na velocidade de UMA máquina
    // não é evidência.
    const duracao = await duracaoOuNull(output)
    expect(duracao === null || duracao < 5).toBe(true)

    // Limite frouxo, só detector de travamento — não é a prova do cancelamento.
    expect(Date.now() - iniciou).toBeLessThan(10_000)
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- run.integration`
Expected: FAIL — `Failed to resolve import "./run"`

- [ ] **Step 3: Implementar**

Criar `src/main/ffmpeg/run.ts`:

```ts
import { spawn, execFile } from 'node:child_process'
import { createProgressReader } from './progress'

export class FfmpegCancelled extends Error {
  constructor() {
    super('Operação cancelada.')
    this.name = 'FfmpegCancelled'
  }
}

export type FfmpegHandle = {
  promise: Promise<void>
  cancel: () => void
}

const STDERR_LINES_KEPT = 12

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    // No Windows, matar só o processo do Node deixa o ffmpeg filho vivo
    // segurando o arquivo de saída aberto. /T mata a árvore, /F força.
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, (err) => {
      // Não rejeitamos aqui: o taskkill devolve erro benigno quando o processo já
      // morreu sozinho na corrida com o cancelamento. O log existe para o caso em
      // que ele falha de verdade e o processo sobrevive.
      if (err) console.error('taskkill falhou:', err.message)
    })
  } else {
    process.kill(-pid, 'SIGKILL')
  }
}

export function runFfmpeg(
  ffmpegPath: string,
  args: string[],
  onProgress: (seconds: number) => void,
): FfmpegHandle {
  const child = spawn(ffmpegPath, args, {
    windowsHide: true,
    detached: process.platform !== 'win32',
  })

  const reader = createProgressReader()
  const errors: string[] = []
  let cancelled = false

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    const seconds = reader.push(chunk)
    if (seconds !== null) onProgress(seconds)
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) errors.push(trimmed)
    }
    if (errors.length > STDERR_LINES_KEPT) errors.splice(0, errors.length - STDERR_LINES_KEPT)
  })

  const promise = new Promise<void>((resolve, reject) => {
    child.on('error', (err) =>
      reject(new Error(`Falha ao iniciar o FFmpeg: ${err.message}`)),
    )
    child.on('close', (code) => {
      if (cancelled) return reject(new FfmpegCancelled())
      if (code === 0) return resolve()
      const detail = errors.length > 0 ? errors.join('\n') : `código de saída ${code}`
      reject(new Error(`FFmpeg falhou:\n${detail}`))
    })
  })

  return {
    promise,
    cancel: () => {
      if (cancelled || child.pid === undefined) return
      cancelled = true
      killTree(child.pid)
    },
  }
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- run.integration`
Expected: PASS — 3 testes. O primeiro leva alguns segundos porque gera o vídeo de teste.

- [ ] **Step 5: Commit**

```bash
git add src/main/ffmpeg/run.ts src/main/ffmpeg/run.integration.test.ts
git commit -m "feat: execucao do ffmpeg com progresso e cancelamento de arvore no windows"
```

---

### Task 9: Fila de exportação

**Files:**
- Create: `src/main/jobs.ts`
- Test: `src/main/jobs.integration.test.ts`

**Interfaces:**
- Consumes: `buildCutArgs` (T5), `runFfmpeg`/`FfmpegCancelled` (T8), `partFileName`/`uniqueFileName` (T4), `ExportRequest`/`JobProgress`/`JobResult` (T2)
- Produces: `startExportJob(ffmpegPath: string, request: ExportRequest, onProgress: (p: JobProgress) => void): { promise: Promise<JobResult>; cancel: () => void }`

Uma parte de cada vez. Rodar vários FFmpegs em paralelo satura a CPU e cada um fica proporcionalmente mais lento — o total não melhora e o progresso fica impossível de reportar.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/main/jobs.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { startExportJob } from './jobs'
import type { ExportRequest, JobProgress } from '../shared/types'

const run = promisify(execFile)
let dir = ''
let outDir = ''
let source = ''

const durationOf = async (file: string): Promise<number> => {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-print_format', 'default=nw=1:nk=1', file,
  ])
  return Number(stdout.trim())
}

const request = (overrides: Partial<ExportRequest> = {}): ExportRequest => ({
  inputPath: source,
  outputDir: outDir,
  baseName: 'fonte',
  extension: '.mp4',
  segments: [
    { index: 0, start: 0, end: 3 },
    { index: 1, start: 3, end: 6 },
    { index: 2, start: 6, end: 10 },
  ],
  mode: 'exact',
  ...overrides,
})

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clipcutter-jobs-'))
  outDir = join(dir, 'saida')
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc=size=320x240:rate=30:duration=10',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-y', (source = join(dir, 'fonte.mp4'))])
}, 120_000)

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('startExportJob (integração — exige ffmpeg instalado)', () => {
  // Cada teste escreve na SUA pasta. Compartilhar uma pasta faz o segundo teste
  // colidir com os arquivos do primeiro, o `uniqueFileName` renomear para
  // `_01 (2).mp4` — corretamente — e a asserção de nome exato quebrar. O defeito
  // seria do teste, não do código.
  it('gera uma parte por segmento, com as durações certas', async () => {
    const dirPartes = join(dir, 'saida-partes')
    const job = startExportJob('ffmpeg', request({ outputDir: dirPartes }), () => {})
    const result = await job.promise

    expect(result.status).toBe('done')
    expect(result.files).toHaveLength(3)

    expect(await durationOf(result.files[0])).toBeCloseTo(3, 1)
    expect(await durationOf(result.files[2])).toBeCloseTo(4, 1)
  })

  it('nomeia as partes em ordem', async () => {
    const dirNomes = join(dir, 'saida-nomes')
    const job = startExportJob('ffmpeg', request({ outputDir: dirNomes }), () => {})
    await job.promise
    const files = (await readdir(dirNomes)).filter((f) => f.startsWith('fonte_parte_')).sort()
    expect(files.slice(0, 3)).toEqual([
      'fonte_parte_01.mp4',
      'fonte_parte_02.mp4',
      'fonte_parte_03.mp4',
    ])
  })

  it('nunca sobrescreve arquivo existente', async () => {
    const collisionDir = join(dir, 'colisao')
    const job1 = startExportJob('ffmpeg', request({ outputDir: collisionDir }), () => {})
    await job1.promise
    const job2 = startExportJob('ffmpeg', request({ outputDir: collisionDir }), () => {})
    const result = await job2.promise

    expect(result.files[0]).toContain('fonte_parte_01 (2).mp4')
  })

  it('reporta progresso geral crescente de 0 a 1', async () => {
    const seen: JobProgress[] = []
    const dirProgresso = join(dir, 'saida-progresso')
    const job = startExportJob('ffmpeg', request({ outputDir: dirProgresso }), (p) => seen.push(p))
    await job.promise

    expect(seen.length).toBeGreaterThan(0)
    const fractions = seen.map((p) => p.overallFraction)
    expect(Math.min(...fractions)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...fractions)).toBeLessThanOrEqual(1)
    expect(seen[seen.length - 1].totalSegments).toBe(3)
  })

  it('cancela no meio e devolve as partes já prontas', async () => {
    const cancelDir = join(dir, 'cancelado')
    const job = startExportJob('ffmpeg', request({ outputDir: cancelDir }), () => {})
    setTimeout(() => job.cancel(), 200)
    const result = await job.promise

    expect(result.status).toBe('cancelled')
    expect(result.files.length).toBeLessThan(3)
  })

  it('para a fila e devolve erro quando o ffmpeg falha', async () => {
    const job = startExportJob('ffmpeg', request({ inputPath: join(dir, 'fantasma.mp4') }), () => {})
    const result = await job.promise

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.failedIndex).toBe(0)
      expect(result.message).toContain('FFmpeg')
    }
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- jobs`
Expected: FAIL — `Failed to resolve import "./jobs"`

- [ ] **Step 3: Implementar**

Criar `src/main/jobs.ts`:

```ts
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildCutArgs } from './ffmpeg/args'
import { runFfmpeg, FfmpegCancelled, type FfmpegHandle } from './ffmpeg/run'
import { partFileName, uniqueFileName } from '../shared/naming'
import type { ExportRequest, JobProgress, JobResult } from '../shared/types'

export function startExportJob(
  ffmpegPath: string,
  request: ExportRequest,
  onProgress: (progress: JobProgress) => void,
): { promise: Promise<JobResult>; cancel: () => void } {
  const done: string[] = []
  let current: FfmpegHandle | null = null
  let cancelled = false

  const promise = (async (): Promise<JobResult> => {
    try {
      mkdirSync(request.outputDir, { recursive: true })
    } catch (error) {
      // Pasta apagada durante a sessão, drive removido, ou sem permissão de
      // escrita. Precisa virar JobResult, não exceção: a promise desta função
      // atravessa o IPC e uma rejeição deixaria a UI travada em "exportando".
      return {
        status: 'error',
        files: [],
        message: `Não consegui usar a pasta de saída:\n${
          error instanceof Error ? error.message : String(error)
        }`,
        failedIndex: 0,
      }
    }

    const total = request.segments.length

    for (const segment of request.segments) {
      if (cancelled) return { status: 'cancelled', files: done }

      const fileName = uniqueFileName(
        partFileName(request.baseName, segment.index, total, request.extension),
        (name) => existsSync(join(request.outputDir, name)),
      )
      const outputPath = join(request.outputDir, fileName)
      const duration = segment.end - segment.start

      onProgress({
        segmentIndex: segment.index,
        totalSegments: total,
        segmentFraction: 0,
        overallFraction: segment.index / total,
        currentFile: fileName,
      })

      const handle = runFfmpeg(
        ffmpegPath,
        buildCutArgs({
          inputPath: request.inputPath,
          outputPath,
          start: segment.start,
          duration,
          mode: request.mode,
        }),
        (seconds) => {
          const segmentFraction = duration > 0 ? Math.min(seconds / duration, 1) : 1
          onProgress({
            segmentIndex: segment.index,
            totalSegments: total,
            segmentFraction,
            overallFraction: (segment.index + segmentFraction) / total,
            currentFile: fileName,
          })
        },
      )
      current = handle

      try {
        await handle.promise
        done.push(outputPath)
      } catch (error) {
        try {
          rmSync(outputPath, { force: true })
        } catch (rmError) {
          // `force: true` só perdoa ENOENT. EBUSY/EPERM acontece no Windows
          // quando antivírus ou indexação ainda seguram o arquivo recém-escrito.
          // Não pode escapar: esta promise atravessa o IPC e uma rejeição
          // travaria a UI em "exportando". Sobrar um arquivo parcial em disco é
          // o mal menor.
          console.error('Não consegui apagar o arquivo parcial:', outputPath, rmError)
        }
        if (error instanceof FfmpegCancelled || cancelled) {
          return { status: 'cancelled', files: done }
        }
        return {
          status: 'error',
          files: done,
          message: error instanceof Error ? error.message : String(error),
          failedIndex: segment.index,
        }
      } finally {
        current = null
      }
    }

    onProgress({
      segmentIndex: total - 1,
      totalSegments: total,
      segmentFraction: 1,
      overallFraction: 1,
      currentFile: '',
    })

    return { status: 'done', files: done }
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      current?.cancel()
    },
  }
}
```

O arquivo parcial da parte interrompida é apagado (`rmSync`) — só as partes concluídas ficam. Isso vale tanto para cancelamento quanto para falha.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- jobs`
Expected: PASS — 6 testes

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os arquivos de teste

- [ ] **Step 6: Commit**

```bash
git add src/main/jobs.ts src/main/jobs.integration.test.ts
git commit -m "feat: fila de exportacao sequencial com progresso, cancelamento e erro"
```

---

### Task 10: A ponte — IPC, preload, protocolo `clip://` e preferências

**Files:**
- Create: `src/main/store.ts`
- Create: `src/main/protocol.ts`
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: tudo das tasks 2–9
- Produces: `window.clip` no renderer, com esta API exata:

```ts
type ClipApi = {
  checkFfmpeg(): Promise<FfmpegCheck>
  openVideoDialog(): Promise<VideoInfo | null>
  probeVideo(path: string): Promise<VideoInfo>
  chooseOutputDir(): Promise<string | null>
  startExport(request: ExportRequest): Promise<JobResult>
  cancelExport(): void
  onExportProgress(handler: (progress: JobProgress) => void): () => void
  openFolder(path: string): Promise<void>
  getPrefs(): Promise<Prefs>
  setPrefs(patch: Partial<Prefs>): Promise<Prefs>
  fileUrl(path: string): string
}
```

- [ ] **Step 1: Criar o armazenamento de preferências**

Criar `src/main/store.ts`:

```ts
import Store from 'electron-store'
import type { Prefs } from '../shared/types'

const store = new Store<Prefs>({
  defaults: {
    outputDir: null,
    exactMode: true,
    chunkDuration: 30,
  },
})

export function getPrefs(): Prefs {
  return {
    outputDir: store.get('outputDir'),
    exactMode: store.get('exactMode'),
    chunkDuration: store.get('chunkDuration'),
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  for (const [key, value] of Object.entries(patch)) {
    store.set(key as keyof Prefs, value as never)
  }
  return getPrefs()
}
```

Os defaults saem direto do spec §11: corte exato ligado, 30.0s, sem pasta escolhida.

- [ ] **Step 2: Registrar o protocolo `clip://`**

Criar `src/main/protocol.ts`:

```ts
import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'

export const CLIP_SCHEME = 'clip'

// Precisa rodar ANTES de app.whenReady()
export function registerClipScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CLIP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

// Precisa rodar DEPOIS de app.whenReady()
export function handleClipProtocol(): void {
  protocol.handle(CLIP_SCHEME, (request) => {
    const filePath = new URL(request.url).searchParams.get('p')
    if (!filePath) return new Response('caminho ausente', { status: 400 })
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

export function toClipUrl(filePath: string): string {
  return `${CLIP_SCHEME}://local/?p=${encodeURIComponent(filePath)}`
}
```

O caminho vai como parâmetro de busca, não como caminho da URL, justamente pra não brigar com `C:\` — a barra invertida e os dois pontos da letra do drive quebram o parser de URL. `net.fetch` sobre `file://` já responde a requisições *Range*, que é o que o `<video>` usa pra pular pra frente sem baixar tudo.

- [ ] **Step 3: Registrar os canais de IPC**

Criar `src/main/ipc.ts`:

```ts
import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { locateBinaries } from './ffmpeg/locate'
import { probeVideo } from './ffmpeg/probe'
import { startExportJob } from './jobs'
import { getPrefs, setPrefs } from './store'
import type { ExportRequest, FfmpegCheck, JobResult, Prefs } from '../shared/types'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv']

let ffprobePath = 'ffprobe'
let ffmpegPath = 'ffmpeg'
let currentJob: { cancel: () => void } | null = null

export function registerIpc(): void {
  ipcMain.handle('app:checkFfmpeg', async (): Promise<FfmpegCheck> => {
    const result = await locateBinaries()
    if (result.ok) {
      ffmpegPath = result.ffmpeg
      ffprobePath = result.ffprobe
    }
    return result
  })

  ipcMain.handle('video:openDialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Escolher vídeo',
      properties: ['openFile'],
      filters: [{ name: 'Vídeos', extensions: VIDEO_EXTENSIONS }],
    })
    if (canceled || filePaths.length === 0) return null
    return probeVideo(ffprobePath, filePaths[0])
  })

  ipcMain.handle('video:probe', (_event, path: string) => probeVideo(ffprobePath, path))

  ipcMain.handle('export:chooseDir', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Escolher pasta de saída',
      properties: ['openDirectory', 'createDirectory'],
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('export:start', async (event, request: ExportRequest): Promise<JobResult> => {
    // Um trabalho por vez. O guard vive aqui, e não na UI, porque um duplo clique
    // dispara o handler duas vezes antes do React re-renderizar — e com dois jobs
    // disputando o mesmo `currentJob`, o `finally` do primeiro a terminar zera a
    // referência e o Cancelar deixa de funcionar contra o que ainda roda.
    if (currentJob) {
      return {
        status: 'error',
        files: [],
        message: 'Já existe uma exportação em andamento.',
        failedIndex: 0,
      }
    }

    const job = startExportJob(ffmpegPath, request, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('export:progress', progress)
    })
    currentJob = job
    try {
      return await job.promise
    } finally {
      currentJob = null
    }
  })

  ipcMain.on('export:cancel', () => currentJob?.cancel())

  ipcMain.handle('shell:openFolder', (_event, path: string) => shell.openPath(path))

  ipcMain.handle('prefs:get', (): Prefs => getPrefs())
  ipcMain.handle('prefs:set', (_event, patch: Partial<Prefs>): Prefs => setPrefs(patch))
}
```

- [ ] **Step 4: Expor a ponte no preload**

Substituir `src/preload/index.ts`. **Manter a exposição de `window.electron`** que o template criou — é de lá que sai o `webUtils.getPathForFile`, a única forma de descobrir o caminho de um arquivo arrastado (a partir do Electron 32, `File.path` não existe mais). A Task 11 depende disso:

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ExportRequest, FfmpegCheck, JobProgress, JobResult, Prefs, VideoInfo,
} from '../shared/types'

const api = {
  checkFfmpeg: (): Promise<FfmpegCheck> => ipcRenderer.invoke('app:checkFfmpeg'),

  openVideoDialog: (): Promise<VideoInfo | null> => ipcRenderer.invoke('video:openDialog'),

  probeVideo: (path: string): Promise<VideoInfo> => ipcRenderer.invoke('video:probe', path),

  chooseOutputDir: (): Promise<string | null> => ipcRenderer.invoke('export:chooseDir'),

  startExport: (request: ExportRequest): Promise<JobResult> =>
    ipcRenderer.invoke('export:start', request),

  cancelExport: (): void => ipcRenderer.send('export:cancel'),

  onExportProgress: (handler: (progress: JobProgress) => void): (() => void) => {
    const listener = (_event: unknown, progress: JobProgress): void => handler(progress)
    ipcRenderer.on('export:progress', listener)
    return () => ipcRenderer.off('export:progress', listener)
  },

  openFolder: (path: string): Promise<void> => ipcRenderer.invoke('shell:openFolder', path),

  getPrefs: (): Promise<Prefs> => ipcRenderer.invoke('prefs:get'),

  setPrefs: (patch: Partial<Prefs>): Promise<Prefs> => ipcRenderer.invoke('prefs:set', patch),

  fileUrl: (path: string): string => `clip://local/?p=${encodeURIComponent(path)}`,
}

export type ClipApi = typeof api

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('clip', api)
```

- [ ] **Step 5: Ligar tudo no processo principal**

Em `src/main/index.ts`, adicionar os imports e as chamadas. `registerClipScheme()` vai no topo do módulo (antes do `app.whenReady()`); as outras duas, dentro do `whenReady`:

```ts
import { registerClipScheme, handleClipProtocol } from './protocol'
import { registerIpc } from './ipc'

registerClipScheme()

app.whenReady().then(() => {
  handleClipProtocol()
  registerIpc()
  // ...resto do que o template já gerou (createWindow etc.)
})
```

- [ ] **Step 6: Declarar o tipo global no renderer**

Criar `src/renderer/src/env.d.ts`:

```ts
/// <reference types="vite/client" />
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { ClipApi } from '../../preload'

declare global {
  interface Window {
    electron: ElectronAPI
    clip: ClipApi
  }
}
```

- [ ] **Step 7: Verificar a ponte manualmente**

Substituir o corpo de `src/renderer/src/App.tsx` por um teste de fumaça temporário:

```tsx
import { useEffect, useState } from 'react'

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState('verificando...')

  useEffect(() => {
    window.clip.checkFfmpeg().then((r) => setStatus(r.ok ? 'FFmpeg OK' : r.message))
  }, [])

  return <pre className="p-8 whitespace-pre-wrap">{status}</pre>
}
```

Run: `npm start`
Expected: a janela mostra **FFmpeg OK**. Isso prova que preload, contextBridge, IPC e a localização do FFmpeg estão todos funcionando juntos.

Abrir o DevTools (`Ctrl+Shift+I`) e confirmar que **não há erro** no console.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: ponte ipc, protocolo clip e preferencias persistidas"
```

---

### Task 11: Tela inicial, importação e ficha do arquivo

**Files:**
- Create: `src/renderer/src/components/WelcomeScreen.tsx`
- Create: `src/renderer/src/components/FileInfo.tsx`
- Create: `src/renderer/src/components/FfmpegMissing.tsx`
- Create: `src/renderer/src/lib/formatSize.ts`
- Test: `src/renderer/src/lib/formatSize.test.ts`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `window.clip` (T10), `VideoInfo` (T2)
- Produces:
  - `formatSize(bytes: number): string`
  - `App` mantendo o estado `video: VideoInfo | null`, passado adiante para as tasks 12–15

- [ ] **Step 1: Escrever o teste de formatSize**

Criar `src/renderer/src/lib/formatSize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatSize } from './formatSize'

describe('formatSize', () => {
  it('formata bytes', () => {
    expect(formatSize(512)).toBe('512 B')
  })

  it('formata megabytes com uma casa', () => {
    expect(formatSize(52428800)).toBe('50.0 MB')
  })

  it('formata gigabytes', () => {
    expect(formatSize(2147483648)).toBe('2.0 GB')
  })

  it('trata zero', () => {
    expect(formatSize(0)).toBe('0 B')
  })

  it('promove a unidade quando o arredondamento chegaria a 1024', () => {
    // 1048575 bytes dá 1023.999 KB: a comparação crua não promove, mas o
    // toFixed(1) exibiria "1024.0 KB".
    expect(formatSize(1048575)).toBe('1.0 MB')
  })

  it('promove na fronteira de GB pelo mesmo motivo', () => {
    expect(formatSize(1073741823)).toBe('1.0 GB')
  })
})
```

Incluir o caminho do renderer no Vitest — em `vitest.config.ts`, `include` já cobre `src/**/*.test.ts`, então não muda nada.

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npm test -- formatSize`
Expected: FAIL — `Failed to resolve import "./formatSize"`

- [ ] **Step 3: Implementar formatSize**

Criar `src/renderer/src/lib/formatSize.ts`:

```ts
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  // Compara o valor JÁ arredondado. Com a comparação crua, 1048575 bytes dá
  // 1023.999 KB — não promove pra MB — e o `toFixed(1)` exibe "1024.0 KB", que é
  // uma unidade que não existe. Mesmo defeito em toda fronteira.
  while (Number(value.toFixed(1)) >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npm test -- formatSize`
Expected: PASS — 6 testes

- [ ] **Step 5: Criar a tela de FFmpeg ausente**

Criar `src/renderer/src/components/FfmpegMissing.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react'

export function FfmpegMissing({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-lg rounded-lg bg-[#1a1a2e] p-8">
        <AlertTriangle className="mb-4 text-[#ef476f]" size={40} />
        <h1 className="mb-3 text-xl font-semibold">FFmpeg não encontrado</h1>
        <pre className="whitespace-pre-wrap rounded bg-[#0f0f1a] p-4 font-mono text-sm text-[#e7e7f0]/80">
          {message}
        </pre>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Criar a tela inicial com drag & drop**

Criar `src/renderer/src/components/WelcomeScreen.tsx`:

```tsx
import { useState } from 'react'
import { FilmIcon } from 'lucide-react'

type Props = {
  onPick: () => void
  onDropFile: (path: string) => void
  error: string | null
}

export function WelcomeScreen({ onPick, onDropFile, error }: Props): React.JSX.Element {
  const [over, setOver] = useState(false)

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={(e) => {
          // `dragleave` também dispara ao entrar num FILHO da zona (ícone,
          // textos). Sem esta guarda a borda azul pisca com o cursor ainda
          // dentro. `contains(null)` é false, então sair da janela ainda limpa.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files[0]
          if (file) onDropFile(window.electron.webUtils.getPathForFile(file))
        }}
        className={`flex w-full max-w-2xl cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-16 transition-colors duration-150 ${
          over ? 'border-[#4361ee] bg-[#4361ee]/10' : 'border-[#252547] hover:border-[#4361ee]/60'
        }`}
      >
        <FilmIcon size={56} className="mb-4 text-[#4361ee]" />
        <p className="text-lg">Arraste um vídeo aqui ou clique para importar</p>
        <p className="mt-2 text-sm text-[#e7e7f0]/50">MP4, MOV, AVI, MKV, WEBM, WMV, FLV</p>
        {error && <p className="mt-6 text-sm text-[#ef476f]">{error}</p>}
      </div>
    </div>
  )
}
```

`window.electron.webUtils.getPathForFile(file)` vem do `@electron-toolkit/preload` que o template do electron-vite já expõe. É a única forma de obter o caminho absoluto de um arquivo arrastado: a partir do Electron 32, `File.path` não existe mais.

- [ ] **Step 7: Criar a ficha do arquivo**

Criar `src/renderer/src/components/FileInfo.tsx`:

```tsx
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
```

- [ ] **Step 8: Montar o App**

Substituir `src/renderer/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { FfmpegCheck, VideoInfo } from '@shared/types'
import { WelcomeScreen } from './components/WelcomeScreen'
import { FileInfo } from './components/FileInfo'
import { FfmpegMissing } from './components/FfmpegMissing'

export default function App(): React.JSX.Element {
  const [check, setCheck] = useState<FfmpegCheck | null>(null)
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.clip.checkFfmpeg().then(setCheck)
  }, [])

  const load = async (loader: () => Promise<VideoInfo | null>): Promise<void> => {
    setError(null)
    try {
      const info = await loader()
      if (info) setVideo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (check === null) return <div className="p-8 text-sm text-[#e7e7f0]/50">Carregando…</div>
  if (!check.ok) return <FfmpegMissing message={check.message} />

  if (!video) {
    return (
      <WelcomeScreen
        error={error}
        onPick={() => load(() => window.clip.openVideoDialog())}
        onDropFile={(path) => load(() => window.clip.probeVideo(path))}
      />
    )
  }

  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-4 p-4">
      <div className="rounded-lg bg-[#1a1a2e] p-4">
        <p className="text-sm text-[#e7e7f0]/50">Player entra na próxima etapa</p>
      </div>
      <FileInfo video={video} />
    </div>
  )
}
```

- [ ] **Step 9: Verificar manualmente**

Run: `npm start`

Conferir, nesta ordem:
1. A tela inicial aparece com a área tracejada.
2. Arrastar um vídeo por cima deixa a borda azul; soltar carrega o arquivo.
3. A ficha à direita mostra duração, resolução, FPS e codecs **corretos** — conferir contra `ffprobe <arquivo>` no terminal.
4. Fechar, reabrir, e desta vez clicar na área: o diálogo do Windows abre filtrando por vídeo.
5. Arrastar um arquivo que não é vídeo (um `.txt`): a mensagem de erro em vermelho aparece e o app não quebra.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: tela inicial com drag and drop e ficha do arquivo"
```

---

### Task 12: Player e navegação precisa

**Files:**
- Create: `src/renderer/src/components/VideoPlayer.tsx`
- Create: `src/renderer/src/components/PlayerControls.tsx`
- Create: `src/renderer/src/hooks/usePlayer.ts`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `VideoInfo` (T2), `formatTime` (T2), `window.clip.fileUrl` (T10)
- Produces: `usePlayer(video: VideoInfo)` devolvendo
  `{ videoRef, currentTime, playing, rate, volume, toggle(), seek(t), nudge(delta), stepFrame(dir), setRate(r), setVolume(v) }`

- [ ] **Step 1: Criar o hook do player**

Criar `src/renderer/src/hooks/usePlayer.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoInfo } from '@shared/types'

export function usePlayer(video: VideoInfo) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState(1)
  const [volume, setVolumeState] = useState(1)

  // requestAnimationFrame em vez de timeupdate: o evento nativo dispara
  // ~4x por segundo, o que faz o playhead andar aos trancos.
  useEffect(() => {
    let frame = 0
    const tick = (): void => {
      const element = videoRef.current
      if (element) setCurrentTime(element.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const seek = useCallback(
    (time: number) => {
      const element = videoRef.current
      if (!element) return
      element.currentTime = Math.min(Math.max(time, 0), video.duration)
      setCurrentTime(element.currentTime)
    },
    [video.duration],
  )

  // O elemento é a fonte única da verdade sobre estar tocando. Sem isto, um vídeo
  // que termina sozinho deixa `playing` preso em true: o botão mostra "pausar", e
  // o clique seguinte cai no ramo play() — que, num vídeo terminado, rebobina pro
  // zero pela especificação do HTML. Ou seja, apertar pausar recomeçaria o clipe.
  // `ended` entra junto com `pause` de propósito: os navegadores disparam `pause`
  // antes na prática, mas depender dessa ordem seria suposição.
  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    const aoTocar = (): void => setPlaying(true)
    const aoParar = (): void => setPlaying(false)
    element.addEventListener('play', aoTocar)
    element.addEventListener('pause', aoParar)
    element.addEventListener('ended', aoParar)
    return () => {
      element.removeEventListener('play', aoTocar)
      element.removeEventListener('pause', aoParar)
      element.removeEventListener('ended', aoParar)
    }
  }, [])

  // Só comanda o elemento; quem escreve `playing` é o efeito acima.
  const toggle = useCallback(() => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }, [])

  const nudge = useCallback(
    (delta: number) => seek((videoRef.current?.currentTime ?? 0) + delta),
    [seek],
  )

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const element = videoRef.current
      if (!element) return
      element.pause()
      const frame = video.fps > 0 ? 1 / video.fps : 1 / 30
      seek(element.currentTime + direction * frame)
    },
    [seek, video.fps],
  )

  const setRate = useCallback((value: number) => {
    setRateState(value)
    if (videoRef.current) videoRef.current.playbackRate = value
  }, [])

  const setVolume = useCallback((value: number) => {
    setVolumeState(value)
    if (videoRef.current) videoRef.current.volume = value
  }, [])

  return { videoRef, currentTime, playing, rate, volume, toggle, seek, nudge, stepFrame, setRate, setVolume }
}

export type Player = ReturnType<typeof usePlayer>
```

- [ ] **Step 2: Criar o elemento de vídeo**

Criar `src/renderer/src/components/VideoPlayer.tsx`:

```tsx
import type { VideoInfo } from '@shared/types'
import type { Player } from '../hooks/usePlayer'

type Props = { video: VideoInfo; player: Player }

export function VideoPlayer({ video, player }: Props): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-black">
      <video
        ref={player.videoRef}
        src={window.clip.fileUrl(video.path)}
        className="max-h-full max-w-full"
        onClick={player.toggle}
        onEnded={() => player.seek(video.duration)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Criar os controles**

Criar `src/renderer/src/components/PlayerControls.tsx`:

```tsx
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
```

- [ ] **Step 4: Ligar os atalhos de teclado no App**

Em `src/renderer/src/App.tsx`, adicionar o hook do player, o efeito de teclado e trocar o painel esquerdo. O bloco de retorno com vídeo carregado vira:

```tsx
import { useEffect } from 'react'
import { usePlayer } from './hooks/usePlayer'
import { VideoPlayer } from './components/VideoPlayer'
import { PlayerControls } from './components/PlayerControls'

// dentro de um novo componente Editor, para que os hooks só rodem com vídeo carregado:
function Editor({ video }: { video: VideoInfo }): React.JSX.Element {
  const player = usePlayer(video)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return

      const actions: Record<string, () => void> = {
        ' ': player.toggle,
        k: player.toggle,
        ArrowLeft: () => player.nudge(-5),
        ArrowRight: () => player.nudge(5),
        j: () => player.nudge(-10),
        l: () => player.nudge(10),
        ',': () => player.stepFrame(-1),
        '.': () => player.stepFrame(1),
      }

      const action = actions[e.key.toLowerCase()] ?? actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-4 p-4">
      <div className="flex min-h-0 flex-col gap-3">
        <VideoPlayer video={video} player={player} />
        <PlayerControls video={video} player={player} />
      </div>
      <FileInfo video={video} />
    </div>
  )
}
```

E no `App`, trocar o bloco final por `return <Editor video={video} />`.

- [ ] **Step 5: Verificar manualmente**

Run: `npm start`

Conferir:
1. O vídeo **aparece e toca** — se a tela ficar preta, o protocolo `clip://` da Task 10 está com problema (abrir o DevTools e olhar a aba Network).
2. Apertar `L` várias vezes seguidas para pular bem longe (num vídeo de 10min, uns 20 toques): o vídeo continua tocando a partir dali sem travar. Isso prova que o *Range* funciona — sem ele, o salto congela ou volta pro início. (A barra de tempo clicável chega na Task 13; aqui a navegação é só pelo teclado.)
3. `Espaço` dá play/pause. `←`/`→` andam 5s. `J`/`L` andam 10s.
4. `,` e `.` andam **um quadro** — o tempo muda em ~0.033s num vídeo de 30fps.
5. Trocar a velocidade para 2x acelera de verdade.
6. Clicar no vídeo dá play/pause.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: player com navegacao quadro a quadro e atalhos de teclado"
```

---

### Task 13: Timeline

**Files:**
- Create: `src/renderer/src/components/Timeline.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `CutPoint` (T2), `formatTime` (T2), `Player` (T12)
- Produces: `<Timeline video points currentTime onSeek onMovePoint onRemovePoint />`

- [ ] **Step 1: Criar a timeline**

Criar `src/renderer/src/components/Timeline.tsx`:

```tsx
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
              // Captura o ponteiro. Sem isto, arrastar o marcador para além da
              // borda do contêiner dispara `pointerleave` e o marcador congela no
              // meio do gesto, sem pista visual de que a interação acabou. E como
              // o `movePoint` limita a [0.05, duração-0.05], arrastar até a borda
              // é o uso NORMAL, não o caso extremo.
              // Os eventos continuam chegando aos handlers do contêiner: a captura
              // redireciona para o marcador, que é descendente dele, então a bolha
              // segue a árvore normalmente.
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
```

- [ ] **Step 2: Ligar a timeline no Editor**

Em `src/renderer/src/App.tsx`, dentro de `Editor`, adicionar o estado dos pontos e renderizar a timeline abaixo dos controles:

```tsx
import { useState } from 'react'
import type { CutPoint } from '@shared/types'
import { movePoint, removePoint } from '@shared/cutPoints'
import { Timeline } from './components/Timeline'

// dentro de Editor:
const [points, setPoints] = useState<CutPoint[]>([])

// no JSX, logo depois de <PlayerControls ... />:
<Timeline
  video={video}
  points={points}
  currentTime={player.currentTime}
  onSeek={player.seek}
  onMovePoint={(id, time) => setPoints((p) => movePoint(p, id, time, video.duration))}
  onRemovePoint={(id) => setPoints((p) => removePoint(p, id))}
/>
```

- [ ] **Step 3: Verificar manualmente**

Para testar antes da Task 14 existir, inserir temporariamente um estado inicial com pontos fixos:

```tsx
const [points, setPoints] = useState<CutPoint[]>([
  { id: 'a', time: video.duration * 0.25 },
  { id: 'b', time: video.duration * 0.6 },
])
```

Run: `npm start`

Conferir:
1. A régua mostra marcas de tempo legíveis e espaçadas (não amontoadas).
2. Dois marcadores laranja aparecem em 25% e 60% da faixa.
3. O playhead branco anda suavemente durante a reprodução — sem trancos.
4. Clicar na faixa pula o vídeo pra aquele ponto.
5. Arrastar um marcador move ele, e ele **não sai** das bordas da faixa.
6. Arrastar um marcador em cima do outro faz os dois virarem um.
7. Botão direito num marcador remove ele.

Depois de conferir, **desfazer** o estado inicial fixo (voltar para `useState<CutPoint[]>([])`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: timeline com regua, playhead e marcadores arrastaveis"
```

---

### Task 14: Painel de corte

**Files:**
- Create: `src/renderer/src/components/CutPanel.tsx`
- Create: `src/renderer/src/hooks/useCutPoints.ts`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `cutPoints` inteiro (T3), `formatTime` (T2), `window.clip.getPrefs/setPrefs` (T10)
- Produces: `useCutPoints(duration: number)` devolvendo
  `{ points, segments, generate(chunk), addAt(time), move(id, time), remove(id), clear() }`

- [ ] **Step 1: Criar o hook**

Criar `src/renderer/src/hooks/useCutPoints.ts`:

```ts
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
```

- [ ] **Step 2: Criar o painel**

Criar `src/renderer/src/components/CutPanel.tsx`:

```tsx
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
        <span className="text-[#06d6a0]">{cuts.segments.length} partes</span>
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
```

- [ ] **Step 3: Ligar no Editor**

Em `src/renderer/src/App.tsx`, dentro de `Editor`: trocar o `useState<CutPoint[]>` pelo hook, carregar a duração salva das preferências, e adicionar o atalho `S`.

```tsx
const cuts = useCutPoints(video.duration)
const [chunk, setChunk] = useState(30)

useEffect(() => {
  // A duração vem da sessão anterior e pode ser MAIOR que este vídeo. Sem o limite,
  // o `<input type="range">` trava o valor renderizado no seu max mas o
  // `<input type="number">` não limita o exibido (ali min/max só governam estilo de
  // inválido) — os dois controles passam a discordar na tela. E aí "Gerar cortes"
  // gera lista vazia e SUBSTITUI por vazio os marcadores que o usuário já colocou
  // na mão, sem erro nenhum.
  //
  // O valor limitado NÃO é persistido de propósito: só `changeChunk` grava. Se
  // gravasse aqui, abrir um clipe curto uma única vez apagaria para sempre a
  // duração que o usuário usa nos vídeos longos.
  window.clip.getPrefs().then((p) =>
    setChunk(Math.min(Math.max(p.chunkDuration, 1), Math.max(video.duration, 1))),
  )
}, [video.duration])

const changeChunk = (value: number): void => {
  setChunk(value)
  void window.clip.setPrefs({ chunkDuration: value })
}
```

No mapa de atalhos do efeito de teclado, adicionar:

```tsx
s: () => cuts.addAt(player.currentTime),
```

E incluir `cuts` e `player` nas dependências do `useEffect`.

A `<Timeline>` passa a receber `points={cuts.points}`, `onMovePoint={cuts.move}`, `onRemovePoint={cuts.remove}`. O `<CutPanel>` entra abaixo da timeline.

- [ ] **Step 4: Verificar manualmente**

Run: `npm start`

Conferir:
1. Digitar `29.5` e clicar "Gerar cortes" num vídeo de 100s cria **3 marcadores** e mostra "4 partes · última com 00:11.500", com a última em laranja.
2. Mover o slider muda o número e o input acompanha.
3. Pôr o player no meio e apertar `S` adiciona um marcador exatamente ali.
4. `S` duas vezes no mesmo lugar **não** cria dois marcadores.
5. Arrastar um marcador atualiza o contador de partes ao vivo.
6. "Limpar" tira todos e volta pra "1 partes".
7. Fechar e reabrir o app: a duração digitada foi lembrada.
8. Com o cursor dentro do input numérico, apertar espaço **não** dá play no vídeo.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: painel de corte com geracao por duracao e marcacao manual"
```

---

### Task 15: Exportação

**Files:**
- Create: `src/renderer/src/components/ExportBar.tsx`
- Create: `src/renderer/src/hooks/useExport.ts`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `Segment`/`JobProgress`/`JobResult` (T2), `outputExtension` (T4), `window.clip` de exportação (T10)
- Produces: `useExport(video, segments)` devolvendo
  `{ outputDir, exactMode, running, progress, result, setExactMode, chooseDir, start, cancel, openFolder, reset }`

- [ ] **Step 1: Criar o hook de exportação**

Criar `src/renderer/src/hooks/useExport.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { JobProgress, JobResult, Segment, VideoInfo } from '@shared/types'
import { outputExtension } from '@shared/naming'

export function useExport(video: VideoInfo, segments: Segment[]) {
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [exactMode, setExactModeState] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [result, setResult] = useState<JobResult | null>(null)

  useEffect(() => {
    window.clip.getPrefs().then((p) => {
      setOutputDir(p.outputDir)
      setExactModeState(p.exactMode)
    })
  }, [])

  useEffect(() => window.clip.onExportProgress(setProgress), [])

  const setExactMode = useCallback((value: boolean) => {
    setExactModeState(value)
    void window.clip.setPrefs({ exactMode: value })
  }, [])

  const chooseDir = useCallback(async () => {
    const dir = await window.clip.chooseOutputDir()
    if (!dir) return
    setOutputDir(dir)
    void window.clip.setPrefs({ outputDir: dir })
  }, [])

  const start = useCallback(async () => {
    if (!outputDir) return
    setRunning(true)
    setResult(null)
    setProgress(null)
    try {
      const jobResult = await window.clip.startExport({
        inputPath: video.path,
        outputDir,
        baseName: video.baseName,
        extension: outputExtension(exactMode ? 'exact' : 'fast', video.extension),
        segments,
        mode: exactMode ? 'exact' : 'fast',
      })
      setResult(jobResult)
    } catch (error) {
      // Rede de segurança: se o IPC rejeitar por qualquer motivo não previsto,
      // a UI precisa sair do estado "exportando" em vez de travar no botão
      // Cancelar para sempre.
      setResult({
        status: 'error',
        files: [],
        message: error instanceof Error ? error.message : String(error),
        failedIndex: 0,
      })
    } finally {
      setRunning(false)
    }
  }, [outputDir, exactMode, segments, video])

  const cancel = useCallback(() => window.clip.cancelExport(), [])

  const openFolder = useCallback(() => {
    if (outputDir) void window.clip.openFolder(outputDir)
  }, [outputDir])

  const reset = useCallback(() => setResult(null), [])

  return { outputDir, exactMode, running, progress, result, setExactMode, chooseDir, start, cancel, openFolder, reset }
}

export type ExportState = ReturnType<typeof useExport>
```

- [ ] **Step 2: Criar a barra de exportação**

Criar `src/renderer/src/components/ExportBar.tsx`:

```tsx
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
            <Download size={16} /> Exportar {partCount} partes
          </button>
        )}
      </div>

      {exp.running && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded bg-[#252547]">
            <div
              className="h-full bg-[#4361ee] transition-[width] duration-150"
              style={{ width: `${pct}%` }}
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
```

- [ ] **Step 3: Ligar no Editor**

Em `src/renderer/src/App.tsx`, dentro de `Editor`:

```tsx
const exp = useExport(video, cuts.segments)
```

E no JSX, abaixo do `<CutPanel>`:

```tsx
<ExportBar exp={exp} partCount={cuts.segments.length} />
```

- [ ] **Step 4: Verificar manualmente — o roteiro completo do MVP**

Run: `npm start`

Este é o teste de aceitação do MVP inteiro (spec §12):

1. Arrastar um vídeo → carrega e a ficha bate com o `ffprobe`.
2. Digitar `29.5`, "Gerar cortes" → marcadores na timeline, contador correto.
3. Apertar `S` no meio → marcador extra na posição exata.
4. Arrastar um marcador → contador atualiza ao vivo.
5. "Escolher pasta" → diálogo do Windows abre, caminho aparece na barra.
6. "Exportar" com **corte exato ligado** → barra de progresso anda, mensagem de conclusão em verde.
7. "Abrir pasta" → Explorer abre na pasta certa, com os arquivos `_parte_01`…`_parte_NN`.
8. Conferir no terminal que as durações batem com a timeline:
   ```bash
   ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "saida/video_parte_01.mp4"
   ```
   Deve bater com o primeiro segmento, com tolerância de 0.1s.
9. Exportar **de novo** na mesma pasta → arquivos viram ` (2)`, nada é sobrescrito.
10. Desligar "corte exato" e exportar → sai muito mais rápido, extensão igual à do original.
11. Exportar um vídeo longo e clicar "Cancelar" no meio → para na hora; abrir o Gerenciador de Tarefas e confirmar que **não há `ffmpeg.exe` pendurado**; as partes já prontas continuam na pasta.
12. Fechar e reabrir o app → pasta, duração e estado do "corte exato" foram lembrados.

- [ ] **Step 5: Rodar a suíte de testes inteira**

Run: `npm test`
Expected: PASS — todos os arquivos

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: exportacao com fila, progresso, cancelamento e abrir pasta"
```

---

## Verificação final do plano

Depois da Task 15, o app cumpre todos os oito critérios de sucesso do spec §12. Antes de considerar o MVP entregue:

- [ ] `npm test` passa inteiro
- [ ] `npm start` abre o app sem erro no console do DevTools
- [ ] Os 12 passos do roteiro da Task 15 foram executados de verdade, num vídeo real
- [ ] `git log --oneline` mostra um commit por task
