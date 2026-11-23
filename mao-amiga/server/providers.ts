/**
 * Integrações externas. A plataforma NUNCA guarda dinheiro nem dados de cartão: tudo passa por
 * instituições de pagamento autorizadas e por um serviço de verificação de identidade.
 * As versões "Mock" servem para desenvolvimento e testes.
 *
 * Em produção, por exemplo:
 *  - Doações (cartão, Apple Pay, Google Pay, transferência) em várias moedas: Stripe, Adyen, Mangopay.
 *  - Pagamentos para fora: Wise Platform, Stripe Connect, Thunes, Payoneer; Pix (BR) via um PSP
 *    brasileiro; mobile money (M-Pesa, MTN, Airtel, GCash) via agregadores licenciados.
 *  - Identidade + listas de sanções (ONU, UE, OFAC) e pessoas politicamente expostas:
 *    Onfido, Veriff, Sumsub, Persona; em Portugal também Chave Móvel Digital, no Brasil gov.br.
 *  - Câmbios: os do próprio prestador de pagamentos, no momento da operação.
 */
import { randomId } from './crypto.ts'
import type { PayoutMethod } from './validation.ts'

export interface PaymentProvider {
  /** Cobra uma doação. Devolve a referência da operação no fornecedor. */
  chargeDonation(input: { amountMinor: number; currency: string; idempotencyKey: string }): Promise<{ ref: string }>
  /**
   * Envia um apoio. `amountMinor` está na moeda base; o fornecedor converte para `targetCurrency`.
   * O descritivo nunca identifica doadores.
   */
  payout(input: {
    method: PayoutMethod
    holderName: string
    country: string
    amountMinor: number
    baseCurrency: string
    targetCurrency: string
    reference: string
  }): Promise<{ ref: string }>
}

export interface KycInput {
  legalName: string
  country: string
  idType: string
  nationalId: string
  birthDate: string
}

export interface KycProvider {
  /**
   * Confirma que a pessoa existe, que os dados são dela e que não consta de listas de sanções.
   * `reason` é um texto curto para mostrar à pessoa quando falha.
   */
  verify(input: KycInput): Promise<{ ok: boolean; ref: string; reason?: string }>
}

export class MockPaymentProvider implements PaymentProvider {
  readonly charges: { amountMinor: number; currency: string; ref: string }[] = []
  readonly payouts: (Parameters<PaymentProvider['payout']>[0] & { ref: string })[] = []

  async chargeDonation(input: { amountMinor: number; currency: string; idempotencyKey: string }) {
    const ref = `mock_ch_${randomId()}`
    this.charges.push({ amountMinor: input.amountMinor, currency: input.currency, ref })
    return { ref }
  }

  async payout(input: Parameters<PaymentProvider['payout']>[0]) {
    const ref = `mock_po_${randomId()}`
    this.payouts.push({ ...input, ref })
    return { ref }
  }
}

/** Simulação: aceita qualquer pessoa com nome e apelido. O formato do documento já foi validado. */
export class MockKycProvider implements KycProvider {
  async verify(input: KycInput) {
    if (input.legalName.trim().split(/\s+/).length < 2) return { ok: false, ref: '', reason: 'full name required' }
    return { ok: true, ref: `mock_kyc_${randomId()}` }
  }
}
