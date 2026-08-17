import ffmpegStatic from 'ffmpeg-static'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'

/**
 * Reescreve um caminho de dentro do `app.asar` para o `app.asar.unpacked`.
 *
 * POR QUE ISTO PRECISA EXISTIR
 * ----------------------------
 * O Electron empacota o app num arquivo único (`app.asar`). O sistema operacional
 * não consegue EXECUTAR um binário de dentro dele, então o empacotador é instruído
 * (via `asarUnpack` no electron-builder.yml) a deixar o ffmpeg e o ffprobe de fora,
 * numa pasta irmã chamada `app.asar.unpacked`.
 *
 * Só que o caminho que o código recebe continua apontando para DENTRO do asar —
 * o pacote não sabe que o arquivo foi desviado. Sem esta reescrita, o app
 * empacotado procura o binário onde ele não está.
 *
 * O sintoma clássico: funciona perfeitamente em `npm start` e quebra no `.exe`.
 * Estava previsto na lista de correções do spec original (item 5) desde o começo
 * do projeto.
 *
 * A troca é do SEGMENTO de caminho, não do texto solto: uma pasta chamada
 * `app.asarbackup` não pode ser afetada.
 */
export function unpackedPath(caminho: string): string {
  return caminho.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
}

/**
 * Caminhos dos binários embutidos.
 *
 * Em desenvolvimento apontam para `node_modules`; empacotado, para o
 * `app.asar.unpacked`. Os dois casos passam pela mesma função — em dev a
 * reescrita simplesmente não encontra nada para trocar.
 *
 * O app NÃO procura mais no PATH do sistema. Isso é deliberado: assim a versão do
 * FFmpeg fica presa à do app, e o comportamento não muda conforme a máquina.
 */
export const FFMPEG_PATH = unpackedPath(ffmpegStatic ?? '')
export const FFPROBE_PATH = unpackedPath(ffprobeInstaller.path)
