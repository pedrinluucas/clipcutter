import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FfmpegCheck } from '../../shared/types'
import { FFMPEG_PATH, FFPROBE_PATH } from './binaries'

const run = promisify(execFile)

async function isAvailable(binary: string): Promise<boolean> {
  try {
    await run(binary, ['-version'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

/**
 * Confere se os binários EMBUTIDOS respondem.
 *
 * Antes isto procurava `ffmpeg` e `ffprobe` no PATH do sistema, e a falha
 * significava "o usuário não instalou" — daí a mensagem mandava rodar
 * `winget install ffmpeg`.
 *
 * Agora eles vêm dentro do app. Se falharem, o usuário não tem nada a instalar:
 * é a instalação do PRÓPRIO app que está incompleta ou corrompida. Mandar
 * instalar FFmpeg seria conselho errado, e a pessoa perderia tempo num caminho
 * que não resolve.
 */
export async function locateBinaries(): Promise<FfmpegCheck> {
  const [hasFfmpeg, hasFfprobe] = await Promise.all([
    isAvailable(FFMPEG_PATH),
    isAvailable(FFPROBE_PATH),
  ])

  if (hasFfmpeg && hasFfprobe) {
    return { ok: true, ffmpeg: FFMPEG_PATH, ffprobe: FFPROBE_PATH }
  }

  const faltando = [!hasFfmpeg && 'ffmpeg', !hasFfprobe && 'ffprobe'].filter(Boolean).join(' e ')

  return {
    ok: false,
    message:
      `O ${faltando} que vem dentro do ClipCutter não respondeu.\n\n` +
      `Isso não é algo que você precise instalar — o FFmpeg vem junto com o app. ` +
      `Significa que a instalação está incompleta ou corrompida, provavelmente ` +
      `porque um antivírus removeu o arquivo.\n\n` +
      `Reinstale o ClipCutter. Se acontecer de novo, verifique a quarentena do ` +
      `seu antivírus.\n\n` +
      `Caminho procurado:\n${!hasFfmpeg ? FFMPEG_PATH : FFPROBE_PATH}`,
  }
}
