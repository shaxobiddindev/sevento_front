import { ArrowLeft, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'

import { useAuthStore } from '@/features/auth'
import { useListParams } from '@/shared/hooks/useListParams'
import { saveFile } from '@/shared/lib/download'
import { Button, Card, PageHeader, PageSpinner, Spinner, toast } from '@/shared/ui'

import { useExportReport, useReportResult, useReports } from '../api/reports.api'
import { ReportFilters } from '../components/ReportFilters'
import { ReportJobs } from '../components/ReportJobs'
import { ReportTable } from '../components/ReportTable'
import { resolveParams } from '../lib/params'

/** Bitta hisobot: filtrlar (URL da), jadval, PDF/Excel (og'ir bo'lsa — fonda, report.ready). */
export function ReportPage() {
  const { key = '' } = useParams()
  const { t } = useTranslation('reports')
  const navigate = useNavigate()
  const reports = useReports()
  const currentBranchId = useAuthStore((s) => s.currentBranchId)
  const { params: url, set } = useListParams()
  const info = reports.data?.find((r) => r.key === key)
  const params = useMemo(
    () => (info ? resolveParams(info.filters, url, currentBranchId) : {}),
    [info, url, currentBranchId],
  )
  const result = useReportResult(key, params, !!info)
  const exporter = useExportReport()

  if (reports.isPending) return <PageSpinner />
  if (!info) return <Navigate to="/reports" replace />

  const onExport = (format: 'pdf' | 'xlsx') =>
    exporter.mutate(
      { key, format, params },
      {
        onSuccess: (res) => {
          if (res.kind === 'file') {
            const { blob, filename } = res.file
            void saveFile(blob, filename).then((saved) => {
              if (saved) toast.success(t('downloaded'), filename)
            })
          } else {
            toast.info(t('queued'), t('queuedText'))
          }
        },
        onError: (error) => toast.error(error.message),
      },
    )

  const heavy = result.data?.heavy ?? info.heavy
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title={info.title}
        subtitle={result.data?.subtitle ?? info.description}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileText className="size-4" />}
              loading={exporter.isPending && exporter.variables?.format === 'pdf'}
              onClick={() => onExport('pdf')}
              data-testid="export-pdf"
            >
              {t('pdf')}
            </Button>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              loading={exporter.isPending && exporter.variables?.format === 'xlsx'}
              onClick={() => onExport('xlsx')}
              data-testid="export-xlsx"
            >
              {t('excel')}
            </Button>
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/reports')}
            >
              {t('back')}
            </Button>
          </>
        }
      />
      <Card>
        <ReportFilters
          filters={info.filters}
          values={params}
          onChange={(changes) => set(changes)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="size-4" />}
            onClick={() => void result.refetch()}
          >
            {t('refresh')}
          </Button>
          {result.isFetching && <Spinner className="size-4" />}
          {heavy && <span className="text-xs text-amber-700">{t('heavyHint')}</span>}
        </div>
      </Card>
      {result.isError ? (
        <Card className="text-sm text-red-700">{result.error.message}</Card>
      ) : result.data ? (
        <ReportTable result={result.data} />
      ) : (
        <PageSpinner />
      )}
      <ReportJobs />
    </div>
  )
}
