import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '../../src/App'

/**
 * UI-01 — TokTickIT heading renders.
 *
 * The landing state must show the product name and the Check System button and
 * nothing else: the brief requires the status to appear only after a click.
 */
describe('TokTickIT landing page', () => {
  it('renders the TokTickIT heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'TokTickIT IT Service Desk' }),
    ).toBeInTheDocument()
  })

  it('offers a Check System button', () => {
    render(<App />)

    expect(
      screen.getByRole('button', { name: 'Check System' }),
    ).toBeInTheDocument()
  })

  it('shows no system status before the button is clicked', () => {
    render(<App />)

    expect(screen.queryByText(/System Status/)).not.toBeInTheDocument()
  })
})
