import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

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

let cachedTransporter: Transporter | null = null

export async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter

  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.SMTP_PASSWORD,
      },
    })
  } else {
    const testAccount = await nodemailer.createTestAccount()
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  }

  return cachedTransporter
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
): Promise<void> {
  const transporter = await getTransporter()

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

  const html = `
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

  const ccList = supplier.ccEmails.length > 0 ? supplier.ccEmails : undefined

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Packaging Orders" <orders@example.com>',
    to: supplier.email,
    cc: ccList,
    subject: `New Order ${order.orderNumber} - ${supplier.name}`,
    html,
  })

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      '[Email] Ethereal preview URL:',
      nodemailer.getTestMessageUrl(info),
    )
  }
}

export async function sendActivationEmail(
  email: string,
  firstName: string,
  token: string,
): Promise<void> {
  const transporter = await getTransporter()
  const activationUrl = `${APP_URL}/activate/${token}`

  const html = `
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

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Packaging Orders" <orders@example.com>',
    to: email,
    subject: 'Activate Your Account',
    html,
  })

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      '[Email] Ethereal preview URL:',
      nodemailer.getTestMessageUrl(info),
    )
  }
}

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string,
): Promise<void> {
  const transporter = await getTransporter()
  const resetUrl = `${APP_URL}/reset-password/${token}`

  const html = `
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

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Packaging Orders" <orders@example.com>',
    to: email,
    subject: 'Reset Your Password',
    html,
  })

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      '[Email] Ethereal preview URL:',
      nodemailer.getTestMessageUrl(info),
    )
  }
}
