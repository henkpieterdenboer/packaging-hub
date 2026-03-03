// ─── Roles ───────────────────────────────────────────────────────────────────

export const Role = {
  ADMIN: 'ADMIN',
  LOGISTICS: 'LOGISTICS',
  FINANCE: 'FINANCE',
} as const

export type RoleType = (typeof Role)[keyof typeof Role]

export const RoleLabels: Record<RoleType, string> = {
  ADMIN: 'Administrator',
  LOGISTICS: 'Logistics',
  FINANCE: 'Finance',
}

// ─── Order Status ────────────────────────────────────────────────────────────

export const OrderStatus = {
  PENDING: 'PENDING',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus]

export const OrderStatusLabels: Record<OrderStatusType, string> = {
  PENDING: 'Pending',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

// ─── Unit ────────────────────────────────────────────────────────────────────

export const Unit = {
  PIECE: 'PIECE',
  BOX: 'BOX',
  PALLET: 'PALLET',
} as const

export type UnitType = (typeof Unit)[keyof typeof Unit]

export const UnitLabels: Record<UnitType, string> = {
  PIECE: 'Piece',
  BOX: 'Box',
  PALLET: 'Pallet',
}

// ─── Email Type ──────────────────────────────────────────────────────────────

export const EmailType = {
  ORDER: 'ORDER',
  ACTIVATION: 'ACTIVATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const

export type EmailTypeType = (typeof EmailType)[keyof typeof EmailType]

export const EmailTypeLabels: Record<EmailTypeType, string> = {
  ORDER: 'Order',
  ACTIVATION: 'Activation',
  PASSWORD_RESET: 'Password Reset',
}

// ─── Language ────────────────────────────────────────────────────────────────

export const Language = {
  EN: 'en',
  NL: 'nl',
  PL: 'pl',
} as const

export type LanguageType = (typeof Language)[keyof typeof Language]

export const LanguageLabels: Record<LanguageType, string> = {
  en: 'English',
  nl: 'Nederlands',
  pl: 'Polski',
}

// ─── Preferred Order Unit ────────────────────────────────────────────────────

export const PreferredOrderUnit = {
  PIECE: 'PIECE',
  BOX: 'BOX',
  PALLET: 'PALLET',
} as const

export type PreferredOrderUnitType = (typeof PreferredOrderUnit)[keyof typeof PreferredOrderUnit]

export const PreferredOrderUnitLabels: Record<PreferredOrderUnitType, string> = {
  PIECE: 'Piece',
  BOX: 'Box',
  PALLET: 'Pallet',
}

// ─── Audit Actions ───────────────────────────────────────────────────────────

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_EMAIL_SENT: 'ORDER_EMAIL_SENT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  ACCOUNT_ACTIVATED: 'ACCOUNT_ACTIVATED',
  GOODS_RECEIVED: 'GOODS_RECEIVED',
  INVOICE_MATCHED: 'INVOICE_MATCHED',
} as const

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction]
