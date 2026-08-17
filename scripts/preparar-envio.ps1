# Prepara TUDO que vai para o usuário final, num comando só.
#
# USO: npm run empacotar
#
# Produz em dist/ENVIAR:
#   - clipcutter-X.Y.Z-setup.exe   instalador (funciona na maioria das máquinas)
#   - ClipCutter-Instalacao.pdf    instruções do instalador
#   - ClipCutter-Portatil.zip      alternativa sem instalação, com LEIA-ME dentro
#
# ORDEM IMPORTA: a portátil sai PRIMEIRO, porque ela não depende do
# electron-builder — só do `out/` e do `electron.exe` do node_modules. O
# instalador vem por último e pode falhar sem levar o resto junto (ver abaixo).
#
# POR QUE O INSTALADOR PODE FALHAR NESTA MÁQUINA
# ----------------------------------------------
# O electron-builder gera o desinstalador em duas etapas: cria um .exe temporário
# e o EXECUTA para produzir a versão final. O Smart App Control do Windows 11
# bloqueia executáveis sem reputação, e um arquivo recém-compilado nunca tem —
# o erro aparece como `spawn UNKNOWN` em `computeScriptAndSignUninstaller`.
# É intermitente: em 17/08/2026 passou às 17:30 e falhou às 18:16, mesmo commit.
# Por isso o script tenta duas vezes e, se ainda assim falhar, PRESERVA o
# instalador anterior em vez de deixar um arquivo de 0 byte no lugar.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Passo($n) { Write-Host "`n=== $n ===" -ForegroundColor Cyan }
function Aviso($n) { Write-Host $n -ForegroundColor Yellow }

# Processos abertos seguram os binários: o electron-builder falha ao regravar o
# win-unpacked, e o zip sai incompleto.
#
# Comparação com StartsWith, NÃO com `-like`: o caminho tem colchetes e o `-like`
# os trataria como classe de caracteres. Escapar com [regex]::Escape é pior
# ainda — vira `\[`, que o `-like` compara literalmente e nunca casa. Foi o que
# aconteceu em 17/08/2026: o passo dizia "fechados: 0" com o app aberto na tela,
# e o build seguinte morria sem explicação.
Passo "Fechando instancias abertas"
$p = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'electron.exe' -and $_.ExecutablePath -and
  $_.ExecutablePath.StartsWith($raiz, [System.StringComparison]::OrdinalIgnoreCase)
}
if ($p) { $p | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }; Start-Sleep 2 }
Write-Host "  fechados: $(@($p).Count)"

$envio = Join-Path $raiz 'dist\ENVIAR'
New-Item -ItemType Directory -Force -Path $envio | Out-Null

# O instalador antigo é a rede de segurança: se o build novo falhar, ele volta.
$backup = $null
$antigo = Get-ChildItem $envio -Filter '*setup.exe' -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt 1MB } | Select-Object -First 1
if ($antigo) {
  $backup = Join-Path $env:TEMP "clipcutter-setup-backup.exe"
  Copy-Item $antigo.FullName $backup -Force
  Write-Host "  instalador anterior guardado ($([math]::Round($antigo.Length/1MB,0)) MB)"
}

Passo "Empacotando o app (electron-builder --dir)"
# `--dir` NÃO gera desinstalador, então não passa pela etapa que o Smart App
# Control bloqueia. É o que torna a portátil confiável nesta máquina.
npm run build:unpack
if ($LASTEXITCODE -ne 0) { throw "build:unpack falhou -- nada foi empacotado" }

Passo "Montando a versao portatil"
#
# A portátil é o `win-unpacked` do electron-builder com UMA troca: o
# `ClipCutter.exe` dele sai e entra o `electron.exe` ORIGINAL, renomeado.
#
# Por que a troca: o exe do electron-builder é o electron.exe com os recursos
# reescritos (ícone, metadados). Isso muda o conteúdo e produz um arquivo que
# nenhuma máquina no mundo já viu — exatamente o que o Smart App Control barra.
#
# NÃO é questão de assinatura. Medido em 17/08/2026: `Get-AuthenticodeSignature`
# devolve NotSigned para os DOIS, e mesmo assim o electron.exe roda livremente e
# o ClipCutter.exe é bloqueado. O que o SAC consulta é REPUTAÇÃO — o hash do
# electron.exe é idêntico ao de milhões de instalações (Discord, VS Code, Slack),
# então a nuvem da Microsoft já o conhece.
#
# Renomear preserva a reputação porque não toca em um byte do conteúdo; o hash
# continua o mesmo. Por isso a verificação abaixo compara hashes: ela falha se
# alguém tentar "melhorar" o exe pintando o ícone, que é justo o que o
# quebraria.
#
# Por que não montar na mão (como era até 17/08/2026): o electron-vite deixa as
# dependências FORA do bundle, então `out/main/index.js` faz require de
# '@electron-toolkit/utils' e 'electron-store' em tempo de execução. Copiar só o
# FFmpeg produzia uma pasta que abria e MORRIA em "Cannot find module". O
# app.asar do electron-builder já carrega a árvore inteira, resolvida.
#
# O preço da troca: no Explorer o arquivo aparece com o ícone do Electron. A
# janela e a barra de tarefas mostram o ícone certo (BrowserWindow.icon), e
# pintar o ícone no exe é justamente o que invalidaria a assinatura.
$port = Join-Path $raiz 'dist\ClipCutter-Portatil'
Remove-Item $port -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$raiz\dist\win-unpacked" $port -Recurse

Remove-Item "$port\ClipCutter.exe" -Force
Copy-Item "$raiz\node_modules\electron\dist\electron.exe" "$port\ClipCutter.exe"

$hOrigem = (Get-FileHash "$raiz\node_modules\electron\dist\electron.exe" -Algorithm SHA256).Hash
$hPortatil = (Get-FileHash "$port\ClipCutter.exe" -Algorithm SHA256).Hash
if ($hOrigem -ne $hPortatil) { throw "ClipCutter.exe portatil foi modificado -- perde a reputacao e sera bloqueado" }
Write-Host "  ClipCutter.exe intacto (sha256 $($hPortatil.Substring(0,16))...)"
Write-Host "  montada: $([math]::Round((Get-ChildItem $port -Recurse -File | Measure-Object Length -Sum).Sum/1MB,0)) MB"

Passo "Gerando PDFs"
npm run pdf:portatil
if ($LASTEXITCODE -ne 0) { throw "pdf:portatil falhou" }
npm run pdf:instalacao
if ($LASTEXITCODE -ne 0) { throw "pdf:instalacao falhou" }

Passo "Compactando a portatil"
& (Join-Path $PSScriptRoot 'compactar-portatil.ps1')
Copy-Item "$raiz\ClipCutter-Instalacao.pdf" $envio -Force

# --- Daqui pra baixo, falha NÃO aborta: a portátil já está pronta. ---
Passo "Instalador (pode ser bloqueado pelo Smart App Control)"
$ok = $false
foreach ($tentativa in 1, 2) {
  Write-Host "  tentativa $tentativa de 2..."
  npx --no-install electron-builder --win
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Aviso "  bloqueado; tentando de novo"
  Start-Sleep 3
}

$novo = Get-ChildItem "$raiz\dist" -Filter '*setup.exe' -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt 1MB } | Select-Object -First 1

if ($ok -and $novo) {
  Copy-Item $novo.FullName $envio -Force
  Write-Host "  instalador novo: $([math]::Round($novo.Length/1MB,0)) MB" -ForegroundColor Green
} elseif ($backup) {
  Copy-Item $backup (Join-Path $envio (Split-Path $antigo.Name -Leaf)) -Force
  Aviso "  INSTALADOR NAO FOI REGERADO -- restaurado o anterior."
  Aviso "  A portatil esta atualizada; o instalador esta na versao de antes."
} else {
  Aviso "  INSTALADOR NAO FOI GERADO e nao havia anterior para restaurar."
}

Write-Host "`nPRONTO -- $envio`n" -ForegroundColor Green
Get-ChildItem $envio | ForEach-Object {
  "  {0,-34} {1,6:N0} MB   {2}" -f $_.Name, ($_.Length / 1MB), $_.LastWriteTime.ToString('HH:mm')
}
