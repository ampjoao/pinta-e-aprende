/**
 * Integrações externas. A plataforma NUNCA guarda dinheiro nem dados de cartão: tudo passa por
 * uma instituição de pagamento autorizada (Banco de Portugal / UE) e por um serviço de
 * verificação de identidade. As versões "Mock" servem para desenvolvimento e testes.
 *
 * Em produção, substituir por, por exemplo:
 *  - Pagamentos: Stripe Connect, Mangopay, Adyen for Platforms ou SIBS (MB WAY / Multibanco),
 *    numa conta de cliente segregada em nome da associação.
 *  - Identidade: Chave Móvel Digital / autenticação.gov, ou um fornecedor KYC (Onfido, Veriff, Sumsub).
 */
import { randomId } from './crypto.ts'
import { isPersonalNif } from './validation.ts'

export interface PaymentProvider {
  /** Cobra uma doação ao doador. Devolve a referência da operação no fornecedor. */
  chargeDonation(input: { amountCents: number; idempotencyKey: string }): Promise<{ ref: string }>
  /** Transfere um apoio para o IBAN verificado do beneficiário. O descritivo nunca identifica doadores. */
  payout(input: { iban: string; holderName: string; amountCents: number; reference: string }): Promise<{ ref: string }>
}

export interface KycProvider {
  /** Confirma que a pessoa existe e que os dados pertencem a quem está a usar a conta. */
  verify(input: { legalName: string; nif: string; birthDate: string }): Promise<{ ok: boolean; ref: string; reason?: string }>
}

export class MockPaymentProvider implements PaymentProvider {
  readonly charges: { amountCents: number; ref: string }[] = []
  readonly payouts: { iban: string; holderName: string; amountCents: number; reference: string; ref: string }[] = []

  async chargeDonation(input: { amountCents: number; idempotencyKey: string }) {
    const ref = `mock_ch_${randomId()}`
    this.charges.push({ amountCents: input.amountCents, ref })
    return { ref }
  }

  async payout(input: { iban: string; holderName: string; amountCents: number; reference: string }) {
    const ref = `mock_po_${randomId()}`
    this.payouts.push({ ...input, ref })
    return { ref }
  }
}

export class MockKycProvider implements KycProvider {
  async verify(input: { legalName: string; nif: string; birthDate: string }) {
    if (!isPersonalNif(input.nif)) return { ok: false, ref: '', reason: 'NIF inválido' }
    if (input.legalName.trim().split(/\s+/).length < 2) return { ok: false, ref: '', reason: 'Indique o nome completo' }
    return { ok: true, ref: `mock_kyc_${randomId()}` }
  }
}
