export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const totalMs = Math.round(safe * 1000)
  const ms = totalMs % 1000
  const totalSec = (totalMs - ms) / 1000
  const sec = totalSec % 60
  const totalMin = (totalSec - sec) / 60
  const min = totalMin % 60
  const hour = (totalMin - min) / 60

  const msStr = String(ms).padStart(3, '0')
  const secStr = String(sec).padStart(2, '0')

  // Vale para gravações de várias horas: sem o degrau pra hora, `mm` passa de 59
  // e vira "105:00.000", que ninguém lê como "1h45min" de cabeça — e a régua da
  // timeline é a principal referência de navegação nesses vídeos.
  if (hour > 0) {
    return `${hour}:${String(min).padStart(2, '0')}:${secStr}.${msStr}`
  }
  return `${String(min).padStart(2, '0')}:${secStr}.${msStr}`
}

export function parseTime(text: string): number | null {
  const trimmed = text.trim()

  const withHour = /^(\d+):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(trimmed)
  if (withHour) {
    const hour = Number(withHour[1])
    const min = Number(withHour[2])
    const sec = Number(withHour[3])
    const ms = withHour[4] ? Number(withHour[4].padEnd(3, '0')) : 0
    return Math.round((hour * 3600 + min * 60 + sec + ms / 1000) * 1000) / 1000
  }

  const noHour = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(trimmed)
  if (noHour) {
    const min = Number(noHour[1])
    const sec = Number(noHour[2])
    const ms = noHour[3] ? Number(noHour[3].padEnd(3, '0')) : 0
    return Math.round((min * 60 + sec + ms / 1000) * 1000) / 1000
  }

  return null
}
