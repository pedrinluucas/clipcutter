export type ProgressReader = {
  push(chunk: string): number | null
}

export function createProgressReader(): ProgressReader {
  let buffer = ''

  return {
    push(chunk: string): number | null {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let latest: number | null = null
      for (const line of lines) {
        const match = /^out_time_us=(-?\d+)$/.exec(line.trim())
        if (!match) continue
        const microseconds = Number(match[1])
        if (microseconds >= 0) latest = microseconds / 1_000_000
      }
      return latest
    },
  }
}
