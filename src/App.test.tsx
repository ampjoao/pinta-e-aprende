import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

function openLion() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'O Leão' }))
}

function zone(id: string) {
  return document.querySelector(`.stage [data-zone="${id}"]`)!
}

describe('App', () => {
  it('shows the categories and the lion on the home screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Pinta e Aprende' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Animais' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'O Leão' })).toBeInTheDocument()
  })

  it('shows "coming soon" for empty categories and a caption when tapped', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Letras' }))
    expect(screen.queryByRole('button', { name: 'O Leão' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Em breve!' }))
  })

  it('paints a zone with the selected colour, and undo reverts it', () => {
    openLion()
    fireEvent.click(screen.getByRole('button', { name: 'Amarelo' }))
    expect(screen.getByText('Amarelo', { selector: '.caption' })).toBeInTheDocument()
    fireEvent.click(zone('juba'))
    expect(zone('juba')).toHaveAttribute('fill', '#FACC15')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(zone('juba')).toHaveAttribute('fill', '#FFFFFF')
  })

  it('erases with the eraser', () => {
    openLion()
    fireEvent.click(zone('sol'))
    expect(zone('sol')).toHaveAttribute('fill', '#EF4444')
    fireEvent.click(screen.getByRole('button', { name: 'Borracha' }))
    fireEvent.click(zone('sol'))
    expect(zone('sol')).toHaveAttribute('fill', '#FFFFFF')
  })

  it('restart asks for confirmation and can be cancelled', () => {
    openLion()
    fireEvent.click(zone('corpo'))
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Não' }))
    expect(zone('corpo')).toHaveAttribute('fill', '#EF4444')
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    expect(zone('corpo')).toHaveAttribute('fill', '#FFFFFF')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mute toggles the sound button', () => {
    openLion()
    fireEvent.click(screen.getByRole('button', { name: 'Sem som' }))
    expect(screen.getByRole('button', { name: 'Som' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Som' }))
  })

  it('goes back home', () => {
    openLion()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(screen.getByRole('heading', { name: 'Pinta e Aprende' })).toBeInTheDocument()
  })
})
