# Mão Amiga

App mundial para quem pode ajudar financeiramente apoiar quem precisa, **sem que um saiba quem é
o outro**. Funciona em Android, iOS, Windows, Mac e no browser.

- **Quem quer ajudar** cria conta, confirma a identidade e doa para um fundo comum mundial, na sua moeda.
- **Quem precisa** confirma a identidade, explica a situação na moeda do seu país, envia provas
  (rendimentos, morada) e escolhe como receber: IBAN, Pix, mobile money, conta bancária ou carteira digital.
- **Duas pessoas da equipa de revisão** verificam cada pedido. Cada revisor só vê os países que
  lhe foram atribuídos. Os documentos são apagados depois.
- **Uma vez por mês** o fundo é dividido por quem foi aprovado, em todos os países, e cada pessoa
  recebe na moeda local, com o descritivo "Mao Amiga".

Não existe nenhuma ligação entre um doador e um beneficiário, nem na base de dados. Ver
[docs/legal.md](docs/legal.md): o que "anónimo" quer dizer, o enquadramento legal mundial, as
medidas contra fraude e a lista para abrir um país. **Leia-o antes de usar com dinheiro real.**

## Línguas, países e moedas

- **Línguas da app**: inglês, espanhol, francês, português (Portugal) e português (Brasil). A app
  escolhe a do aparelho e pode-se mudar no topo. Nomes de países, moedas, datas e números aparecem
  automaticamente no formato de cada língua. Já está preparada para línguas da direita para a
  esquerda (árabe, hebraico...).
- **Países de exemplo**: Portugal, Espanha, França, Reino Unido, EUA, Brasil, México, Angola,
  Moçambique, Quénia, Índia e Filipinas. Cada país tem moeda, documento de identificação, formas de
  receber, limiar de pobreza e apoio máximo próprios, em `server/countries.ts`.
  **Os valores são exemplos aproximados** e aparecem assinalados aos revisores até serem confirmados.
- **Moedas**: o fundo comum está numa moeda base (`BASE_CURRENCY`, EUR por omissão). Doações em
  qualquer moeda com câmbio; pedidos na moeda do país. Em produção os câmbios vêm do prestador de pagamentos.

### Acrescentar uma língua

1. Copiar `src/i18n/en.ts` para `src/i18n/<código>.ts` e traduzir (o TypeScript avisa se faltar algo).
2. Juntá-la a `LANGUAGES` em `src/i18n/index.tsx`.
3. Traduzir as mensagens de erro do servidor em `server/messages.ts`.

### Acrescentar um país

Juntar uma linha ao catálogo em `server/countries.ts` (ou num JSON indicado em `COUNTRIES_FILE`)
com moeda, tipo de documento, limiar de pobreza, apoio máximo e formas de receber, e o câmbio da
moeda. Depois seguir a lista no fim de [docs/legal.md](docs/legal.md).

## Estado

Protótipo completo e testado, de ponta a ponta, com **pagamentos e verificação de identidade
simulados**. Para usar a sério falta:

1. A estrutura legal (organização principal e parceiros locais, ver docs/legal.md).
2. Prestadores reais de pagamentos, câmbios e identidade em `server/providers.ts`.
3. Confirmar os valores de cada país e ativar só os países prontos (`ENABLED_COUNTRIES`).
4. Alojar o servidor com HTTPS, uma `MASTER_KEY` secreta e cópias de segurança.
5. Políticas de privacidade e termos em cada língua.

## Demonstração

`npm run demo:build` gera `demo-dist/index.html`: a app completa num só ficheiro, a correr no
browser sem servidor (as mesmas regras de `server/`, com SQLite em JavaScript) e com pessoas e
dinheiro fictícios de vários países. Uma faixa no topo permite entrar como doador, beneficiária,
revisor ou administração. `npm run demo` abre a mesma versão em modo de desenvolvimento.

## Correr no computador

Precisa do [Node.js](https://nodejs.org) 22.18 ou mais recente.

```bash
npm install
cp .env.example .env            # opcional: ajustar regras e conta de administração

# terminal 1: servidor (http://localhost:8787)
ADMIN_EMAIL=admin@exemplo.org ADMIN_PASSWORD=uma-palavra-passe-longa MIN_DONORS_PER_CYCLE=1 npm run server

# terminal 2: app (http://localhost:5174)
npm run dev

npm test        # 34 testes: regras, anonimato, fraude, moedas, línguas, HTTP e interface
npm run build   # versão final em dist/
```

Documentos de teste válidos: NIF `123456789` (Portugal), CPF `529.982.247-25` (Brasil),
DNI `12345678Z` (Espanha); nos outros países, qualquer número com 4 a 30 letras ou algarismos.

## Como está organizado

```
server/            servidor (Node.js, sem dependências externas, SQLite incluído no Node)
  service.ts       regras: contas, identidade, pedidos, revisão, doações, distribuição
  countries.ts     países, moedas e câmbios (valores de exemplo)
  allocation.ts    divisão do fundo
  validation.ts    NIF, CPF, DNI, IBAN, Pix, telefone, contas
  messages.ts      mensagens do servidor em 5 línguas
  db.ts            tabelas (doações e pagamentos sem ligação entre si)
  crypto.ts        cifra AES-256-GCM, impressões digitais HMAC, palavras-passe scrypt
  providers.ts     pagamentos e identidade (simulados; trocar pelos reais)
  http.ts          rotas /api/...
src/               app (React), igual em todas as plataformas
  i18n/            línguas
  screens/         Início, Entrar, Identidade, Doador, Beneficiário, Revisão, Administração
src-tauri/         versão Windows e Mac
docs/legal.md      lei, privacidade, fraude, abrir países
```

## Regras configuráveis (variáveis de ambiente)

| Variável | Omissão | O que faz |
|---|---|---|
| `MASTER_KEY` | (obrigatória em produção) | Chave de cifra, 64 caracteres hexadecimais |
| `BASE_CURRENCY` | EUR | Moeda do fundo comum |
| `ENABLED_COUNTRIES` | todos os do catálogo | Países abertos, por exemplo `PT,BR,MZ` |
| `COUNTRIES_FILE` | (catálogo de exemplo) | JSON com países e câmbios |
| `MIN_DONORS_PER_CYCLE` | 5 | Doadores diferentes necessários para distribuir |
| `APPROVALS_REQUIRED` | 2 | Revisores que têm de aprovar (mínimo 2) |
| `APPROVAL_VALID_DAYS` | 180 | Validade de uma aprovação |
| `MIN_DONATION_CENTS` / `MAX_DONATION_CENTS` | 500 / 1000000 | Limites por doação, na moeda base |
| `ALLOWED_ORIGINS` | web, Android, iOS, Windows | Origens que podem falar com o servidor |

## Android, iOS, Windows e Mac

Todas as versões saem do mesmo código em `src/`. O endereço do servidor é definido na compilação
com `VITE_API_URL` (nos workflows, pela variável do repositório `MAO_AMIGA_API_URL` em
Settings → Secrets and variables → Actions → Variables). Em produção tem de ser `https://`.

| Versão | Tecnologia | Onde aparece |
|---|---|---|
| Android | Capacitor | GitHub → Actions → **Mão Amiga · Android** → Artifacts (APK) |
| iOS | Capacitor | GitHub → Actions → **Mão Amiga · iOS** (confirma que compila) |
| Windows e Mac | Tauri | GitHub → Actions → **Mão Amiga · Windows e Mac** → Artifacts (.msi/.exe e .dmg) |

No computador:

- Android: `npx cap add android` (uma vez) e depois `npm run android` (precisa do Android Studio).
- iOS: num Mac com Xcode, `npx cap add ios` (uma vez) e depois `npm run ios`.
- Windows/Mac: com [Rust](https://rustup.rs), `npx tauri icon assets/logo.png` (uma vez) e
  `npm run desktop` ou `npm run desktop:build`.

Nas lojas, ver as regras sobre donativos em [docs/legal.md](docs/legal.md#lojas-de-aplicações).
