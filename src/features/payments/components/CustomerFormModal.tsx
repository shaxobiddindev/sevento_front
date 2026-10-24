import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { CustomerDetail } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { parseDecimalInput, toDecimalInput } from '@/shared/lib/money'
import { Button, FormField, Input, Modal, Textarea, toast } from '@/shared/ui'

import { useSaveCustomer } from '../api/payments.api'

const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === '' || Number.isFinite(Number(parseDecimalInput(v))), { message: 'number' })

const schema = z.object({
  name: z.string().trim().min(2).max(150),
  phone: z.string().trim().max(30),
  tin: z.string().trim().max(20),
  address: z.string().trim().max(255),
  note: z.string(),
  credit_limit_base: optionalNumber,
  default_due_days: optionalNumber,
})
type FormValues = z.infer<typeof schema>

interface Props {
  customer?: CustomerDetail
  open: boolean
  onClose: () => void
  onSaved?: (customer: CustomerDetail) => void
}

/** Mijoz qo'shish/tahrirlash. Kredit limiti va muddat — faqat `customers.credit_limit.manage`. */
export function CustomerFormModal({ customer, open, onClose, onSaved }: Props) {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const canLimit = useCapability('customers.credit_limit.manage')
  const { base } = useActiveCurrencies()
  const save = useSaveCustomer()
  const { register, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: open
      ? {
          name: customer?.name ?? '',
          phone: customer?.phone ?? '',
          tin: customer?.tin ?? '',
          address: customer?.address ?? '',
          note: customer?.note ?? '',
          credit_limit_base: toDecimalInput(customer?.credit_limit_base),
          default_due_days:
            customer?.default_due_days === null || customer?.default_due_days === undefined
              ? ''
              : String(customer.default_due_days),
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) => {
    const body: Record<string, unknown> = {
      name: values.name,
      phone: values.phone,
      tin: values.tin,
      address: values.address,
      note: values.note,
    }
    if (canLimit) {
      body.credit_limit_base = values.credit_limit_base
        ? parseDecimalInput(values.credit_limit_base)
        : null
      body.default_due_days = values.default_due_days ? Number(values.default_due_days) : null
    }
    save.mutate(
      { id: customer?.id, body },
      {
        onSuccess: (saved) => {
          toast.success(t('customers.saved'))
          onSaved?.(saved)
          onClose()
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(schema.shape)),
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? t('customers.edit') : t('customers.new')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="customer-form"
            loading={save.isPending}
            data-testid="customer-save"
          >
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label={t('customers.name')} required error={formState.errors.name?.message}>
          <Input autoFocus {...register('name')} invalid={!!formState.errors.name} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('customers.phone')} error={formState.errors.phone?.message}>
            <Input {...register('phone')} placeholder="+998 90 123 45 67" />
          </FormField>
          <FormField label={t('customers.tin')} error={formState.errors.tin?.message}>
            <Input {...register('tin')} inputMode="numeric" />
          </FormField>
        </div>
        <FormField label={t('customers.address')}>
          <Input {...register('address')} />
        </FormField>
        {canLimit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('customers.creditLimit', { base })}
              hint={t('customers.creditLimitHint')}
              error={formState.errors.credit_limit_base?.message}
            >
              <Input
                {...register('credit_limit_base')}
                inputMode="decimal"
                data-testid="customer-limit"
              />
            </FormField>
            <FormField
              label={t('customers.dueDays')}
              hint={t('customers.dueDaysHint')}
              error={formState.errors.default_due_days?.message}
            >
              <Input {...register('default_due_days')} inputMode="numeric" />
            </FormField>
          </div>
        )}
        <FormField label={t('customers.note')}>
          <Textarea rows={2} {...register('note')} />
        </FormField>
      </form>
    </Modal>
  )
}
