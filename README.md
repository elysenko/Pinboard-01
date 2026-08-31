# PinBoard

A public sticky-note wall. Anyone can read the board and add, edit or remove a pin —
there is no sign-in step in front of the wall.

- **Backend** — NestJS 11 REST API, Prisma 6, PostgreSQL (`backend/`)
- **Frontend** — Angular standalone-component SPA (`frontend/`)

## Quickstart

```bash
docker compose up -d postgres          # Postgres 16 on :5432

cd backend
cp .env.example .env                   # then set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy
node prisma/seed/seed.js               # three demo pins + an admin account
npm run start:dev                      # API on http://localhost:3001/api
```

In a second terminal:

```bash
cd frontend
npm install
npx ng serve                           # http://localhost:4200
```

`frontend/proxy.conf.json` forwards `/api` to `http://localhost:3001`, so the SPA and
the API are same-origin during development.

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string. Boot fails without it. |
| `JWT_SECRET` | **yes** | — | Signing key for access tokens. Boot fails without it. |
| `PORT` | no | `3001` | HTTP listen port. |
| `NODE_ENV` | no | — | `production` in deployed environments. |
| `JWT_EXPIRES_IN` | no | `1d` | Access-token lifetime (`ms` duration string). |
| `FRONTEND_URL` | no | reflect origin | Pins CORS to a single origin. |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | no | — | Object storage. Optional; a missing value degrades that feature with a 503 instead of blocking startup. |

Optional credentials can also be supplied at runtime through the admin settings screen;
`ConfigResolver` reads `process.env` first and falls back to the `SystemSetting` table.

## API

All routes are prefixed with `/api`. Swagger UI: `/api/docs`.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/pins` | public | Every pin, `createdAt DESC` with `id DESC` as tiebreaker. |
| `GET` | `/api/pins/:id` | public | `404` when absent. |
| `POST` | `/api/pins` | public | `201`. `title` ≤ 120 (trimmed, non-empty), `body` ≤ 2000, defaults to `""`. |
| `PATCH` | `/api/pins/:id` | public | `200`. Every field optional; omitted fields are untouched. |
| `DELETE` | `/api/pins/:id` | public | `204`, empty body. `404` when absent. |
| `GET` | `/api/health` | public | Liveness — `{ "status": "ok" }`, no I/O. |
| `GET` | `/api/health/deep` | public | Readiness — round-trips to Postgres, `503` when down. |
| `POST` | `/api/auth/signup` | public | `201`. The first account on an instance becomes `ADMIN`. |
| `POST` | `/api/auth/login` | public | `200` with a bearer token. |
| `POST` | `/api/auth/logout` | bearer | Stateless; instructs the client to discard its token. |
| `GET` | `/api/auth/me` | bearer | The signed-in user. |
| `GET` | `/api/admin/settings` | `ADMIN` | Provisioned services with masked values and a `configured` flag. |
| `PATCH` | `/api/admin/settings` | `ADMIN` | Upserts credential values. Idempotent; unknown keys are rejected. |

### Why the pin routes are public

The product spec requires the wall to render and accept edits with no authentication
prompt, so `PinsController` is marked `@Public()`. Authentication is still enforced by
default everywhere else: `JwtAuthGuard` and `RolesGuard` are registered as global
guards, so a new route is protected unless it opts out explicitly.

One consequence worth knowing: any visitor can delete the demo pins. The seed is
idempotent and runs on every container start, so a restart restores them.

## Tests

```bash
cd backend
npm test              # unit
npm run test:e2e      # HTTP-level, needs a database
npx tsc --noEmit -p tsconfig.build.json
```

## Deployment

`backend/Dockerfile` builds the API image. Its entrypoint runs
`prisma migrate deploy`, re-seeds, then starts the server on `PORT` (default `3001`).
The SPA is built and served separately by nginx — see `colossus.yaml`.
