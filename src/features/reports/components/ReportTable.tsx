import { useTranslation } from 'react-i18next'

import type { ReportResult } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'

import { formatCell, isNumeric } from '../lib/format'

/** Hisobot jadvali: ustunlar backend dan (tur, xona), jami qatori, qisqartirilgan bo'lsa izoh. */
export function ReportTable({ result }: { result: ReportResult }) {
  const { t } = useTranslation('reports')
  const { columns, rows, totals } = result
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">{t('noData')}</p>
  }
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm" data-testid="report-table">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-3 py-2 whitespace-nowrap',
                    isNumeric(c) ? 'text-right' : 'text-left',
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 py-1.5',
                      isNumeric(c) ? 'text-right whitespace-nowrap tabular-nums' : '',
                      isNumeric(c) && String(row[c.key] ?? '').startsWith('-') && 'text-red-700',
                    )}
                  >
                    {formatCell(c, row[c.key], row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr
                className="border-t-2 border-slate-300 bg-slate-50 font-semibold"
                data-testid="report-totals"
              >
                {columns.map((c, index) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 py-2',
                      isNumeric(c) && 'text-right whitespace-nowrap tabular-nums',
                    )}
                  >
                    {c.key in totals ? formatCell(c, totals[c.key]) : index === 0 ? t('total') : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {result.truncated
          ? t('truncated', { shown: rows.length, total: result.row_count })
          : t('rows', { count: result.row_count })}
      </p>
      {result.notes.map((note) => (
        <p key={note} className="mt-1 text-xs text-slate-500">
          {note}
        </p>
      ))}
    </div>
  )
}
