# ClipCutter

App de desktop que pica um vídeo em partes — por duração fixa **e** por segundo
escolhido na mão, os dois alimentando a mesma lista de cortes.

Feito para quem publica em Stories, Reels e TikTok: o corte sai com a duração
exata pedida, e os presets já vêm com a margem que as redes exigem.

![Electron](https://img.shields.io/badge/Electron-39-47848F)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![testes](https://img.shields.io/badge/testes-141-06D6A0)

## O que ele faz

- **Duração fixa ou segundo exato.** Gere marcadores a cada N segundos, arraste
  qualquer um, apague com o botão direito, ou tecle <kbd>S</kbd> para marcar o
  ponto onde o vídeo está.
- **Prévia ao vivo.** Mudar a duração move os marcadores na régua na hora, sem
  precisar clicar em "Gerar cortes".
- **Corte exato ou instantâneo.** Marcado, reencoda e a parte sai com a duração
  cravada. Desmarcado, copia os fluxos sem reencodar (quase instantâneo), mas o
  corte cai no keyframe mais próximo e pode variar alguns segundos.
- **Presets de 29,9s e 59,9s.** Não é capricho: "até 30 segundos" quer dizer
  *menos* que 30, e um arquivo de 30,000s é recusado.
- **FFmpeg embutido.** Nada para instalar à parte.

## Rodando

```bash
npm install
npm start
```

## Testes

```bash
npm test        # 141 testes, Vitest
npm run typecheck
```

A lógica de negócio — pontos de corte, aritmética de tempo, nomes de arquivo,
argumentos do FFmpeg, leitura de progresso — vive em módulos puros que não
importam Electron nem React. É o que permite testá-la sem subir uma janela.

## Empacotando

```bash
npm run empacotar
```

Um comando produz `dist/ENVIAR/` inteiro: instalador, PDF de instruções e a
versão portátil compactada.

A **portátil** é o pacote do electron-builder com uma troca: o executável dele
sai e entra o `electron.exe` original, renomeado. O motivo é o Smart App Control
do Windows 11, que bloqueia executáveis **sem reputação** — não sem assinatura.
Medido: os dois binários aparecem como `NotSigned`, e mesmo assim um roda e o
outro é barrado. Renomear não altera um byte, então o hash — e a reputação —
seguem de pé.

## Arquitetura

Dois processos. O renderer (React) só desenha e manda pedidos; todo acesso a
disco e ao FFmpeg vive no main, atrás de uma ponte tipada no `preload`. O
renderer nunca importa `node:*`, `electron` ou `child_process`.

O vídeo chega à tela por um protocolo próprio (`clip://`) que implementa
requisições Range à mão — sem isso o player carrega, mas não deixa arrastar a
agulha.

```
src/
  main/       processos, FFmpeg, protocolo, IPC
  preload/    a ponte, e só ela
  renderer/   React
  shared/     lógica pura, testada
docs/         spec, plano e o registro das decisões
```

## Decisões

`docs/superpowers/` guarda a spec, o plano de implementação e um registro com as
decisões tomadas durante a construção — cada uma com o raciocínio e o custo caso
estivesse errada.

## Licença

MIT — veja [LICENSE](LICENSE).
