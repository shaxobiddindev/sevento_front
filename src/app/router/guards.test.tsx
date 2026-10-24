import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth'
import type { Me } from '@/shared/api/types'

import { RequireAuth, RequireCapability } from './guards'

const me: Me = {
  id: 1,
  username: 'sotuvchi',
  full_name: 'Sotuvchi',
  phone: '',
  is_superuser: false,
  role: { code: 'seller', name: 'Sotuvchi' },
  capabilities: ['sales.create'],
  branches: [{ id: 1, code: 'TSH1', name: 'Toshkent 1', type: 'shop', is_default: true }],
  all_branches: false,
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>login sahifasi</p> },
      { path: '/403', element: <p>403 sahifasi</p> },
      {
        path: '/secret',
        element: (
          <RequireAuth>
            <RequireCapability cap="users.manage">
              <p>maxfiy</p>
            </RequireCapability>
          </RequireAuth>
        ),
      },
      {
        path: '/sales',
        element: (
          <RequireAuth>
            <RequireCapability cap="sales.create">
              <p>savdo</p>
            </RequireCapability>
          </RequireAuth>
        ),
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('route guards', () => {
  it("server bilan aloqa yo'q (oflayn) — login emas, «Internet yo'q» ekrani", () => {
    useAuthStore.setState({ status: 'offline', user: null })
    renderAt('/sales')
    expect(screen.getByTestId('offline-screen')).toBeInTheDocument()
    expect(screen.queryByText('login sahifasi')).not.toBeInTheDocument()
  })

  it("anonim foydalanuvchini login ga yo'naltiradi", () => {
    useAuthStore.setState({ status: 'anonymous', user: null })
    renderAt('/sales')
    expect(screen.getByText('login sahifasi')).toBeInTheDocument()
  })

  it("huquqi bo'lmasa 403", () => {
    useAuthStore.setState({ status: 'authenticated', user: me })
    renderAt('/secret')
    expect(screen.getByText('403 sahifasi')).toBeInTheDocument()
  })

  it("huquqi bo'lsa sahifani ko'rsatadi", () => {
    useAuthStore.setState({ status: 'authenticated', user: me })
    renderAt('/sales')
    expect(screen.getByText('savdo')).toBeInTheDocument()
  })
})
