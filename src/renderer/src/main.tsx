import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Só a caixa tracejada da tela inicial chama `preventDefault()` no drop. Soltar
// fora dela — na margem, ou em qualquer lugar da tela do Editor — cai no
// comportamento padrão do Chromium: navegar o webContents pra URL `file://` do
// arquivo solto. Isso troca a UI inteira sem barra de menu e sem Back, e no
// Editor derruba a lista de cortes junto. `will-navigate` no processo principal
// (src/main/index.ts) é o backstop para o que escapar daqui.
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
