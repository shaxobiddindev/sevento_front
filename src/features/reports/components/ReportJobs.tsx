import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ReportJob } from '@/shared/api/types'
import { formatDateTime } from '@/shared/lib/date'
import { saveFile } from '@/shared/lib/download'
import { Badge, Button, Card, toast } from '@/shared/ui'

import { reportsApi, useReportJobs } from '../api/reports.api'

const tones = { pending: 'neutral', running: 'info', ready: 'success', failed: 'danger' } as const

/** Fonda tayyorlangan hisobot fayllari (report.ready kelganda yangilanadi). */
export function ReportJobs() {
  const { t } = useTranslation('reports')
  const jobs = useReportJobs()
  const [busy, setBusy] = useState<number | null>(null)

  const download = async (job: ReportJob) => {
    if (!job.download_url) return
    setBusy(job.id)
    try {
      const result = await reportsApi.download(job.download_url)
      if (result.kind === 'file') await saveFile(result.file.blob, result.file.filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card data-testid="report-jobs">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('jobs.title')}</h2>
      {!jobs.data?.length ? (
        <p className="text-sm text-slate-500">{t('jobs.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {jobs.data.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {job.title} <span className="text-xs text-slate-500 uppercase">{job.format}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(job.created_at)}
                  {job.status === 'failed' && job.error && ` — ${job.error}`}
                </p>
              </div>
              <Badge tone={tones[job.status]}>
                {(job.status === 'pending' || job.status === 'running') && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                {t(`jobs.status.${job.status}`)}
              </Badge>
              {job.download_url && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download className="size-4" />}
                  loading={busy === job.id}
                  onClick={() => void download(job)}
                  data-testid="job-download"
                >
                  {t('jobs.download')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
