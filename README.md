# Pinta e Aprende

> Este repositório também contém a app **Gota a Gota** (ajuda financeira anónima) na pasta [`gota-a-gota/`](gota-a-gota/README.md).

App de pintura para crianças pequenas: escolhem uma cor, tocam numa parte do desenho e ouvem o nome das cores e das coisas. Funciona no browser (tablet, telemóvel, computador), sem contas nem publicidade.

## Correr no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes automáticos
npm run build    # versão final em dist/
```

## Como está organizado

```
content/
  drawings/<id>/drawing.svg    desenho; cada parte pintável tem data-zone="<zona>"
  drawings/<id>/drawing.json   categoria e lista de zonas
  locales/<língua>/ui.json     textos da app
  locales/<língua>/drawings.json  título e frase de cada zona
  audio/manifest.json          lista de gravações de voz disponíveis
public/audio/<língua>/<id>.mp3 gravações de voz (opcionais)
src/
  paint/      estado da pintura (pintar, apagar, desfazer, recomeçar) e paleta
  audio/      voz (gravações → voz do aparelho), efeitos sonoros, volume
  i18n/       línguas e textos
  screens/    ecrã inicial e ecrã de pintura
```

## Acrescentar um desenho

1. Cria `content/drawings/<id>/drawing.svg` com `viewBox="0 0 400 400"`. Cada parte pintável leva `data-zone="nome"` e `fill="#ffffff"`. Os detalhes que não se pintam (olhos, bigodes) vão num `<g pointer-events="none">` por cima.
2. Cria `content/drawings/<id>/drawing.json` com `id`, `category` (`animais`, `letras`, `numeros`, `veiculos`, `natureza`, `historias`) e a lista de `zones`.
3. Em `content/locales/pt-PT/drawings.json`, acrescenta o `title` e uma frase em `parts` para cada zona.
4. `npm test` confirma que as zonas do SVG e do JSON coincidem e que todas têm texto.

## Gravações de voz

Por omissão a app usa a voz do aparelho. Para usar uma gravação:

1. Grava o ficheiro com o nome da chave do texto, por exemplo `public/audio/pt-PT/colors.red.mp3` ou `public/audio/pt-PT/drawings.leao.parts.juba.mp3`.
2. Acrescenta `"pt-PT/colors.red"` à lista `files` em `content/audio/manifest.json`.

Se a gravação falhar, a app usa a voz do aparelho. Se não houver voz em português, o texto aparece na legenda.

## Acrescentar uma língua

Copia `content/locales/pt-PT/` para `content/locales/<código>/` (por exemplo `en-GB`) e traduz. A app escolhe a língua do aparelho; o que faltar aparece em português.

## Versões: web, Android, iOS, Windows e Mac

Todas saem do mesmo código em `src/`.

| Versão | Tecnologia | Onde aparece |
|---|---|---|
| Web | Vite | Cloudflare Pages (cada push para `main`) |
| Instalável no tablet/PC | PWA (`vite-plugin-pwa`) | No browser: "Adicionar ao ecrã principal" / "Instalar app". Funciona sem internet. |
| Android | Capacitor | GitHub → Actions → **Android** → Artifacts (APK) |
| iOS | Capacitor | GitHub → Actions → **iOS** (confirma que compila) |
| Windows e Mac | Tauri | GitHub → Actions → **Desktop** → Artifacts (.msi/.exe e .dmg) |

O ícone da app está em `assets/logo.png` (1024×1024, desenhado em `assets/icon.svg`). `npm run icons` gera todos os tamanhos.

### No computador

- Android: `npx cap add android` (uma vez) e depois `npm run android` (precisa do Android Studio).
- iOS: num Mac com Xcode, `npx cap add ios` (uma vez) e depois `npm run ios`.
- Windows/Mac: com [Rust](https://rustup.rs) instalado, `npm run desktop` (teste) ou `npm run desktop:build` (instalador).

As pastas `android/` e `ios/` são geradas e não vão para o Git.

### Lojas (quando a app estiver pronta)

- **Google Play** (25 USD, uma vez): criar uma chave de assinatura e gerar um `.aab` com `./gradlew bundleRelease`.
- **App Store** (Apple Developer, 99 USD/ano): abrir `ios/App/App.xcodeproj` no Xcode, escolher a equipa e fazer Product → Archive. A Mac App Store usa a mesma conta.
- **Microsoft Store** (grátis para particulares): enviar o `.msi` gerado pelo workflow Desktop.

Apps para crianças: sem publicidade nem recolha de dados (regras Kids da Apple e Families da Google). A app já cumpre isso.

## Publicar (Cloudflare Pages)

Workers & Pages → Create → Pages → Connect to Git → escolhe este repositório.

- Framework preset: **None** (ou Vite)
- Build command: `npm run build`
- Build output directory: `dist`

Cada `git push` para `main` publica uma nova versão.
