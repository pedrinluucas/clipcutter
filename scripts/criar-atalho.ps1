# Cria o atalho do ClipCutter na área de trabalho.
#
# Aponta DIRETO para o electron.exe, sem script intermediário. A primeira versão
# usava um .vbs para "esconder o console" — console que nunca existiria, porque o
# electron.exe é aplicativo gráfico. Essa camada desnecessária virou o problema:
# o Windows Script Host é vetor clássico de malware, e o duplo-clique no .vbs era
# barrado em silêncio (verificado em 17/08/2026 — funcionava da linha de comando,
# não funcionava do Explorer, e não dava erro nenhum).
#
# USO: npm run atalho

$raiz = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $raiz "node_modules\electron\dist\electron.exe"
$entrada = Join-Path $raiz "out\main\index.js"
$icone = Join-Path $raiz "dist\win-unpacked\ClipCutter.exe"
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) "ClipCutter.lnk"

if (-not (Test-Path $electron)) { Write-Error "Falta o Electron. Rode 'npm install'."; exit 1 }
if (-not (Test-Path $entrada)) { Write-Error "App nao compilado. Rode 'npm run build'."; exit 1 }

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $electron
$s.Arguments = "`"$entrada`""
$s.WorkingDirectory = $raiz
if (Test-Path $icone) { $s.IconLocation = "$icone,0" }
$s.Description = "ClipCutter"
$s.Save()

Write-Host "Atalho criado: $lnk"
