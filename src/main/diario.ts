// Diário de inicialização, isolado no PRIMEIRO módulo que o bundle carrega.
//
// Por que um arquivo só para isto: em JavaScript os `import` executam antes da
// primeira linha do módulo que os importa. Enquanto o registro vivia no topo do
// `index.ts`, um diário vazio era ambíguo — podia significar "o Electron não
// subiu" ou "um dos meus módulos explodiu ao ser carregado", que pedem
// investigações opostas. Sendo o primeiro import de todos, este módulo separa
// os dois casos: se ele registrou, o bundle começou a rodar.
//
// Não importa `electron` de propósito. Só `node:` — assim ele não pode falhar
// pelo mesmo motivo que estaria tentando diagnosticar.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Escreve nos DOIS lugares: o diretório temporário de um app empacotado no macOS
// é um contêiner privado, diferente do `/tmp` que quem investiga enxerga.
const DESTINOS = [join(tmpdir(), 'clipcutter-boot.log'), '/tmp/clipcutter-boot.log']

export const BOOT_LOG = DESTINOS.join(' e ')

export function boot(etapa: string): void {
  const linha = `${new Date().toISOString()}  ${etapa}\n`
  console.error('[boot]', etapa)
  for (const destino of DESTINOS) {
    try {
      appendFileSync(destino, linha)
    } catch {
      // Um diário que derruba o app que deveria diagnosticar seria pior que não
      // existir. `/tmp` não existe no Windows, e tudo bem.
    }
  }
}

boot('bundle carregado -- primeira linha executada')
