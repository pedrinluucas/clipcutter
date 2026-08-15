import { AlertTriangle } from 'lucide-react'

export function FfmpegMissing({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-lg rounded-lg bg-[#1a1a2e] p-8">
        <AlertTriangle className="mb-4 text-[#ef476f]" size={40} />
        <h1 className="mb-3 text-xl font-semibold">FFmpeg não encontrado</h1>
        <pre className="whitespace-pre-wrap rounded bg-[#0f0f1a] p-4 font-mono text-sm text-[#e7e7f0]/80">
          {message}
        </pre>
      </div>
    </div>
  )
}
