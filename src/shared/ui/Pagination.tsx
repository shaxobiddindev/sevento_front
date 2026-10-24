import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from './Button'

export interface PaginationProps {
  page: number
  totalPages: number
  count: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, count, onChange }: PaginationProps) {
  const { t } = useTranslation()
  if (!count) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>{t('table.total', { count })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={<ChevronLeft className="size-4" />}
          aria-label={t('table.prev')}
        />
        <span>
          {t('table.page')} {page} {t('table.of')} {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          icon={<ChevronRight className="size-4" />}
          aria-label={t('table.next')}
        />
      </div>
    </div>
  )
}
