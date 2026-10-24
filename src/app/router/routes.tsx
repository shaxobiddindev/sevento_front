/* eslint-disable react-refresh/only-export-components -- lazy sahifa konstantalari */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { LoginPage } from '@/features/auth'
import { DashboardPage } from '@/features/dashboard'
import { PageSpinner } from '@/shared/ui'

import { AppShell } from '../layout/AppShell'
import { TRANSFER_VIEW_CAPS } from '../layout/nav'
import { ErrorPage, ForbiddenPage, NotFoundPage } from '../pages/StatusPages'
import { RedirectIfAuthed, RequireAuth, RequireCapability } from './guards'

// Kam ishlatiladigan sahifalar alohida chunk larda (boshlang'ich yuklash kichik bo'lsin)
const settings = () => import('@/features/settings')
const UsersPage = lazy(() => settings().then((m) => ({ default: m.UsersPage })))
const UserFormPage = lazy(() => settings().then((m) => ({ default: m.UserFormPage })))
const RolesPage = lazy(() => settings().then((m) => ({ default: m.RolesPage })))
const RoleFormPage = lazy(() => settings().then((m) => ({ default: m.RoleFormPage })))
const BranchesPage = lazy(() => settings().then((m) => ({ default: m.BranchesPage })))
const SystemSettingsPage = lazy(() => settings().then((m) => ({ default: m.SystemSettingsPage })))
const AuditPage = lazy(() => import('@/features/audit').then((m) => ({ default: m.AuditPage })))
const catalog = () => import('@/features/catalog')
const ProductsPage = lazy(() => catalog().then((m) => ({ default: m.ProductsPage })))
const ProductFormPage = lazy(() => catalog().then((m) => ({ default: m.ProductFormPage })))
const CategoriesPage = lazy(() => catalog().then((m) => ({ default: m.CategoriesPage })))
const ReferencesPage = lazy(() => catalog().then((m) => ({ default: m.ReferencesPage })))
const currency = () => import('@/features/currency')
const CurrencyRatesPage = lazy(() => currency().then((m) => ({ default: m.CurrencyRatesPage })))
const CurrenciesPage = lazy(() => currency().then((m) => ({ default: m.CurrenciesPage })))
const inventory = () => import('@/features/inventory')
const StockPage = lazy(() => inventory().then((m) => ({ default: m.StockPage })))
const MovementsPage = lazy(() => inventory().then((m) => ({ default: m.MovementsPage })))
const ProductStockPage = lazy(() => inventory().then((m) => ({ default: m.ProductStockPage })))
const TransfersPage = lazy(() => inventory().then((m) => ({ default: m.TransfersPage })))
const TransferPage = lazy(() => inventory().then((m) => ({ default: m.TransferPage })))
const StockCountsPage = lazy(() => inventory().then((m) => ({ default: m.StockCountsPage })))
const StockCountPage = lazy(() => inventory().then((m) => ({ default: m.StockCountPage })))
const WriteOffsPage = lazy(() => inventory().then((m) => ({ default: m.WriteOffsPage })))
const WriteOffPage = lazy(() => inventory().then((m) => ({ default: m.WriteOffPage })))
const WriteOffReasonsPage = lazy(() =>
  inventory().then((m) => ({ default: m.WriteOffReasonsPage })),
)
const sales = () => import('@/features/sales')
const PosPage = lazy(() => sales().then((m) => ({ default: m.PosPage })))
const SalesPage = lazy(() => sales().then((m) => ({ default: m.SalesPage })))
const SaleDetailPage = lazy(() => sales().then((m) => ({ default: m.SaleDetailPage })))
const ReturnsPage = lazy(() => sales().then((m) => ({ default: m.ReturnsPage })))
const ReturnDetailPage = lazy(() => sales().then((m) => ({ default: m.ReturnDetailPage })))
const payments = () => import('@/features/payments')
const CashPage = lazy(() => payments().then((m) => ({ default: m.CashPage })))
const PaymentMethodsPage = lazy(() => payments().then((m) => ({ default: m.PaymentMethodsPage })))
const CustomersPage = lazy(() => payments().then((m) => ({ default: m.CustomersPage })))
const CustomerDetailPage = lazy(() => payments().then((m) => ({ default: m.CustomerDetailPage })))
const DebtsPage = lazy(() => payments().then((m) => ({ default: m.DebtsPage })))
const PaymentsJournalPage = lazy(() => payments().then((m) => ({ default: m.PaymentsJournalPage })))
const reports = () => import('@/features/reports')
const ReportsPage = lazy(() => reports().then((m) => ({ default: m.ReportsPage })))
const ReportPage = lazy(() => reports().then((m) => ({ default: m.ReportPage })))
const purchasing = () => import('@/features/purchasing')
const PurchasesPage = lazy(() => purchasing().then((m) => ({ default: m.PurchasesPage })))
const PurchaseFormPage = lazy(() => purchasing().then((m) => ({ default: m.PurchaseFormPage })))
const SuppliersPage = lazy(() => purchasing().then((m) => ({ default: m.SuppliersPage })))
const ExpenseTypesPage = lazy(() => purchasing().then((m) => ({ default: m.ExpenseTypesPage })))

const lazyPage = (element: ReactNode) => <Suspense fallback={<PageSpinner />}>{element}</Suspense>

const REPORTS_VIEW = ['reports.view', 'reports.financial'] as const
const COUNT_VIEW = ['inventory.counts.manage', 'inventory.view_cost'] as const
const WRITE_OFF_VIEW = ['inventory.writeoffs.manage', 'inventory.view_cost'] as const

const guarded = (cap: string | readonly string[], element: ReactNode) => (
  <RequireCapability cap={cap}>
    <Suspense fallback={<PageSpinner />}>{element}</Suspense>
  </RequireCapability>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: 'catalog',
        children: [
          { index: true, element: <Navigate to="/catalog/products" replace /> },
          { path: 'products', element: guarded('catalog.view', <ProductsPage />) },
          { path: 'products/new', element: guarded('catalog.manage', <ProductFormPage />) },
          { path: 'products/:id', element: guarded('catalog.view', <ProductFormPage />) },
          { path: 'categories', element: guarded('catalog.view', <CategoriesPage />) },
          { path: 'references', element: guarded('catalog.view', <ReferencesPage />) },
        ],
      },
      {
        path: 'sales',
        children: [
          { index: true, element: guarded('sales.view', <SalesPage />) },
          { path: 'pos', element: guarded('sales.create', <PosPage />) },
          { path: 'returns', element: guarded('sales.view', <ReturnsPage />) },
          { path: 'returns/:id', element: guarded('sales.view', <ReturnDetailPage />) },
          { path: ':id', element: guarded('sales.view', <SaleDetailPage />) },
        ],
      },
      { path: 'cash', element: guarded('cashbox.view', <CashPage />) },
      { path: 'customers', element: guarded('customers.view', <CustomersPage />) },
      { path: 'customers/:id', element: guarded('customers.view', <CustomerDetailPage />) },
      { path: 'debts', element: guarded('debts.view', <DebtsPage />) },
      { path: 'payments', element: guarded('payments.view', <PaymentsJournalPage />) },
      {
        path: 'inventory',
        children: [
          { index: true, element: <Navigate to="/inventory/stock" replace /> },
          { path: 'stock', element: guarded('inventory.view', <StockPage />) },
          { path: 'movements', element: guarded('inventory.view', <MovementsPage />) },
          { path: 'products/:id', element: guarded('inventory.view', <ProductStockPage />) },
          { path: 'transfers', element: guarded(TRANSFER_VIEW_CAPS, <TransfersPage />) },
          {
            path: 'transfers/new',
            element: guarded('inventory.transfers.create', <TransferPage />),
          },
          { path: 'transfers/:id', element: guarded(TRANSFER_VIEW_CAPS, <TransferPage />) },
          { path: 'counts', element: guarded(COUNT_VIEW, <StockCountsPage />) },
          { path: 'counts/:id', element: guarded(COUNT_VIEW, <StockCountPage />) },
          { path: 'write-offs', element: guarded(WRITE_OFF_VIEW, <WriteOffsPage />) },
          {
            path: 'write-offs/new',
            element: guarded('inventory.writeoffs.manage', <WriteOffPage />),
          },
          { path: 'write-offs/:id', element: guarded(WRITE_OFF_VIEW, <WriteOffPage />) },
        ],
      },
      {
        path: 'purchasing',
        children: [
          { index: true, element: <Navigate to="/purchasing/purchases" replace /> },
          { path: 'purchases', element: guarded('purchasing.view', <PurchasesPage />) },
          { path: 'purchases/new', element: guarded('purchasing.manage', <PurchaseFormPage />) },
          { path: 'purchases/:id', element: guarded('purchasing.view', <PurchaseFormPage />) },
          { path: 'suppliers', element: guarded('purchasing.view', <SuppliersPage />) },
          { path: 'expense-types', element: guarded('purchasing.manage', <ExpenseTypesPage />) },
        ],
      },
      { path: 'currency', element: lazyPage(<CurrencyRatesPage />) },
      { path: 'reports', element: guarded(REPORTS_VIEW, <ReportsPage />) },
      { path: 'reports/:key', element: guarded(REPORTS_VIEW, <ReportPage />) },
      {
        path: 'settings',
        children: [
          { index: true, element: <Navigate to="/settings/users" replace /> },
          { path: 'users', element: guarded('users.manage', <UsersPage />) },
          { path: 'users/new', element: guarded('users.manage', <UserFormPage />) },
          { path: 'users/:id', element: guarded('users.manage', <UserFormPage />) },
          { path: 'roles', element: guarded('users.manage', <RolesPage />) },
          { path: 'roles/new', element: guarded('users.manage', <RoleFormPage />) },
          { path: 'roles/:id', element: guarded('users.manage', <RoleFormPage />) },
          {
            path: 'branches',
            element: (
              <Suspense fallback={<PageSpinner />}>
                <BranchesPage />
              </Suspense>
            ),
          },
          { path: 'currencies', element: guarded('settings.manage', <CurrenciesPage />) },
          { path: 'system', element: guarded('settings.manage', <SystemSettingsPage />) },
          {
            path: 'payment-methods',
            element: guarded('settings.manage', <PaymentMethodsPage />),
          },
          {
            path: 'write-off-reasons',
            element: guarded('settings.manage', <WriteOffReasonsPage />),
          },
        ],
      },
      { path: 'audit', element: guarded('audit.view', <AuditPage />) },
      { path: '403', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
