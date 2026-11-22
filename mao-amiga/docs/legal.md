# Enquadramento legal e de privacidade

> Este documento explica as escolhas da app. **Não substitui um advogado nem um contabilista.**
> Antes de receber dinheiro real, valide tudo com profissionais. Leis e valores mudam.

## O que "anónimo" quer dizer nesta app

| Quem | Sabe quem doou? | Sabe quem recebeu? |
|---|---|---|
| Doador | (só ele próprio) | **Não** |
| Beneficiário | **Não** | (só ele próprio) |
| Público / outros utilizadores | **Não** | **Não** |
| Revisores | **Não** | Sim, para verificar a necessidade (com sigilo e registo de cada consulta) |
| Associação (por obrigação legal) | Sim (registos de doações) | Sim (registos de pagamentos) |
| Ninguém, nem a associação | **Qual doador pagou a qual beneficiário** — essa ligação não existe |

O anonimato **total**, em que nem a entidade sabe quem envia e quem recebe dinheiro, **é ilegal**
na UE: as regras contra branqueamento de capitais e financiamento do terrorismo obrigam a
identificar as pessoas. Por isso a app faz o máximo que a lei permite:

1. **Fundo comum.** O doador doa à associação, não a uma pessoa. A associação atribui apoios a
   partir do fundo. Na base de dados, a tabela de doações e a de pagamentos não têm nenhuma
   coluna em comum (há um teste automático que garante isto).
2. **Ciclos com mínimo de doadores.** Uma distribuição só acontece com pelo menos
   `MIN_DONORS_PER_CYCLE` doadores diferentes, para que não se possa deduzir quem pagou
   comparando datas e valores.
3. **Estatísticas com grupos mínimos.** Os números públicos só aparecem com 5 ou mais pessoas.
4. **Descritivo neutro.** A transferência chega como "Mão Amiga - apoio comunitário".
5. **Dados cifrados e minimizados.** Nome, data de nascimento, IBAN e documentos são cifrados
   (AES-256-GCM). O NIF não é guardado, só uma impressão digital (HMAC). Os documentos de prova
   são apagados quando o pedido é decidido.

Tribunais e autoridades (por exemplo, a Unidade de Informação Financeira) podem pedir os
registos que a lei obriga a guardar. Os termos de utilização têm de dizer isto com clareza.

## Modelo legal recomendado (Portugal)

1. **Entidade sem fins lucrativos.** Constituir uma associação e, idealmente, pedir o estatuto de
   IPSS ou de utilidade pública. Assim:
   - quem doa pode deduzir o donativo no IRS/IRC (mecenato, Estatuto dos Benefícios Fiscais);
   - a associação recebe doações para si e atribui apoios sociais, em vez de "transferir dinheiro
     entre pessoas", que seria um serviço de pagamento sujeito a licença do Banco de Portugal.
2. **Instituição de pagamento autorizada.** Cobrar doações e fazer transferências através de um
   prestador licenciado (Stripe, Mangopay, Adyen, SIBS/MB WAY, ou o próprio banco da associação).
   A app nunca guarda dados de cartão.
3. **Identificação (KYC).** Lei n.º 83/2017 (prevenção do branqueamento de capitais) e, a partir de
   2027, o Regulamento (UE) 2024/1624. Usar a Chave Móvel Digital / autenticação.gov ou um
   fornecedor de verificação de identidade. Verificar listas de sanções da UE/ONU (normalmente o
   prestador de pagamentos faz isto). Guardar os registos pelo prazo legal (7 anos na Lei 83/2017).
4. **Verificação de beneficiários.** Revisores com formação (idealmente assistentes sociais),
   termo de confidencialidade, duas aprovações independentes, reavaliação a cada 6 meses.
   Considerar parcerias com juntas de freguesia e serviços de ação social para validar casos.

## Fraude e mentiras ("sem ser mentira nem scam")

O que a app já faz:

- uma conta por pessoa (NIF único, via impressão digital) e só maiores de 18 anos;
- NIF e IBAN validados pelos dígitos de controlo; o mesmo IBAN não pode estar em duas contas;
- documentos obrigatórios (rendimentos e morada) e deteção do mesmo ficheiro em contas diferentes;
- cálculo automático do rendimento por adulto equivalente (escala da OCDE modificada, a do INE)
  comparado com o limiar de pobreza (`POVERTY_LINE_CENTS`, atualizar com o valor oficial);
- duas aprovações de revisores diferentes; um revisor não pode rever o próprio pedido;
- botão "suspeita de fraude" que suspende o pedido e os pagamentos;
- aprovação com prazo (180 dias por omissão), depois é preciso provar de novo;
- limite mensal por pessoa (`MAX_MONTHLY_CENTS`);
- registo de auditoria de cada consulta de documentos e de cada decisão;
- aviso no registo de que dar informações falsas é crime (burla).

Para os doadores, o risco de "scam" é a própria plataforma: por isso a associação deve publicar
relatórios e contas anuais auditadas, e as estatísticas agregadas estão sempre visíveis na app.

## RGPD

- Fazer uma **Avaliação de Impacto sobre a Proteção de Dados** (pessoas vulneráveis, dados
  financeiros, possivelmente dados de saúde nos documentos) e nomear um Encarregado de Proteção
  de Dados.
- Base legal: execução do contrato (apoio) e obrigação legal (KYC e contabilidade).
- Direito ao apagamento: botão "Eliminar a minha conta". Os registos que a lei obriga a manter
  ficam, sem email associado.
- Alojar o servidor e a base de dados na UE.

## Impostos e prestações sociais de quem recebe

Confirmar com um contabilista como são tratados os apoios recebidos (IRS, Imposto do Selo) e se
contam como rendimento para prestações como o RSI. Informar os beneficiários disto antes de aceitarem.

## Lojas de aplicações

- **Apple App Store**: só organizações sem fins lucrativos aprovadas podem recolher donativos
  dentro da app (regra 3.2.1(vi)) e têm de suportar Apple Pay. Em alternativa, a doação abre no browser.
- **Google Play**: donativos a instituições de caridade verificadas podem usar um sistema de
  pagamento externo, seguindo a política de pagamentos do Google Play.

## Se for para o Brasil

A arquitetura é a mesma, mas muda: CPF em vez de NIF, Pix em vez de IBAN, LGPD em vez de RGPD,
Lei 9.613/1998 e regras do COAF/Banco Central para prevenção de lavagem de dinheiro, e a
entidade seria uma OSC (associação ou fundação), eventualmente com título de OSCIP.
