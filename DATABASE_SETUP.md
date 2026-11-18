# Database Setup & Migration Guide

ExamConnect uses **PostgreSQL 17** with Prisma 8 ORM (`@prisma/orm-postgres`) defined in `packages/database/prisma/contract.prisma`.

## 1. Starting PostgreSQL & Redis Locally

Using Docker Compose:

```powershell
docker compose up -d
```

Verify containers are running:

```powershell
docker ps
```

## 2. Applying Additive Migrations (Preserves Existing Data)

All schema additions are strictly **additive and non-destructive**. Never run `prisma migrate reset` or drop tables in an environment with live or seeded data.

To apply pending migrations (including `passwordResetToken`, `savedExam`, and `exam.isArchived`):

```powershell
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/database exec prisma db migrate
```

### Manual SQL Reference (If Applying Directly via `psql`)

The migration `packages/database/migrations/app/20261118T1414_add_password_reset_saved_exams_archive` executes the following additive DDL:

```sql
CREATE TABLE IF NOT EXISTS "public"."passwordResetToken" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "id" SERIAL NOT NULL,
  "tokenHash" text NOT NULL,
  "usedAt" timestamptz,
  "userId" int4 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."savedExam" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "examId" int4 NOT NULL,
  "id" SERIAL NOT NULL,
  "userId" int4 NOT NULL,
  PRIMARY KEY ("id")
);

ALTER TABLE "public"."exam"
  ADD COLUMN IF NOT EXISTS "isArchived" bool DEFAULT false NOT NULL;

ALTER TABLE "public"."passwordResetToken"
  ADD CONSTRAINT "passwordResetToken_tokenHash_key" UNIQUE ("tokenHash");

ALTER TABLE "public"."savedExam"
  ADD CONSTRAINT "savedExam_userId_examId_key" UNIQUE ("userId", "examId");

CREATE INDEX IF NOT EXISTS "passwordResetToken_expiresAt_idx_6b6b8c10"
  ON "public"."passwordResetToken" ("expiresAt");

CREATE INDEX IF NOT EXISTS "passwordResetToken_userId_idx_a489d58a"
  ON "public"."passwordResetToken" ("userId");

CREATE INDEX IF NOT EXISTS "savedExam_examId_idx_a57bdadd"
  ON "public"."savedExam" ("examId");

CREATE INDEX IF NOT EXISTS "savedExam_userId_idx_a489d58a"
  ON "public"."savedExam" ("userId");

ALTER TABLE "public"."passwordResetToken"
  ADD CONSTRAINT "passwordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."user" ("id");

ALTER TABLE "public"."savedExam"
  ADD CONSTRAINT "savedExam_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."user" ("id");

ALTER TABLE "public"."savedExam"
  ADD CONSTRAINT "savedExam_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "public"."exam" ("id");
```

## 3. Idempotent Exam Catalogue Expansion

To insert the baseline catalogue of major central government and banking exams (SSC CGL, SSC MTS, SSC GD, SSC CPO, IBPS PO, IBPS CSA, IBPS RRB, SBI PO, SBI Junior Associate, UPSC CAPF, RRB NTPC) without modifying or deleting any existing records:

```powershell
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api seed:exams
```

Existing records (such as UPSC Civil Services, Combined Geo-Scientist 2027, SSC CHSL 2026 Exam ID 5, and existing student profiles/education records) are never touched or duplicated.

## 4. Schema Development Workflow

When adding new columns or tables in `packages/database/prisma/contract.prisma`:

```powershell
# 1. Re-emit contract.json and contract.d.ts
pnpm --filter @examconnect/database exec prisma contract emit

# 2. Plan a new additive migration from the latest migration directory
pnpm --filter @examconnect/database exec prisma migration plan --from <latest_migration_dir> --name <descriptive_slug>

# 3. Apply migration to PostgreSQL
pnpm --filter @examconnect/database exec prisma db migrate
```
