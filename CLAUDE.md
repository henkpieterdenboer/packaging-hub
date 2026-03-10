# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SupplyHub — employees browse a product catalog, place orders for supplies, and the system automatically emails suppliers. Admins manage employees, suppliers, and products. The system includes goods receiving, email logging, and a responsive mobile interface.

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
npm run db:push          # Push schema to Neon DEV branch
npm run db:push:prod     # Push schema to Neon MAIN branch (production)
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

### Database Models (12)

- **User** — employees with roles (ADMIN, LOGISTICS, FINANCE), activation flow, `passwordHash` nullable for pre-activation
- **Supplier** — suppliers with `ccEmails` string array and `language`
- **Product** — items linked to suppliers and optional ProductType, optional `unitsPerBox`/`boxesPerPallet`/`pricePerUnit`, optional `pdfUrl`
- **ProductType** — categorization for products (e.g. Boxes, Labels), managed by admins
- **Order** — purchase orders with auto-generated `PO-XXXX` numbers, status tracking (PENDING → PARTIALLY_RECEIVED → RECEIVED)
- **OrderItem** — line items with quantity/unit, cache fields (`quantityReceived`, `receivedDate`, `receivedById`) computed from DeliveryItems
- **Delivery** — a single receiving session for an order, with date, notes, receivedBy
- **DeliveryItem** — what was received per order item in a specific delivery
- **DeliveryPhoto** — photos linked to a delivery (nullable `deliveryId`) or legacy order (nullable `orderId`)
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
  - `/cart` — Cart page (grouped by supplier, unit conversion display, pending order warnings)
  - `/orders` — Order list with status filtering, expandable rows, click to detail
  - `/orders/new` — New order form (supports pre-fill via `?supplierId=X&productId=Y`)
  - `/orders/[id]` — Order detail with delivery history + photo lightbox
  - `/receiving` — Goods receiving list (PENDING/PARTIALLY_RECEIVED orders)
  - `/receiving/[id]` — Delivery form with photo upload, delivery history
  - `/invoices` — Invoice control page with inline invoice matching
  - `/emails` — Email log viewer with type filtering and detail dialog (admins see all, others see own)
  - `/settings` — Profile info and password change
  - `/admin/employees`, `/admin/suppliers`, `/admin/products` — Admin CRUD pages (products has Excel import/export)
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
- `Role` (ADMIN, LOGISTICS, FINANCE) + `RoleLabels`
- `OrderStatus` (PENDING, PARTIALLY_RECEIVED, RECEIVED, CANCELLED) + `OrderStatusLabels`
- `Unit` (PIECE, BOX, PALLET) + `UnitLabels`
- `PreferredOrderUnit` (PIECE, BOX, PALLET) + `PreferredOrderUnitLabels`
- `EmailType` (ORDER, ACTIVATION, PASSWORD_RESET) + `EmailTypeLabels`
- `AuditAction` (CREATE, UPDATE, DELETE, LOGIN, ORDER_PLACED, ORDER_EMAIL_SENT, PASSWORD_RESET, ACCOUNT_ACTIVATED, GOODS_RECEIVED)

### Order Flow (Cart-Based)

1. Employee browses `/products` catalog → adds items to cart (localStorage via CartContext)
2. Cart at `/cart` groups items by supplier, shows unit conversions and pending order warnings
3. Submit per supplier group → `prisma.$transaction()` creates order + items atomically
4. Auto-generates `PO-XXXX` number (`src/lib/order-utils.ts`)
5. System emails supplier with HTML order table (CC: supplier CC emails + ordering employee)
6. Email is logged to `EmailLog` table

### Goods Receiving Flow (Delivery Records)

Each receiving session creates a `Delivery` record with `DeliveryItem`s. This preserves full history of partial deliveries.

1. Navigate to `/receiving` → shows orders with status PENDING or PARTIALLY_RECEIVED
2. Click an order → `/receiving/[id]` shows delivery history + new delivery form
3. Per item: shows ordered qty, already received (from previous deliveries), and remaining
4. Enter received quantities for this delivery + date (default today)
5. Save → POST `/api/orders/[id]/deliveries` creates Delivery + DeliveryItems in transaction
6. `OrderItem.quantityReceived` is updated as cache (sum of all DeliveryItems)
7. Status auto-calculated: all items fully received → RECEIVED, some → PARTIALLY_RECEIVED
8. Photos can be selected as part of the delivery form (before save), uploaded after delivery is created
9. After save, redirects back to `/receiving` with success toast
10. Delivery history with photos is also shown on the order detail page `/orders/[id]`
11. Photo lightbox: click any delivery photo to view full-size overlay

### Validation Schemas

`src/lib/validations.ts` — Centralized Zod schemas: `loginSchema`, `createUserSchema`, `updateUserSchema`, `createSupplierSchema`, `updateSupplierSchema`, `createProductSchema`, `updateProductSchema`, `createProductTypeSchema`, `updateProductTypeSchema`, `createOrderSchema`, `createDeliverySchema`, `activateAccountSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema`.

**Zod v4 note**: Use `.issues` not `.errors` on ZodError objects.

### Email System

`src/lib/email.ts` — Cached transporter. Ethereal for dev (logs preview URLs), Resend SMTP for production.
- `sendOrderEmail()` — HTML formatted order table with CC support (supplier CCs + employee email). Accepts `options?: { employeeEmail, orderId, sentById }`.
- `sendActivationEmail()` — Account activation link with logo + VML button. Accepts optional `sentById`.
- `sendPasswordResetEmail()` — Password reset link with logo + VML button. Accepts optional `sentById`.
- All emails include Coloriginz logo via CID inline attachment and VML `<v:roundrect>` for Outlook-compatible buttons.
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
- **Preview/Test**: `develop` branch → Vercel Preview (`col-supplyhub-test.vercel.app`), Neon `dev` branch (`ep-still-credit-agvj8t0c`)
- **Production**: `main` branch → Vercel Production (`supplyhub.apps.coloriginz.com`), Neon `main` branch (`ep-orange-river-agk5l5ep`)

### Neon Database Branching

Single Neon project with two branches (same project, separate connection strings):
- **`dev` branch** (`ep-still-credit-agvj8t0c`) = test/preview database — `.env` `DATABASE_URL` + `DIRECT_URL`
- **`main` branch** (`ep-orange-river-agk5l5ep`) = production database — `.env` `DATABASE_URL_PROD` + `DIRECT_URL_PROD`

Schema changes must be applied to **both** branches separately (no merge mechanism in Neon):
- `npm run db:push` → pushes to **dev** (uses `DIRECT_URL` from `.env`)
- `npm run db:push:prod` → pushes to **main** (overrides `DIRECT_URL` with `DIRECT_URL_PROD`)

### Deploy Workflow

**Develop (test/preview):**
```bash
git push origin develop      # triggers Vercel preview deploy
npm run db:push              # push schema to Neon dev branch
```

**Production (after approval):**
```bash
git checkout main && git merge develop && git push origin main   # triggers Vercel production deploy
npm run db:push:prod         # push schema to Neon main branch (add --accept-data-loss if needed)
git checkout develop
```

## Git Workflow

- **Repo**: `github.com/henkpieterdenboer/packaging-hub`
- **Branches**: `main` (production) + `develop` (staging/preview)
- Default working branch: `develop`
- Never push directly to `main` without explicit approval
- `develop` → Vercel preview/test, after approval merge to `main` → production

## Environment Variables

See `.env.example`. Key variables:
- `LOCAL_DB` / `LOCAL_DATABASE_URL` — Local PostgreSQL toggle
- `DATABASE_URL` / `DIRECT_URL` — Neon **dev** branch (pooled / direct for Prisma CLI)
- `DATABASE_URL_PROD` / `DIRECT_URL_PROD` — Neon **main** branch (used by `db:push:prod`)
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — NextAuth config
- `APP_URL` — Base URL for email links
- `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` — Production email (Resend)
- `NEXT_PUBLIC_TEST_MODE` — Shows demo accounts on login page

## Platform Notes

- **Windows EPERM on `prisma generate`**: Stop dev server before running
- **Adding NOT NULL columns**: Add nullable first, backfill, then alter to NOT NULL
- **Prisma 6**: `previewFeatures = ["driverAdapters"]` in schema (deprecated warning is expected)
- **Next.js 16**: `middleware` deprecation warning is expected (use `proxy` in future)
- **File input pattern**: When using `e.target.value = ''` to reset a file input, capture files with `Array.from(files)` BEFORE resetting — otherwise the FileList is cleared before React's state updater runs
- **Daily database backup**: GitHub Actions workflow (`.github/workflows/db-backup.yml`) runs pg_dump at 03:00 UTC, stores as artifact for 90 days. Requires `PRODUCTION_DIRECT_URL` secret on the repo.

## Demo Accounts (after seeding)

- Admin: `admin@example.com` / `Welkom01`
- Employee: `employee@example.com` / `Welkom02`
