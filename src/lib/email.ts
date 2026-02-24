import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const DEMO_EMAIL = process.env.DEMO_EMAIL
const IS_TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

type EmailProvider = 'ethereal' | 'resend'

interface OrderEmailData {
  orderNumber: string
  notes?: string | null
}

interface OrderItemEmailData {
  quantity: number
  unit: string
  product: {
    name: string
    articleCode: string
  }
}

interface SupplierEmailData {
  name: string
  email: string
  ccEmails: string[]
}

interface EmployeeEmailData {
  firstName: string
  lastName: string
}

let cachedEtherealTransporter: Transporter | null = null
let cachedResendTransporter: Transporter | null = null

async function getEmailProvider(): Promise<EmailProvider> {
  if (!IS_TEST_MODE) {
    return 'resend'
  }

  try {
    const cookieStore = await cookies()
    const providerCookie = cookieStore.get('email-provider')
    if (providerCookie?.value === 'resend') {
      return 'resend'
    }
  } catch {
    // cookies() can fail outside request context
  }

  return 'ethereal'
}

async function getDemoEmailTarget(): Promise<string | null> {
  if (!IS_TEST_MODE) return null

  try {
    const cookieStore = await cookies()
    const target = cookieStore.get('demo-email-target')?.value
    return target || DEMO_EMAIL || null
  } catch {
    return DEMO_EMAIL || null
  }
}

function getEtherealTransporter(): Transporter {
  if (cachedEtherealTransporter) return cachedEtherealTransporter

  const user = process.env.ETHEREAL_USER
  const pass = process.env.ETHEREAL_PASS

  if (!user || !pass) {
    throw new Error('ETHEREAL_USER and ETHEREAL_PASS env vars are required for Ethereal email')
  }

  cachedEtherealTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user, pass },
  })

  return cachedEtherealTransporter
}

function getResendTransporter(): Transporter {
  if (cachedResendTransporter) return cachedResendTransporter

  cachedResendTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.resend.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'resend',
      pass: process.env.SMTP_PASSWORD,
    },
  })

  return cachedResendTransporter
}

async function getTransporter(): Promise<{ transporter: Transporter; provider: EmailProvider }> {
  const provider = await getEmailProvider()

  if (provider === 'resend') {
    return { transporter: getResendTransporter(), provider }
  }

  return { transporter: getEtherealTransporter(), provider }
}

function addDemoBanner(html: string, originalTo: string, provider: EmailProvider, actualTo: string): string {
  const providerLabel = provider === 'ethereal' ? 'Test inbox (Ethereal)' : 'Real mail (Resend)'
  const banner = `
    <div style="background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #991b1b;">
      <strong>TEST MODE</strong><br/>
      Original recipient: ${originalTo}<br/>
      Provider: ${providerLabel}<br/>
      Actual recipient: ${actualTo}
    </div>
  `
  return banner + html
}

function getUnitLabel(unit: string): string {
  const labels: Record<string, string> = {
    PIECE: 'Piece(s)',
    BOX: 'Box(es)',
    PALLET: 'Pallet(s)',
  }
  return labels[unit] || unit
}

export async function sendOrderEmail(
  order: OrderEmailData,
  items: OrderItemEmailData[],
  supplier: SupplierEmailData,
  employee: EmployeeEmailData,
  options?: { employeeEmail?: string; orderId?: string; sentById?: string },
): Promise<{ etherealUrl?: string; emailLogId?: string }> {
  const { transporter, provider } = await getTransporter()
  const demoTarget = await getDemoEmailTarget()

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.product.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.product.articleCode}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${getUnitLabel(item.unit)}</td>
      </tr>`,
    )
    .join('')

  const notesSection = order.notes
    ? `<p style="margin-top: 16px;"><strong>Notes:</strong> ${order.notes}</p>`
    : ''

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Order ${order.orderNumber}</h2>
      <p>Dear ${supplier.name},</p>
      <p>A new order has been placed by ${employee.firstName} ${employee.lastName}.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Article Code</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Quantity</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      ${notesSection}
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        This is an automated message from the packaging materials ordering system.
      </p>
    </div>
  `

  const actualTo = demoTarget || supplier.email

  // Build CC list: supplier CC emails + employee email (only when not in demo redirect mode)
  const baseCcEmails = [
    ...supplier.ccEmails,
    ...(options?.employeeEmail && !demoTarget ? [options.employeeEmail] : []),
  ]
  const ccList = demoTarget ? undefined : (baseCcEmails.length > 0 ? baseCcEmails : undefined)

  const subjectPrefix = IS_TEST_MODE ? '[TEST] ' : ''
  const subject = `${subjectPrefix}New Order ${order.orderNumber} - ${supplier.name}`

  if (IS_TEST_MODE && demoTarget) {
    html = addDemoBanner(html, supplier.email, provider, actualTo)
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Packaging Orders" <orders@example.com>',
    to: actualTo,
    cc: ccList,
    subject,
    html,
  })

  let etherealUrl: string | undefined
  if (provider === 'ethereal') {
    const url = nodemailer.getTestMessageUrl(info)
    console.log('[Email] Ethereal preview URL:', url)
    etherealUrl = url || undefined
  }

  // Log the email
  let emailLogId: string | undefined
  try {
    const log = await prisma.emailLog.create({
      data: {
        type: 'ORDER',
        subject,
        toAddress: actualTo,
        ccAddresses: ccList || [],
        orderId: options?.orderId,
        sentById: options?.sentById,
        provider,
        etherealUrl: etherealUrl || null,
        status: 'SENT',
      },
    })
    emailLogId = log.id
  } catch (logError) {
    console.error('[Email] Failed to create email log:', logError)
  }

  return { etherealUrl, emailLogId }
}

export async function sendActivationEmail(
  email: string,
  firstName: string,
  token: string,
  sentById?: string,
): Promise<{ etherealUrl?: string; emailLogId?: string }> {
  const { transporter, provider } = await getTransporter()
  const demoTarget = await getDemoEmailTarget()
  const activationUrl = `${APP_URL}/activate/${token}`

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Activate Your Account</h2>
      <p>Hello ${firstName},</p>
      <p>An account has been created for you in the packaging materials ordering system. Please click the button below to set your password and activate your account.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${activationUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Activate Account
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 14px; word-break: break-all;">${activationUrl}</p>
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        This link will expire in 48 hours. If you did not expect this email, you can safely ignore it.
      </p>
    </div>
  `

  const actualTo = demoTarget || email
  const subjectPrefix = IS_TEST_MODE ? '[TEST] ' : ''
  const subject = `${subjectPrefix}Activate Your Account`

  if (IS_TEST_MODE && demoTarget) {
    html = addDemoBanner(html, email, provider, actualTo)
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Packaging Orders" <orders@example.com>',
    to: actualTo,
    subject,
    html,
  })

  let etherealUrl: string | undefined
  if (provider === 'ethereal') {
    const url = nodemailer.getTestMessageUrl(info)
    console.log('[Email] Ethereal preview URL:', url)
    etherealUrl = url || undefined
  }

  // Log the email
  let emailLogId: string | undefined
  try {
    const log = await prisma.emailLog.create({
      data: {
        type: 'ACTIVATION',
        subject,
        toAddress: actualTo,
        ccAddresses: [],
        sentById,
        provider,
        etherealUrl: etherealUrl || null,
        status: 'SENT',
      },
    })
    emailLogId = log.id
  } catch (logError) {
    console.error('[Email] Failed to create email log:', logError)
  }

  return { etherealUrl, emailLogId }
}

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string,
  sentById?: string,
): Promise<{ etherealUrl?: string; emailLogId?: string }> {
  const { transporter, provider } = await getTransporter()
  const demoTarget = await getDemoEmailTarget()
  const resetUrl = `${APP_URL}/reset-password/${token}`

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>Hello ${firstName},</p>
      <p>We received a request to reset your password. Click the button below to choose a new password.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 14px; word-break: break-all;">${resetUrl}</p>
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `

  const actualTo = demoTarget || email
  const subjectPrefix = IS_TEST_MODE ? '[TEST] ' : ''
  const subject = `${subjectPrefix}Reset Your Password`

  if (IS_TEST_MODE && demoTarget) {
    html = addDemoBanner(html, email, provider, actualTo)
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Packaging Orders" <orders@example.com>',
    to: actualTo,
    subject,
    html,
  })

  let etherealUrl: string | undefined
  if (provider === 'ethereal') {
    const url = nodemailer.getTestMessageUrl(info)
    console.log('[Email] Ethereal preview URL:', url)
    etherealUrl = url || undefined
  }

  // Log the email
  let emailLogId: string | undefined
  try {
    const log = await prisma.emailLog.create({
      data: {
        type: 'PASSWORD_RESET',
        subject,
        toAddress: actualTo,
        ccAddresses: [],
        sentById,
        provider,
        etherealUrl: etherealUrl || null,
        status: 'SENT',
      },
    })
    emailLogId = log.id
  } catch (logError) {
    console.error('[Email] Failed to create email log:', logError)
  }

  return { etherealUrl, emailLogId }
}
