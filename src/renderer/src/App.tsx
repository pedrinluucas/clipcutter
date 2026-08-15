import { useEffect, useState } from 'react'

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState('verificando...')

  useEffect(() => {
    window.clip.checkFfmpeg().then((r) => setStatus(r.ok ? 'FFmpeg OK' : r.message))
  }, [])

  return <pre className="p-8 whitespace-pre-wrap">{status}</pre>
}
