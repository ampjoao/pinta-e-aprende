import { useState } from 'react'
import { useSpeech } from '../audio/SpeechContext'
import { DrawingView } from '../components/DrawingView'
import { drawings } from '../drawings/registry'
import { useLocale } from '../i18n/LocaleContext'

export const CATEGORIES = [
  { id: 'animais', icon: '🦁' },
  { id: 'letras', icon: '🔤' },
  { id: 'numeros', icon: '🔢' },
  { id: 'veiculos', icon: '🚗' },
  { id: 'natureza', icon: '🌳' },
  { id: 'historias', icon: '📖' },
]

export function Home({ onOpen }: { onOpen: (drawingId: string) => void }) {
  const { t, dt, line, drawingLine } = useLocale()
  const { say } = useSpeech()
  const [category, setCategory] = useState('animais')
  const visible = drawings.filter((d) => d.category === category)

  return (
    <main className="home">
      <h1 className="logo">{t('app.title')}</h1>
      <nav className="categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`category${c.id === category ? ' selected' : ''}`}
            aria-label={t(`home.categories.${c.id}`)}
            aria-pressed={c.id === category}
            onClick={() => {
              setCategory(c.id)
              say(line(`home.categories.${c.id}`))
            }}
          >
            <span className="category-icon" aria-hidden="true">
              {c.icon}
            </span>
            <span className="category-name">{t(`home.categories.${c.id}`)}</span>
          </button>
        ))}
      </nav>
      <section className="cards">
        {visible.length === 0 && (
          <button className="soon" onClick={() => say(line('home.soon'))} aria-label={t('home.soon')}>
            <span aria-hidden="true">🎨⏳</span>
          </button>
        )}
        {visible.map((d) => (
          <button
            key={d.id}
            className="card"
            aria-label={dt(d.id, 'title')}
            onClick={() => {
              say(drawingLine(d.id, 'title'))
              onOpen(d.id)
            }}
          >
            <DrawingView svg={d.svg} fills={{}} label={dt(d.id, 'title')} />
          </button>
        ))}
      </section>
    </main>
  )
}
