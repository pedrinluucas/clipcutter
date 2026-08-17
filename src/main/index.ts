import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerClipScheme, handleClipProtocol } from './protocol'
import { registerIpc, cancelCurrentJob } from './ipc'

registerClipScheme()

// Referência à janela viva, para o segundo clique no atalho poder trazê-la à
// frente em vez de abrir um app novo. Ver a trava de instância única no fim.
let janela: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 750,
    show: false,
    backgroundColor: '#0f0f1a',
    // O template só aplicava isto no Linux, porque no Windows e no macOS o ícone
    // do executável empacotado já resolve. Mas em DESENVOLVIMENTO quem executa é o
    // `electron.exe`, então a janela e a barra de tarefas mostram o logo do
    // Electron — foi o que o Pedro viu. Aplicar em todas as plataformas faz o
    // `npm start` parecer o app de verdade; no pacote é redundante e inofensivo.
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Backstop: se um `drop` de arquivo escapar do listener do renderer (src/renderer/
  // src/main.tsx), o comportamento padrão do Chromium é navegar o webContents pra
  // URL `file://` do arquivo solto — substitui a UI inteira, sem barra de menu e
  // sem Back. Os dois lados não competem: o do renderer cobre o caso comum, este
  // é a rede de segurança pra qualquer coisa que passe por cima dele.
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  janela = mainWindow
  mainWindow.on('closed', () => {
    janela = null
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// TRAVA DE INSTÂNCIA ÚNICA
//
// Sem ela, clicar no atalho com o app já aberto sobe um SEGUNDO app inteiro. O
// estrago não é a janela repetida:
//
// 1. As duas instâncias gravam no MESMO arquivo de preferências (electron-store),
//    e a última a fechar sobrescreve o que a outra salvou.
// 2. A trava de exportação concorrente (ipc.ts) vale dentro de UM processo. Dois
//    apps têm duas travas independentes — os dois poderiam exportar para a mesma
//    pasta ao mesmo tempo, e o `uniqueFileName` (que checa o disco antes de
//    escrever) perderia a corrida: ambos veem "não existe" e gravam no mesmo nome.
//
// Quem chega depois desiste e manda a instância viva se mostrar.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!janela) return
    if (janela.isMinimized()) janela.restore()
    janela.show()
    janela.focus()
  })

  iniciar()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
function iniciar(): void {
  app.whenReady().then(() => {
    // Set app user model id for windows
    // Precisa bater com o `appId` do electron-builder.yml. É o que o Windows usa
    // para agrupar janelas na barra de tarefas e para o ícone do atalho — com o
    // valor genérico do scaffold, o app apareceria como "electron".
    electronApp.setAppUserModelId('com.pedrolucas.clipcutter')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    handleClipProtocol()
    registerIpc()

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Sem isto, fechar a janela no meio de uma exportação não leva o job junto: o
// `ffmpeg.exe` filho fica órfão rodando sem cabeça, ou morre num pipe quebrado sem
// que a limpeza do arquivo parcial (jobs.ts) chegue a rodar.
app.on('before-quit', () => {
  cancelCurrentJob()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
