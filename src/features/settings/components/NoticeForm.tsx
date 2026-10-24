import { zodResolver } from '@hookform/resolvers/zod'
import { Megaphone } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { Button, Card, FormField, Input, Select, toast } from '@/shared/ui'

import { useSendNotice } from '../api/notice.api'

const schema = z.object({
  level: z.enum(['info', 'warning', 'error']),
  message: z.string().trim().min(1).max(500),
})
type FormValues = z.infer<typeof schema>

/** Rahbar uchun: barcha ulangan foydalanuvchilarga WebSocket orqali xabar (system.notice). */
export function NoticeForm() {
  const { t } = useTranslation('realtime')
  const send = useSendNotice()
  const { register, handleSubmit, reset, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { level: 'info', message: '' },
  })

  const onSubmit = (values: FormValues) =>
    send.mutate(values, {
      onSuccess: () => {
        toast.success(t('noticeForm.sent'))
        reset({ level: values.level, message: '' })
      },
      onError: (error) => applyServerErrors(error, setError, ['level', 'message']),
    })

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="size-5 text-brand-700" />
        <div>
          <h2 className="text-sm font-semibold">{t('noticeForm.title')}</h2>
          <p className="text-xs text-slate-500">{t('noticeForm.hint')}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2" noValidate>
        <FormField label={t('noticeForm.level')} className="w-40">
          <Select {...register('level')}>
            <option value="info">{t('noticeForm.levels.info')}</option>
            <option value="warning">{t('noticeForm.levels.warning')}</option>
            <option value="error">{t('noticeForm.levels.error')}</option>
          </Select>
        </FormField>
        <FormField
          label={t('noticeForm.message')}
          className="min-w-64 flex-1"
          error={formState.errors.message?.message}
        >
          <Input {...register('message')} invalid={!!formState.errors.message} />
        </FormField>
        <Button type="submit" loading={send.isPending} className="h-10">
          {t('noticeForm.send')}
        </Button>
      </form>
    </Card>
  )
}
