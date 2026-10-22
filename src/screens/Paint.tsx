import { useEffect, useReducer, useState, useSyncExternalStore } from 'react'
import { audioSettings } from '../audio/settings'
import { sfx, useSpeech } from '../audio/SpeechContext'
import { DrawingView } from '../components/DrawingView'
import { Icon } from '../components/Icon'
import { Palette, type Tool } from '../components/Palette'
import { getDrawing } from '../drawings/registry'
import { useLocale } from '../i18n/LocaleContext'
import { canUndo, createPaintState, paintReducer } from '../paint/state'

export function Paint({ drawingId, onHome }: { drawingId: string; onHome: () => void }) {
  const drawing = getDrawing(drawingId)!
  const { t, dt, line } = useLocale()
  const { say, repeat, caption } = useSpeech()
  const [state, dispatch] = useReducer(paintReducer, undefined, () => createPaintState())
  const [tool, setTool] = useState<Tool>({ kind: 'color', color: 'red' })
  const [confirmRestart, setConfirmRestart] = useState(false)
  const settings = useSyncExternalStore(audioSettings.subscribe, audioSettings.get)

  useEffect(() => {
    const timer = setTimeout(() => say(line('say.welcome')), 1200)
    return () => clearTimeout(timer)
  }, [say, line])

  function pickTool(next: Tool) {
    setTool(next)
    say(next.kind === 'color' ? line(`colors.${next.color}`) : line('say.eraser'))
  }

  function tapZone(zone: string) {
    if (tool.kind === 'eraser') {
      if (state.fills[zone]) sfx.soft()
      dispatch({ type: 'paint', zone, color: null })
    } else {
      sfx.pop()
      dispatch({ type: 'paint', zone, color: tool.color })
    }
  }

  return (
    <main className="paint">
      <header className="toolbar">
        <button className="tool" onClick={onHome} aria-label={t('tools.home')}>
          <Icon name="home" />
        </button>
        <button
          className="tool"
          disabled={!canUndo(state)}
          aria-label={t('tools.undo')}
          onClick={() => {
            sfx.soft()
            dispatch({ type: 'undo' })
          }}
        >
          <Icon name="undo" />
        </button>
        <button className="tool" aria-label={t('tools.restart')} onClick={() => setConfirmRestart(true)}>
          <Icon name="restart" />
        </button>
        <span className="spacer" />
        <button
          className="tool repeat"
          aria-label={t('tools.repeat')}
          onClick={() => {
            if (!repeat()) say(line('say.welcome'))
          }}
        >
          <Icon name="repeat" />
        </button>
        <button
          className="tool"
          aria-label={settings.muted ? t('tools.sound') : t('tools.mute')}
          aria-pressed={settings.muted}
          onClick={() => audioSettings.set({ muted: !settings.muted })}
        >
          <Icon name={settings.muted ? 'mute' : 'speaker'} />
        </button>
        <input
          className="volume"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={settings.volume}
          aria-label={t('tools.volume')}
          disabled={settings.muted}
          onChange={(e) => audioSettings.set({ volume: Number(e.target.value) })}
        />
      </header>

      <div className="stage">
        <DrawingView svg={drawing.svg} fills={state.fills} label={dt(drawing.id, 'title')} onZoneTap={tapZone} />
        {caption && (
          <p className="caption" aria-live="polite">
            {caption}
          </p>
        )}
      </div>

      <Palette
        tool={tool}
        onPick={pickTool}
        colorName={(id) => t(`colors.${id}`)}
        eraserLabel={t('tools.eraser')}
      />

      {confirmRestart && (
        <div className="modal" role="dialog" aria-label={t('tools.restartConfirm')}>
          <div className="modal-box">
            <Icon name="restart" size={64} />
            <div className="modal-actions">
              <button
                className="big yes"
                aria-label={t('tools.yes')}
                onClick={() => {
                  dispatch({ type: 'reset' })
                  setConfirmRestart(false)
                  say(line('say.restart'))
                }}
              >
                <Icon name="check" size={48} />
              </button>
              <button className="big no" aria-label={t('tools.no')} onClick={() => setConfirmRestart(false)}>
                <Icon name="close" size={48} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
