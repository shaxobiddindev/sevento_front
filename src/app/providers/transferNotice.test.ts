import { describe, expect, it } from 'vitest'

import type { Me } from '@/shared/api/types'

import { transferNotice } from './transferNotice'

const base: Me = {
  id: 2,
  username: 'omborchi2',
  full_name: 'Omborchi 2',
  phone: '',
  is_superuser: false,
  role: { code: 'storekeeper', name: 'Omborchi' },
  capabilities: [
    'inventory.transfers.create',
    'inventory.transfers.receive',
    'inventory.transfers.cancel',
  ],
  branches: [{ id: 2, code: 'SAM1', name: 'Samarqand 1', type: 'warehouse', is_default: true }],
  all_branches: false,
}
const sender: Me = {
  ...base,
  id: 1,
  branches: [{ id: 1, code: 'TSH1', name: 'Toshkent 1', type: 'shop', is_default: true }],
}
const owner: Me = {
  ...base,
  id: 9,
  capabilities: ['dashboard.view'],
  branches: [],
  all_branches: true,
}

const msg = (type: string, payload: Record<string, unknown>) => ({
  type,
  timestamp: '',
  payload: {
    number: 'KO-TSH1-26-000001',
    from_branch_id: 1,
    from_branch_name: 'Toshkent 1',
    to_branch_id: 2,
    to_branch_name: 'Samarqand 1',
    actor_id: 1,
    ...payload,
  },
})

describe("ko'chirish bildirishnomalari", () => {
  it("jo'natilganda — faqat qabul qiluvchi nuqtaga, o'ziga emas", () => {
    const sent = msg('transfer.sent', { items_count: 2 })
    const notice = transferNotice(sent, base)
    expect(notice?.kind).toBe('info')
    expect(notice?.title).toContain('KO-TSH1-26-000001')
    expect(notice?.description).toContain('Toshkent 1 → Samarqand 1')
    expect(transferNotice(sent, sender)).toBeNull() // o'zi jo'natdi
    expect(transferNotice(sent, { ...sender, id: 5 })).toBeNull() // boshqa nuqta
  })

  it("qabul qilinganda — jo'natuvchiga; farq bo'lsa rahbarga ham ogohlantirish", () => {
    const ok = msg('transfer.received', { actor_id: 2, has_discrepancy: false })
    expect(transferNotice(ok, sender)?.kind).toBe('success')
    expect(transferNotice(ok, owner)).toBeNull()
    const short = msg('transfer.received', {
      actor_id: 2,
      has_discrepancy: true,
      discrepancies: [{ product_name: 'Cola', quantity: '5.000', quantity_received: '4.000' }],
    })
    const forOwner = transferNotice(short, owner)
    expect(forOwner?.kind).toBe('warning')
    expect(forOwner?.description).toContain('Cola 4/5')
    expect(transferNotice(short, sender)?.kind).toBe('warning')
  })

  it("jo'natilgani bekor qilinsa qabul qiluvchiga; qoralama bekor qilinsa jim", () => {
    const sent = msg('transfer.cancelled', { previous_status: 'sent', reason: "Mashina yo'q" })
    expect(transferNotice(sent, base)?.description).toContain("Mashina yo'q")
    expect(transferNotice(msg('transfer.cancelled', { previous_status: 'draft' }), base)).toBeNull()
  })
})
