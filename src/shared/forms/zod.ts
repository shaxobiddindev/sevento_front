import { z } from 'zod'

import i18n from '@/shared/i18n'

/** Zod xabarlarini o'zbekcha qiladi (validation namespace). */
z.config({
  customError: (issue) => {
    const t = (key: string, options?: Record<string, unknown>) =>
      i18n.t(`validation:${key}`, options)
    switch (issue.code) {
      case 'too_small':
        if (issue.origin === 'string') {
          return issue.minimum === 1 ? t('required') : t('minLength', { min: issue.minimum })
        }
        return t('positive')
      case 'too_big':
        return issue.origin === 'string' ? t('maxLength', { max: issue.maximum }) : t('invalid')
      case 'invalid_type':
        return issue.input === undefined || issue.input === '' ? t('required') : t('invalid')
      case 'invalid_format':
        return t('invalid')
      default:
        return t('invalid')
    }
  },
})

export { z }
