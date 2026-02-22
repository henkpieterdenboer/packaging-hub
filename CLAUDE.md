# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Packaging Materials Ordering System — employees browse a product catalog, place orders for packaging materials, and the system automatically emails suppliers. Admins manage employees, suppliers, and products.

UI is in **English**, code (variables, comments) is in **English**.

## Tech Stack

- **Framework**: Next.js 16 with App Router, React 19, TypeScript strict mode
- **Database**: PostgreSQL — local for dev (`LOCAL_DB=true`), Neon for production (`@prisma/adapter-neon`)
- **ORM**: Prisma 6 with conditional adapter (local direct vs Neon serverless)
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
```

**Important**: Use `prisma db push` for schema changes, NOT `prisma migrate dev`.

**No test framework**: This project has no unit/integration tests.

**Vercel build**: `vercel.json` runs `npx prisma generate` before `npm run build`. `postinstall` in package.json also runs `prisma generate`.

## Architecture

### Database Connection

`src/lib/db.ts` — Dual-mode Prisma client singleton:
- `LOCAL_DB=true`: Standard PrismaClient with `LOCAL_DATABASE_URL`
- Otherwise: Neon serverless adapter with WebSocket pooling

Two connection strings for Neon: `DATABASE_URL` (pooled) and `DIRECT_URL` (direct for Prisma CLI).

### Database Models (7)

- **User** — employees with roles (ADMIN, USER), activation flow
- **Supplier** — packaging material suppliers with article groups
- **Product** — items linked to suppliers, with packaging units and pricing
- **Order** — purchase orders with auto-generated numbers (BEST-001)
- **OrderItem** — line items with quantity, unit, and receiving tracking
- **Return** — returned items with reason and location
- **AuditLog** — action trail

All IDs are UUIDs. Soft deletes via `isActive` flag.

### Authentication

- NextAuth JWT strategy (`src/lib/auth.ts`)
- JWT callback refreshes roles from DB on every request
- User deactivation invalidates session immediately
- Activation flow: admin creates user → activation email → user sets password
- `src/middleware.ts` handles route protection (public vs auth vs admin)

### Route Structure

- `src/app/(dashboard)/` — Protected route group (dashboard, orders, products, admin)
- `src/app/api/` — API routes (auth, admin CRUD, orders, products, suppliers)
- `src/app/login/`, `activate/`, `forgot-password/`, `reset-password/` — Public auth pages

### API Route Pattern

```typescript
const session = await getServerSession(authOptions)
if (!session?.user) return NextResponse.json({ error: '...' }, { status: 401 })
if (!session.user.roles.includes('ADMIN')) return NextResponse.json({ error: '...' }, { status: 403 })
// Zod validation...
```

### Key Types

All domain enums in `src/types/index.ts`: Role, OrderStatus, Unit, ArticleGroup, AuditAction (with label maps).

### Order Flow

1. Employee selects supplier → browses their products
2. Adds items with quantities and units (PIECE, BOX, PALLET)
3. Submits order → auto-generates BEST-XXX number
4. System emails supplier with order details (CC emails supported)

### Email System

`src/lib/email.ts` — Ethereal for dev (logs preview URLs), Resend SMTP for production. Functions: `sendOrderEmail()`, `sendActivationEmail()`, `sendPasswordResetEmail()`.

### Components

- `src/components/ui/` — shadcn/ui primitives (use `npx shadcn@latest add <component>`)
- `src/components/dashboard/nav.tsx` — Sidebar navigation (role-aware)
- `src/components/providers/session-provider.tsx` — NextAuth SessionProvider wrapper

### Import Alias

Use `@/*` for all imports from `src/`.

## Environments

- **Local dev**: `LOCAL_DB=true`, local PostgreSQL, Ethereal email
- **Preview/Test**: `develop` branch → Vercel Preview, Neon test DB
- **Production**: `main` branch → Vercel Production, Neon prod DB

## Git Workflow

- Default branch: `develop`
- Never push directly to `main` without explicit approval
- `develop` → test, after approval merge to `main` → production

## Environment Variables

See `.env.example`. Key variables:
- `LOCAL_DB` / `LOCAL_DATABASE_URL` — Local PostgreSQL toggle
- `DATABASE_URL` / `DIRECT_URL` — Neon PostgreSQL
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — NextAuth config
- `APP_URL` — Base URL for email links
- `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` — Production email (Resend)

## Platform Notes

- **Windows EPERM on `prisma generate`**: Stop dev server before running
- **Adding NOT NULL columns**: Add nullable first, backfill, then alter to NOT NULL
- **Prisma 6**: Uses `previewFeatures = ["driverAdapters"]` in schema (deprecated warning is expected)

## Demo Accounts (after seeding)

- Admin: `admin@example.com` / `admin123`
- Employee: `employee@example.com` / `employee123`
