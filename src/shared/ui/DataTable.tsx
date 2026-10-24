import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyText?: string
  onRowClick?: (row: T) => void
  skeletonRows?: number
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyText,
  onRowClick,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const showSkeleton = loading && !rows?.length

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn('divide-y divide-slate-100', loading && rows?.length && 'opacity-60')}>
          {showSkeleton &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`s-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}
          {!showSkeleton && rows?.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10">
                <EmptyState text={emptyText ?? t('status.empty')} />
              </td>
            </tr>
          )}
          {!showSkeleton &&
            rows?.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer hover:bg-brand-50/60')}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2.5 align-middle', col.className)}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
