import { AlertTriangle } from 'lucide-react'

export function FfmpegMissing({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-lg rounded-lg bg-[#1a1a2e] p-8">
        <AlertTriangle className="mb-4 text-[#ef476f]" size={40} />
        {/*
          Era "FFmpeg não encontrado", de quando o app procurava no PATH e a
          falha significava "o usuário não instalou". Agora o FFmpeg vem dentro
          do pacote: se falhou, não há nada para o usuário instalar — a
          instalação do próprio app é que está incompleta. O título antigo
          mandaria a pessoa para um caminho que não resolve.
        */}
        <h1 className="mb-3 text-xl font-semibold">Instalação incompleta</h1>
        <pre className="whitespace-pre-wrap rounded bg-[#0f0f1a] p-4 font-mono text-sm text-[#e7e7f0]/80">
          {message}
        </pre>
      </div>
    </div>
  )
}
