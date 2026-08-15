# SDD ledger — plan: docs/superpowers/plans/2026-08-15-clipcutter-mvp.md

Spec: docs/superpowers/specs/2026-08-15-clipcutter-mvp-design.md (read, binding authority)
Branch: feat/mvp (branched from main @ 0e5da94)

## Setup

Ruling: trabalhar em branch `feat/mvp` no próprio repo, sem git worktree — o repo
nasceu neste plano, não há trabalho paralelo, não há remoto, e o entregável é um
servidor de dev Electron que o usuário roda do caminho real do projeto. Um worktree
poria node_modules e o app num diretório temporário e exigiria merge para ganhar
zero isolamento. Custo se errado: baixo — `git branch` já isola o histórico, e o
worktree pode ser criado depois sem perder nada.

## Pre-flight scan

### Pares de tasks que compartilham arquivo ou interface

| A | B | Produz → Consome | Achado |
|---|---|---|---|
| T1 | T11-T15 | aliases `@shared`/`@renderer` no tsconfig+vite → imports do renderer | OK (corrigido na auto-revisão do plano) |
| T2 | T3,T4,T5,T7,T9,T10 | `types.ts` (CutPoint, Segment, CutMode, VideoInfo, FfmpegCheck, ExportRequest, JobProgress, JobResult, Prefs) → todos | OK, todos os tipos consumidos estão definidos em T2 |
| T2 | T11,T12,T13,T14 | `formatTime` → FileInfo, PlayerControls, Timeline, CutPanel | OK |
| T3 | T13 | `movePoint`/`removePoint` → App importa direto | OK — estado transitório, T14 rewira para `cuts.move`/`cuts.remove`; documentado em T14 Step 3 |
| T3 | T14 | módulo inteiro → `useCutPoints` | OK |
| T4 | T9 | `partFileName`, `uniqueFileName` → jobs.ts | OK, assinaturas batem |
| T4 | T15 | `outputExtension(mode, ext)` → useExport | OK |
| T5 | T8, T9 | `buildCutArgs({inputPath,outputPath,start,duration,mode})` → teste de integração e fila | OK |
| T6 | T8 | `createProgressReader()` → run.ts | OK |
| T7 | T10 | `locateBinaries()`, `probeVideo(ffprobePath, filePath)` → ipc.ts | OK |
| T8 | T9 | `runFfmpeg`, `FfmpegCancelled`, `type FfmpegHandle` → jobs.ts | OK, `FfmpegHandle` é exportado em T8 |
| T9 | T10 | `startExportJob(ffmpegPath, request, onProgress)` → ipc.ts | OK |
| T10 | T11 | `window.clip.checkFfmpeg/openVideoDialog/probeVideo` | OK |
| T10 | T11 | `window.electron.webUtils.getPathForFile` (drag & drop) | OK (corrigido na auto-revisão: preload mantém `exposeInMainWorld('electron', electronAPI)`) |
| T10 | T12 | `window.clip.fileUrl` + protocolo `clip://` | OK |
| T10 | T14, T15 | `getPrefs`/`setPrefs` | OK, chaves batem com `Prefs` |
| T11 | T12 | App com estado `video` → componente `Editor` | OK, T12 declara a troca explicitamente |
| T12 | T13, T14 | `Player` (`currentTime`, `seek`) | OK |
| T13 | T14 | props da `<Timeline>` rewiradas para o hook | OK |
| T14 | T15 | `cuts.segments` → `useExport(video, segments)` | OK, `segments` é `useMemo` (identidade estável) |

### Coerência interna de cada task

| Task | Texto concorda consigo mesmo? |
|---|---|
| T1 | **NÃO** — ver Ruling 1 (scaffold interativo) e Ruling 2 (electron-store ESM) |
| T2 | Sim — 11 testes cobrem as duas funções declaradas |
| T3 | Sim — conferi na mão: `generateTimesByDuration(0.1, 1)` dá 9 itens; `movePoint(...30.01)` colapsa como o teste espera |
| T4 | Sim — `uniqueFileName('live 12.03.mp4')` separa a extensão certa |
| T5 | Sim |
| T6 | Sim |
| T7 | Sim — `parseFps('30000/1001')` = 29.97 com o arredondamento de 2 casas |
| T8 | Sim |
| T9 | **NÃO** — ver Ruling 3 (teste de cancelamento pode ser instável) |
| T10 | Sim |
| T11 | Sim |
| T12 | Sim — mapa de teclas: `e.key.toLowerCase()` pega letras e espaço, o fallback `actions[e.key]` pega as setas |
| T13 | Sim, com uma imprecisão aceita (ver nota) |
| T14 | Sim |
| T15 | Sim |

Nota aceita (T13): a densidade das marcas da régua usa a largura medida no render
anterior (`800` no primeiro). Redimensionar a janela não recalcula até o próximo
render. É imprecisão visual, não defeito funcional — não entra no loop de correção.

## Rulings de pré-voo

Ruling 1 (T1): o scaffold NÃO pode rodar `npm create @quick-start/electron@latest .`
na raiz do repo. A pasta já tem `.git` e `docs/`, e o gerador faz pergunta
interativa quando o diretório não está vazio — um subagente ficaria pendurado
esperando stdin. O passo passa a ser: gerar em `tmp-scaffold/`, mover o conteúdo
para a raiz preservando `.git` e `docs/`, apagar `tmp-scaffold/`. Custo se errado:
baixo — se o gerador aceitasse a raiz, o resultado seria idêntico.

Ruling 2 (T1, T10): fixar `electron-store@^8.2.0`. Verificado com `npm view`: a
versão mais recente (11.x) declara `"type": "module"`, e o electron-vite emite
CommonJS para o processo main — o `require()` estouraria `ERR_REQUIRE_ESM` só na
Task 10, longe da causa. A v8 não declara `type`, então é CJS. Custo se errado:
baixo — ficar numa major antiga de uma biblioteca de preferências não tem impacto
funcional no MVP; migrar depois é trocar o import.

Ruling 3 (T9): o teste "cancela no meio" gera seu próprio vídeo maior
(`testsrc=size=1280x720:rate=30:duration=30`) em vez de reusar a fonte de 10s a
320x240. Com a fonte pequena, o `libx264 -preset veryfast` pode terminar os 3s
antes do `cancel()` dos 200ms e o teste passaria a falhar de forma intermitente,
que é pior que não ter teste. Custo se errado: a suíte fica alguns segundos mais
lenta.

Ruling 4 (T1 → T10-T15): `ELECTRON_RUN_AS_NODE=1` está setado no ambiente em que os
subagentes rodam. Confirmei na mão (`env | grep -i electron`) — não é invenção do
implementador da T1 nem defeito do scaffold: é artefato do harness (o Claude Code é
um app Electron e a variável vaza pros processos filhos). Com ela setada, o Electron
roda como Node puro e nenhuma janela abre. Consequência: os roteiros de verificação
manual das tasks 10-15 pedem `npm start`, e nenhum subagente vai conseguir ver a
janela. Decisão: (a) todo dispatch de T10-T15 instrui a limpar a variável para o
processo filho antes de rodar `npm start`; (b) subagente não afirma ter visto a
janela — reporta o que dá pra provar (o processo subiu, o Vite compilou, o console
ficou limpo) e declara o que não conseguiu observar; (c) a verificação visual de
verdade fica com o usuário no terminal dele, onde a variável não existe. Custo se
errado: um defeito puramente visual (cor, alinhamento) passa pelas revisões e só
aparece quando o usuário abrir o app.

## Progress

Task 1: implementado (commit c5e286d), DONE_WITH_CONCERNS — ressalvas eram (1) não
conseguiu confirmar a janela visualmente e (2) a variável de ambiente acima. Nenhuma
das duas é defeito de código.

Task 1: revisão — spec ✅, qualidade Aprovada, 1 Important + 3 Minor.
  ⚠️ resolvido pelo controller: histórico git íntegro (3 commits, os 2 de docs
     preservados) e `docs/specs` + `docs/plans` intactos. Verificado na mão. Não é gap.
  ⚠️ visual da janela: coberto pela Ruling 4, não é gap desta task.
Task 1: minor (deferred): `electron-builder.yml` ainda tem `productName: tmp-scaffold`
  — arquivo inerte, o plano exclui empacotamento.
Task 1: minor (deferred): `package.json` mantém `author`/`homepage` de template.
Task 1: minor (deferred): IPC de demonstração `ping` em `src/renderer/src/App.tsx` e
  `src/main/index.ts` — usa `window.electron` genérico em vez de `window.clip`.
  A T11 reescreve o App e a T10 mexe no main; carregar ponteiro no dispatch da T10
  para remover o handler `ping` do main, que a T11 não alcança.
Task 1: fix round 1/5 (1 addressed, 0 open — nome `tmp-scaffold` no package-lock.json
  quebrava `npm ci`; re-revisão confirmou que só os 2 campos de nome mudaram, sem
  churn de dependência; commits c5e286d..299f7bc)
Task 1: complete (commits 0e5da94..299f7bc, review clean)

Task 2: implementado (commit 852c02a), DONE. Revisão: spec ✅, qualidade Aprovada,
  0 Critical / 0 Important. TDD verificado como genuíno (RED = erro de import não
  resolvido antes de `time.ts` existir, GREEN = 11/11).
  ⚠️ resolvido pelo controller: o revisor não podia verificar se as tasks futuras
     consomem esses tipos sem desvio — é forward-looking por natureza, não é lacuna
     da T2. Cada revisão de task seguinte compara contra `types.ts`, e a revisão
     final da branch fecha a conta. Nada a corrigir aqui.
Task 2: minor (não-código, não vai pra triagem de merge): o relatório diz "8 tipos"
  e lista 9; e cita a mensagem de RED com texto ligeiramente diferente do brief.
  Ambos são deslize de narrativa do relatório, o código está correto.
Task 2: complete (commits 299f7bc..852c02a, review clean)

Task 3: implementado (commit 4b5c4dd), DONE, 25/25 testes.
Ruling 5 (T3): o implementador reportou 25 testes onde o plano dizia "PASS — 22
  testes". Contei na mão: o bloco de teste do próprio brief tem 25 `it()`, o arquivo
  commitado tem 25, e os nomes batem um a um. A contagem "22" no plano é erro meu de
  documentação, não desvio do agente. 25 é o número correto. Auditei as demais
  briefs (T2, T4, T5, T6) e as contagens estão certas — o erro é isolado na T3.
  Custo se errado: nenhum no código; se eu estivesse errado, o revisor pegaria
  testes extras que não existem no brief, e é justamente isso que peço pra ele
  verificar.

Task 3: revisão — spec ✅ (transcrição byte-a-byte do brief, zero desvio), qualidade
  "Needs fixes" por 1 Important plan-mandated. Sem Minor.
Ruling 6 (T3): o achado é REAL e é defeito do meu plano, não do implementador.
  A comparação `Math.abs(p.time - target) < MIN_GAP` em `addPoint`/`movePoint` usa
  subtração de ponto flutuante crua. Verifiquei na mão: `59.05 - 59` dá
  0.04999999999999716, então um ponto exatamente a MIN_GAP de distância é tratado
  como "colado" e rejeitado. Varredura de 0 a 1000s em passos de 0.1: 4773/10001
  valores (48%) sofrem o falso positivo — incluindo 59 e 88.5, que são exatamente o
  que `generateTimesByDuration(29.5, 100)` produz. O teste do brief usa 10.05 vs 10,
  que cai do lado seguro (0.05000000000000071), e por isso a suíte não pega.
  Autoridade: spec §5 diz "Pontos a menos de 0.05s um do outro colapsam" — estrito,
  logo exatamente MIN_GAP deve ser ACEITO. Decisão: aplicar `round3` na diferença
  antes de comparar, extraindo um helper `tooClose(a, b)` usado nos dois pontos, e
  adicionar teste de regressão com um par que expõe o bug (59.05 vs 59) — sem ele a
  correção fica desprotegida. Sintoma se não corrigido: o usuário gera cortes a cada
  29.5s, tenta marcar um ponto logo depois de 59s, e o marcador some sem explicação;
  ou arrasta um marcador pra perto de outro e o vizinho é apagado. Custo se errado:
  praticamente nulo — `round3` só normaliza a diferença para milissegundos, que é a
  precisão que o resto do módulo já usa.
Task 3: fix round 1/5 (1 addressed, 0 open; commits 4b5c4dd..f40a3e5). Re-revisão
  confirmou nos dois lados da fronteira: 0.049 ainda colapsa, 0.05 é aceito, e a
  varredura que antes dava 5904 falsos positivos passou a dar 0. Os 2 testes de
  regressão foram vistos falhando contra o código antigo (RED real no relatório).
  Nenhum dos 25 testes anteriores foi alterado — o diff do teste é inserção pura.
Task 3: PENDÊNCIA DO CONTROLLER — RESOLVIDA (commit 4d6cdc0): o bloco de código da
  Task 3 dentro do plano foi corrigido (helper `tooClose`, 2 testes de regressão,
  contagem 22→27), senão o documento continuaria entregando o bug para quem
  reexecutasse o passo.
Task 3: complete (commits 852c02a..4d6cdc0, review clean)

Task 4: implementado (commit 4dcf5a5), DONE, 12/12 (suíte 50/50).
Task 4: revisão — spec ✅, qualidade Aprovada, 0 Critical / 0 Important. O revisor
  percorreu na mão os casos fora dos testes (total=9/99/100/120/1000; `.gitignore`,
  `arquivo.`, nome sem ponto) e não achou comportamento errado.
  ⚠️ resolvido pelo controller: "os chamadores passam `total` consistente dentro de
     um mesmo job?" — verifiquei no plano da T9 (linha 1677): `const total =
     request.segments.length` é calculado UMA vez antes do laço e passado igual em
     toda chamada. Não é lacuna. CARREGAR para a revisão da T9: confirmar que a
     implementação mantém isso, porque recalcular `total` por arquivo faria a
     largura do zero à esquerda variar no meio da exportação.
Task 4: minor (deferred): `uniqueFileName` tem laço `for (let n = 2; ; n++)` sem teto
  de iterações; depende do callback `exists` terminar. Com `fs.existsSync` real sobre
  diretório finito termina trivialmente. O próprio revisor argumenta que travar é
  failure mode melhor que sobrescrever em silêncio. Triagem na revisão final.
Task 4: minor (deferred): os testes não cobrem `.gitignore`, extensão vazia com ponto
  final, nem total=100 exato — a implementação trata bem, mas sem rede.
Task 4: complete (commits 4d6cdc0..4dcf5a5, review clean)

Task 5: implementado (commit 74953e1), DONE, 7/7 (suíte 57/57).
Task 5: revisão — spec ✅, qualidade Aprovada, 0 Critical / 0 Important. O revisor
  leu o array token a token como o FFmpeg parsearia, nos dois modos, e confirmou:
  `-ss` do lado da entrada, `-t` e codecs do lado da saída, `-y` + caminho por
  último. Sem ambiguidade de `indexOf` (`-c` só existe no modo rápido, `-c:v`/`-c:a`
  só no exato). `toFixed(3)` não vira notação exponencial em nenhum valor alcançável.
  ⚠️ resolvido pelo controller: `Segment` é `{index,start,end}` e `CutArgsOptions` é
     `{start,duration}` — alguém precisa converter. Verifiquei o brief da T9 (linha
     188): `const duration = segment.end - segment.start`, passado em 204. Correto.
     CARREGAR para a revisão da T9: confirmar que a implementação faz essa conta, e
     não passa `segment.end` como duração — o sintoma seria cada parte saindo cada
     vez mais longa que a anterior.
Task 5: minor (deferred): `args.test.ts` não tem asserção de que `-t` vem DEPOIS de
  `-i` (só existe a de `-ss` antes de `-i`). Hoje o código está certo, mas uma
  regressão que movesse `-t` pro lado da entrada mudaria a semântica de "duração da
  saída" para "limite de leitura da entrada" sem quebrar nenhum teste. Lacuna do meu
  código de teste no plano, não do implementador. Correção sugerida, uma linha:
  `expect(args.indexOf('-t')).toBeGreaterThan(args.indexOf('-i'))`. Triagem na
  revisão final.
Task 5: minor (deferred): o ternário de modo não escala pra um terceiro `CutMode`;
  hoje a união é fechada em 'exact' | 'fast', então não é defeito presente.
Task 5: complete (commits 4dcf5a5..74953e1, review clean)

Task 6: implementado (commit d55165b), DONE, 8/8 (suíte 65/65).
Task 6: revisão — spec ✅, qualidade Aprovada, 0 Critical / 0 Important. O revisor
  traçou o buffer passo a passo nos 5 cenários que pedi: linha partida remonta
  corretamente; o buffer é limitado por construção (só o fragmento após a última
  quebra sobrevive); o `\r\n` passa por garantia real (`trim()` aplicado sempre antes
  do regex), não por acidente; leitura válida seguida de `N/A` mantém a válida; e
  `0` não é colapsado em "sem leitura" porque a checagem é `>= 0`, não truthiness.
  ⚠️ resolvido pelo controller: "este módulo é ligado ao processo real do FFmpeg em
     algum lugar?" — é a T8, que consome `createProgressReader`. Forward-looking, não
     é lacuna da T6. CARREGAR para a revisão da T8.
Task 6: minor (deferred): faltam 2 casos de teste para caminhos que o código já trata
  certo — leitura válida seguida de `N/A` (deve devolver a válida) e `out_time_us=0`
  (deve devolver 0, não null). Sem eles, uma regressão nesses caminhos passa batida.
Task 6: complete (commits 74953e1..d55165b, review clean)

Task 7: implementado (commit 953361a), DONE_WITH_CONCERNS — a ressalva era a contagem
  de testes, e o implementador estava certo.
Ruling 7 (T7): meu despacho mandou esperar 10 testes de probe / suíte 76. Contagem
  errada minha pela SEGUNDA vez neste plano (a primeira foi a Ruling 5). O brief tem
  9 `it()` de probe + 1 de integração = 10 novos, suíte 75. O implementador contou,
  viu que não fechava e me reportou em vez de inventar um décimo teste — que é
  exatamente o comportamento que venho pedindo desde a T4. Plano corrigido em
  c9f08f9. Padrão identificado: eu conto blocos de teste de cabeça e erro. Custo se
  errado: nenhum, o revisor recontou de forma independente e confirmou 9+1.
Task 7: revisão — spec ✅, qualidade Aprovada, 1 Important plan-mandated.
Ruling 8 (T7): CORRIGIR. O achado é real: `streams.find(s => s.codec_type ===
  'video')` pega o PRIMEIRO fluxo de vídeo, e capa embutida (`attached_pic`) é
  reportada pelo ffprobe como fluxo de vídeo. A ordem depende do muxer, não é
  garantida. Arquivo vindo de `yt-dlp --embed-thumbnail` — que existe no toolchain
  dele, a skill /watch usa yt-dlp — cairia nisso. Sintoma: resolução e FPS lidos da
  miniatura em vez do vídeo. A duração NÃO é afetada (vem de `format`, não do
  stream), então a timeline e a exportação continuam corretas; o estrago é o FPS
  errado quebrando o passo quadro a quadro (`,`/`.`) e a ficha do arquivo mostrando
  a resolução da capa. Autoridade: spec §3 item 2 exige que a ficha mostre resolução
  e FPS corretos. Decisão: filtrar `disposition.attached_pic`, sem fallback — se o
  único fluxo de vídeo for capa (ex: MP3 com capa), o arquivo DEVE mesmo ser recusado
  como "sem faixa de vídeo". Custo se errado: quase nulo; o filtro só descarta fluxo
  explicitamente marcado como capa, e `disposition` ausente mantém o fluxo.
Task 7: minor (NÃO é defeito): o revisor apontou que a rejeição do `execFile` em
  arquivo corrompido chega ao usuário como texto cru em inglês do ffprobe. Verifiquei
  o spec §8: "Arquivo não é vídeo legível → Mostra a mensagem do ffprobe". É
  literalmente o comportamento especificado. Nada a fazer.
Task 7: minor (deferred): mensagem de commit sem diacríticos ("localizacao") — texto
  do meu próprio brief, cosmético.
Task 7: fix round 1/5 (1 addressed, 0 open; commits 953361a..0b0ec1f). Re-revisão
  confirmou: filtro usa `!== 1` (mantém stream sem `disposition`), SEM fallback,
  `disposition` tipado, os 2 testes de regressão foram vistos falhando de verdade
  ('mjpeg' onde esperava 'h264'; não lançou onde devia lançar), nenhum dos 9 testes
  anteriores alterado, e nada fora de probe.ts/probe.test.ts foi tocado.
Task 7: plano alinhado (commit 8d902a1) — filtro, tipo, 2 testes e contagens 9→11 /
  75→77 agora estão no documento.
Task 7: complete (commits d55165b..8d902a1, review clean)

Task 8: implementado (commit bd1fb3e), DONE, 3/3 integração (suíte 80/80). Órfãos:
  nenhum `ffmpeg.exe` sobreviveu em 4 execuções; cancelamento não oscilou.
Task 8: revisão — spec ✅, qualidade "Needs fixes", 2 Important plan-mandated + 4 Minor.
  ⚠️ resolvido pelo controller: o revisor não pôde provar a fase RED porque teste e
     implementação vieram no mesmo commit. Isso é propriedade estrutural do MEU plano
     (um commit por task), não indício de TDD forjado — vale para todas as tasks 2-8.
     O relatório traz saída específica (linha/coluna, "Failed Suites 1"). Aceito.
Ruling 9 (T8): CORRIGIR o erro de spawn não localizado. `child.on('error', err =>
  reject(err))` repassa o erro cru do Node ("spawn ffmpeg ENOENT"). A constraint de
  idioma é explícita e esse texto chega ao usuário via jobs.ts → JobResult.message →
  UI. Probabilidade baixa (o `locateBinaries` barra na abertura), mas a correção é
  uma linha. Custo se errado: nulo.
Ruling 10 (T8): CORRIGIR o ponto cego do teste de cancelamento — este é o
  load-bearing. Verifiquei o código: o `reject(FfmpegCancelled)` mora DENTRO do
  handler de `close`. Então o mecanismo descrito pelo revisor está errado (não há
  falso "cancelado"), mas a consequência é pior: se o `taskkill` falhar e o FFmpeg
  sobreviver, `close` nunca dispara e a promessa NUNCA resolve — o botão Cancelar
  gira pra sempre. E o teste é de fato cego: com `cancelled=true`, o close rejeita
  como cancelado independentemente do código de saída, então um `killTree` totalmente
  quebrado passaria no teste, só mais devagar. A única evidência de que o tree-kill
  funciona hoje é o `tasklist` manual do implementador, que não está na suíte.
  Decisão: asserção de tempo decorrido no teste (cancelamento resolve em < 3s; o
  encode natural de 30s a 720p leva muito mais), o que põe o mecanismo sob teste
  automatizado permanente. Margem enorme, sem risco de intermitência.
Ruling 11 (T8): CORRIGIR barato — parar de engolir o erro do `taskkill`
  (`() => {}`). Registrar em console.error, sem rejeitar (o taskkill retorna erro
  benigno quando o processo já morreu na corrida, rejeitar geraria falso alarme).
  Dá rastro quando o cancelamento falhar.
Task 8: minor (deferred): NÃO estou adicionando watchdog que rejeita se o processo
  nunca fechar após cancelar. Seria a proteção real contra o travamento acima, mas é
  escopo que o plano não pediu e o spec não exige, e o `taskkill /T /F` sobre filho
  próprio é confiável (4/4 aqui). Registrado para triagem na revisão final. Se o
  usuário relatar "cancelei e travou", esta é a primeira suspeita.
Task 8: minor (deferred): `onProgress` chamado sem try/catch dentro do handler de
  stdout; se o consumidor lançar (ex: `webContents.send` após a janela fechar), a
  exceção escapa do dispatch de evento.
Task 8: minor (deferred): dupla-liquidação da promise (`error` + `close`) depende do
  no-op nativo do Promise, sem guarda explícita nem comentário.
Task 8: minor (deferred): linhas de stderr partidas entre chunks viram entradas
  separadas no buffer de diagnóstico (cosmético).
Task 8: minor (deferred): `cancel()` após saída normal ainda chama taskkill em PID
  obsoleto (risco teórico de reuso de PID).
Task 8: fix round 1/5 (2 addressed, 1 open; commit 6c62958). Erro de spawn localizado
  e log do taskkill: OK. A asserção de tempo FALHOU no seu próprio teste de sanidade.
Ruling 12 (T8): minha Ruling 10 estava errada na premissa. Eu assumi que o encode
  natural de 30s a 720p levaria "vários segundos"; nesta máquina leva 889ms. Com o
  killTree quebrado de propósito, o teste passou em 889ms, abaixo do limite de 3000ms
  — ou seja, a asserção que eu criei para dar dente ao teste continuou sem dente. Só
  descobri porque exigi o teste de sanidade (quebrar o killTree e confirmar que o
  teste falha); sem ele, eu teria fechado a task acreditando ter resolvido.
  Decisão: abandonar a prova por tempo, que depende da velocidade da máquina, e provar
  pelo ESTADO DO ARQUIVO. Se o taskkill funciona, o ffmpeg morre no meio e o arquivo
  de saída fica truncado (com `-movflags +faststart` o índice é escrito no fim, então
  o arquivo nem é legível). Se o taskkill falha, o encode termina e o arquivo tem os
  30s completos e legíveis. A diferença é categórica, não temporal. Mantenho um limite
  de tempo frouxo (10s) só como detector de travamento. Custo se errado: se o ffprobe
  conseguir ler duração parcial de um mp4 truncado, a asserção aceita `null` OU
  duração < 5s, então cobre os dois comportamentos.
Task 8: fix round 2/5 (3 addressed, 0 open; commits bd1fb3e..18d81db). Teste de
  sanidade saiu certo dos dois lados: killTree intacto → duração null (arquivo
  ilegível), killTree quebrado → duração 30 e o teste FALHA. Restaurado e conferido
  byte a byte por `git diff`. O re-revisor não aceitou os números de cara — foi
  atrás do mecanismo e confirmou que eles são inevitáveis: o muxer de mp4 grava o
  índice (moov) só no fim, e o taskkill é TerminateProcess forçado, então processo
  morto nunca grava índice. Os dois estados não podem convergir.
Task 8: minor (deferred): `duracaoOuNull` engole TODO erro do ffprobe e devolve null.
  Se o ffprobe sumisse do ambiente, todo cenário colapsaria em null e o teste perderia
  a capacidade de falhar. Descartado empiricamente aqui (a rodada com killTree
  quebrado leu 30, provando que o ffprobe funciona), mas é fragilidade do helper.
Task 8: plano alinhado (commit dd17254) — erro localizado, log do taskkill, fonte
  pesada, helper `duracaoOuNull` e o teste categórico, com comentário explicando por
  que a versão por tempo foi abandonada.
Task 8: complete (commits 8d902a1..dd17254, review clean)

Task 9: NEEDS_CONTEXT — implementação pronta, não commitada. O agente achou 2
  defeitos no MEU arquivo de teste e parou. Verifiquei os dois na mão: procedem.
Ruling 13 (T9): três testes ("gera uma parte por segmento", "nomeia as partes em
  ordem", "reporta progresso") chamam `request()` sem sobrescrever `outputDir`, então
  compartilham a mesma pasta `saida`. O primeiro escreve fonte_parte_01/02/03; o
  segundo roda de novo, o `uniqueFileName` faz o trabalho dele CORRETAMENTE e gera
  `_01 (2).mp4`, e aí a asserção de nome exato do segundo teste quebra. Não é
  intermitência — é ordem de execução, reproduzível. O código está certo; o teste é
  que compartilha estado. Decisão: cada um desses três testes ganha sua própria
  subpasta. O teste "nunca sobrescreve" continua rodando duas vezes na MESMA pasta,
  que é o ponto dele. Custo se errado: nenhum, isolar pasta de teste não altera o que
  cada asserção verifica.
Ruling 14 (T9): o import de teste traz `writeFile` e nunca usa. Com
  `noUnusedLocals: true` no tsconfig, o `npm run typecheck` falha. Erro meu de
  redação. Decisão: remover do import.
Task 9: observações úteis do agente — cancelamento deu `files.length = 0` em 325ms
  (bem abaixo do limite de 3, sem risco de intermitência); `rmSync` do arquivo parcial
  não deu EBUSY/EPERM; o try/catch do `mkdirSync` de fato resolve em vez de lançar.
Task 9: NOTA para a revisão: o `console.error('taskkill falhou:')` que introduzi na
  Ruling 11 aparece no output de teste em algumas execuções, porque o taskkill devolve
  erro benigno quando o processo já morreu na corrida. É consequência esperada da
  decisão, mas polui a saída e reduz o valor do log (quem grita sempre não avisa
  nada). Não vou pré-julgar para o revisor: se ele levantar, eu adjudico.
  → O revisor NÃO levantou. Fica como está.

Task 9: implementado (commit 938c092), DONE, 6/6 (suíte 86/86, 3 execuções).
  As duas verificações carregadas das revisões da T4 e T5 passaram: `total` é
  calculado uma vez fora do laço (jobs.ts:34) e chega igual em toda chamada; a
  duração é `segment.end - segment.start` (jobs.ts:44), não `segment.end`.
  O revisor confirmou linha a linha que o isolamento de pastas NÃO enfraqueceu
  asserção nenhuma — "nomeia as partes em ordem" ainda exige os três nomes exatos.
Task 9: revisão — spec ✅, qualidade "Needs fixes", 1 Important plan-mandated + 2 Minor.
Ruling 15 (T9): CORRIGIR o `rmSync` desprotegido. Verifiquei o arquivo: o `mkdirSync`
  está dentro de try/catch COM um comentário meu explicando que a rejeição travaria a
  UI em "exportando" — e vinte linhas abaixo o `rmSync(outputPath, {force:true})` roda
  cru dentro do catch. `force: true` suprime só ENOENT; EBUSY/EPERM (arquivo travado
  por antivírus ou indexação do Windows logo após o processo sair) passa direto. Se
  lançar ali, o throw escapa da IIFE assíncrona e a promise REJEITA em vez de resolver
  num JobResult — exatamente o que o meu próprio comentário diz que não pode
  acontecer. O módulo aplica a invariante de forma inconsistente consigo mesmo.
  Nenhum dos 6 testes cobre: o único que entra no catch usa arquivo inexistente, então
  o ffmpeg nunca cria saída e o rmSync cai no caso ENOENT que o `force` já perdoa.
  Decisão: try/catch em volta do rmSync, log, e seguir devolvendo o JobResult.
  Custo se errado: nulo — na pior hipótese sobra um arquivo parcial em disco, que é
  infinitamente melhor que a UI travada.
Task 9: ⚠️ resolvido pelo controller: "a UI pode montar um ExportRequest com zero
  segmentos?" — não. `segmentsFrom` só devolve lista vazia se a duração for <= 0, e
  vídeo carregado tem duração > 0; sem pontos de corte o resultado é uma parte só.
  Na prática segments.length >= 1 sempre.
Task 9: minor (deferred): mesmo assim, a emissão final de progresso usa
  `segmentIndex: total - 1` sem guarda, então uma lista vazia emitiria índice -1. O
  JobResult sairia correto; é evento espúrio, não resultado errado. Guarda de 1 linha
  (`if (total > 0)`) fica para triagem final.
Task 9: minor (deferred): se o cancelamento e um erro real (disco cheio) acontecerem
  juntos, o job reporta 'cancelled' e mascara o erro. Inerente ao desenho do brief.
Task 9: fix round 1/5 (1 addressed, 0 open; commits 938c092..198cd84). Re-revisão
  confirmou: rmSync dentro do próprio try/catch que engole e não relança; os dois
  caminhos de retorno (cancelled/error) byte-idênticos com discriminante, message e
  failedIndex preservados; nada mais no bloco pode lançar; `finally { current = null }`
  intacto; nenhum arquivo de teste tocado.
Task 9: plano alinhado (commit be63732) — pastas isoladas nos 3 testes, import morto
  removido, guarda do rmSync, com comentários explicando cada um.
Task 9: complete (commits dd17254..be63732, review clean)

Task 10: implementado (commit 9345f56), DONE, 89/89 (86→89 com protocol.test.ts).
  Build dos 3 bundles OK; Electron subiu com 4 processos estáveis e console limpo
  por ~16s; electron-store v8 não precisou de adaptação nenhuma.
Ruling 16 (T10 → T11-T15): a forma que eu passei para limpar a variável de ambiente
  (`ELECTRON_RUN_AS_NODE= npm start`) NÃO funciona neste shell — a variável continua
  setada e o Electron roda como Node puro e quebra em `electron.app` undefined. O
  comando correto é `env -u ELECTRON_RUN_AS_NODE npm start`. Descoberto pelo
  implementador da T10, que corrigiu e me avisou em vez de desistir da verificação.
  USAR ESTA FORMA em todos os despachos das tasks 11-15. Custo se errado: o agente
  conclui que o app não sobe e reporta falha inexistente.
Task 10: revisão — spec ✅, qualidade Aprovada, 1 Important plan-mandated + 2 Minor.
  Fronteira de segurança verificada: `exposeInMainWorld` recebe objeto de 11 funções
  puras, sem `ipcRenderer` cru, sem `require`, sem namespace de módulo;
  `contextIsolation: true` e `nodeIntegration: false` intactos; `registerSchemes-
  AsPrivileged` no topo do módulo (linha 7) ANTES do whenReady (linha 48) e
  `handleClipProtocol` dentro do then (linha 59) — a ordem certa, conferida no arquivo
  real e não só pela presença das chamadas; handler `ping` removido dos dois lados;
  `toClipUrl` e `fileUrl` conferidos caractere a caractere, idênticos.
  (Nota: falei "dez métodos" no despacho, são 11. Terceira contagem errada minha
  neste plano. Não afetou nada — o revisor recontou e conferiu os 11.)
Ruling 17 (T10): CORRIGIR a corrida do `currentJob`. É um único slot de módulo. Se
  um segundo `export:start` chegar antes do primeiro terminar, a referência do
  primeiro é sobrescrita; e quando QUALQUER um dos dois liquida, o `finally` zera
  `currentJob`, então o `cancelExport` vira no-op contra o job que ainda está rodando.
  Cenário real: duplo clique no botão Exportar antes do React re-renderizar — o
  handler roda duas vezes. Resultado: arquivos duplicados com sufixo (2) e o botão
  Cancelar sem efeito. Isso é load-bearing para a T15, cujo roteiro de verificação
  manual exige que cancelar funcione. Autoridade: spec §7 exige cancelamento
  funcional. Decisão: barrar no processo principal (não na UI) — um segundo
  `export:start` com job em andamento devolve JobResult de erro. O guard na UI pode
  ser vencido por corrida; o do main não. Custo se errado: nulo, exportar duas vezes
  ao mesmo tempo nunca foi funcionalidade pedida.
Task 10: minor (deferred): `src/preload/index.d.ts` ainda declara `Window.api`, mas
  nada expõe `window.api` desde que este diff removeu o `exposeInMainWorld('api')`.
  Tipo mente sobre o runtime; inofensivo hoje.
Task 10: minor (deferred): `protocol.handle` não valida o caminho recebido (relativo,
  `..`, UNC). O revisor avaliou honestamente: o renderer só passa caminhos vindos de
  diálogo nativo ou `getPathForFile`, e explorar exigiria já ter execução de JS no
  renderer isolado — ponto em que existem ataques mais simples. Característica de
  desenho, não defeito a corrigir agora.
Task 10: fix round 1/5 (1 addressed, 0 open; commits 9345f56..c323f3e). Re-revisão
  confirmou que o guard fecha a corrida DE FATO, com o raciocínio: a checagem
  `if (currentJob)` e a atribuição `currentJob = job` são ambas síncronas, e o
  primeiro `await` só vem depois — então o event loop de thread única não tem onde
  encaixar um segundo handler entre as duas. À prova de corrida por posição, não por
  lock. Guard antes do `startExportJob` (nenhum processo nasce antes de recusar),
  JobResult bem formado, caminho feliz e encaminhamento de progresso intactos.
Task 10: plano alinhado (commit ccbd5a8).
Task 10: complete (commits be63732..ccbd5a8, review clean)

Task 11: implementado (commit 5955fb3), DONE, 93/93. Investigou os 3 candidatos que
  apontei lendo os tipos instalados; nenhum se materializou.
Task 11: revisão — spec ❌ (pelo achado 1), 2 Important plan-mandated + 3 Minor.
Ruling 18 (T11): CORRIGIR o `formatSize` na fronteira de unidade. Reproduzi na mão:
  a escolha da unidade usa o valor CRU (`value >= 1024`), mas a exibição usa
  `toFixed(1)`, que arredonda por conta própria. Um arquivo de 1.048.575 bytes dá
  1023.999 KB — não promove pra MB — e o toFixed exibe "1024.0 KB". Mesmo defeito em
  toda fronteira: 1.073.741.823 vira "1024.0 MB" em vez de "1.0 GB". Os 4 testes do
  brief (512, 52428800, 2147483648, 0) não tocam essa faixa. Decisão: comparar o
  valor JÁ arredondado na condição do laço (`Number(value.toFixed(1)) >= 1024`).
  Verifiquei que os 4 casos existentes continuam idênticos. Mais teste de regressão
  com 1048575 e 1073741823. Custo se errado: nulo, a mudança só afeta a faixa que
  hoje está errada.
Ruling 19 (T11): CORRIGIR o pisca-pisca do `onDragLeave`. O handler zera o destaque
  em qualquer `dragleave`, sem checar para onde o ponteiro foi. Os filhos da zona
  (ícone, dois parágrafos, o parágrafo de erro) recebem alvo de arraste normalmente, e
  com `p-16` de respiro o cursor quase certamente cruza um deles ao trazer o arquivo —
  então a borda azul apaga e acende. Atinge diretamente o passo 9.2 do roteiro de
  aceitação do próprio brief. Decisão: guardar com
  `if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)`. Custo se
  errado: nulo; `contains(null)` devolve false, então sair da janela ainda limpa.
Task 11: minor (deferred): classes hex literais em vez dos tokens `@theme` já
  definidos; mudança de paleta exigiria varrer arquivos. Era assim no brief.
Task 11: minor (deferred): arrastar texto/URL (não-arquivo) ainda acende o destaque
  azul antes de não fazer nada no drop. `files[0]` está guardado, não quebra.
Task 11: fix round 1/5 (2 addressed, 0 open; commits 5955fb3..03bb9d4). Re-revisão
  derivou os 6 casos do formatSize na mão e confirmou que os 4 originais não mudaram;
  checou que o laço não gira sem parar na unidade final (a guarda de índice barra
  antes); confirmou o RED real dos 2 testes novos com as strings erradas; guarda do
  dragleave idêntica à prescrita, com o caso "saiu da janela" preservado.
Task 11: plano alinhado (commit b28ba84).
Task 11: complete (commits ccbd5a8..b28ba84, review clean)

Task 12: implementado (commit 5449af3), DONE_WITH_CONCERNS, 95/95 (sem testes novos,
  por decisão do plano). Investigou os 4 candidatos que apontei e trouxe respostas
  concretas: as setas SÓ funcionam pelo segundo caminho da busca (`?? actions[e.key]`,
  porque 'arrowleft' minúsculo não existe no mapa) — funciona, mas é carga viva, não
  código morto; `fps === 0` é alcançável de verdade (ffprobe devolve "0/0"); o
  seek-to-duration do onEnded não trava o elemento.
Task 12: revisão — spec ❌ por 1 Important plan-mandated + 2 Minor.
  BOA NOTÍCIA que resolve preocupação minha: a guarda de teclado checa `tagName`, não
  `type`, então já cobre o input numérico e o slider da T14 e o checkbox da T15 —
  DESDE QUE sejam elementos nativos. CARREGAR para T14 e T15: usar `<input>` nativo,
  não componente customizado, senão a guarda para de enxergar.
Ruling 20 (T12): CORRIGIR o estado `playing` defasado. Verifiquei a cadeia: `playing`
  só é escrito dentro de `toggle` e `stepFrame` — nada escuta os eventos nativos do
  elemento. Se o vídeo termina sozinho, o React continua achando que toca e o botão
  segue mostrando "pausar". Aí o usuário aperta o que parece ser pausar, o `toggle`
  pergunta `element.paused` (verdadeiro, porque acabou) e chama `play()` — e pela
  especificação do HTML, dar play num vídeo que chegou ao fim rebobina pro zero.
  Resultado: aperta pausar, o vídeo recomeça. Alcançável pelo roteiro de aceitação do
  próprio brief (apertar L até o fim). Autoridade: spec §3 item 3 exige play/pause
  funcional. Decisão: escutar `play`, `pause` e `ended` no elemento e deixar ELE ser a
  fonte única da verdade; remover os `setPlaying` imperativos do toggle e do
  stepFrame. Isso também cobre qualquer outra origem de pausa no futuro. Custo se
  errado: baixo — se `play()` for rejeitado (política de autoplay), o evento não
  dispara e o estado fica falso, que é justamente o correto.
Task 12: minor (deferred): o laço de animação redesenha o Editor ~60x/s desde a
  montagem, sem depender de estar tocando. Hoje só o texto de tempo consome; virou
  preocupação registrada para T13-T15.
Task 12: minor (deferred): a guarda de teclado deixaria de proteger se alguma task
  futura trocar input nativo por componente customizado.
Task 12: fix round 1/5 (1 addressed, 0 open; commits 5449af3..d9ccc6b). Re-revisão
  confirmou os 3 listeners anexados e removidos, as 3 escritas imperativas removidas,
  os comandos play()/pause() preservados, e o ref populado a tempo (efeitos rodam
  depois do commit). Percorreu 5 cenários de estado defasado — buscar pausado, travar
  carregando, play recusado por autoplay, fim natural, pausa manual — e nenhum sobrou.
  O implementador concordou com meu raciocínio e melhorou a distinção: o bug nunca foi
  "play num vídeo terminado rebobina" (isso é a especificação), foi o ícone mentir
  sobre o estado e transformar uma intenção de pausar em reinício.
Task 12: plano alinhado (commit 3615c16).
Task 12: complete (commits b28ba84..3615c16, review clean)

Task 13: implementado (commit 34f8ee6), DONE_WITH_CONCERNS, 95/95. Pulou o passo 3 do
  brief (semear pontos de depuração) por instrução minha — não pode ver nada e só
  criaria risco de lixo no commit. Foi conferir se o problema da largura da régua era
  regressão dele: descobriu que o mesmo padrão já existia no VideoPlayer. Distinguir
  "eu introduzi" de "já era assim" evitou correção desnecessária.
Task 13: revisão — spec ✅, qualidade "Needs fixes", 1 Important + 3 Minor.
Ruling 21 (T13): CORRIGIR a falta de `setPointerCapture`. Passei sem pré-julgar
  gravidade e o revisor chegou a Important sozinho, com argumento melhor que o meu: o
  contêiner tem só 16px de folga além da trilha, então qualquer arrasto que ultrapasse
  isso num único quadro de entrada dispara `pointerleave` e congela o marcador no meio
  do gesto, sem pista visual de que a interação acabou. E como o `movePoint` limita a
  `[0.05, duração-0.05]`, arrastar até a borda é operação NORMAL, não canto. Sem
  corrupção e sem estado preso, mas lido pelo usuário como "o arrasto quebrou".
  Autoridade: spec §3 item 6 exige arrastar marcador. Decisão: capturar o ponteiro no
  pointerdown do marcador. Com captura ativa, os eventos de fronteira deixam de
  disparar no contêiner e o `pointermove` continua chegando por bolha (o marcador é
  descendente), então os handlers existentes seguem funcionando sem mudança. Custo se
  errado: nulo, é o mecanismo padrão da plataforma pra exatamente isso.
Task 13: minor (deferred): clique com botão DIREITO na trilha vazia também busca — o
  `onPointerDown` não checa `e.button`. Move o playhead sem querer. Correção: gatear
  com `e.button === 0`.
Task 13: minor (deferred): playhead em 100% transborda ~2-6px da trilha; cai dentro do
  respiro do painel, então quase certamente não escapa visualmente. Cosmético.
Task 13: minor (deferred, NÃO é da T13): num vídeo de 2h as marcas da régua saem como
  "105:00.000" em vez de "1:45:00", porque o `formatTime` não converte minuto em hora.
  Foi decisão deliberada minha no spec §escopo (formato mm:ss.mmm). Mas o usuário corta
  gravações longas — aulas e imersões — então vale reconsiderar na triagem final. Não
  é defeito da Timeline, que corretamente não reimplementou formatação.
Task 13: fix round 1/5 (1 addressed, 0 open; commits 34f8ee6..acd9938). O implementador
  confirmou meu raciocínio sobre a bolha em vez de aceitar, e o re-revisor chegou à
  mesma conclusão INDEPENDENTEMENTE, com o mecanismo: a captura redireciona o alvo mas
  não altera a bolha, e suprime as transições de fronteira nos outros elementos — que
  é exatamente o que remove o congelamento. Handlers existentes intactos, um arquivo só.
Task 13: plano alinhado (commit 1ea893e).
Task 13: complete (commits 3615c16..1ea893e, review clean)

Task 14: implementado (commit 8b7f9cb), DONE_WITH_CONCERNS, 95/95. Três ressalvas.
Ruling 22 (T14): MANTER o "Gerar cortes" substituindo a lista inteira. O implementador
  apontou, com razão, que isso descarta em silêncio os marcadores colocados na mão e
  contradiz o discurso de "os dois modos se misturam livremente". Pesei as
  alternativas: (a) MESCLAR em vez de substituir parece resolver, e é idempotente se
  o usuário clicar duas vezes com a mesma duração (o `addPoint` deduplica) — mas
  quebra feio no caso real de TROCAR a duração: gerar a cada 29.5s e depois a cada 20s
  deixaria 29.5/59/88.5 E 20/40/60/80 empilhados, um amontoado que não é divisão
  nenhuma; (b) rastrear a procedência de cada ponto para substituir só os gerados
  contradiz o núcleo do desenho (spec §5: depois de entrar na lista, ninguém sabe de
  onde o ponto veio) e adiciona estado. Substituir é a única semântica em que "gerar
  a cada X segundos" significa o que diz quando X muda. Autoridade: spec §5.
  Custo se errado: o usuário perde marcadores manuais ao clicar em Gerar. Mitigação
  existente: o botão "Limpar" é separado, então Gerar não é o único jeito de zerar, e
  o contador ao vivo mostra a mudança na hora. LEVAR AO USUÁRIO na entrega — é decisão
  de produto dele, e a alternativa (botão com rótulo "Regerar" quando já há pontos) é
  barata se ele preferir.
Task 14: as outras 2 ressalvas foram passadas ao revisor SEM pré-julgamento de
  gravidade: (a) corrida entre o efeito que carrega a preferência e o usuário digitando
  antes dela resolver; (b) vídeo curto (~4s) onde o slider trava no máximo mas o campo
  numérico e o estado ficam em 30, os dois discordam na tela, e "Gerar cortes" produz
  0 marcadores em silêncio.
Task 14: revisão — spec ✅, qualidade "Needs fixes", 1 Important + 3 Minor. Delegação,
  rewiring, teclado, memoização e a lógica do destaque foram todos traçados na mão e
  conferidos. O revisor confirmou que apertar S duas vezes no mesmo ponto não duplica
  E não gasta re-render, porque o `addPoint` devolve a MESMA referência e o React
  desiste da renderização por `Object.is`.
Ruling 23 (T14): CORRIGIR a falta de limite no `chunk` contra a duração do vídeo. O
  revisor escalou a ressalva (b) do implementador de Minor para Important com um
  enquadramento melhor: não é desalinhamento visual, é PERDA DE DADOS. Cadeia: sessão
  anterior salva 30s; usuário abre clipe de 4s; o `<input type="range">` trava o valor
  renderizado em max=4 (comportamento do navegador) mas o `<input type="number">` NÃO
  limita o valor exibido (min/max ali só governam estilo de inválido), então mostra 30;
  os dois controles discordam na tela. Aí "Gerar cortes" chama generate(30) numa
  duração de 4, recebe lista vazia, e SUBSTITUI os pontos que o usuário já tinha
  marcado na mão por nada — sem erro, sem estado desabilitado, sem explicação. Nasce do
  cruzamento de duas exigências do próprio spec (§11 persistir a duração + §3 item 6
  limitar o slider à duração do vídeo). Decisão: limitar na carga da preferência.
  Custo se errado: nulo; a preferência salva NÃO é sobrescrita (só `changeChunk`
  persiste), então o 30 sobrevive para o próximo vídeo longo.
Task 14: minor (deferred): corrida da preferência — o revisor avaliou sozinho e chegou
  a Minor com bom argumento: o Editor monta uma vez por sessão, a janela é um
  round-trip de IPC, e o pior caso é um valor revertido que o usuário redigita.
Task 14: minor (deferred): `changeChunk` grava a preferência a CADA `onChange`, e
  arrastar o slider dispara continuamente — cada micro-tique vira escrita síncrona em
  disco no processo principal. Não é incorreto, é desperdício; um debounce resolveria.
Task 14: minor (deferred): `CutPanel` repete `0.05` cru em vez de importar `MIN_GAP`.
Task 14: NOTA para T15: o objeto `cuts` é literal novo a cada render (mesmo padrão do
  `usePlayer`). Um `useCallback(fn, [cuts])` reconstruiria a cada quadro; só
  `useCallback(fn, [cuts.segments])` é seguro, porque `segments` é memoizado e estável.
Task 14: fix round 1/5 (1 addressed, 0 open; commits 8b7f9cb..24a70ed). Re-revisão
  traçou os 3 números (4s→4, 30s→30, 3600s→30) e confirmou que o caso do vídeo longo
  passou intacto; confirmou que NENHUM `setPrefs` foi adicionado no efeito — que era o
  ponto mais provável de alguém implementar demais por prestatividade; `changeChunk`
  intacto como único caminho de persistência.
Task 14: plano alinhado (commit cd48683).
Task 14: complete (commits 1ea893e..cd48683, review clean)

Task 15: implementado (commit 277d65f), DONE_WITH_CONCERNS, 95/95.
Task 15: revisão — spec ✅, qualidade "Needs fixes", 1 Important plan-mandated + 2 Minor.
  As 3 restrições carregadas foram todas satisfeitas e VERIFICADAS: depende de
  `cuts.segments` (memoizado) e não do wrapper; checkbox nativo; nenhuma trava
  concorrente na UI. O revisor também confirmou de forma independente três coisas que
  o implementador só tinha afirmado: editar cortes durante a exportação é inofensivo
  porque o `request` chega ao main como cópia estrutural do IPC; exportação com zero
  segmentos é inalcançável (o `segmentsFrom` sempre devolve ao menos uma parte e o
  `probeVideo` recusa duração <= 0); e "Abrir pasta" não pode ser clicado com pasta
  nula porque só renderiza sob resultado 'done', que exige ter passado pelo start.
Ruling 24 (T15): CORRIGIR a reentrância do `start()`. E o achado é o REVERSO da minha
  própria Ruling 17: ao fazer o processo principal recusar depressa a segunda
  exportação, criei uma promessa rápida correndo contra a lenta. Cadeia: dois cliques
  quase simultâneos; ambos passam pelo `if (!outputDir) return`; o main aceita o
  primeiro e recusa o segundo na hora; a recusa resolve antes, seu `finally` zera
  `running` e seu `then` grava o erro — e como a barra de progresso E o botão Cancelar
  são condicionados a `running`, os dois somem enquanto o ffmpeg real segue rodando.
  O estado se corrige sozinho quando o job verdadeiro termina, mas até lá o
  cancelamento — capacidade de primeira classe, passo 11 do roteiro de aceitação —
  fica indisponível. Decisão: guarda de reentrância com `useRef` (síncrona) e não com
  o estado `running` (assíncrono). O estado só atualiza no próximo render, então dois
  eventos no mesmo tique leriam `false` nos dois e a guarda não fecharia nada. O ref
  fecha completamente. NÃO é trava concorrente com a do main: aquela é a autoridade
  sobre "existe job rodando"; esta só impede o hook de se invocar duas vezes.
  Custo se errado: nulo, exportar duas vezes em paralelo nunca foi funcionalidade.
Task 15: minor (deferred): corrida entre `getPrefs()` na montagem e `chooseDir()`
  resolvendo antes — exige diálogo de pasta do SO, que leva muito mais que um IPC.
Task 15: minor (deferred): `reset` é exportado pelo hook e nunca chamado; superfície
  morta que veio do próprio brief.
Task 15: fix round 1/5 (1 addressed, 0 open; commits 277d65f..1941eba). Re-revisão
  traçou a sequência de dois cliques e confirmou que o segundo retorna ANTES do IPC,
  então o job real mantém `running` e a barra e o Cancelar sobrevivem; guarda é ref e
  não estado; ref setado antes do primeiro await; resetado no finally; `setRunning`
  intacto dos dois lados; ref FORA da lista de dependências (correto).
Task 15: plano alinhado (commit f4a3a92).
Task 15: complete (commits cd48683..f4a3a92, review clean)

=== TODAS AS 15 TASKS CONCLUÍDAS — 38 commits, 95 testes ===

REVISÃO FINAL DA BRANCH (opus, 0e5da94..f4a3a92): 1 Critical, 5 Important, 11 Minor,
triagem dos 30 adiados, e julgamento das minhas rulings.
  Confirmou que plano e repositório concordam: 24 de 26 blocos de código do plano
  batem byte a byte com o arquivo que produzem; os 2 que diferem só mudam onde um
  hook é declarado. Reexecutar qualquer passo do plano não reintroduz nada.
Ruling 25: C1 é REAL, verifiquei na mão. O `index.html` traz a CSP do template sem
  `media-src`, então cai em `default-src 'self'` — e `clip://local` não é 'self'. O
  `registerSchemesAsPrivileged` não pede `bypassCSP`. O `<video>` seria bloqueado e a
  tela ficaria preta, com o erro só no console do DevTools. Nenhuma revisão de task
  podia ver: a T1 escreveu a CSP, a T10 registrou o protocolo, a T12 adicionou o
  elemento — nenhum diff continha a regra E a coisa bloqueada por ela.
  Decisão: corrigir pela CSP (`media-src 'self' clip:`) e não por `bypassCSP`, porque
  a primeira é comprovável lendo e a segunda depende de semântica de privilégio.
Ruling 26: a revisão final mostrou que minha Ruling 4 (verificação headless) tinha o
  CUSTO subestimado. Escrevi "um defeito puramente visual passa pelas revisões". C1
  não é visual — é falha funcional dura do recurso central. A decisão em si era
  forçada (o harness não deixa ver janela), mas a lição para a próxima vez é concreta:
  toda fronteira protocolo/CSP merece uma asserção em nível de Node (buscar a URL
  `clip://` do processo principal; parsear a meta CSP e afirmar que todo esquema que o
  renderer vai carregar está permitido). Isso teria pego C1 sem janela nenhuma.
Ruling 27: a revisão final apontou, com razão, que minha Ruling 23 acertou o
  diagnóstico e corrigiu só METADE. Limitei a duração na carga da preferência, mas o
  campo numérico é a outra entrada e está aberto: limpar o campo dá 0, digitar "-" dá
  NaN, digitar 300 num vídeo de 100s não é limitado por min/max — e nos três casos o
  "Gerar cortes" apaga todos os marcadores manuais. É a MESMA cadeia de perda de dados
  que eu mesmo classifiquei como Important. Entra na leva de correção.
Ruling 28: aceito a reavaliação do watchdog de cancelamento. Eu tinha estimado o
  estrago como "a UI trava no Cancelar". É pior: o `finally` que zera `currentJob`
  nunca roda se a promise nunca liquidar, então TODA exportação seguinte devolve "já
  existe uma exportação em andamento" até reiniciar o app. Não é botão travado, é app
  inutilizado para a função principal. São ~8 linhas. Entra.
Ruling 29: MANTER a Ruling 22 (Gerar substitui a lista), com a ressalva que a revisão
  final levantou: fechar o caso degenerado em que a geração devolve zero pontos e a
  lista não está vazia — aí substituir é deleção pura sem benefício nenhum. Com esse
  caso guardado, a semântica de substituir se sustenta.
Fix wave final despachada (1 agente, lista completa).

=== MARCO: processo principal completo e testado. Daqui em diante é UI. ===
A partir da T11 a verificação automatizada cobre: tipos batendo entre os 3 processos,
os 3 bundles compilando, testes de lógica pura, e o app subindo sem erro no console.
NÃO cobre: o que aparece na tela. Cada task de UI declara explicitamente o que não
pôde observar, e a verificação visual fica com o usuário.

