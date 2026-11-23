// O serviço usa Buffer (do Node). No browser, usa-se a versão do pacote "buffer".
import { Buffer } from 'buffer'

;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer
