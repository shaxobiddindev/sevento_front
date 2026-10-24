import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

import { isApiError } from '@/shared/api/errors'
import { z } from '@/shared/forms/zod'
import { Button, FormField, Input } from '@/shared/ui'

import { useAuthStore } from '../store/authStore'

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await login(values.username, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    } catch (error) {
      setServerError(
        isApiError(error) && error.code === 'authentication_failed'
          ? t('login.failed')
          : isApiError(error)
            ? error.message
            : String(error),
      )
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-700 text-xl font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            label={t('login.username')}
            htmlFor="username"
            error={errors.username?.message}
          >
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              invalid={!!errors.username}
              {...register('username')}
            />
          </FormField>
          <FormField
            label={t('login.password')}
            htmlFor="password"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>
          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('login.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
