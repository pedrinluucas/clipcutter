/**
 * Gera o PDF de instruções da versão PORTÁTIL.
 *
 * A portátil existe porque o Smart App Control do Windows 11 bloqueia
 * executáveis sem reputação — e um app recém-compilado nunca tem. Ela contorna
 * isso rodando pelo `electron.exe` original, que a Microsoft já conhece.
 *
 * USO: npm run pdf:portatil
 * SAÍDA: dist/ClipCutter-Portatil/LEIA-ME.pdf
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

const raiz = path.join(__dirname, '..')
const pasta = path.join(raiz, 'dist', 'ClipCutter-Portatil')
const saida = path.join(pasta, 'LEIA-ME.pdf')

const icone = fs.readFileSync(path.join(raiz, 'build', 'icon.png')).toString('base64')

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>ClipCutter Portátil</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 46px 54px; font: 15px/1.62 "Segoe UI", system-ui, sans-serif; color: #1a1a2e; }
  header { display: flex; align-items: center; gap: 20px; }
  header img { width: 66px; height: 66px; }
  h1 { margin: 0; font-size: 29px; letter-spacing: -0.5px; }
  .sub { color: #6b6b80; font-size: 14.5px; margin-top: 3px; }
  .tag { display:inline-block; background:#06d6a0; color:#04241a; font-size:11.5px;
         font-weight:700; padding:2px 9px; border-radius:20px; margin-left:8px; vertical-align:middle; }
  .regua { height: 3px; background: #4361ee; margin: 20px 0 26px; border-radius: 2px; }
  h2 { font-size: 16.5px; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e2ec; }
  h2:first-of-type { margin-top: 0; }
  p { margin: 9px 0; }
  ol, ul { margin: 10px 0; padding-left: 21px; }
  li { margin: 7px 0; }
  .destaque { background:#eef1ff; border-left:4px solid #4361ee; padding:14px 18px;
              margin:15px 0; border-radius:0 6px 6px 0; }
  .ok { background:#eefbf5; border-left:4px solid #06d6a0; padding:13px 18px;
        margin:15px 0; border-radius:0 6px 6px 0; }
  .arq { font-family: Consolas, monospace; background:#f3f3f8; padding:2px 7px;
         border-radius:4px; font-size:13.5px; }
  .botao { display:inline-block; background:#4361ee; color:#fff; padding:2px 10px;
           border-radius:4px; font-size:12.5px; font-weight:600; white-space:nowrap; }
  footer { margin-top:30px; padding-top:13px; border-top:1px solid #e2e2ec;
           font-size:12px; color:#8a8a9e; }
</style></head><body>

<header>
  <img src="data:image/png;base64,${icone}" alt="">
  <div>
    <h1>ClipCutter <span class="tag">PORTÁTIL</span></h1>
    <div class="sub">Corta vídeo em partes para Stories, Reels e TikTok</div>
  </div>
</header>
<div class="regua"></div>

<h2>Não precisa instalar nada</h2>
<p>Esta versão roda direto da pasta. Sem instalador, sem administrador, sem programa extra.</p>
<ol>
  <li>Extraia o <span class="arq">.zip</span> onde quiser — área de trabalho, Documentos, um pen drive.</li>
  <li>Abra a pasta extraída.</li>
  <li>Dê duplo-clique em <span class="arq">ClipCutter.cmd</span>.</li>
</ol>

<div class="destaque">
  <strong>Extraia a pasta inteira.</strong> O arquivo <span class="arq">ClipCutter.cmd</span>
  precisa ficar ao lado da pasta <span class="arq">app</span>. Se você abrir o
  <span class="arq">.cmd</span> de dentro do zip sem extrair, não funciona.
</div>

<h2>Por que esta versão não é bloqueada</h2>
<p>
  O Windows 11 bloqueia programas <strong>sem reputação</strong> — não, como se
  costuma pensar, sem assinatura. Qualquer programa recém-compilado gera um arquivo
  único, que nunca existiu em outra máquina, e por isso é barrado mesmo sendo
  inofensivo.
</p>
<p>
  Esta versão contorna isso rodando através do <span class="arq">electron.exe</span>,
  um componente presente em milhares de programas conhecidos (Discord, VS Code,
  Slack) e que o Windows já reconhece. <strong>O programa é exatamente o mesmo do
  instalador</strong> — muda só quem o carrega.
</p>

<h2>Como usar</h2>
<ol>
  <li>Arraste um vídeo para a janela.</li>
  <li>
    Escolha a duração de cada parte. Os botões <span class="botao">29,9s</span> e
    <span class="botao">59,9s</span> já vêm com a margem certa — as redes recusam
    arquivos de 30 e 60 segundos exatos.
  </li>
  <li>Clique em <span class="botao">Gerar cortes</span>. Os marcadores aparecem na linha do tempo.</li>
  <li>
    Ajuste se quiser: arraste um marcador, clique com o botão direito para remover,
    ou tecle <strong>S</strong> para marcar um corte na posição atual.
  </li>
  <li>Escolha a pasta de saída e clique em <span class="botao">Exportar</span>.</li>
</ol>

<div class="ok">
  <strong>Deixe "Corte exato" marcado.</strong> É mais lento, mas o arquivo sai com a
  duração exata que você pediu. Desmarcado é quase instantâneo, porém o corte cai no
  ponto-chave mais próximo e pode variar alguns segundos — bom para picar gravação
  longa, ruim para rede social com limite de tempo.
</div>

<h2>Atalhos de teclado</h2>
<ul>
  <li><strong>Espaço</strong> — play / pausa</li>
  <li><strong>← →</strong> — 5 segundos &nbsp;·&nbsp; <strong>J L</strong> — 10 segundos</li>
  <li><strong>, .</strong> — um quadro por vez (para achar o segundo exato)</li>
  <li><strong>S</strong> — marcar corte onde o vídeo está</li>
</ul>

<h2>Desinstalar</h2>
<p>Apague a pasta. Não há nada no registro do Windows nem em outros lugares do sistema.</p>

<footer>
  ClipCutter 1.0.0 portátil &nbsp;·&nbsp; Windows 10 e 11 &nbsp;·&nbsp; uso interno
</footer>

</body></html>`

app.whenReady().then(async () => {
  const tmp = path.join(os.tmpdir(), `clipcutter-portatil-${Date.now()}.html`)
  fs.writeFileSync(tmp, html, 'utf8')

  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await win.loadFile(tmp)

  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { marginType: 'none' },
  })

  fs.writeFileSync(saida, pdf)
  fs.unlinkSync(tmp)

  console.log('PDF gerado:', saida)
  console.log('tamanho:', (pdf.length / 1024).toFixed(0) + ' KB')
  app.exit(0)
})
