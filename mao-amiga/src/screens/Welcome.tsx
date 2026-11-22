import { api, type Note, type Role, type Stats } from '../api'
import { formatEuro } from '../format'
import { useLoad } from '../ui'

export function Welcome({ onStart }: { onStart: (mode: 'login' | 'register', role?: Role) => void }) {
  const stats = useLoad(() => api<Stats>('GET', '/api/stats'))
  const notes = useLoad(() => api<Note[]>('GET', '/api/notes'))
  const s = stats.data
  const small = (v: number | null) => (v === null ? `menos de ${s?.minGroup ?? 5}` : String(v))

  return (
    <div className="stack">
      <section className="hero">
        <h1>Ajudar sem ninguém saber quem ajudou. Receber sem ninguém saber quem recebeu.</h1>
        <p>
          Quem pode ajudar contribui para um fundo comum. Quem precisa prova a sua situação e recebe um apoio mensal.
          Nenhum doador sabe quem recebeu e nenhum beneficiário sabe quem deu.
        </p>
        <div className="actions">
          <button className="primary" onClick={() => onStart('register', 'donor')}>
            Quero ajudar
          </button>
          <button className="secondary" onClick={() => onStart('register', 'beneficiary')}>
            Preciso de ajuda
          </button>
          <button className="link" onClick={() => onStart('login')}>
            Já tenho conta
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Como funciona</h2>
        <ol className="steps">
          <li>
            <strong>Todos confirmam a identidade.</strong> A lei obriga a saber quem dá e quem recebe dinheiro. Esses dados
            ficam cifrados e só são vistos por quem tem de os verificar.
          </li>
          <li>
            <strong>Quem precisa prova a necessidade.</strong> Envia documentos de rendimentos e morada. Duas pessoas
            diferentes da equipa de revisão têm de aprovar. Os documentos são apagados logo depois.
          </li>
          <li>
            <strong>As doações juntam-se num fundo.</strong> Uma vez por mês o fundo é dividido por quem foi aprovado.
            Como o dinheiro se mistura, não existe ligação entre um doador e um beneficiário, nem sequer na nossa base de dados.
          </li>
          <li>
            <strong>O pagamento chega por transferência.</strong> Para o IBAN em nome da pessoa aprovada, com o descritivo
            "Mão Amiga". O dinheiro passa por uma instituição de pagamento autorizada.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>Até agora</h2>
        {stats.error && <p className="muted">{stats.error}</p>}
        {s && (
          <div className="stats">
            <div>
              <span className="big">{s.donatedCents === null ? '—' : formatEuro(s.donatedCents)}</span>
              <span>doados por {small(s.donors)} pessoas</span>
            </div>
            <div>
              <span className="big">{s.distributedCents === null ? '—' : formatEuro(s.distributedCents)}</span>
              <span>entregues a {small(s.peopleHelped)} pessoas</span>
            </div>
            <div>
              <span className="big">{s.cycles}</span>
              <span>distribuições mensais</span>
            </div>
          </div>
        )}
        <p className="hint">Com grupos pequenos não mostramos números, para que ninguém possa ser identificado.</p>
      </section>

      {notes.data && notes.data.length > 0 && (
        <section className="card">
          <h2>Mensagens de quem recebeu</h2>
          <ul className="notes">
            {notes.data.map((n, i) => (
              <li key={i}>“{n.text}”</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
