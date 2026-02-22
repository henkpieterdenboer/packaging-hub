// ─── Roles ───────────────────────────────────────────────────────────────────

export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const

export type RoleType = (typeof Role)[keyof typeof Role]

export const RoleLabels: Record<RoleType, string> = {
  ADMIN: 'Administrator',
  USER: 'User',
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

// ─── Article Group ───────────────────────────────────────────────────────────

export const ArticleGroup = {
  PACKAGING: 'PACKAGING',
  LABELS: 'LABELS',
  TAPE: 'TAPE',
  PALLETS: 'PALLETS',
  OTHER: 'OTHER',
} as const

export type ArticleGroupType = (typeof ArticleGroup)[keyof typeof ArticleGroup]

export const ArticleGroupLabels: Record<ArticleGroupType, string> = {
  PACKAGING: 'Packaging',
  LABELS: 'Labels',
  TAPE: 'Tape',
  PALLETS: 'Pallets',
  OTHER: 'Other',
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
} as const

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction]
