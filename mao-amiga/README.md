# Mão Amiga

App para quem pode ajudar financeiramente apoiar quem precisa, **sem que um saiba quem é o outro**.
Funciona em Android, iOS, Windows, Mac e no browser.

- **Quem quer ajudar** cria conta, confirma a identidade e doa para um fundo comum.
- **Quem precisa** confirma a identidade, explica a situação, envia provas (rendimentos, morada)
  e indica quanto precisa por mês.
- **Duas pessoas da equipa de revisão** verificam cada pedido. Os documentos são apagados depois.
- **Uma vez por mês** o fundo é dividido por quem foi aprovado e o dinheiro é transferido para o
  IBAN de cada pessoa, com o descritivo "Mão Amiga".

Não existe nenhuma ligação entre um doador e um beneficiário, nem na base de dados. Ver
[docs/legal.md](docs/legal.md) para o enquadramento legal, o que "anónimo" quer dizer aqui e
as medidas contra fraude. **Leia esse documento antes de usar com dinheiro real.**

## Estado

Protótipo completo e testado, a funcionar de ponta a ponta com **pagamentos e verificação de
identidade simulados**. Para usar a sério falta:

1. Constituir a associação (ver docs/legal.md).
2. Ligar um prestador de pagamentos real e um serviço de identidade real em `server/providers.ts`.
3. Alojar o servidor na UE com HTTPS, uma `MASTER_KEY` secreta e cópias de segurança da base de dados.
4. Política de privacidade, termos de utilização e avaliação de impacto (RGPD).

## Correr no computador

Precisa do [Node.js](https://nodejs.org) 22.18 ou mais recente.

```bash
npm install
cp .env.example .env            # opcional: ajustar regras e conta de administração

# terminal 1: servidor (http://localhost:8787)
ADMIN_EMAIL=admin@exemplo.pt ADMIN_PASSWORD=uma-palavra-passe-longa MIN_DONORS_PER_CYCLE=1 npm run server

# terminal 2: app (http://localhost:5174)
npm run dev

npm test        # 21 testes: regras, anonimato, fraude, HTTP e interface
npm run build   # versão final em dist/
```

Para experimentar: entre com a conta de administração e crie duas contas de revisão; registe uma
pessoa que precisa de ajuda (NIF de teste válido, por exemplo `123456789`) e envie um pedido;
aprove-o com os dois revisores; registe um doador e doe; corra a distribuição na administração.

## Como está organizado

```
server/            servidor (Node.js, sem dependências externas, SQLite incluído no Node)
  service.ts       todas as regras: contas, identidade, pedidos, revisão, doações, distribuição
  allocation.ts    divisão do fundo pelos beneficiários
  db.ts            tabelas (doações e pagamentos sem ligação entre si)
  crypto.ts        cifra AES-256-GCM, impressões digitais HMAC, palavras-passe scrypt
  validation.ts    NIF, IBAN, idade
  providers.ts     pagamentos e identidade (simulados; trocar pelos reais)
  http.ts          rotas /api/...
src/               app (React), igual em todas as plataformas
  screens/         Início, Entrar, Identidade, Doador, Beneficiário, Revisão, Administração
src-tauri/         versão Windows e Mac
docs/legal.md      lei, privacidade, fraude
```

## Regras configuráveis (variáveis de ambiente)

| Variável | Omissão | O que faz |
|---|---|---|
| `MASTER_KEY` | (obrigatória em produção) | Chave de cifra, 64 caracteres hexadecimais |
| `MAX_MONTHLY_CENTS` | 30000 | Máximo por pessoa por mês (300 €) |
| `MIN_DONORS_PER_CYCLE` | 5 | Doadores diferentes necessários para distribuir |
| `POVERTY_LINE_CENTS` | 63600 | Limiar de pobreza mensal (atualizar com o INE) |
| `APPROVALS_REQUIRED` | 2 | Revisores que têm de aprovar (mínimo 2) |
| `APPROVAL_VALID_DAYS` | 180 | Validade de uma aprovação |
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
- Windows/Mac: com [Rust](https://rustup.rs) instalado, `npx tauri icon assets/logo.png` (uma vez)
  e `npm run desktop` ou `npm run desktop:build`.

Nas lojas, ver as regras sobre donativos em [docs/legal.md](docs/legal.md#lojas-de-aplicações).
