import type { CategoryTree } from '@/shared/api/types'

export interface FlatCategory {
  id: number
  name: string
  depth: number
  is_active: boolean
  parent: number | null
  /** "Ichimliklar / Suv / Gazli" */
  path: string
}

/** Daraxtni tanlagich uchun tekis ro'yxatga aylantiradi (chuqurlik bilan). */
export function flattenTree(nodes: CategoryTree[], depth = 0, prefix = ''): FlatCategory[] {
  const result: FlatCategory[] = []
  for (const node of nodes) {
    const path = prefix ? `${prefix} / ${node.name}` : node.name
    result.push({
      id: node.id,
      name: node.name,
      depth,
      is_active: node.is_active,
      parent: node.parent,
      path,
    })
    result.push(...flattenTree(node.children ?? [], depth + 1, path))
  }
  return result
}

/** Tugun va uning barcha avlodlari id lari (o'zini ota sifatida tanlab bo'lmasligi uchun). */
export function subtreeIds(nodes: CategoryTree[], id: number): Set<number> {
  const find = (list: CategoryTree[]): CategoryTree | undefined => {
    for (const node of list) {
      if (node.id === id) return node
      const found = find(node.children ?? [])
      if (found) return found
    }
    return undefined
  }
  const root = find(nodes)
  const ids = new Set<number>()
  const walk = (node: CategoryTree) => {
    ids.add(node.id)
    ;(node.children ?? []).forEach(walk)
  }
  if (root) walk(root)
  return ids
}

/** Select option matni: chuqurlikka qarab chekinish. */
export function indentLabel(item: FlatCategory): string {
  return `${'\u00A0\u00A0\u00A0'.repeat(item.depth)}${item.depth ? '└ ' : ''}${item.name}`
}
