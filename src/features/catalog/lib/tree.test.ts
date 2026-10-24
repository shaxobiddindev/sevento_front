import { describe, expect, it } from 'vitest'

import type { CategoryTree } from '@/shared/api/types'

import { flattenTree, indentLabel, subtreeIds } from './tree'

const node = (
  id: number,
  name: string,
  children: CategoryTree[] = [],
  parent: number | null = null,
): CategoryTree => ({
  id,
  name,
  parent,
  sort_order: 0,
  is_active: true,
  children,
})

const tree = [
  node(1, 'Ichimliklar', [node(2, 'Suv', [node(3, 'Gazli', [], 2)], 1)]),
  node(4, 'Non'),
]

describe('category tree helpers', () => {
  it("flattenTree chuqurlik va yo'l bilan", () => {
    expect(flattenTree(tree).map((c) => [c.id, c.depth, c.path])).toEqual([
      [1, 0, 'Ichimliklar'],
      [2, 1, 'Ichimliklar / Suv'],
      [3, 2, 'Ichimliklar / Suv / Gazli'],
      [4, 0, 'Non'],
    ])
  })

  it('subtreeIds tugun va avlodlari', () => {
    expect([...subtreeIds(tree, 1)].sort()).toEqual([1, 2, 3])
    expect([...subtreeIds(tree, 3)]).toEqual([3])
    expect(subtreeIds(tree, 99).size).toBe(0)
  })

  it('indentLabel', () => {
    const flat = flattenTree(tree)
    expect(indentLabel(flat[0])).toBe('Ichimliklar')
    expect(indentLabel(flat[2]).endsWith('└ Gazli')).toBe(true)
  })
})
