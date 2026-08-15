import { useState } from 'react'
import { FilmIcon } from 'lucide-react'

type Props = {
  onPick: () => void
  onDropFile: (path: string) => void
  error: string | null
}

export function WelcomeScreen({ onPick, onDropFile, error }: Props): React.JSX.Element {
  const [over, setOver] = useState(false)

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={(e) => {
          // `dragleave` também dispara ao entrar num filho da zona (ícone, textos).
          // Sem esta guarda a borda azul pisca enquanto o cursor ainda está dentro.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files[0]
          if (file) onDropFile(window.electron.webUtils.getPathForFile(file))
        }}
        className={`flex w-full max-w-2xl cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-16 transition-colors duration-150 ${
          over ? 'border-[#4361ee] bg-[#4361ee]/10' : 'border-[#252547] hover:border-[#4361ee]/60'
        }`}
      >
        <FilmIcon size={56} className="mb-4 text-[#4361ee]" />
        <p className="text-lg">Arraste um vídeo aqui ou clique para importar</p>
        <p className="mt-2 text-sm text-[#e7e7f0]/50">MP4, MOV, AVI, MKV, WEBM, WMV, FLV</p>
        {error && <p className="mt-6 text-sm text-[#ef476f]">{error}</p>}
      </div>
    </div>
  )
}
