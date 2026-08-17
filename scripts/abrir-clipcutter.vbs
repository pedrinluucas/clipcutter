' Abre o ClipCutter sem janela de terminal.
'
' POR QUE ISTO EXISTE
' -------------------
' O Smart App Control do Windows 11 bloqueia executáveis SEM REPUTAÇÃO — e não,
' como se supõe, sem assinatura. Verificado em 17/08/2026: o `electron.exe`
' original também não é assinado, e mesmo assim roda; o nosso `ClipCutter.exe`
' é esse mesmo Electron renomeado e com outro ícone, o que produz um arquivo
' único que nunca existiu em lugar nenhum — e portanto sem reputação. É esse que
' ele barra, tanto o instalador quanto o app.
'
' A saída: executar o código COMPILADO DE PRODUÇÃO através do `electron.exe`
' original, que a Microsoft já conhece. Não é o modo de desenvolvimento — não
' sobe servidor, não recompila nada. É o mesmo app que o instalador entregaria,
' só que carregado por um binário que o Windows aceita.
'
' Deixa de ser necessário no dia em que o app for assinado com certificado
' comercial e acumular reputação.
'
' Depende de `out/` (gerado por `npm run build`) e de `node_modules/electron`.

Set fso = CreateObject("Scripting.FileSystemObject")
Set ws = CreateObject("WScript.Shell")

' A raiz do projeto é a pasta acima de scripts/ — assim o atalho continua
' funcionando se o projeto for movido.
raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))

electron = raiz & "\node_modules\electron\dist\electron.exe"
entrada  = raiz & "\out\main\index.js"

If Not fso.FileExists(electron) Then
  MsgBox "Não encontrei o Electron em:" & vbCrLf & electron & vbCrLf & vbCrLf & _
         "Rode 'npm install' na pasta do projeto.", 16, "ClipCutter"
  WScript.Quit 1
End If

If Not fso.FileExists(entrada) Then
  MsgBox "O app não está compilado." & vbCrLf & vbCrLf & _
         "Rode 'npm run build' na pasta do projeto.", 16, "ClipCutter"
  WScript.Quit 1
End If

ws.CurrentDirectory = raiz
' O 0 esconde a janela de console; o False não espera o app fechar.
ws.Run """" & electron & """ """ & entrada & """", 0, False
