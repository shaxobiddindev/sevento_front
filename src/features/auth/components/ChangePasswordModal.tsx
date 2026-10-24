import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { Button, FormField, Input, Modal, toast } from '@/shared/ui'

import { useChangePassword } from '../api/hooks'

const schema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
    confirm: z.string().min(1),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'mismatch' })
type FormValues = z.infer<typeof schema>

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('auth')
  const mutation = useChangePassword()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: FormValues) =>
    mutation.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      {
        onSuccess: () => {
          toast.success(t('changePassword.success'))
          close()
        },
        onError: (error) =>
          applyServerErrors(error, setError, ['current_password', 'new_password']),
      },
    )

  const confirmError =
    errors.confirm?.message === 'mismatch' ? t('changePassword.mismatch') : errors.confirm?.message

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('changePassword.title')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="change-password-form" loading={mutation.isPending}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="change-password-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField label={t('changePassword.current')} error={errors.current_password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...register('current_password')}
          />
        </FormField>
        <FormField label={t('changePassword.new')} error={errors.new_password?.message}>
          <Input type="password" autoComplete="new-password" {...register('new_password')} />
        </FormField>
        <FormField label={t('changePassword.confirm')} error={confirmError}>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </FormField>
      </form>
    </Modal>
  )
}
