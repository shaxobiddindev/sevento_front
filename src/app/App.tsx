import { RouterProvider } from 'react-router'

import { AppProviders } from './providers/AppProviders'
import { router } from './router/routes'

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
