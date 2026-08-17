# ClipCutter — Design do MVP

**Data:** 2026-08-15
**Status:** aprovado, pronto para virar plano de implementação
**Substitui:** `prompt-clipcutter-v2.md` (spec original, ver "Correções" no fim)

---

## 1. Objetivo

App desktop para picar um vídeo longo em partes, com dois jeitos de decidir
onde cortar: gerar pontos automaticamente a cada X segundos, ou marcar o
ponto exato assistindo ao vídeo. As partes saem como arquivos separados numa
pasta escolhida.

Usuário: o próprio desenvolvedor, no Windows, rodando pelo terminal.

## 2. Decisões que moldam o design

| Decisão | Escolha | Por quê |
|---|---|---|
| Modo de corte | Automático **e** manual, na mesma lista | São a mesma coisa: uma lista de pontos. Só muda quem preenche. |
| Distribuição | `npm start`, sem instalador | Adia electron-builder e FFmpeg embutido. Corta ~40% do trabalho do v1. |
| Precisão do corte | Toggle "corte exato", ligado por padrão | Clipe de 29.5s que sai com 33s não serve pra Reels. Modo rápido fica disponível pra grava­ções longas. |
| Encontrar o corte | Player preciso + timeline simples | Miniatura a cada 5s não ajuda a achar *o segundo*. Quadro a quadro ajuda. |
| Empacotamento | Electron + React + TS via `electron-vite` | Só app desktop entrega caminho absoluto de arquivo e diálogo de pasta nativo. |

### Por que não web local

O browser entrega o *conteúdo* do arquivo arrastado, nunca o *caminho* — por
segurança. O FFmpeg precisa do caminho. As alternativas seriam copiar 2GB pro
servidor local a cada vídeo, ou digitar `C:\Users\...` na mão. Ambas piores
que aprender IPC.

## 3. Escopo do MVP

### Entra

1. **Importação** — arrastar na janela ou botão. Um vídeo por vez.
   Aceita: MP4, MOV, AVI, MKV, WEBM, WMV, FLV.
2. **Ficha do arquivo** via ffprobe: duração, resolução, FPS, codec de vídeo,
   codec de áudio, bitrate, tamanho.
3. **Player** — play/pause, barra de progresso clicável, volume, velocidade
   (0.5 / 0.75 / 1 / 1.25 / 1.5 / 2). Tempo em `mm:ss.mmm`, virando
   `h:mm:ss.mmm` a partir de 1 hora (gravações de imersão passam de 59 minutos).
4. **Navegação precisa** — atalhos de teclado:
   - `Espaço` — play/pause
   - `←` / `→` — 5 segundos
   - `,` / `.` — um quadro (usa o FPS lido pelo ffprobe: `1/fps` segundos)
   - `J` / `K` / `L` — voltar / pausar / avançar
   - `S` — marcar corte na posição atual
5. **Timeline** — régua de tempo, playhead acompanhando o vídeo, marcadores
   de corte, clique para navegar. Sem zoom, sem miniatura, sem waveform.
6. **Pontos de corte**
   - "Gerar a cada X segundos": input numérico + slider (1.0s até a duração
     total, passo 0.1s)
   - **Prévia ao vivo na timeline** (acrescentado em 15/08/2026, depois do MVP):
     enquanto a duração muda, marcadores tracejados apagados mostram onde os
     cortes cairiam. É cálculo na hora de desenhar, não estado — usa a mesma
     função pura do botão, então prévia e resultado não divergem, e mexer no
     slider não pode apagar marcador nenhum. Só viram cortes de verdade ao
     clicar "Gerar cortes". Acima de 300 marcadores a prévia não é desenhada
     (slider em 1s num vídeo de 1h daria 3.600, e a timeline redesenha ~60x/s).
   - "Cortar aqui": marca na posição atual do player
   - Arrastar marcador na timeline; apagar marcador
   - Contador ao vivo: `6 partes · última com 12.4s`
7. **Exportação** — escolher pasta (diálogo nativo do Windows, lembrada entre
   sessões), toggle "corte exato", fila com progresso por parte e geral,
   cancelar, botão "Abrir pasta" ao concluir.
8. **Saída** — `<nome_original>_parte_01.<ext>`, `_parte_02.<ext>`, … onde
   `<ext>` é `.mp4` no modo exato e a extensão original no modo rápido
   (ver §7).

### Fica de fora (roadmap, cada um com sua própria rodada)

Remoção de silêncio · Redimensionar · Comprimir · Extrair áudio · Lote ·
Transcrição/karaokê · Miniaturas · Waveform · Dropdown de formatos ·
Zoom na timeline · Notificação nativa · Empacotar em `.exe`

### Formato de saída no v1

Sem dropdown. O modo decide:

- **Rápido** — mantém o container original (é cópia byte a byte dos dados
  codificados; converter exigiria recodificar, que é justamente o que esse
  modo evita).
- **Exato** — MP4 / H.264 / AAC.

O dropdown volta quando existir a aba "Converter".

## 4. Arquitetura

Dois processos. **O renderer nunca toca disco nem FFmpeg** — ele só desenha e
manda pedidos. Toda operação de arquivo vive no main, atrás de uma lista
fechada de funções expostas pelo `preload`. Sem `nodeIntegration`, sem
`require` no renderer.

Isso não é cerimônia: é o que impede um bug de UI de virar perda de arquivo, e
é o que deixa a lógica de FFmpeg testável sem abrir janela.

```
electron/
├── main.ts              janela, ciclo de vida, protocolo clip://
├── preload.ts           contextBridge — a ponte tipada
├── ipc.ts               registro dos canais
├── ffmpeg/
│   ├── locate.ts        acha ffmpeg/ffprobe no PATH
│   ├── probe.ts         chama ffprobe + parseia o JSON
│   ├── args.ts          monta os argumentos (puro)
│   ├── progress.ts      lê a saída -progress (puro)
│   └── run.ts           roda processo filho, encerra sob demanda
├── jobs.ts              fila sequencial, cancelamento, eventos
└── store.ts             electron-store (preferências)

src/
├── App.tsx
├── components/
│   ├── WelcomeScreen.tsx
│   ├── Player/          VideoPlayer, PlayerControls
│   ├── Timeline/        Timeline, Ruler, Playhead, CutMarkers
│   ├── CutPanel.tsx
│   └── Export/          ExportBar, ProgressPanel
├── hooks/               usePlayer, useCutPoints, useExport
├── lib/                 time.ts, cutPoints.ts, naming.ts   ← puros, testados
└── types/index.ts       tipos compartilhados com o main
```

### Stack

Electron (estável mais recente) · React 19 + TypeScript · Tailwind CSS v4 ·
Lucide React · electron-store · Vitest · scaffold via `electron-vite`
(template `react-ts`).

FFmpeg e FFprobe vêm do PATH do sistema — já instalados via winget. Nada
embutido no v1.

## 5. Modelo de dados

```ts
type CutPoint = { id: string; time: number }        // segundos, decimal
type Segment  = { index: number; start: number; end: number }
```

**Regras:**

- Pontos são **fronteiras internas**. O `0` e a duração total são implícitos e
  nunca aparecem na lista.
- A lista fica sempre ordenada por `time`.
- Pontos a menos de **0.05s** um do outro colapsam em um só (isso também
  garante que nenhum segmento saia menor que 0.05s).
- N pontos ⇒ N+1 segmentos, derivados por `segmentsFrom(points, duration)` —
  função pura, sem estado.

**É isso que unifica os dois modos.** `generateByDuration(29.5, total)` apenas
devolve uma lista de `CutPoint` e a joga no mesmo lugar onde o clique manual
joga. Depois de entrar, ninguém sabe (nem precisa saber) de onde o ponto veio —
dá pra arrastar, apagar e misturar os dois livremente.

Casos de borda definidos:

- Duração pedida ≥ duração do vídeo ⇒ zero pontos, uma parte só — **desde que a
  lista já esteja vazia**. Se houver pontos marcados na mão, "Gerar cortes" não
  substitui por vazio: substituir aí seria deleção pura, sem divisão nenhuma em
  troca. A lista fica como está.
- Última parte menor que a duração pedida ⇒ é mantida, e a UI avisa
  (`última com 12.4s`).
- Ponto arrastado para além de um vizinho ⇒ a lista reordena; se colar em
  outro (< 0.05s), colapsa.
- Ponto **arrastado** para fora do vídeo ⇒ é limitado ao intervalo
  `[0.05, duração − 0.05]`. O marcador continua vivo para poder ser trazido de
  volta. Nunca vira segmento vazio nem tempo negativo.
- Ponto **adicionado** (tecla `S` / "Cortar aqui") fora dessa faixa ⇒ é
  **recusado**, não limitado. Corrigido em 15/08/2026 depois de aparecer no uso
  real: o player começa parado em 0, então "Cortar aqui" ali é o clique mais
  provável do app; limitar criava um ponto em 0.05s, exportava uma parte de 50ms
  **e deslocava todas as seguintes** (a segunda saía com 29.95s em vez de 30s).
  O erro de raciocínio original foi tratar "cortar em 0" como pedido inválido a
  corrigir. Não é: o começo e o fim já são fronteiras implícitas, então o pedido é
  vazio e a resposta honesta é não fazer nada. E o marcador espúrio era invisível,
  porque o playhead branco fica em cima dele.

## 6. Reprodução do vídeo no player

O `<video>` do renderer **não consegue abrir `file:///C:/...`** — o Electron
bloqueia por segurança quando a UI roda em `localhost`, que é o caso em
desenvolvimento.

Solução: o main registra o protocolo `clip://` com `protocol.handle()`,
servindo o arquivo do disco via `net.fetch(pathToFileURL(caminho))`, que já
traz suporte a *Range* — necessário para arrastar a barra de progresso sem
carregar o arquivo inteiro na memória.

São ~15 linhas, mas sem isso o app abre com tela preta e nenhuma mensagem de
erro. Vale registrar como decisão explícita.

## 7. Exportação

### Os comandos

```bash
# Rápido — copia os dados, cai no ponto-chave mais próximo
ffmpeg -ss 29.5 -i IN -t 30.0 -c copy -avoid_negative_ts make_zero OUT.mp4

# Exato — redecodifica a partir do ponto marcado
ffmpeg -ss 29.5 -i IN -t 30.0 \
  -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k OUT.mp4
```

O `-ss` vem **antes** do `-i` nos dois casos: assim o FFmpeg salta direto pro
trecho em vez de decodificar desde o começo. Num arquivo de uma hora, é a
diferença entre segundos e minutos.

### Progresso

`-progress pipe:1 -nostats` faz o FFmpeg emitir `out_time_us=` em formato fixo,
linha a linha. O parser lê isso, não o stderr — texto de stderr muda entre
versões do FFmpeg e quebra sem aviso.

Progresso geral = `(partes concluídas + fração da atual) / total de partes`.

### Fila

Uma parte de cada vez, em sequência. Rodar vários FFmpegs em paralelo não
acelera: satura a CPU e cada um fica proporcionalmente mais lento.

### Cancelamento

No Windows, matar o processo do Node não mata o FFmpeg filho de forma
confiável — ele vira zumbi segurando o arquivo de saída aberto. Usa-se
`taskkill /PID <pid> /T /F`, e o arquivo parcial da parte interrompida é
apagado.

### Nomenclatura

- Base: nome do arquivo original sem extensão.
- Numeração com zero à esquerda, largura = `max(2, dígitos do total)`.
  12 partes ⇒ `_parte_01`…`_parte_12`. 120 partes ⇒ `_parte_001`.
- Extensão: modo rápido mantém a original; modo exato usa `.mp4`.
- Colisão: `_parte_01 (2).mp4`. **Nunca sobrescreve em silêncio.**

## 8. Tratamento de erros

| Situação | Comportamento |
|---|---|
| FFmpeg/FFprobe fora do PATH | Tela na abertura com `winget install ffmpeg` pronto pra copiar. App não prossegue. |
| Arquivo não é vídeo legível | Mostra a mensagem do ffprobe; o vídeo não carrega. |
| Nome de saída já existe | Vira `_parte_01 (2).mp4`. |
| FFmpeg falha no meio da fila | Para a fila, mostra as últimas linhas do stderr, mantém as partes já concluídas. |
| Pasta de saída sumiu ou sem permissão | Pede pra escolher outra antes de começar. |
| Vídeo sem faixa de áudio | Exporta normalmente (só vídeo), sem erro. |
| Cancelamento | Mata a árvore de processos, apaga o arquivo parcial, mantém as partes prontas. |

## 9. Estratégia de testes

TDD: teste antes da implementação. Runner: **Vitest**.

### Unitários — lógica pura, onde moram os bugs

| Módulo | Cobre |
|---|---|
| `lib/cutPoints` | gerar por duração, inserir ordenado, colapsar < 0.05s, remover, derivar segmentos, bordas (duração > vídeo, ponto em 0, ponto no último quadro, última parte menor) |
| `lib/time` | formatar e ler `mm:ss.mmm` |
| `lib/naming` | zero à esquerda, largura variável, colisão de arquivo |
| `ffmpeg/args` | argumentos dos dois modos — testa o comando sem rodar FFmpeg |
| `ffmpeg/progress` | leitura da saída `-progress`, com amostra real como fixture |
| `ffmpeg/probe` | leitura do JSON do ffprobe, com fixture real |

### Integração — poucos, e valem por dez unitários

Gerar um vídeo de 10s com o próprio FFmpeg (`-f lavfi -i testsrc`), cortar em
3 partes, e conferir com ffprobe que as durações batem — nos dois modos.

É o teste que pega o `-ss` no lugar errado, a numeração fora de ordem e o
segmento que sai vazio. Nenhum unitário pega isso.

## 10. Interface

Herda o visual definido no spec original:

- Dark mode: fundo `#0f0f1a`, painéis `#1a1a2e`, cards `#252547`
- Destaque azul `#4361ee` · sucesso `#06d6a0` · marcadores de corte `#ff6b35`
- Fonte de UI: Inter / system-ui · timestamps em monoespaçada
- Bordas 8px, transições 150ms, ícones Lucide
- Janela mínima 1100×750

Sem sidebar de abas no v1 — só existe uma ferramenta. A sidebar entra quando
a segunda chegar. Tela inicial: área tracejada central, "Arraste um vídeo aqui
ou clique para importar".

## 11. Persistência (electron-store)

Última pasta de saída · estado do toggle "corte exato" · última duração usada
no gerador.

Na primeira execução (sem nada salvo): "corte exato" **ligado**, duração
padrão **30.0s**, pasta de saída vazia — pedida antes da primeira exportação.
Depois disso vale sempre o último valor usado.

## 12. Critérios de sucesso do MVP

1. `npm start` abre o app.
2. Arrastar um MP4 carrega o vídeo e mostra a ficha correta.
3. Gerar cortes a cada 29.5s coloca os marcadores certos na timeline.
4. `S` no meio do vídeo adiciona um marcador na posição exata.
5. Arrastar um marcador atualiza as durações das partes ao vivo.
6. Exportar com "corte exato" produz arquivos cujas durações batem com a
   timeline (conferido por ffprobe, ±0.1s).
7. Cancelar no meio interrompe de fato e não deixa processo pendurado.
8. Reabrir o app lembra a última pasta usada.

---

## 13. Correções ao spec original

O `prompt-clipcutter-v2.md` tem contradições internas. Ficam registradas aqui
para não se perderem quando as próximas ferramentas forem construídas:

1. **`-c copy` vs. precisão de décimos** — são incompatíveis. Stream copy só
   corta em ponto-chave. Resolvido no v1 pelo toggle.
2. **Remoção de silêncio com `concat -c copy`** — não funciona: os limites de
   fala nunca caem em ponto-chave, e o resultado sai com quadros congelados e
   áudio dessincronizado. Precisa de `filter_complex` com
   `select`/`aselect` + `setpts`/`asetpts`, com recodificação obrigatória.
3. **Estimativa de tamanho na compressão** — CRF é qualidade constante e
   bitrate variável; não existe bitrate alvo pra multiplicar. Ou usa `-b:v`
   com two-pass, ou a barra "150MB → ~45MB" é chute e precisa estar rotulada
   como aproximada.
4. **Whisper local** — exige binário nativo por plataforma/arquitetura mais um
   modelo de 150MB a 1.5GB no instalador. A API resolve em uma tarde.
   Inverter a prioridade: API primeiro, local depois (se algum dia).
5. **`ffmpeg-static` + electron-builder** — o binário fica dentro do
   `app.asar` e não executa. Exige `asarUnpack` no config e correção do
   caminho em produção (`app.asar` → `app.asar.unpacked`). Funciona em dev e
   quebra no `.exe`, então só aparece tarde.
6. **Build macOS** — `.dmg` não sai de forma confiável do Windows, e sem
   assinatura/notarização (Apple Developer, US$99/ano) o macOS bloqueia o app.
   Enquanto não houver Mac, é intenção, não entrega.
7. **Preview ao vivo de resize e de "sem silêncio"** — não vem do FFmpeg. É
   simulação no renderer (CSS/canvas pro enquadramento; pular regiões no
   player pro silêncio). Implementação própria, não configuração.
8. **Encoding do arquivo** — o `.md` original está com mojibake (`Ã­`, `ð`):
   salvo em UTF-8 e lido como Latin-1. Salvar de novo em UTF-8 antes de
   reaproveitar, ou os ícones das abas viram lixo na UI.

## 14. Roadmap pós-MVP

Ordem sugerida, cada item com sua própria rodada de design → plano →
implementação:

1. Waveform na timeline (ajuda a cortar entre frases)
2. Remoção de silêncio (com a correção #2 acima)
3. Redimensionar (9:16, 4:5, 1:1) — com sidebar de abas entrando aqui
4. Comprimir (com a correção #3)
5. Extrair áudio
6. Lote
7. Transcrição via API (com a correção #4)
8. Empacotar `.exe` com FFmpeg embutido (com a correção #5)
