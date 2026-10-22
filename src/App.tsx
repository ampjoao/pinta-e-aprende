import { useState } from 'react'
import { LocaleProvider } from './i18n/LocaleContext'
import { SpeechProvider } from './audio/SpeechContext'
import { Home } from './screens/Home'
import { Paint } from './screens/Paint'

type Screen = { name: 'home' } | { name: 'paint'; drawingId: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  return (
    <LocaleProvider>
      <SpeechProvider>
        {screen.name === 'home' ? (
          <Home onOpen={(drawingId) => setScreen({ name: 'paint', drawingId })} />
        ) : (
          <Paint drawingId={screen.drawingId} onHome={() => setScreen({ name: 'home' })} />
        )}
      </SpeechProvider>
    </LocaleProvider>
  )
}
