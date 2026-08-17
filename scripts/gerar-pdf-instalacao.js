/**
 * Gera o PDF de instruções de instalação para enviar junto do instalador.
 *
 * Usa o próprio Electron (que já é dependência do projeto) como renderizador —
 * evita puxar uma biblioteca de PDF só para isto.
 *
 * USO: npm run pdf:instalacao
 * SAÍDA: ClipCutter-Instalacao.pdf na raiz do projeto
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

const raiz = path.join(__dirname, '..')
const saida = path.join(raiz, 'ClipCutter-Instalacao.pdf')

const icone = fs.readFileSync(path.join(raiz, 'build', 'icon.png')).toString('base64')

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>ClipCutter</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 56px;
    font: 15px/1.65 "Segoe UI", system-ui, sans-serif;
    color: #1a1a2e;
  }
  header { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; }
  header img { width: 68px; height: 68px; }
  h1 { margin: 0; font-size: 30px; letter-spacing: -0.5px; }
  .sub { color: #6b6b80; font-size: 15px; margin-top: 2px; }
  .regua { height: 3px; background: #4361ee; margin: 22px 0 30px; border-radius: 2px; }
  h2 {
    font-size: 17px; margin: 30px 0 12px;
    padding-bottom: 7px; border-bottom: 1px solid #e2e2ec;
  }
  h2:first-of-type { margin-top: 0; }
  p { margin: 10px 0; }
  ol { margin: 12px 0; padding-left: 22px; }
  ol li { margin: 9px 0; }
  .aviso {
    background: #fff8e6; border-left: 4px solid #ff6b35;
    padding: 14px 18px; margin: 16px 0; border-radius: 0 6px 6px 0;
  }
  .aviso strong { color: #c2410c; }
  .ok {
    background: #eefbf5; border-left: 4px solid #06d6a0;
    padding: 14px 18px; margin: 16px 0; border-radius: 0 6px 6px 0;
  }
  .botao {
    display: inline-block; background: #4361ee; color: #fff;
    padding: 2px 10px; border-radius: 4px; font-size: 13px;
    font-weight: 600; white-space: nowrap;
  }
  .arquivo {
    font-family: Consolas, monospace; background: #f3f3f8;
    padding: 3px 8px; border-radius: 4px; font-size: 13.5px;
  }
  footer {
    margin-top: 34px; padding-top: 14px; border-top: 1px solid #e2e2ec;
    font-size: 12.5px; color: #8a8a9e;
  }
</style></head><body>

<header>
  <img src="data:image/png;base64,${icone}" alt="">
  <div>
    <h1>ClipCutter</h1>
    <div class="sub">Corta vídeo em partes para Stories, Reels e TikTok</div>
  </div>
</header>
<div class="regua"></div>

<h2>O que você recebeu</h2>
<p>
  Um arquivo só: <span class="arquivo">clipcutter-1.0.0-setup.exe</span> (134 MB).
  Ele traz tudo dentro — <strong>você não precisa instalar mais nada</strong>,
  nem FFmpeg, nem qualquer outro programa.
</p>

<h2>Instalando</h2>
<ol>
  <li>Dê duplo-clique no arquivo.</li>
  <li>
    Se aparecer a tela azul <strong>"O Windows protegeu o seu computador"</strong>,
    clique em <span class="botao">Mais informações</span> e depois em
    <span class="botao">Executar assim mesmo</span>.
  </li>
  <li>Ele instala sozinho e cria o atalho na área de trabalho.</li>
</ol>

<div class="aviso">
  <strong>Por que o Windows avisa?</strong><br>
  Porque o app é interno e não tem certificado comercial de assinatura — que custa
  algumas centenas de dólares por ano. O Windows não está dizendo que o programa é
  perigoso; está dizendo que não sabe quem o publicou. É o mesmo aviso que aparece
  em qualquer programa sem certificado.
</div>

<h2>Se aparecer "Smart App Control blocked an app"</h2>
<p>
  Esse é um aviso diferente e mais rígido — <strong>não tem botão de "executar assim
  mesmo"</strong>. Ele bloqueia programas sem reputação, e um app recém-compilado
  nunca tem.
</p>
<p>Para desligar:</p>
<p>
  <span class="arquivo">Configurações › Privacidade e segurança › Segurança do Windows
  › Controle de aplicativos e navegador › Smart App Control › Desativado</span>
</p>
<div class="aviso">
  <strong>Atenção antes de desligar:</strong> depois de desativado, só volta a ligar
  reinstalando o Windows. Em máquina virtual ou de testes, sem problema. Em máquina
  de trabalho, pense duas vezes.
</div>

<h2>Como usar</h2>
<ol>
  <li>Arraste um vídeo para a janela.</li>
  <li>
    Escolha a duração de cada parte. Os botões <span class="botao">29,9s</span> e
    <span class="botao">59,9s</span> já vêm com a margem certa — as redes recusam
    arquivos de 30 e 60 segundos exatos.
  </li>
  <li>Clique em <span class="botao">Gerar cortes</span>. Os marcadores aparecem na linha do tempo.</li>
  <li>Ajuste o que quiser: arraste um marcador, ou use <strong>S</strong> para marcar um corte onde o vídeo está.</li>
  <li>Escolha a pasta e clique em <span class="botao">Exportar</span>.</li>
</ol>

<div class="ok">
  <strong>Dica:</strong> deixe <strong>Corte exato</strong> marcado. É mais lento,
  mas o arquivo sai com a duração exata que você pediu. Desmarcado é quase
  instantâneo, porém o corte cai no ponto-chave mais próximo e pode variar alguns
  segundos — bom para picar gravação longa, ruim para rede social com limite.
</div>

<footer>
  ClipCutter 1.0.0 &nbsp;·&nbsp; Windows 10 e 11 &nbsp;·&nbsp; uso interno
</footer>

</body></html>`

app.whenReady().then(async () => {
  const tmp = path.join(os.tmpdir(), `clipcutter-pdf-${Date.now()}.html`)
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
