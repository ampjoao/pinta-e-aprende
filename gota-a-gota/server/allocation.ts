/**
 * Divisão do fundo comum por quem foi aprovado.
 *
 * Cada pessoa pede um valor mensal (limitado pelo máximo da plataforma).
 * Se o fundo chega para todos, cada um recebe o que pediu e o resto fica para o ciclo seguinte.
 * Se não chega, o fundo é dividido em proporção ao que cada um pediu. Trabalha-se em cêntimos
 * inteiros; os cêntimos que sobram do arredondamento vão para quem ficou com maior resto.
 */
export interface Need {
  id: string
  requestedCents: number
}

export interface Allocation {
  payouts: Map<string, number>
  distributedCents: number
  carryOverCents: number
}

export function allocate(poolCents: number, needs: Need[], maxMonthlyCents: number): Allocation {
  const demands = needs
    .map((n) => ({ id: n.id, demand: Math.max(0, Math.min(Math.floor(n.requestedCents), maxMonthlyCents)) }))
    .filter((n) => n.demand > 0)
  const totalDemand = demands.reduce((s, n) => s + n.demand, 0)
  const payouts = new Map<string, number>()
  const pool = Math.max(0, Math.floor(poolCents))

  if (totalDemand === 0 || pool === 0) return { payouts, distributedCents: 0, carryOverCents: pool }

  if (pool >= totalDemand) {
    for (const n of demands) payouts.set(n.id, n.demand)
    return { payouts, distributedCents: totalDemand, carryOverCents: pool - totalDemand }
  }

  const shares = demands.map((n) => {
    const exact = (pool * n.demand) / totalDemand
    const base = Math.floor(exact)
    return { id: n.id, base, rest: exact - base, demand: n.demand }
  })
  let leftover = pool - shares.reduce((s, x) => s + x.base, 0)
  const order = [...shares].sort((a, b) => b.rest - a.rest || (a.id < b.id ? -1 : 1))
  for (const s of order) {
    if (leftover === 0) break
    if (s.base < s.demand) {
      s.base++
      leftover--
    }
  }
  for (const s of shares) if (s.base > 0) payouts.set(s.id, s.base)
  return { payouts, distributedCents: pool - leftover, carryOverCents: leftover }
}
