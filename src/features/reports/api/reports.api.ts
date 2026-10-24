import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type FileOrJson } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { ReportInfo, ReportJob, ReportResult } from '@/shared/api/types'

export type ReportParams = Record<string, string>

export const reportsApi = {
  list: () => api.get<ReportInfo[]>('/reports/'),
  result: (key: string, params: ReportParams) => api.get<ReportResult>(`/reports/${key}/`, params),
  export: (key: string, format: 'pdf' | 'xlsx', params: ReportParams) =>
    api.postFileOrJson<ReportJob>(`/reports/${key}/export/`, { format, params }),
  jobs: () => api.get<ReportJob[]>('/reports/jobs/'),
  download: (url: string) => api.file(url.replace(/^\/api\/v1/, '')),
}

export function useReports() {
  return useQuery({
    queryKey: queryKeys.reports.list,
    queryFn: reportsApi.list,
    staleTime: 300_000,
  })
}

/** Hisobot natijasi (ekran). WebSocket yo'q — hisobotlar oddiy REST (qayta so'rash tugma bilan). */
export function useReportResult(key: string, params: ReportParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.result(key, params),
    queryFn: () => reportsApi.result(key, params),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })
}

export function useExportReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      key,
      format,
      params,
    }: {
      key: string
      format: 'pdf' | 'xlsx'
      params: ReportParams
    }): Promise<FileOrJson<ReportJob>> => reportsApi.export(key, format, params),
    onSuccess: (result) => {
      if (result.kind === 'json') void qc.invalidateQueries({ queryKey: queryKeys.reports.jobs })
    },
  })
}

export function useReportJobs() {
  return useQuery({
    queryKey: queryKeys.reports.jobs,
    queryFn: reportsApi.jobs,
    // report.ready kelmasa ham (uzilish) navbatdagilar vaqti-vaqti bilan tekshiriladi
    refetchInterval: (query) =>
      query.state.data?.some((j) => j.status === 'pending' || j.status === 'running')
        ? 5_000
        : false,
  })
}
