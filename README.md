# IIST Career Development & Placement Management Portal

Next.js (App Router) + TypeScript, Prisma + PostgreSQL, Auth.js, Tailwind + shadcn/ui.

> **Read [ARCHITECTURE.md](./ARCHITECTURE.md) before adding a feature.**
> It records the binding decisions — most importantly that **mutations use REST
> route handlers under `app/api/**` with TanStack Query, not Server Actions**
> (Phase 3.5 override), that every API handler must call its own permission
> guard, and that all file access goes through the storage adapter.

See [SETUP.md](./SETUP.md) for environment and database setup.

## Getting started

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy # build the schema
npm run db:seed           # demo accounts (all passwords: Password@123)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest unit/component tests |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |

Verification scripts (require a running database, and for the HTTP one a running
dev server) are listed at the bottom of [ARCHITECTURE.md](./ARCHITECTURE.md).

## Roles

Student, T&P Admin, Faculty, HOD, Company Rep — permissions are defined in
`lib/rbac/index.ts` and enforced per route handler.
