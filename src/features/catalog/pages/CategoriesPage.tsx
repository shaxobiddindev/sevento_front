import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, FolderPlus, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import type { CategoryTree } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { cn } from '@/shared/lib/cn'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageSpinner,
  Select,
  Switch,
  toast,
} from '@/shared/ui'

import { useCategoryTree, useSaveCategory } from '../api/catalog.api'
import { flattenTree, indentLabel, subtreeIds } from '../lib/tree'

type Editing = { node?: CategoryTree; parent?: number | null } | null

export function CategoriesPage() {
  const { t } = useTranslation('catalog')
  const canManage = useCapability('catalog.manage')
  const tree = useCategoryTree()
  const [editing, setEditing] = useState<Editing>(null)

  if (tree.isPending) return <PageSpinner />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('categories.title')}
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ parent: null })}>
              {t('categories.new')}
            </Button>
          )
        }
      />
      <Card className="p-2">
        {tree.data?.length ? (
          <ul>
            {tree.data.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                canManage={canManage}
                onEdit={setEditing}
              />
            ))}
          </ul>
        ) : (
          <div className="py-8">
            <EmptyState text={t('categories.empty')} />
          </div>
        )}
      </Card>
      <CategoryModal editing={editing} tree={tree.data ?? []} onClose={() => setEditing(null)} />
    </div>
  )
}

function TreeNode({
  node,
  depth,
  canManage,
  onEdit,
}: {
  node: CategoryTree
  depth: number
  canManage: boolean
  onEdit: (e: Editing) => void
}) {
  const { t } = useTranslation('catalog')
  const { t: tc } = useTranslation()
  const [open, setOpen] = useState(true)
  const hasChildren = (node.children ?? []).length > 0
  return (
    <li>
      <div
        className="group flex items-center gap-1 rounded-md py-1.5 pr-2 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn('rounded p-0.5 text-slate-400', !hasChildren && 'invisible')}
          aria-label={node.name}
        >
          <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        </button>
        <span className={cn('flex-1 text-sm', !node.is_active && 'text-slate-400 line-through')}>
          {node.name}
        </span>
        {!node.is_active && <Badge>{tc('status.inactive')}</Badge>}
        {canManage && (
          <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              icon={<FolderPlus className="size-4" />}
              onClick={() => onEdit({ parent: node.id })}
              title={t('categories.addChild')}
              aria-label={t('categories.addChild')}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil className="size-4" />}
              onClick={() => onEdit({ node })}
              aria-label={tc('actions.edit')}
            />
          </span>
        )}
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  parent: z.string(),
  sort_order: z.coerce.number<string>().int().min(0),
  is_active: z.boolean(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function CategoryModal({
  editing,
  tree,
  onClose,
}: {
  editing: Editing
  tree: CategoryTree[]
  onClose: () => void
}) {
  const { t } = useTranslation('catalog')
  const { t: tc } = useTranslation()
  const save = useSaveCategory()
  const node = editing?.node
  const flat = useMemo(() => flattenTree(tree), [tree])
  // o'zini va avlodlarini ota sifatida tanlab bo'lmaydi
  const blocked = useMemo(
    () => (node ? subtreeIds(tree, node.id) : new Set<number>()),
    [tree, node],
  )

  const { register, handleSubmit, control, setError, formState } = useForm<
    FormInput,
    unknown,
    FormValues
  >({
    resolver: zodResolver(schema),
    values: editing
      ? {
          name: node?.name ?? '',
          parent: String(node ? (node.parent ?? '') : (editing.parent ?? '')),
          sort_order: String(node?.sort_order ?? 0),
          is_active: node?.is_active ?? true,
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: node?.id, body: { ...values, parent: values.parent ? Number(values.parent) : null } },
      {
        onSuccess: () => {
          toast.success(node ? t('categories.updated') : t('categories.created'))
          onClose()
        },
        onError: (error) =>
          applyServerErrors(error, setError, ['name', 'parent', 'sort_order', 'is_active']),
      },
    )

  return (
    <Modal
      open={editing !== null}
      onClose={onClose}
      title={node ? t('categories.edit') : t('categories.new')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label={t('categories.name')} required error={formState.errors.name?.message}>
          <Input autoFocus {...register('name')} invalid={!!formState.errors.name} />
        </FormField>
        <FormField label={t('categories.parent')} error={formState.errors.parent?.message}>
          <Select {...register('parent')}>
            <option value="">{t('categories.root')}</option>
            {flat
              .filter((c) => !blocked.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {indentLabel(c)}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label={t('categories.sortOrder')} error={formState.errors.sort_order?.message}>
          <Input type="number" min={0} {...register('sort_order')} />
        </FormField>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch
                checked={field.value}
                onChange={field.onChange}
                label={tc('fields.isActive')}
              />
              <span className="text-sm">{tc('fields.isActive')}</span>
            </div>
          )}
        />
      </form>
    </Modal>
  )
}
