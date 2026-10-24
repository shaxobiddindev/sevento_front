import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, FormField, Input, Modal } from '@/shared/ui'

/** Bekor qilish sababi (majburiy) — audit jurnaliga yoziladi. */
export function ReasonModal({
  open,
  title,
  hint,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  hint?: string
  loading: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation('inventory')
  const [reason, setReason] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('doc.close')}
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            data-testid="reason-confirm"
          >
            {t('doc.cancel')}
          </Button>
        </>
      }
    >
      {hint && <p className="mb-3 text-sm text-slate-600">{hint}</p>}
      <FormField label={t('doc.cancelReason')} required hint={t('doc.cancelHint')}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </FormField>
    </Modal>
  )
}
