import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ServiceStatus } from './ServiceStatus'

describe('ServiceStatus', () => {
  it('displays the service name', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.getByText('nakom.is')).toBeInTheDocument()
  })

  it('applies status-up class when up', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-up')
  })

  it('applies status-down class when down', () => {
    render(<ServiceStatus service="nakom.is" status="down" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-down')
  })

  it('applies status-unknown class when unknown', () => {
    render(<ServiceStatus service="nakom.is" status="unknown" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-unknown')
  })

  it('applies status-warning class when warning', () => {
    render(<ServiceStatus service="nakom.is" status="warning" />)
    expect(screen.getByTestId('status-indicator')).toHaveClass('status-warning')
  })

  it('shows warning indicator with ⚠ prefix', () => {
    render(<ServiceStatus service="nakom.is" status="warning" />)
    expect(screen.getByTestId('status-indicator')).toHaveTextContent('⚠ warning')
  })

  it('displays detail when provided', () => {
    render(<ServiceStatus service="nakom.is" status="warning" detail="available" />)
    expect(screen.getByText('available')).toBeInTheDocument()
  })

  it('does not display detail when not provided', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.queryByText('available')).not.toBeInTheDocument()
  })

  it('displays latency when provided', () => {
    render(<ServiceStatus service="nakom.is" status="up" latencyMs={42} />)
    expect(screen.getByText('42ms')).toBeInTheDocument()
  })

  it('does not display latency when not provided', () => {
    render(<ServiceStatus service="nakom.is" status="up" />)
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })
})
