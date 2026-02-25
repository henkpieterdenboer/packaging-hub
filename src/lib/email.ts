import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getTranslation, type TranslationFunction } from '@/i18n'
import { LOGO_BASE64 } from '@/lib/logo-data'

const LOGO_CID = 'coloriginz-logo'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

function getUnitLabel(unit: string, t: TranslationFunction): string {
  const key = `emailTemplates.order.unitLabels.${unit}`
  const label = t(key)
  return label !== key ? label : unit
}

export async function sendOrderEmail(
  order: OrderEmailData,
  items: OrderItemEmailData[],
  supplier: SupplierEmailData,
  employee: EmployeeEmailData,
  options?: { employeeEmail?: string; orderId?: string; sentById?: string; language?: string },
): Promise<{ etherealUrl?: string; emailLogId?: string }> {
  const { transporter, provider } = await getTransporter()
  const demoTarget = await getDemoEmailTarget()
  const lang = options?.language || 'en'
  const t = getTranslation(lang)

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(item.product.name)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(item.product.articleCode)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(getUnitLabel(item.unit, t))}</td>
      </tr>`,
    )
    .join('')

  const safeSupplierName = escapeHtml(supplier.name)
  const safeEmployeeName = escapeHtml(`${employee.firstName} ${employee.lastName}`)

  const notesSection = order.notes
    ? `<p style="margin-top: 16px;"><strong>${t('emailTemplates.order.notes')}</strong> ${escapeHtml(order.notes)}</p>`
    : ''

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><![endif]-->
        <img src="cid:${LOGO_CID}" alt="Coloriginz" width="180" height="45" style="border: 0; outline: none;" />
        <!--[if mso]></td></tr></table><![endif]-->
      </div>
      <h2 style="color: #333;">${t('emailTemplates.order.subject', { orderNumber: escapeHtml(order.orderNumber), supplierName: safeSupplierName })}</h2>
      <p>${t('emailTemplates.order.greeting', { supplierName: safeSupplierName })}</p>
      <p>${t('emailTemplates.order.intro', { employeeName: safeEmployeeName })}</p>
      <p>${t('emailTemplates.order.placedByCompany')}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${t('emailTemplates.order.product')}</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${t('emailTemplates.order.articleCode')}</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t('emailTemplates.order.quantity')}</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${t('emailTemplates.order.unit')}</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      ${notesSection}
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        ${t('emailTemplates.order.footer')}
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
  const subject = `${subjectPrefix}${t('emailTemplates.order.subject', { orderNumber: order.orderNumber, supplierName: supplier.name })}`

  if (IS_TEST_MODE && demoTarget) {
    html = addDemoBanner(html, supplier.email, provider, actualTo)
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"SupplyHub" <orders@example.com>',
    to: actualTo,
    cc: ccList,
    subject,
    html,
    attachments: [{
      filename: 'logo.png',
      content: Buffer.from(LOGO_BASE64, 'base64'),
      cid: LOGO_CID,
    }],
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
        htmlBody: html,
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
  language?: string,
): Promise<{ etherealUrl?: string; emailLogId?: string }> {
  const { transporter, provider } = await getTransporter()
  const demoTarget = await getDemoEmailTarget()
  const t = getTranslation(language || 'en')
  const activationUrl = `${APP_URL}/activate/${encodeURIComponent(token)}`
  const safeFirstName = escapeHtml(firstName)

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${t('emailTemplates.activation.title')}</h2>
      <p>${t('emailTemplates.activation.greeting', { firstName: safeFirstName })}</p>
      <p>${t('emailTemplates.activation.intro')}</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${activationUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          ${t('emailTemplates.activation.button')}
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">${t('emailTemplates.activation.linkHint')}</p>
      <p style="color: #666; font-size: 14px; word-break: break-all;">${activationUrl}</p>
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        ${t('emailTemplates.activation.expiry')}
      </p>
    </div>
  `

  const actualTo = demoTarget || email
  const subjectPrefix = IS_TEST_MODE ? '[TEST] ' : ''
  const subject = `${subjectPrefix}${t('emailTemplates.activation.subject')}`

  if (IS_TEST_MODE && demoTarget) {
    html = addDemoBanner(html, email, provider, actualTo)
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"SupplyHub" <orders@example.com>',
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
        htmlBody: html,
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
  language?: string,
): Promise<{ etherealUrl?: string; emailLogId?: string }> {
  const { transporter, provider } = await getTransporter()
  const demoTarget = await getDemoEmailTarget()
  const t = getTranslation(language || 'en')
  const resetUrl = `${APP_URL}/reset-password/${encodeURIComponent(token)}`
  const safeFirstName = escapeHtml(firstName)

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${t('emailTemplates.passwordReset.title')}</h2>
      <p>${t('emailTemplates.passwordReset.greeting', { firstName: safeFirstName })}</p>
      <p>${t('emailTemplates.passwordReset.intro')}</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          ${t('emailTemplates.passwordReset.button')}
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">${t('emailTemplates.passwordReset.linkHint')}</p>
      <p style="color: #666; font-size: 14px; word-break: break-all;">${resetUrl}</p>
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        ${t('emailTemplates.passwordReset.expiry')}
      </p>
    </div>
  `

  const actualTo = demoTarget || email
  const subjectPrefix = IS_TEST_MODE ? '[TEST] ' : ''
  const subject = `${subjectPrefix}${t('emailTemplates.passwordReset.subject')}`

  if (IS_TEST_MODE && demoTarget) {
    html = addDemoBanner(html, email, provider, actualTo)
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"SupplyHub" <orders@example.com>',
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
        htmlBody: html,
        status: 'SENT',
      },
    })
    emailLogId = log.id
  } catch (logError) {
    console.error('[Email] Failed to create email log:', logError)
  }

  return { etherealUrl, emailLogId }
}
