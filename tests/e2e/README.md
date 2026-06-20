# E2E Tests

Reactive Resume uses Playwright for PR-gated browser coverage of deterministic core flows.

## Local setup

Start PostgreSQL:

`sudo docker compose -f compose.dev.yml up -d postgres`

Build the production app:

`APP_URL=http://localhost:3000 PORT=3000 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres AUTH_SECRET=3f95d9f2687e4d1f9571a7adf0b2e89a7cc98f5b1fb72ad8c9d4b67a42fdf613 ENCRYPTION_SECRET=2f724ef46009b17ea8c5f88e9ea28fd93d12529e7ff71731a8d2875566551d91 FLAG_DISABLE_SIGNUPS=false FLAG_DISABLE_EMAIL_AUTH=false FLAG_DISABLE_API_RATE_LIMIT=true LOCAL_STORAGE_PATH=/workspace/data/e2e pnpm db:migrate`

`APP_URL=http://localhost:3000 PORT=3000 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres AUTH_SECRET=3f95d9f2687e4d1f9571a7adf0b2e89a7cc98f5b1fb72ad8c9d4b67a42fdf613 ENCRYPTION_SECRET=2f724ef46009b17ea8c5f88e9ea28fd93d12529e7ff71731a8d2875566551d91 FLAG_DISABLE_SIGNUPS=false FLAG_DISABLE_EMAIL_AUTH=false FLAG_DISABLE_API_RATE_LIMIT=true LOCAL_STORAGE_PATH=/workspace/data/e2e pnpm build`

Run tests:

`APP_URL=http://localhost:3000 PORT=3000 DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres AUTH_SECRET=3f95d9f2687e4d1f9571a7adf0b2e89a7cc98f5b1fb72ad8c9d4b67a42fdf613 ENCRYPTION_SECRET=2f724ef46009b17ea8c5f88e9ea28fd93d12529e7ff71731a8d2875566551d91 FLAG_DISABLE_SIGNUPS=false FLAG_DISABLE_EMAIL_AUTH=false FLAG_DISABLE_API_RATE_LIMIT=true LOCAL_STORAGE_PATH=/workspace/data/e2e pnpm test:e2e`

## Coverage

- Email/password auth smoke.
- Dashboard sample resume creation.
- Builder basics edit and autosave persistence.
- JSON export/import.
- Public sharing for anonymous visitors.

PDF, DOCX, OAuth, passkeys, 2FA, password reset, and AI flows are intentionally outside the initial PR gate.
