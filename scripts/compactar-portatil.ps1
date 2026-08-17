# Compacta dist/ClipCutter-Portatil em dist/ENVIAR/ClipCutter-Portatil.zip.
#
# USO: npm run zip:portatil   (ou automaticamente pelo `npm run empacotar`)
#
# POR QUE NÃO `Compress-Archive`
# -----------------------------
# O Compress-Archive do Windows PowerShell 5.1 grava os caminhos internos com
# BARRA INVERTIDA. A especificação do formato ZIP (APPNOTE 4.4.17) exige barra
# normal. O Explorer do Windows tolera, mas um extrator que siga a regra ao pé
# da letra cria um arquivo chamado literalmente "app\out\main\index.js" em vez
# da árvore de pastas — e aí o ClipCutter.cmd não acha a pasta `app` e avisa
# "Arquivos faltando". Verificado em 17/08/2026 abrindo o zip gerado.
#
# Aqui as entradas são escritas na mão, com barra normal.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$origem = Join-Path $raiz 'dist\ClipCutter-Portatil'
$envio = Join-Path $raiz 'dist\ENVIAR'
$zip = Join-Path $envio 'ClipCutter-Portatil.zip'

if (-not (Test-Path $origem)) { throw "pasta nao encontrada: $origem" }
New-Item -ItemType Directory -Force -Path $envio | Out-Null
Remove-Item $zip -Force -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$arquivos = Get-ChildItem $origem -Recurse -File
$total = $arquivos.Count
Write-Host "  compactando $total arquivos..."

$fs = [System.IO.File]::Open($zip, 'Create')
$arq = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $i = 0
  foreach ($f in $arquivos) {
    $rel = $f.FullName.Substring($origem.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $arq, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $i++
    if ($i % 25 -eq 0) { Write-Host "    $i/$total" }
  }
}
finally {
  $arq.Dispose()
  $fs.Dispose()
}

Write-Host "  zip: $([math]::Round((Get-Item $zip).Length/1MB,0)) MB"
