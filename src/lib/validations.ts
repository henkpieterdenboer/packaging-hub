import { z } from 'zod'
import { Role, Unit, Language, PreferredOrderUnit } from '@/types'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── Shared enum values ─────────────────────────────────────────────────────

const languageValues = Object.values(Language) as [string, ...string[]]

// ─── Users ───────────────────────────────────────────────────────────────────

const roleValues = Object.values(Role) as [string, ...string[]]

export const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  roles: z
    .array(z.enum(roleValues))
    .min(1, 'At least one role is required'),
  preferredLanguage: z.enum(languageValues).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  middleName: z.string().nullable().optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  roles: z
    .array(z.enum(roleValues))
    .min(1, 'At least one role is required')
    .optional(),
  isActive: z.boolean().optional(),
  preferredLanguage: z.enum(languageValues).optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// ─── Suppliers ───────────────────────────────────────────────────────────────

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  email: z.string().email('Please enter a valid email address'),
  ccEmails: z
    .array(z.string().email('Each CC email must be a valid email address'))
    .optional(),
  language: z.enum(languageValues).optional(),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').optional(),
  email: z.string().email('Please enter a valid email address').optional(),
  ccEmails: z
    .array(z.string().email('Each CC email must be a valid email address'))
    .optional(),
  language: z.enum(languageValues).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>

// ─── Product Types ──────────────────────────────────────────────────────────

export const createProductTypeSchema = z.object({
  name: z.string().min(1, 'Product type name is required'),
})

export type CreateProductTypeInput = z.infer<typeof createProductTypeSchema>

export const updateProductTypeSchema = z.object({
  name: z.string().min(1, 'Product type name is required').optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProductTypeInput = z.infer<typeof updateProductTypeSchema>

// ─── Products ────────────────────────────────────────────────────────────────

const preferredOrderUnitValues = Object.values(PreferredOrderUnit) as [string, ...string[]]

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  articleCode: z.string().min(1, 'Article code is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
  productTypeId: z.string().min(1).nullable().optional(),
  unitsPerBox: z.number().int().positive().nullable().optional(),
  boxesPerPallet: z.number().int().positive().nullable().optional(),
  pricePerUnit: z.number().positive().nullable().optional(),
  csrdRequirements: z.string().max(2000).nullable().optional(),
  remarks: z.string().max(1000).nullable().optional(),
  isCustom: z.boolean().optional(),
  preferredOrderUnit: z.enum(preferredOrderUnitValues).nullable().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').optional(),
  articleCode: z.string().min(1, 'Article code is required').optional(),
  supplierId: z.string().min(1, 'Supplier is required').optional(),
  productTypeId: z.string().min(1).nullable().optional(),
  unitsPerBox: z.number().int().positive().nullable().optional(),
  boxesPerPallet: z.number().int().positive().nullable().optional(),
  pricePerUnit: z.number().positive().nullable().optional(),
  csrdRequirements: z.string().max(2000).nullable().optional(),
  remarks: z.string().max(1000).nullable().optional(),
  isCustom: z.boolean().optional(),
  preferredOrderUnit: z.enum(preferredOrderUnitValues).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProductInput = z.infer<typeof updateProductSchema>

// ─── Orders ──────────────────────────────────────────────────────────────────

const unitValues = Object.values(Unit) as [string, ...string[]]

const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit: z.enum(unitValues),
})

export const createOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  notes: z.string().max(1000).optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// ─── Account Activation ─────────────────────────────────────────────────────

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const activateAccountSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ActivateAccountInput = z.infer<typeof activateAccountSchema>

// ─── Forgot Password ────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ─── Reset Password ─────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// ─── Change Password ────────────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// ─── Receive Goods ──────────────────────────────────────────────────────────

export const receiveGoodsSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1, 'Order item ID is required'),
        quantityReceived: z.number().int().min(0, 'Quantity must be 0 or more'),
        receivedDate: z.string().min(1, 'Received date is required'),
      }),
    )
    .min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
})

export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>

// ─── Delivery (new receiving system) ─────────────────────────────────────────

export const createDeliverySchema = z.object({
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1, 'Order item ID is required'),
        quantityReceived: z.number().int().min(0, 'Quantity must be 0 or more'),
      }),
    )
    .min(1, 'At least one item is required'),
})

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>

// ─── Invoice ────────────────────────────────────────────────────────────────

export const matchInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(100),
})

export type MatchInvoiceInput = z.infer<typeof matchInvoiceSchema>
