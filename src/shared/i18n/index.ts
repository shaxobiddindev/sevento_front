import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import audit from './locales/uz/audit.json'
import auth from './locales/uz/auth.json'
import catalog from './locales/uz/catalog.json'
import common from './locales/uz/common.json'
import currency from './locales/uz/currency.json'
import errors from './locales/uz/errors.json'
import inventory from './locales/uz/inventory.json'
import nav from './locales/uz/nav.json'
import payments from './locales/uz/payments.json'
import purchasing from './locales/uz/purchasing.json'
import realtime from './locales/uz/realtime.json'
import reports from './locales/uz/reports.json'
import sales from './locales/uz/sales.json'
import settings from './locales/uz/settings.json'
import validation from './locales/uz/validation.json'

// Hozir faqat o'zbek (lotin). Yangi til: locales/<kod>/ papkasi + shu yerda resources ga qo'shish.
export const resources = {
  uz: {
    common,
    nav,
    auth,
    settings,
    audit,
    errors,
    validation,
    realtime,
    catalog,
    currency,
    inventory,
    purchasing,
    sales,
    payments,
    reports,
  },
} as const

export const defaultNS = 'common'

void i18n.use(initReactI18next).init({
  resources,
  lng: 'uz',
  fallbackLng: 'uz',
  defaultNS,
  ns: Object.keys(resources.uz),
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
