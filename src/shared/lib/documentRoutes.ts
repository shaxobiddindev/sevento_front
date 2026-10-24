/** Hujjat turi (backend document_type / source_type) → sahifa manzili. Bitta joyda. */
const ROUTES: Partial<Record<string, (id: number) => string>> = {
  purchase: (id) => `/purchasing/purchases/${id}`,
  sale: (id) => `/sales/${id}`,
  sale_return: (id) => `/sales/returns/${id}`,
  transfer: (id) => `/inventory/transfers/${id}`,
  stock_count: (id) => `/inventory/counts/${id}`,
  write_off: (id) => `/inventory/write-offs/${id}`,
  customer: (id) => `/customers/${id}`,
}

export function documentRoute(type: string, id: number | null | undefined): string | null {
  const route = ROUTES[type]
  return route && id ? route(id) : null
}
