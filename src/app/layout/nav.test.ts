import { describe, expect, it } from 'vitest'

import { activeNavPath, filterNav, navItems } from './nav'

const paths = (caps: string[]) =>
  filterNav(navItems, caps).flatMap((i) => (i.children ? i.children.map((c) => c.to) : [i.to]))

describe('filterNav', () => {
  it("omborchi kirim, qoldiq va harakatlarni ko'radi, sozlamalarni ko'rmaydi", () => {
    const visible = paths([
      'inventory.view',
      'purchasing.view',
      'purchasing.manage',
      'catalog.view',
    ])
    expect(visible).toEqual(
      expect.arrayContaining([
        '/inventory/stock',
        '/inventory/movements',
        '/purchasing/purchases',
        '/purchasing/suppliers',
        '/purchasing/expense-types',
      ]),
    )
    expect(visible).not.toContain('/settings/users')
  })

  it("kirim huquqisiz foydalanuvchida xarajat turlari yo'q", () => {
    const visible = paths(['inventory.view', 'purchasing.view'])
    expect(visible).toContain('/purchasing/purchases')
    expect(visible).not.toContain('/purchasing/expense-types')
  })

  it("huquqi yo'q guruh butunlay yashiriladi", () => {
    const groups = filterNav(navItems, []).map((i) => i.labelKey)
    expect(groups).not.toContain('inventory')
  })
})

describe('activeNavPath', () => {
  it("eng uzun mos yo'l faol: /sales/pos — Kassa, /sales/12 — Savdolar", () => {
    expect(activeNavPath('/sales/pos', navItems)).toBe('/sales/pos')
    expect(activeNavPath('/sales/12', navItems)).toBe('/sales')
    expect(activeNavPath('/catalog/products/5', navItems)).toBe('/catalog/products')
    expect(activeNavPath('/salesman', navItems)).toBeNull()
  })
})

describe("to'lovlar menyusi", () => {
  it("buxgalter mijozlar, qarzlar, to'lovlar va kassani ko'radi; omborchi ko'rmaydi", () => {
    const accountant = paths(['customers.view', 'debts.view', 'payments.view', 'cashbox.view'])
    expect(accountant).toEqual(
      expect.arrayContaining(['/customers', '/debts', '/payments', '/cash']),
    )
    expect(paths(['inventory.view', 'purchasing.view'])).not.toContain('/customers')
  })
})

describe('ombor hujjatlari va qaytarish menyusi', () => {
  it("ro'yxatdagi huquqlardan birortasi yetarli (ko'chirish: yaratish, qabul yoki tannarx)", () => {
    expect(paths(['inventory.transfers.receive'])).toContain('/inventory/transfers')
    expect(paths(['inventory.view_cost'])).toEqual(
      expect.arrayContaining([
        '/inventory/transfers',
        '/inventory/counts',
        '/inventory/write-offs',
      ]),
    )
    // sotuvchi: qoldiq bor, ko'chirish/inventarizatsiya yo'q; qaytarishlar — savdo bo'limida
    const seller = paths(['inventory.view', 'sales.view', 'sales.create'])
    expect(seller).not.toContain('/inventory/transfers')
    expect(seller).not.toContain('/inventory/counts')
    expect(seller).toContain('/sales/returns')
  })

  it('/sales/returns/5 da faqat "Qaytarishlar" faol', () => {
    expect(activeNavPath('/sales/returns/5', navItems)).toBe('/sales/returns')
    expect(activeNavPath('/inventory/transfers/new', navItems)).toBe('/inventory/transfers')
  })
})
