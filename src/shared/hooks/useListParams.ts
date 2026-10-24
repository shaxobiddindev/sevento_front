import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Ro'yxat sahifalari uchun URL dagi parametrlar (page, search, filtrlar) —
 * sahifa yangilansa yoki havola ulashilsa holat saqlanadi.
 */
export function useListParams(defaults: Record<string, string> = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo(() => {
    const result: Record<string, string> = { ...defaults }
    searchParams.forEach((value, key) => {
      result[key] = value
    })
    return result
  }, [searchParams, defaults])

  const page = Math.max(1, Number(params.page) || 1)

  const set = useCallback(
    (changes: Record<string, string | number | null | undefined>, resetPage = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === undefined || value === '') next.delete(key)
          else next.set(key, String(value))
        }
        if (resetPage && !('page' in changes)) next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const setPage = useCallback((next: number) => set({ page: next > 1 ? next : null }, false), [set])

  return { params, page, set, setPage }
}
