export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const totalMs = Math.round(safe * 1000)
  const ms = totalMs % 1000
  const totalSec = (totalMs - ms) / 1000
  const sec = totalSec % 60
  const min = (totalSec - sec) / 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export function parseTime(text: string): number | null {
  const match = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(text.trim())
  if (!match) return null
  const min = Number(match[1])
  const sec = Number(match[2])
  const ms = match[3] ? Number(match[3].padEnd(3, '0')) : 0
  return Math.round((min * 60 + sec + ms / 1000) * 1000) / 1000
}
