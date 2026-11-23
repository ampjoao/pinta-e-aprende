/**
 * Demonstração num único ficheiro HTML (`npm run demo:build` → demo-dist/index.html).
 * Corre a app e o servidor no browser: troca a base de dados e a cifra do Node pelas versões
 * em demo/ e responde aos pedidos da app localmente.
 */
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const SWAP: Record<string, string> = {
  [here('./server/db.ts')]: here('./demo/db.ts'),
  [here('./server/crypto.ts')]: here('./demo/crypto.ts'),
}

function swapNodeModules(): Plugin {
  return {
    name: 'mao-amiga-demo-swap',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === 'node:fs') return '\0empty-fs'
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved && SWAP[resolved.id]) return SWAP[resolved.id]
      return null
    },
    load(id) {
      if (id === '\0empty-fs') return 'export const readFileSync = () => { throw new Error("sem ficheiros na demonstração") }'
      return null
    },
  }
}

export default defineConfig({
  root: here('./demo'),
  base: './',
  plugins: [swapNodeModules(), react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('https://api.demo.invalid') },
  build: { outDir: here('./demo-dist'), emptyOutDir: true, target: 'es2022' },
})
