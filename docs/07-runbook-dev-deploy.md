# 07 — Development and Deployment Runbook

This runbook explains how to create the project from zero, run it locally, and deploy it.

> Bootstrap status (Milestone 0, 2026-06-05): the project is already scaffolded.
> Realized stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
> (strict), Tailwind CSS v4, ESLint 9, Prettier 3, next-intl 4, Prisma 6.
> Deviations from the from-zero commands below are noted inline.
>
> To run an already-bootstrapped checkout:
>
> ```bash
> corepack enable pnpm   # if pnpm is missing (Corepack ships with Node)
> pnpm install
> pnpm prisma generate
> pnpm dev               # http://localhost:3000 → redirects to /pl
> ```

## 1. Prerequisites

Install:

- Node.js LTS;
- pnpm;
- Git;
- VS Code;
- GitHub account;
- Vercel account;
- PostgreSQL provider account: Neon or Supabase;
- email provider account: Resend/Postmark/SendGrid.

Check versions:

```bash
node -v
pnpm -v
git --version
```

## 2. Create project

Recommended repository name:

```bash
medslot
```

Create app:

```bash
pnpm create next-app medslot --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd medslot
```

If `pnpm create next-app` behaves differently on your machine, use:

```bash
npx create-next-app@latest medslot --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
cd medslot
```

## 3. Initialize Git

```bash
git init
git add .
git commit -m "chore: bootstrap Next.js app"
```

Create GitHub repo and push:

```bash
git remote add origin git@github.com:<your-user>/medslot.git
git branch -M main
git push -u origin main
```

## 4. Install main dependencies

```bash
pnpm add @prisma/client prisma zod date-fns uuid bcryptjs
pnpm add next-intl
pnpm add resend
pnpm add @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
pnpm add -D tsx
```

> Note (Milestone 0): Prisma is pinned to the v6 line — install with
> `pnpm add @prisma/client@^6` and `pnpm add -D prisma@^6` — because Prisma 7
> removed the `datasource.url` schema property (see `DECISIONS.md`, Decision 007).
> Under pnpm v11, approve native build scripts in `pnpm-workspace.yaml`
> (the `allowBuilds:` map) for `prisma`, `@prisma/engines`, `@prisma/client`,
> and `esbuild`.

Optional:

```bash
pnpm add @sentry/nextjs
```

## 5. Initialize shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

Add common components:

```bash
pnpm dlx shadcn@latest add button input textarea form card dialog table badge select tabs dropdown-menu sheet calendar
```

## 6. Initialize Prisma

```bash
pnpm prisma init
```

This creates:

```text
prisma/schema.prisma
.env
```

Copy `.env.example` from this handbook into your project root and fill values.

## 7. Create database

Use Neon or Supabase.

### Neon/Supabase steps

1. Create new project.
2. Choose EU region if possible (e.g. Neon Frankfurt) for GDPR/RODO.
3. Copy the PostgreSQL connection strings.
4. Paste them into `.env`.

This project uses two connection strings (see `DECISIONS.md`, Decision 011):

- `DATABASE_URL` — the **pooled** connection, used at runtime. Required on
  serverless hosts (Vercel). On Neon this is the "Pooled connection" string (its
  host contains `-pooler`).
- `DIRECT_URL` — a **direct** (unpooled) connection, used only by Prisma
  migrations and introspection. On Neon this is the plain "Direct connection"
  string.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler:PORT/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

For local development against a single Postgres (no pooler), set `DIRECT_URL` to
the same value as `DATABASE_URL`.

## 8. Add Prisma models

> Milestone 1 status: `prisma/schema.prisma`, the `*_init` and
> `*_appointment_no_overlap` migrations, and `prisma/seed.ts` are already
> committed. If you have a PostgreSQL `DATABASE_URL`, you only need to apply
> them: `pnpm prisma migrate deploy && pnpm prisma generate && pnpm db:seed`.
> The steps below describe how the schema was created from zero.

Copy model draft from `docs/03-data-model.md` into `prisma/schema.prisma` and adapt names if needed.

Then run:

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

Open Prisma Studio:

```bash
pnpm prisma studio
```

## 9. Add double-booking constraint

Create a raw migration after initial schema.

Command:

```bash
pnpm prisma migrate dev --create-only --name appointment_no_overlap
```

Open generated SQL migration file and add:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT appointment_no_overlap
EXCLUDE USING gist (
  "doctorId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE (status = 'booked');
```

Then run:

```bash
pnpm prisma migrate dev
```

> Implementation note: the committed migration uses `tsrange` (not `tstzrange`)
> and `WHERE ("status" = 'booked')`, because Prisma maps `DateTime` to
> `timestamp(3)` (UTC, without time zone). See `DECISIONS.md`, Decision 008.

## 10. Create folder structure

```bash
mkdir -p src/server/{appointments,patients,notes,working-hours,blocked-times,audit,consent,email,auth}
mkdir -p src/components/{booking,admin,ui}
mkdir -p src/lib/{date-time,security,validation,export}
mkdir -p src/i18n/messages
mkdir -p src/app/[locale]/{booking,admin/calendar,admin/patients,admin/settings,cancel}
```

## 11. Add documentation files

Copy these handbook files into the project root:

```text
README.md
AGENTS.md
.github/copilot-instructions.md
PLANS.md
CHANGELOG.md
DECISIONS.md
docs/*
prompts/*
.env.example
```

## 12. Add scripts to package.json

Recommended scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts",
    "retention:sweep": "tsx scripts/retention-sweep.ts",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "check": "pnpm lint && pnpm typecheck && pnpm build",
    "verify": "pnpm lint && pnpm typecheck && pnpm test",
    "postinstall": "prisma generate",
    "prepare": "husky"
  }
}
```

If your Next.js version no longer supports `next lint`, replace with ESLint CLI according to generated project config.

## 13. Local run

```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm db:seed
pnpm dev
```

Open:

```text
http://localhost:3000
```

### Admin sign-in (local)

The seed (`pnpm db:seed`) creates the clinic, the single doctor, Monday–Friday
09:00–17:00 working hours, and one admin user. All of these are env-driven with
development defaults, so the same script seeds a real deployment:

- Clinic/doctor: `CLINIC_NAME`, `CLINIC_SLUG`, `CLINIC_TIMEZONE`, `DEFAULT_LOCALE`,
  `DOCTOR_DISPLAY_NAME`, `DOCTOR_EMAIL`, and optional `DOCTOR_TIMEZONE` (defaults
  to `CLINIC_TIMEZONE`).
- Admin user: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (development defaults:
  `admin@example.com` / `medslot-admin`).

The seed is idempotent (keyed by `CLINIC_SLUG` and `DOCTOR_EMAIL`) and never logs
the password. Set real values before seeding a production database. Sign in at:

```text
http://localhost:3000/pl/admin/login
```

The admin session cookie is signed with `AUTH_SECRET`, so that variable must be set.
**Change the admin credentials and `AUTH_SECRET` before any shared/production deployment.**

## 14. Development workflow

For each feature:

```bash
git checkout -b feature/<feature-name>
```

Develop.

Run checks and tests:

```bash
pnpm check        # lint + typecheck + build
pnpm test         # unit + integration (see "Tests" below)
```

### Tests

Tests use Vitest and are split into two projects:

- **Unit** (`tests/unit/`) — pure logic with no database: Zod schemas,
  date/timezone math, availability interval helpers, CSV building, and token
  hashing.
- **Integration** (`tests/integration/`) — real server logic against a real
  PostgreSQL database: booking, the database-level no-overlap constraint,
  availability, cancellation, manual appointments, working hours, blocked time,
  patient history, notes, GDPR anonymization/retention, and CSV export.

```bash
pnpm test              # everything (unit + integration)
pnpm test:unit         # unit only — never needs a database
pnpm test:integration  # integration only
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage report
pnpm verify            # lint + typecheck + test
```

Integration tests connect to a dedicated database derived from `DATABASE_URL` by
suffixing the database name with `_test` (e.g. `medslot` → `medslot_test`), or to
`TEST_DATABASE_URL` if it is set. The schema is created automatically on first run
with `prisma migrate deploy`, so the only prerequisite is a running Postgres:

```bash
docker compose up -d   # local Postgres (see docker-compose.yml)
pnpm test:integration
```

If no database is reachable, the integration tests are **skipped** (not failed) so
the suite still passes locally. In CI (`CI=true`) a missing database is a hard
error instead, so integration coverage cannot be silently lost.

A Husky pre-commit hook (`.husky/pre-commit`) runs `lint-staged`, `pnpm
typecheck`, and `pnpm test` before each commit. It activates after `pnpm install`
inside a Git repository (via the `prepare` script). Bypass only in emergencies
with `git commit --no-verify`.

Update docs:

- README if usage changes;
- PLANS.md if milestone changes;
- docs/* if behavior changes;
- CHANGELOG.md for user-visible changes;
- DECISIONS.md for architecture/product decisions;
- AGENTS.md / copilot instructions if AI workflow needs updating.

Commit:

```bash
git add .
git commit -m "feat: add <feature-name>"
git push -u origin feature/<feature-name>
```

Open PR.

## 15. Vercel deployment

1. Go to Vercel.
2. Import GitHub repository.
3. Select Next.js framework.
4. Add environment variables:
   - `DATABASE_URL` (pooled connection — required at runtime)
   - `DIRECT_URL` (direct connection — used by migrations)
   - `AUTH_SECRET` (also signs the admin session cookie)
   - `CANCEL_TOKEN_SECRET`
   - `NEXT_PUBLIC_APP_URL` (your deployed URL; cancellation links use it)
   - `EMAIL_PROVIDER` (`log` to send nothing, or `smtp` for real email)
   - `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (when `EMAIL_PROVIDER=smtp`)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (only if you run `db:seed` to create the first admin; set strong values)
   - `CLINIC_NAME`, `CLINIC_SLUG`, `CLINIC_TIMEZONE`, `DOCTOR_DISPLAY_NAME`, `DOCTOR_EMAIL` (only if you run `db:seed`; set real clinic/doctor values)
5. Deploy.

## 16. Production migrations

Before production deployment:

```bash
pnpm prisma migrate deploy
```

Recommended:

- run migrations in CI/CD or a controlled manual step;
- never run `prisma db push` against production;
- test migrations against staging first.

To connect to the database directly (Prisma Studio, `psql`, or the Neon SQL
editor) and run read-only inspection queries — locally or against production —
see `docs/11-database-access.md`.

## 17. Staging environment

Create separate environments:

- local;
- staging/preview;
- production.

Use separate databases for staging and production.

Never test destructive migrations on production first.

## 18. Release checklist

Before release:

- [ ] `pnpm check` passes.
- [ ] `pnpm test` passes (start Postgres with `docker compose up -d` first so the integration tests run instead of skipping).
- [ ] Prisma migration reviewed.
- [ ] Docs updated.
- [ ] Changelog updated.
- [ ] Privacy impact reviewed if personal data behavior changed.
- [ ] No secrets committed.
- [ ] Patient public view does not expose private data.
- [ ] Manual booking tested.
- [ ] Cancellation tested.
- [ ] Export tested.
- [ ] Working hours tested.
- [ ] Double-booking tested.

## 19. Free-stack deploy checklist (single doctor)

This is the end-to-end path to run MedSlot for **one doctor at zero cost**:
Neon Free (EU/Frankfurt) + Gmail SMTP + Vercel Hobby. Vercel Hobby is for
**non-commercial** use — move to Vercel Pro once the clinic charges money through
the deployment.

### 19.0 What you'll need

- **Node.js 20+** and **pnpm** (`corepack enable pnpm`).
- **Docker** (optional, for the local Postgres used by the tests — see
  `docker-compose.yml`).
- Accounts: **GitHub** (code), **Neon** (database), **Vercel** (hosting), and a
  **Gmail** account if you want confirmation/cancellation emails.
- The two secrets generated in 19.1.

### 19.1 Prepare secrets (local)

Generate two strong secrets and pick a strong admin password:

```bash
openssl rand -base64 32   # use for AUTH_SECRET
openssl rand -base64 32   # use for CANCEL_TOKEN_SECRET
```

### 19.2 Create the database (Neon, free)

1. Create a Neon account and a new project in the **EU (Frankfurt)** region
   (GDPR/RODO + lower latency for PL/EU patients).
2. Copy two connection strings from the Neon dashboard:
   - **Pooled** (host contains `-pooler`) → this is `DATABASE_URL`.
   - **Direct** (no `-pooler`) → this is `DIRECT_URL`.

### 19.3 Create the Gmail App Password (free email)

1. Enable **2-Step Verification** on the Google account.
2. Create an **App Password** (16 characters). Use it as `SMTP_PASSWORD`
   (remove spaces). `SMTP_USER` and `EMAIL_FROM` are the full Gmail address.
   Leave `EMAIL_PROVIDER=log` if you don't want to send patient emails yet.

### 19.4 Verify locally, then push to GitHub

First make sure the project is green (the pre-commit hook runs these anyway):

```bash
pnpm install            # also installs the Husky pre-commit hook (prepare script)
docker compose up -d    # start local Postgres so the integration tests run
pnpm verify             # lint + typecheck + unit & integration tests
```

Create an **empty** repository on GitHub (no README/.gitignore) via the website,
or with the GitHub CLI:

```bash
gh repo create <you>/<repo> --private --source=. --remote=origin
```

Then commit and push:

```bash
git init                      # if not already a repo
git add .
git commit -m "chore: initial MedSlot deploy"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git   # skip if gh already added it
git push -u origin main
```

The first commit triggers the pre-commit hook (lint-staged + typecheck + tests).
Integration tests skip automatically if Postgres is not running; start it with
`docker compose up -d` to include them.

### 19.5 Run migrations + seed against the production DB (once)

From your machine, with the **production** values exported (do NOT commit them):

```bash
DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" pnpm prisma migrate deploy
DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" \
  CLINIC_NAME="..." CLINIC_SLUG="..." CLINIC_TIMEZONE="Europe/Warsaw" \
  DOCTOR_DISPLAY_NAME="..." DOCTOR_EMAIL="..." \
  ADMIN_EMAIL="..." ADMIN_PASSWORD="..." pnpm db:seed
```

The seed is idempotent, so it is safe to re-run.

### 19.6 Import the project into Vercel

1. New Project → import the GitHub repo → framework **Next.js** (auto-detected).
2. Add the environment variables from section 15 (set `EMAIL_PROVIDER=smtp` only
   when you want real emails). Set `NEXT_PUBLIC_APP_URL` to the Vercel-assigned
   URL for the first deploy.
3. Deploy. `prisma generate` runs automatically via the `postinstall` script.

### 19.7 Finalize the public URL

After the first successful deploy, set `NEXT_PUBLIC_APP_URL` to the **final**
domain (Vercel domain or your custom domain) and redeploy, so cancellation links
point at the right host.

### 19.8 Smoke test

- [ ] Open `/<locale>` and create a public booking.
- [ ] Confirm the booking appears in `/<locale>/admin` after sign-in.
- [ ] Open the cancellation link and cancel; confirm status changes (not deleted).
- [ ] If `EMAIL_PROVIDER=smtp`: confirm confirmation + cancellation emails arrive.

