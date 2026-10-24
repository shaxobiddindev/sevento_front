/**
 * Barcha TanStack Query kalitlari bir joyda. Realtime invalidate xaritasi (2-bosqich)
 * shu kalitlarga tayanadi.
 */
export const queryKeys = {
  me: ['me'] as const,
  capabilities: ['capabilities'] as const,
  users: {
    all: ['users'] as const,
    list: (params: object) => ['users', 'list', params] as const,
    detail: (id: number | string) => ['users', 'detail', String(id)] as const,
  },
  roles: {
    all: ['roles'] as const,
    list: (params: object = {}) => ['roles', 'list', params] as const,
    detail: (id: number | string) => ['roles', 'detail', String(id)] as const,
  },
  branches: {
    all: ['branches'] as const,
    list: (params: object = {}) => ['branches', 'list', params] as const,
    detail: (id: number | string) => ['branches', 'detail', String(id)] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (params: object) => ['audit', 'list', params] as const,
  },
  currency: {
    all: ['currency'] as const,
    currencies: ['currency', 'currencies'] as const,
    latest: ['currency', 'latest'] as const,
    rates: (params: object) => ['currency', 'rates', params] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    categories: ['catalog', 'categories'] as const,
    categoryTree: ['catalog', 'categories', 'tree'] as const,
    units: ['catalog', 'units'] as const,
    priceTypes: ['catalog', 'price-types'] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    stock: (params: object) => ['inventory', 'stock', params] as const,
    batches: (params: object) => ['inventory', 'batches', params] as const,
    movements: (params: object) => ['inventory', 'movements', params] as const,
    // hujjatlar ham ['inventory'] ostida: stock.changed ularni ham yangilaydi
    transfers: (params: object) => ['inventory', 'transfers', params] as const,
    transfer: (id: number | string) => ['inventory', 'transfer', String(id)] as const,
    incomingTransfers: ['inventory', 'transfers-incoming'] as const,
    counts: (params: object) => ['inventory', 'counts', params] as const,
    count: (id: number | string) => ['inventory', 'count', String(id)] as const,
    countItems: (id: number | string, params: object) =>
      ['inventory', 'count', String(id), 'items', params] as const,
    writeOffs: (params: object) => ['inventory', 'write-offs', params] as const,
    writeOff: (id: number | string) => ['inventory', 'write-off', String(id)] as const,
    writeOffReasons: ['inventory', 'write-off-reasons'] as const,
  },
  purchasing: {
    all: ['purchasing'] as const,
    suppliers: (params: object) => ['purchasing', 'suppliers', params] as const,
    expenseTypes: ['purchasing', 'expense-types'] as const,
    purchases: (params: object) => ['purchasing', 'purchases', params] as const,
    purchase: (id: number | string) => ['purchasing', 'purchase', String(id)] as const,
    preview: (id: number | string) => ['purchasing', 'purchase', String(id), 'preview'] as const,
  },
  sales: {
    all: ['sales'] as const,
    list: (params: object) => ['sales', 'list', params] as const,
    detail: (id: number | string) => ['sales', 'detail', String(id)] as const,
    lists: ['sales', 'list'] as const,
    pos: (params: object) => ['sales', 'pos', params] as const,
    posAll: ['sales', 'pos'] as const,
    summary: (params: object) => ['sales', 'summary', params] as const,
    summaryAll: ['sales', 'summary'] as const,
    returns: (params: object) => ['sales', 'returns', params] as const,
    returnDetail: (id: number | string) => ['sales', 'return', String(id)] as const,
  },
  payments: {
    all: ['payments'] as const,
    methods: ['payments', 'methods'] as const,
    categories: ['payments', 'categories'] as const,
    cashboxes: (params: object) => ['payments', 'cashboxes', params] as const,
    transactions: (params: object) => ['payments', 'transactions', params] as const,
    customers: (params: object) => ['payments', 'customers', params] as const,
    customer: (id: number | string) => ['payments', 'customer', String(id)] as const,
    ledger: (id: number | string, params: object) =>
      ['payments', 'customer', String(id), 'ledger', params] as const,
    payoff: (id: number | string, currency: string) =>
      ['payments', 'customer', String(id), 'payoff', currency] as const,
    debts: (params: object) => ['payments', 'debts', params] as const,
    payments: (params: object) => ['payments', 'payments', params] as const,
    payment: (id: number | string) => ['payments', 'payment', String(id)] as const,
    shifts: (params: object) => ['payments', 'shifts', params] as const,
    currentShift: (branch: number | null) => ['payments', 'shift-current', branch] as const,
  },
  reports: {
    all: ['reports'] as const,
    list: ['reports', 'list'] as const,
    result: (key: string, params: object) => ['reports', 'result', key, params] as const,
    jobs: ['reports', 'jobs'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    data: (params: object) => ['dashboard', params] as const,
  },
  products: {
    all: ['products'] as const,
    list: (params: object) => ['products', 'list', params] as const,
    detail: (id: number | string, branch?: number | null) =>
      ['products', 'detail', String(id), branch ?? null] as const,
    prices: (id: number | string) => ['products', 'prices', String(id)] as const,
  },
}
