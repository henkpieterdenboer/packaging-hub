import { z } from 'zod'
import { Role, Unit, ArticleGroup } from '@/types'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

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
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// ─── Suppliers ───────────────────────────────────────────────────────────────

const articleGroupValues = Object.values(ArticleGroup) as [string, ...string[]]

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  email: z.string().email('Please enter a valid email address'),
  ccEmails: z
    .array(z.string().email('Each CC email must be a valid email address'))
    .optional(),
  articleGroup: z.enum(articleGroupValues),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').optional(),
  email: z.string().email('Please enter a valid email address').optional(),
  ccEmails: z
    .array(z.string().email('Each CC email must be a valid email address'))
    .optional(),
  articleGroup: z.enum(articleGroupValues).optional(),
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

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  articleCode: z.string().min(1, 'Article code is required'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  productTypeId: z.string().min(1).nullable().optional(),
  unitsPerBox: z.number().int().positive().nullable().optional(),
  unitsPerPallet: z.number().int().positive().nullable().optional(),
  pricePerUnit: z.number().positive().nullable().optional(),
  csrdRequirements: z.string().nullable().optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').optional(),
  articleCode: z.string().min(1, 'Article code is required').optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  productTypeId: z.string().min(1).nullable().optional(),
  unitsPerBox: z.number().int().positive().nullable().optional(),
  unitsPerPallet: z.number().int().positive().nullable().optional(),
  pricePerUnit: z.number().positive().nullable().optional(),
  csrdRequirements: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProductInput = z.infer<typeof updateProductSchema>

// ─── Orders ──────────────────────────────────────────────────────────────────

const unitValues = Object.values(Unit) as [string, ...string[]]

const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unit: z.enum(unitValues),
})

export const createOrderSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  notes: z.string().optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// ─── Account Activation ─────────────────────────────────────────────────────

export const activateAccountSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
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
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
