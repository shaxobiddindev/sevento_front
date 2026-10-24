/**
 * API turlari — faqat generatsiya qilingan schema.d.ts dan alias lar.
 * Qo'lda dublikat tur yozilmaydi; o'zgarsa `npm run gen:api`.
 */
import type { components, paths } from './schema'

export type { paths }
export type Schemas = components['schemas']

export type Me = Schemas['Me']
export type MeBranch = Schemas['UserBranch']
export type RoleBrief = Schemas['RoleBrief']
export type LoginRequest = Schemas['LoginRequest']
export type LoginResponse = Schemas['LoginResponse']
export type ChangePasswordRequest = Schemas['ChangePasswordRequest']
export type Capability = Schemas['Capability']

export type User = Schemas['User']
export type UserWriteRequest = Schemas['UserWriteRequest']
export type UserPatchRequest = Schemas['PatchedUserWriteRequest']
export type SetPasswordRequest = Schemas['SetPasswordRequest']

export type Role = Schemas['Role']
export type RoleRequest = Schemas['RoleRequest']
export type RolePatchRequest = Schemas['PatchedRoleRequest']

export type Branch = Schemas['Branch']
export type BranchRequest = Schemas['BranchRequest']
export type BranchPatchRequest = Schemas['PatchedBranchRequest']
export type BranchType = Branch['type']

export type AuditLog = Schemas['AuditLog']

export type Currency = Schemas['Currency']
export type CurrencyRequest = Schemas['CurrencyRequest']
export type CurrencyPatchRequest = Schemas['PatchedCurrencyRequest']
export type ExchangeRate = Schemas['ExchangeRate']
export type LatestRate = Schemas['LatestRate']
export type RateCreateRequest = Schemas['RateCreateRequest']
export type FetchResult = Schemas['FetchResult']

export type Category = Schemas['Category']
export type CategoryRequest = Schemas['CategoryRequest']
export type CategoryPatchRequest = Schemas['PatchedCategoryRequest']
export type CategoryTree = Schemas['CategoryTree']
export type Unit = Schemas['Unit']
export type UnitRequest = Schemas['UnitRequest']
export type UnitPatchRequest = Schemas['PatchedUnitRequest']
export type PriceType = Schemas['PriceType']
export type PriceTypeRequest = Schemas['PriceTypeRequest']
export type PriceTypePatchRequest = Schemas['PatchedPriceTypeRequest']
export type Product = Schemas['Product']
export type ProductWriteRequest = Schemas['ProductWriteRequest']
export type ProductPatchRequest = Schemas['PatchedProductWriteRequest']
export type ProductPrice = Schemas['ProductPrice']
export type CurrentPrice = Schemas['CurrentPrice']
export type SetPriceRequest = Schemas['SetPriceRequest']
export type StockLevel = Schemas['StockLevel']
export type Batch = Schemas['Batch']
export type StockMovement = Schemas['StockMovement']
export type MovementType = Schemas['MovementTypeEnum']
export type BranchBrief = Schemas['BranchBrief']
export type TransferList = Schemas['TransferList']
export type TransferDetail = Schemas['TransferDetail']
export type TransferItem = Schemas['TransferItem']
export type TransferStatus = Schemas['TransferStatusEnum']
export type TransferWriteRequest = Schemas['TransferWriteRequest']
export type TransferReceiveRequest = Schemas['TransferReceiveRequest']
export type StockCountList = Schemas['StockCountList']
export type StockCountItem = Schemas['StockCountItem']
export type StockCountStatus = Schemas['StockCountStatusEnum']
export type StockCountCreateRequest = Schemas['StockCountCreateRequest']
export type CountedWriteRequest = Schemas['CountedWriteRequest']
export type WriteOffReason = Schemas['WriteOffReason']
export type WriteOffReasonRequest = Schemas['WriteOffReasonRequest']
export type WriteOffList = Schemas['WriteOffList']
export type WriteOffDetail = Schemas['WriteOffDetail']
export type WriteOffWriteRequest = Schemas['WriteOffWriteRequest']

export type Supplier = Schemas['Supplier']
export type SupplierRequest = Schemas['SupplierRequest']
export type ExpenseType = Schemas['ExpenseType']
export type ExpenseTypeRequest = Schemas['ExpenseTypeRequest']
export type AllocationMethod = Schemas['AllocationMethodEnum']
export type PurchaseList = Schemas['PurchaseList']
export type PurchaseDetail = Schemas['PurchaseDetail']
export type PurchaseStatus = Schemas['PurchaseStatusEnum']
export type PurchaseItem = Schemas['PurchaseItem']
export type PurchaseExpense = Schemas['PurchaseExpense']
export type PurchaseWriteRequest = Schemas['PurchaseWriteRequest']
export type CostPreview = Schemas['CostPreview']
export type SaleList = Schemas['SaleList']
export type SaleDetail = Schemas['SaleDetail']
export type SaleItem = Schemas['SaleItem']
export type SalePayment = Schemas['SalePayment']
export type SaleStatus = Schemas['SaleStatusEnum']
export type SaleWriteRequest = Schemas['SaleWriteRequest']
export type PosProduct = Schemas['PosProduct']
export type PosConfig = Schemas['PosConfig']
export type DailySummary = Schemas['DailySummary']
export type SaleReturnList = Schemas['SaleReturnList']
export type SaleReturnDetail = Schemas['SaleReturnDetail']
export type SaleReturnBrief = Schemas['SaleReturnBrief']
export type SaleReturnWriteRequest = Schemas['SaleReturnWriteRequest']

export type PaymentMethod = Schemas['PaymentMethod']
export type PaymentMethodRequest = Schemas['PaymentMethodRequest']
export type Cashbox = Schemas['Cashbox']
export type CashTransaction = Schemas['CashTransaction']
export type CashFlowCategory = Schemas['CashFlowCategory']
export type Customer = Schemas['Customer']
export type CurrencyAmount = Schemas['CurrencyAmount']
export type CustomerDetail = Schemas['CustomerDetail']
export type CustomerWriteRequest = Schemas['CustomerWriteRequest']
export type CreditStatus = Schemas['CreditStatus']
export type Debt = Schemas['Debt']
export type DebtStatus = Schemas['DebtStatusEnum']
export type LedgerEntry = Schemas['LedgerEntry']
export type LedgerEntryType = Schemas['LedgerEntryTypeEnum']
export type DebtPaymentWriteRequest = Schemas['DebtPaymentWriteRequest']
export type Payoff = Schemas['Payoff']
export type PaymentList = Schemas['PaymentList']
export type PaymentDetail = Schemas['PaymentDetail']
export type CashShift = Schemas['CashShift']
export type CurrentShift = Schemas['CurrentShift']
export type ShiftCloseRequest = Schemas['ShiftCloseRequest']
export type CashEntryWriteRequest = Schemas['CashEntryWriteRequest']
export type SaleDebt = Schemas['SaleDebt']
export type ReportInfo = Schemas['ReportInfo']
export type ReportFilter = Schemas['Filter']
export type ReportColumn = Schemas['Column']
export type ReportResult = Schemas['ReportResult']
export type ReportJob = Schemas['ReportJob']
export type ReportJobStatus = Schemas['ReportJobStatusEnum']
export type ExportRequest = Schemas['ExportRequestRequest']
export type Dashboard = Schemas['Dashboard']
export type DashboardKpi = Schemas['Kpi']
export type SystemSetting = Schemas['SystemSetting']
export type Health = Schemas['Health']

export interface Paginated<T> {
  count: number
  page: number
  page_size: number
  total_pages: number
  results: T[]
}

/** Umumiy ro'yxat parametrlari (core.api.pagination + filter formati). */
export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  [key: string]: string | number | boolean | undefined
}
