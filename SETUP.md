# IIST Placement Portal — Local Dev Setup

## Prerequisites
- Node.js 18+
- Docker Desktop (for managed Postgres + MinIO), OR a local PostgreSQL 15+ install

## Option A: Docker (recommended)

```bash
# Start Postgres + MinIO
docker-compose up -d postgres minio

# Generate Prisma client & run migrations
npm run db:migrate        # creates tables + runs prisma/seed.ts automatically

# Start dev server
npm run dev
```

## Option B: Local PostgreSQL (no Docker)

1. Create a database manually:
```sql
CREATE USER iist_user WITH PASSWORD 'iist_pass';
CREATE DATABASE iist_career_db OWNER iist_user;
GRANT ALL PRIVILEGES ON DATABASE iist_career_db TO iist_user;
```

2. Run migrations and seed:
```bash
npm run db:migrate   # or: npm run db:push  (skips migration history)
npm run db:seed
npm run dev
```

## Demo Credentials (all passwords: `Password@123`)

| Role            | Login ID                  |
|-----------------|---------------------------|
| TP Admin        | tpadmin@iist.ac.in        |
| Faculty         | faculty@iist.ac.in        |
| Head of Dept    | hod@iist.ac.in            |
| Company Rep     | recruiter@isro.gov.in     |
| Student (done)  | IIST2021CS01              |
| Student (new)   | IIST2024AE01              |

## Available Scripts

| Script              | Description                          |
|---------------------|--------------------------------------|
| `npm run dev`       | Start development server             |
| `npm run build`     | Production build                     |
| `npm run db:migrate`| Run Prisma migrations + seed         |
| `npm run db:push`   | Push schema without migrations       |
| `npm run db:seed`   | Seed demo data only                  |
| `npm run db:studio` | Open Prisma Studio (DB GUI)          |
| `npm test`          | Run Vitest unit tests                |
