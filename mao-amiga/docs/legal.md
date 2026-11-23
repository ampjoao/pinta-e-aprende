# Enquadramento legal e de privacidade (mundial)

> Este documento explica as escolhas da app. **Não substitui advogados nem contabilistas em cada
> país.** Antes de receber dinheiro real num país, valide tudo com profissionais desse país.
> Leis, limiares e câmbios mudam.

## A verdade sobre "o mundo inteiro"

A app já funciona tecnicamente para qualquer país: línguas, moedas, documentos de identificação
e formas de pagamento locais. **Legalmente, não existe uma licença única para o mundo inteiro.**
Cada país onde se recolhem doações ou se pagam apoios tem regras próprias. Por isso a app só
mostra os países que a organização ativou (`ENABLED_COUNTRIES`), e cada país novo é aberto de
propósito, depois de cumprir a lista no fim deste documento.

Há países onde **não é possível operar**: os que estão sob sanções abrangentes da ONU, UE ou EUA
(por exemplo Coreia do Norte, Irão, Síria, Cuba, Crimeia e outras regiões ocupadas). O prestador
de pagamentos também bloqueia pessoas que constem de listas de sanções.

## O que "anónimo" quer dizer nesta app

| Quem | Sabe quem doou? | Sabe quem recebeu? |
|---|---|---|
| Doador | (só ele próprio) | **Não** |
| Beneficiário | **Não** | (só ele próprio) |
| Público / outros utilizadores | **Não** | **Não** |
| Revisores | **Não** | Sim, só dos países que lhes foram atribuídos, com sigilo e registo de cada consulta |
| Organização (por obrigação legal) | Sim (registos de doações) | Sim (registos de pagamentos) |
| Ninguém, nem a organização | **Qual doador pagou a qual beneficiário** — essa ligação não existe |

O anonimato **total** (nem a entidade saber quem envia e quem recebe) **é ilegal em praticamente
todos os países**: as recomendações do GAFI/FATF contra branqueamento de capitais e financiamento
do terrorismo obrigam a identificar as pessoas. A app faz o máximo que a lei permite:

1. **Fundo comum mundial.** O doador doa à organização, não a uma pessoa. A organização atribui
   apoios a partir do fundo. As tabelas de doações e de pagamentos não têm nenhuma coluna em
   comum (há um teste automático que garante isto).
2. **Ciclos com mínimo de doadores** (`MIN_DONORS_PER_CYCLE`), para que não se possa deduzir quem
   pagou comparando datas e valores. Como o fundo é mundial, um doador nem sabe em que país foi
   parar o seu dinheiro.
3. **Estatísticas com grupos mínimos** (5 pessoas).
4. **Descritivo neutro**: "Mao Amiga".
5. **Dados cifrados e minimizados**: nome, data de nascimento e dados de pagamento cifrados
   (AES-256-GCM); o número de identificação só como impressão digital (HMAC); documentos
   apagados quando o pedido é decidido.

Tribunais e autoridades de cada país podem pedir os registos que a lei obriga a guardar. Os
termos de utilização têm de o dizer com clareza.

## Modelo de organização recomendado

Uma app global precisa de uma estrutura legal global. Os modelos que normalmente funcionam:

1. **Uma organização principal sem fins lucrativos** (por exemplo uma associação ou fundação
   num país da UE) que recebe as doações para si e atribui apoios sociais. Assim não "transfere
   dinheiro entre pessoas" (o que exigiria licença de serviços de pagamento), mas concede apoios.
2. **Parceiros locais em cada país onde se pagam apoios**: ONG registadas, que ajudam a verificar
   os pedidos (assistentes sociais), conhecem as regras locais e, onde a lei o exige, recebem a
   verba e fazem o pagamento.
3. **Para os doadores terem benefícios fiscais**, normalmente a entidade tem de ser reconhecida no
   país do doador. Soluções comuns: redes como a Transnational Giving Europe, entidades "Friends
   of" (por exemplo uma 501(c)(3) nos EUA), ou uma entidade registada em cada grande mercado
   de doadores.

## Pagamentos

- Nunca guardar dinheiro nem dados de cartão na app. Usar instituições de pagamento licenciadas.
- **Doações** em várias moedas: Stripe, Adyen, Mangopay (cartão, Apple Pay, Google Pay, transferências).
- **Apoios**: Wise Platform, Stripe Connect, Thunes, Payoneer; Pix através de um PSP brasileiro;
  mobile money (M-Pesa, MTN, Airtel, Orange, GCash) através de agregadores licenciados.
- **Câmbios**: a tabela em `server/countries.ts` é só para o protótipo. Em produção usar os câmbios
  do prestador no momento da operação.

## Identificação e listas de sanções

Usar um fornecedor internacional de verificação de identidade (documento + selfie), que também
verifique listas de sanções (ONU, UE, OFAC, Reino Unido) e pessoas politicamente expostas:
Onfido, Veriff, Sumsub, Persona, ou soluções nacionais (Chave Móvel Digital em Portugal, gov.br no
Brasil, etc.). Guardar os registos pelo prazo legal de cada país (muitas vezes 5 a 10 anos).

## Fraude ("sem ser mentira nem scam")

O que a app já faz, em todos os países:

- uma conta por documento de identificação (por país) e só maiores de idade (idade configurável por país);
- validação dos documentos com dígitos de controlo onde existem (NIF, CPF, DNI/NIE) e dos IBAN;
- a mesma conta de destino (IBAN, chave Pix, telefone, conta, carteira) não pode estar em duas pessoas;
- documentos de rendimentos e morada obrigatórios, aceites em qualquer língua;
- deteção do mesmo ficheiro em contas diferentes;
- rendimento por adulto equivalente comparado com o limiar de pobreza **do país**, na moeda local;
- apoio máximo mensal **por país**, na moeda local;
- duas aprovações de revisores diferentes, que só veem os países que lhes foram atribuídos
  (para conhecerem a língua e os documentos locais);
- suspensão por suspeita de fraude, aprovação com prazo e registo de auditoria.

Para os doadores, o risco de "scam" é a própria plataforma: publicar contas anuais auditadas e
relatórios por país.

## Proteção de dados

Cada região tem a sua lei: RGPD (UE), LGPD (Brasil), UK GDPR, CCPA/CPRA (Califórnia), POPIA
(África do Sul), Lei 22/11 (Angola), DPDP Act (Índia), Data Privacy Act (Filipinas), entre outras.
Pontos comuns:

- avaliação de impacto antes de abrir (pessoas vulneráveis, dados financeiros, possivelmente de saúde);
- encarregado de proteção de dados;
- transferências internacionais de dados com base legal (por exemplo cláusulas contratuais-tipo);
- algumas leis exigem guardar dados no próprio país: confirmar antes de abrir.

## Impostos e prestações sociais de quem recebe

Em cada país, confirmar como são tratados os apoios recebidos (rendimento tributável ou não) e
se contam para prestações sociais. Informar os beneficiários antes de aceitarem.

## Lojas de aplicações

- **Apple App Store**: só organizações sem fins lucrativos aprovadas podem recolher donativos dentro
  da app (regra 3.2.1(vi)), com Apple Pay. Em alternativa, a doação abre no browser.
- **Google Play**: donativos a instituições verificadas podem usar pagamentos externos, segundo a
  política de pagamentos do Google Play.
- As duas lojas permitem escolher em que países a app aparece: coincidir com os países ativos.

## Lista para abrir um país

1. Base legal para pagar apoios nesse país (parceiro local ou registo próprio).
2. Prestador de pagamentos que pague nesse país e moeda, e verificação de identidade que aceite
   os documentos locais.
3. Limiar de pobreza oficial e apoio máximo mensal, confirmados e colocados no catálogo de países
   (marcar `example: false`).
4. Revisores com formação, que conheçam a língua e os documentos locais.
5. Proteção de dados e impostos verificados por profissionais locais.
6. Tradução da app para a língua local, se ainda não existir.
7. Acrescentar o código do país a `ENABLED_COUNTRIES`.
