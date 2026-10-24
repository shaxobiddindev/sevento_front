import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SystemSetting } from '@/shared/api/types'
import { formatDateTime } from '@/shared/lib/date'
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  PageSpinner,
  Select,
  Switch,
  toast,
} from '@/shared/ui'

import { useResetSystemSetting, useSystemSettings, useUpdateSystemSetting } from '../api/system.api'
import { NoticeForm } from '../components/NoticeForm'

export function SystemSettingsPage() {
  const { t } = useTranslation('settings')
  const settings = useSystemSettings()

  if (settings.isPending) return <PageSpinner />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('system.title')} />
      <div className="mb-4">
        <NoticeForm />
      </div>
      <div className="space-y-3">
        {settings.data?.map((item) => (
          <SettingRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  )
}

function SettingRow({ item }: { item: SystemSetting }) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const update = useUpdateSystemSetting()
  const reset = useResetSystemSetting()
  const [draft, setDraft] = useState<string>(String(item.value ?? ''))
  const [error, setError] = useState<string | null>(null)

  const save = (value: unknown) => {
    setError(null)
    update.mutate(
      { key: item.key, value },
      {
        onSuccess: () => toast.success(t('system.saved')),
        onError: (err) => setError(err.message),
      },
    )
  }

  const onReset = () =>
    reset.mutate(item.key, {
      onSuccess: (updated) => {
        setDraft(String(updated.value ?? ''))
        toast.success(t('system.reset'))
      },
      onError: (err) => toast.error(err.message),
    })

  const dirty = draft !== String(item.value ?? '')

  let control: React.ReactNode
  switch (item.type) {
    case 'bool':
      control = (
        <Switch
          checked={Boolean(item.value)}
          onChange={(v) => save(v)}
          disabled={update.isPending}
        />
      )
      break
    case 'choice':
      control = (
        <Select
          value={String(item.value)}
          onChange={(e) => save(e.target.value)}
          disabled={update.isPending}
          className="w-48"
        >
          {item.choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      )
      break
    default:
      control = (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (item.type === 'int') {
              const n = Number(draft)
              if (!Number.isInteger(n)) return setError(tc('validation:integer'))
              return save(n)
            }
            save(draft)
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-48"
            inputMode={item.type === 'str' ? 'text' : 'decimal'}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!dirty}
            loading={update.isPending}
            className="h-10"
          >
            {tc('actions.save')}
          </Button>
        </form>
      )
  }

  return (
    <Card className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-sm font-semibold">{item.key}</code>
          {item.is_overridden && <Badge tone="warning">{t('system.overridden')}</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-600">{item.description}</p>
        <p className="mt-1 text-xs text-slate-400">
          {t('system.default', { value: String(item.default) })}
          {item.updated_by &&
            item.updated_at &&
            ` · ${t('system.updatedBy', { user: item.updated_by, date: formatDateTime(item.updated_at) })}`}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {control}
        {item.is_overridden && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="size-4" />}
            onClick={onReset}
            loading={reset.isPending}
            title={t('system.resetToDefault')}
          />
        )}
      </div>
    </Card>
  )
}
