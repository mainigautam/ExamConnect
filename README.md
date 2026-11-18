# ExamConnect — Government Exam Eligibility & Recruitment Platform

ExamConnect is a full-stack government examination eligibility and recruitment intelligence platform built with **Next.js 16**, **Fastify**, **PostgreSQL 17**, **Prisma ORM**, and **Redis / BullMQ**.

## Key Features

- **Automated Eligibility Engine**: Evaluates student profiles (date of birth, category, gender, state) and multiple education records (Class 10, Class 12 streams including Science + Mathematics, Diploma, Bachelor's, Master's) against exam-level and post-level rules with exact cutoff-date calculations and transparent rule-by-rule explanations.
- **Secure Authentication & Password Recovery**: Session-based authentication with HttpOnly cookies, Argon2id password hashing, sliding-window rate limiting, and end-to-end Forgot Password / Reset Password (`/forgot-password`, `/reset-password`) using single-use SHA-256 hashed 256-bit tokens, anti-enumeration responses, session revocation, and configurable SMTP email delivery.
- **Complete Student Portal**: Dashboard with KPI cards, search & multi-filter explorer, Eligible & Ineligible views, Exam Details with official notification PDFs, Application Deadlines tracker, Saved/Bookmarked exams, Notifications center, Profile & Multiple Education Management, and Account Settings / Change Password.
- **Role-Protected Admin Panel (`/admin`)**: Create/edit/archive exams, manage posts, configure category-wise age & AND/OR eligibility rules, attach and verify official notification sources, manage application deadlines, audit students, broadcast alerts, and monitor system health.
- **Background Worker & Reminders**: BullMQ/Redis scheduler for automated official source ingestion and deduplicated 7-day / 3-day / 1-day closing deadline reminders.

## Workspace Structure

```text
apps/
  api/          Fastify REST API, Auth, Eligibility Engine, Admin APIs, SMTP Service
  web/          Next.js 16 App Router Frontend (Student Portal + Admin Panel)
  worker/       BullMQ/Redis background job worker (reminders + source ingestion)
packages/
  database/     Prisma contract, additive migrations, typed Postgres ORM client, seed script
  config/       Shared configuration package
  types/        Shared TypeScript types
  validation/   Shared validation package
```

## Quick Start (Windows PowerShell)

### 1. Install Dependencies

```powershell
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` (and `.env.local` for frontend `NEXT_PUBLIC_API_URL`) and update values without committing real secrets.

### 3. Start PostgreSQL and Redis

```powershell
docker compose up -d
```

### 4. Apply Additive Database Migrations

```powershell
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/database exec prisma db migrate
```

### 5. (Optional) Seed Verified Baseline Government Exam Catalogue

This script is strictly idempotent and preserves all existing exams and student records:

```powershell
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api seed:exams
```

### 6. Start the API, Worker, and Frontend

In separate terminals:

```powershell
# API (http://localhost:4000)
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api dev

# Frontend (http://localhost:3000)
cd apps/web
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" exec next dev --webpack

# Worker (optional, requires Redis)
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/worker dev
```

### 7. Run Automated Tests & Production Builds

```powershell
# Typecheck all packages
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" typecheck

# Run API security & eligibility regression tests
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api test

# Production builds
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api build
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter web build
```

## Documentation

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) — PostgreSQL setup, migrations, and safe seeding
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) — Complete Student, Auth, and Admin REST API reference
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — Secure admin bootstrap, exam creation, rule syntax, and source verification
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production build, SMTP configuration, cookies/CORS, and deployment guide
