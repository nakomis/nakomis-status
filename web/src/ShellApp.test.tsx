import { render, screen, waitFor } from '@testing-library/react'
import ShellApp, { STATUS_API } from './ShellApp'

test('inside the shell, status is read from status.nakom.is', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ name: 'nakom.is', status: 'up' }])))
  vi.stubGlobal('fetch', fetchMock)
  const { container } = render(<ShellApp />)
  expect(container.firstChild).toHaveClass('status-remote')
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${STATUS_API}/api/status`))
  expect(await screen.findByText('All systems operational')).toBeInTheDocument()
  vi.unstubAllGlobals()
})
