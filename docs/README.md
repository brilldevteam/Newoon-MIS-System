# Newoon KYC & Engagement Workflow Management System

## Current Developer Entry Point

Read [Developer Handover](DEVELOPER_HANDOVER.md) and [Repository Instructions](../AGENTS.md) first. They cover current architecture, safe setup, deployment, document QA, and known limitations.

The Step 1 description below is historical and does not describe the current implemented application. Its migration/seed instructions are not production deployment instructions. The seed script resets passwords for existing seeded accounts; never run it casually on a shared database.

## Historical Step 1 Reference

This repository contains the Step 1 SaaS-ready foundation for Newoon's KYC and engagement workflow platform.

## Scope

- Multi-tenant database foundation.
- JWT authentication and role-based authorization structure.
- Tenant module enablement structure.
- Placeholder frontend pages for future business workflows.
- Upload-ready backend structure for future document management.

Full KYC workflow automation is intentionally not implemented in Step 1.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

3. Update `DATABASE_URL` and `JWT_SECRET`.

4. Run Prisma migration:

```bash
npm run prisma:migrate -w backend
```

5. Seed roles, modules, default tenant, and super admin:

```bash
npm run seed -w backend
```

6. Run backend:

```bash
npm run start:dev -w backend
```

7. Run frontend:

```bash
npm run dev -w frontend
```

## Default Seed Login

- Email: `admin@newoon.com`
- Password: `Admin@12345`

Change this credential before any shared or deployed environment.
