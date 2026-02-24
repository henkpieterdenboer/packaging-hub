# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Packaging Materials Ordering System — employees browse a product catalog, place orders for packaging materials, and the system automatically emails suppliers. Admins manage employees, suppliers, and products. The system includes goods receiving, email logging, and a responsive mobile interface.

UI is in **English**, code (variables, comments) in **English**.

## Tech Stack

- **Framework**: Next.js 16 with App Router, React 19, TypeScript strict mode
- **Database**: PostgreSQL via Neon (Prisma 6 ORM, simple `datasourceUrl` — NOT using the Neon adapter)
- **Auth**: NextAuth.js v4 (JWT strategy, credentials provider)
- **UI**: Tailwind CSS 4 + shadcn/ui (new-york style, neutral base, lucide icons, Geist fonts)
- **Toasts**: sonner
- **Email**: Nodemailer — Ethereal (dev), Resend SMTP (production)
- **Validation**: Zod v4

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:seed          # Seed demo accounts (tsx prisma/seed.ts)
npx prisma db push       # Push schema changes to DB
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Open Prisma Studio DB browser
npx shadcn@latest add <component>  # Add shadcn/ui component
```

**Important**: Use `prisma db push` for schema changes, NOT `prisma migrate dev`.

**No test framework**: This project has no unit/integration tests.

**Vercel build**: `vercel.json` runs `npx prisma generate` before `npm run build`. `postinstall` also runs `prisma generate`.

## Architecture

### Database Connection

`src/lib/db.ts` — Prisma client singleton using `datasourceUrl`:
- `LOCAL_DB=true`: uses `LOCAL_DATABASE_URL` (local PostgreSQL)
- Otherwise: uses `DATABASE_URL` (Neon pooled connection)
- Singleton stored on `globalThis` to prevent multiple instances in dev

Note: `@prisma/adapter-neon` is installed but **not used**. The simple `datasourceUrl` approach works fine. `DIRECT_URL` is only needed for Prisma CLI commands (`db push`, `studio`).

### Database Models (8)

- **User** — employees with roles (ADMIN, USER), activation flow, `passwordHash` nullable for pre-activation
- **Supplier** — suppliers with `ccEmails` string array and `articleGroup`
- **Product** — items linked to suppliers and optional ProductType, optional `unitsPerBox`/`unitsPerPallet`/`pricePerUnit`, optional `pdfUrl`
- **ProductType** — categorization for products (e.g. Boxes, Labels), managed by admins
- **Order** — purchase orders with auto-generated `BEST-XXX` numbers, status tracking (PENDING → PARTIALLY_RECEIVED → RECEIVED)
- **OrderItem** — line items with quantity/unit, receiving tracking (`quantityReceived`, `receivedDate`, `receivedById`)
- **Return** — returned items with reason and location
- **AuditLog** — action trail with `userId` (nullable), `action`, `entityType`, `entityId`
- **EmailLog** — logs all sent emails (type, subject, to, CC, provider, ethereal URL, status)

All IDs are UUIDs. Soft deletes via `isActive` flag. `OrderItem` and `Return` cascade on parent delete.

### Authentication

- NextAuth JWT strategy (`src/lib/auth.ts`)
- JWT callback refreshes roles from DB on every request; returns `{}` if user deactivated
- Passwords hashed with bcryptjs (cost 10)
- Activation flow: admin creates user → activation email (7-day token) → user sets password
- Password reset: 1-hour token expiration
- Password change: authenticated users via `/api/auth/change-password`
- `src/middleware.ts` — public paths bypass checks, `/admin/*` requires ADMIN role, API routes do their own auth
- Type augmentation in `src/types/next-auth.d.ts`

### Route Structure

- `src/app/(dashboard)/` — Protected route group:
  - `/dashboard` — Stats overview with clickable cards
  - `/products` — Product catalog (grid/list view, sorting, quick order buttons)
  - `/orders` — Order list with status filtering via URL params
  - `/orders/new` — New order form (supports pre-fill via `?supplierId=X&productId=Y`)
  - `/orders/[id]` — Order detail with receiving progress
  - `/receiving` — Goods receiving page (record received quantities per order item)
  - `/emails` — Email log viewer with type filtering and detail dialog
  - `/settings` — Profile info and password change
  - `/admin/employees`, `/admin/suppliers`, `/admin/products` — Admin CRUD pages
- `src/app/api/` — API routes (auth, admin CRUD, orders, products, suppliers, emails)
- `src/app/login/`, `activate/`, `forgot-password/`, `reset-password/` — Public auth pages

### API Route Pattern

All API routes follow this pattern:

```typescript
// 1. Auth check
const session = await getServerSession(authOptions)
if (!session?.user) return NextResponse.json({ error: '...' }, { status: 401 })

// 2. Role check (admin routes only)
if (!session.user.roles.includes('ADMIN')) return NextResponse.json({ error: '...' }, { status: 403 })

// 3. Zod validation with flattened errors
const parsed = schema.safeParse(body)
if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 })

// 4. Business logic + try/catch with console.error
```

### Key Types

`src/types/index.ts` — All domain enums as `const` objects (NOT Prisma enums) with corresponding label maps:
- `Role` (ADMIN, USER) + `RoleLabels`
- `OrderStatus` (PENDING, PARTIALLY_RECEIVED, RECEIVED, CANCELLED) + `OrderStatusLabels`
- `Unit` (PIECE, BOX, PALLET) + `UnitLabels`
- `ArticleGroup` (PACKAGING, LABELS, TAPE, PALLETS, OTHER) + `ArticleGroupLabels`
- `EmailType` (ORDER, ACTIVATION, PASSWORD_RESET) + `EmailTypeLabels`
- `AuditAction` (CREATE, UPDATE, DELETE, LOGIN, ORDER_PLACED, ORDER_EMAIL_SENT, PASSWORD_RESET, ACCOUNT_ACTIVATED, GOODS_RECEIVED)

### Order Flow

1. Employee selects supplier → browses their products
2. Adds items with quantities and units (PIECE, BOX, PALLET)
3. Submits order → `prisma.$transaction()` creates order + items atomically
4. Auto-generates `BEST-XXX` number (`src/lib/order-utils.ts`)
5. System emails supplier with HTML order table (CC: supplier CC emails + ordering employee)
6. Email is logged to `EmailLog` table
7. Quick order: click "Order" on any product card → pre-fills `/orders/new`

### Goods Receiving Flow

1. Navigate to `/receiving` → shows orders with status PENDING or PARTIALLY_RECEIVED
2. Expand an order → see items with quantity ordered vs received
3. Enter received quantities and dates (default today, backdating allowed)
4. Save → PATCH `/api/orders/[id]/receive` updates items in transaction
5. Status auto-calculated: all items fully received → RECEIVED, some → PARTIALLY_RECEIVED
6. Audit log entry created with action GOODS_RECEIVED

### Validation Schemas

`src/lib/validations.ts` — Centralized Zod schemas: `loginSchema`, `createUserSchema`, `updateUserSchema`, `createSupplierSchema`, `updateSupplierSchema`, `createProductSchema`, `updateProductSchema`, `createProductTypeSchema`, `updateProductTypeSchema`, `createOrderSchema`, `activateAccountSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema`, `receiveGoodsSchema`.

**Zod v4 note**: Use `.issues` not `.errors` on ZodError objects.

### Email System

`src/lib/email.ts` — Cached transporter. Ethereal for dev (logs preview URLs), Resend SMTP for production.
- `sendOrderEmail()` — HTML formatted order table with CC support (supplier CCs + employee email). Accepts `options?: { employeeEmail, orderId, sentById }`.
- `sendActivationEmail()` — Account activation link. Accepts optional `sentById`.
- `sendPasswordResetEmail()` — Password reset link. Accepts optional `sentById`.
- All functions log to `EmailLog` table after sending (wrapped in try/catch so logging failures don't break email delivery).

### Components

- `src/components/ui/` — shadcn/ui primitives (includes Sheet, Dialog, Badge, Table, etc.)
- `src/components/dashboard/nav.tsx` — Responsive sidebar navigation (desktop sidebar + mobile hamburger with Sheet). Uses `NavContent` subcomponent with `onNavigate` callback for mobile sheet auto-close.
- `src/components/providers/session-provider.tsx` — NextAuth SessionProvider wrapper

### Import Alias

Use `@/*` for all imports from `src/`.

## UI Patterns

### Responsive Design
- Desktop (md+): fixed sidebar, 6px padding
- Mobile (<md): top bar with hamburger menu, Sheet sidebar, 4px padding
- Tables wrapped in `overflow-x-auto` for horizontal scroll on mobile
- `useSearchParams()` requires wrapping component in `<Suspense>`

### Product Catalog
- Grid/list view toggle (state: `viewMode`)
- Client-side sorting on name, article code, supplier, price
- Grid: sort dropdown + direction button
- List: clickable table headers with sort arrows
- "Order" button on each product → navigates to `/orders/new?supplierId=X&productId=Y`

### React 19 / ESLint Strict Rules
- Do NOT use `setState` directly inside `useEffect` bodies (lint error: `react-hooks/set-state-in-effect`)
- Do NOT access `ref.current` during render (lint error: `react-hooks/refs`)
- Use event callbacks (like `onClick`) or `onOpenChange` to update state instead

## Environments

- **Local dev**: `LOCAL_DB=true`, local PostgreSQL, Ethereal email
- **Preview/Test**: `develop` branch → Vercel Preview, Neon test DB
- **Production**: `main` branch → Vercel Production, Neon prod DB

## Git Workflow

- **Repo**: `github.com/henkpieterdenboer/packaging-hub`
- **Branches**: `main` (production) + `develop` (staging/preview)
- Default working branch: `develop`
- Never push directly to `main` without explicit approval
- `develop` → Vercel preview/test, after approval merge to `main` → production

## Environment Variables

See `.env.example`. Key variables:
- `LOCAL_DB` / `LOCAL_DATABASE_URL` — Local PostgreSQL toggle
- `DATABASE_URL` / `DIRECT_URL` — Neon PostgreSQL (pooled / direct for Prisma CLI)
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — NextAuth config
- `APP_URL` — Base URL for email links
- `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` — Production email (Resend)
- `NEXT_PUBLIC_TEST_MODE` — Shows demo accounts on login page

## Platform Notes

- **Windows EPERM on `prisma generate`**: Stop dev server before running
- **Adding NOT NULL columns**: Add nullable first, backfill, then alter to NOT NULL
- **Prisma 6**: `previewFeatures = ["driverAdapters"]` in schema (deprecated warning is expected)
- **Next.js 16**: `middleware` deprecation warning is expected (use `proxy` in future)

## Demo Accounts (after seeding)

- Admin: `admin@example.com` / `admin123`
- Employee: `employee@example.com` / `employee123`
