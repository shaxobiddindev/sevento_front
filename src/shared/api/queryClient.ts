import { QueryClient } from '@tanstack/react-query'

import { isApiError } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx xatolarni qayta so'rashdan foyda yo'q
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
    // Oflayn bo'lsa mutatsiya kutib turmaydi (navbat yo'q): darhol "Internet yo'q" xatosi.
    // Aks holda savdo aloqa tiklanganda "o'zi" yuborilib, kassir buni bilmay qolardi.
    mutations: { retry: false, networkMode: 'always' },
  },
})
