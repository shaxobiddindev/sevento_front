import { ChevronRight, FileBarChart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { ReportInfo } from '@/shared/api/types'
import { Card, PageHeader, PageSpinner } from '@/shared/ui'

import { useReports } from '../api/reports.api'
import { ReportJobs } from '../components/ReportJobs'

/** Hisobotlar reyestri: bo'limlar bo'yicha (foydalanuvchi huquqiga qarab backend beradi). */
export function ReportsPage() {
  const { t } = useTranslation('reports')
  const reports = useReports()
  if (reports.isPending) return <PageSpinner />
  const groups = new Map<string, ReportInfo[]>()
  for (const r of reports.data ?? []) {
    groups.set(r.category_label, [...(groups.get(r.category_label) ?? []), r])
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {groups.size === 0 && <p className="text-sm text-slate-500">{t('empty')}</p>}
      {[...groups.entries()].map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => (
              <Link key={r.key} to={`/reports/${r.key}`} data-testid={`report-${r.key}`}>
                <Card className="flex h-full items-start gap-3 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                  <FileBarChart className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <ReportJobs />
    </div>
  )
}
