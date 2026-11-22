const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const date = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatEuro = (cents: number) => euro.format(cents / 100)
export const formatDate = (ms: number) => date.format(new Date(ms))

/** "12,50" ou "12.50" → 1250 cêntimos. Devolve null se não for um valor válido. */
export function parseEuro(text: string): number | null {
  const clean = text.replace(/\s|€/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}

export const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: 'Alimentação',
  habitacao: 'Renda ou casa',
  saude: 'Saúde e medicamentos',
  educacao: 'Escola e educação',
  energia: 'Luz, água e gás',
  transportes: 'Transportes',
  outro: 'Outra necessidade',
}

export const DOCUMENT_LABELS: Record<string, string> = {
  rendimentos: 'Prova de rendimentos (IRS, recibos, declaração da Segurança Social)',
  morada: 'Prova de morada (fatura, contrato, atestado da junta)',
  despesas: 'Despesas (renda, faturas, receitas médicas)',
  outro: 'Outro documento',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Por enviar',
  pending: 'Em verificação',
  approved: 'Aprovado',
  rejected: 'Não aprovado',
  suspended: 'Suspenso',
  expired: 'Caducado',
}
