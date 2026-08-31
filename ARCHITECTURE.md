# ARCHITECTURE

## Requested stack
- `enterprise` (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL)

## Scaffolding status
- **Newly scaffolded** — the project directory contained only `.git`, `.github`, and a stub `README.md` before this run. The full `template-enterprise` template was copied into the project root.

## Layout
- `frontend/` — Angular 19 standalone-component SPA (Angular CLI project name: `frontend`). Build output: `dist/frontend/browser`.
- `backend/` — NestJS API with a tRPC router (`/trpc/*`) and a REST health endpoint (`GET /health`). Prisma ORM against PostgreSQL.
- `.pipeline/surface.json` — machine-readable manifest of routes, components, and `data-testid` values generated from the template's source files. Keep it in sync as routes/components are added.
- `.colossus-acceptance.json` — post-deploy render-gate contract (`ready_testid: app-ready`); `expect_text` is intentionally empty and must be filled in by the coder once the real front page content (PinBoard wall) is built.
- `colossus.yaml` — build manifest read by deploy agents (framework, output dir, ports). Do not delete.

## Next steps for the developer
1. Implement the PinBoard `Pin` CRUD feature per the plan on top of this scaffold: Prisma schema/migration, `PinsModule` (REST controller/service/DTOs), Angular wall/detail/dialog components, replacing the template's default `users` sample where appropriate.
2. Copy env templates if/when added (`.env.template` → `.env`, `backend/.env.template` → `backend/.env`) — this template variant ships without `.env.template` files, so create `backend/.env` manually with `DATABASE_URL`, `PORT`, etc. before running the backend.
3. Run `npm install` in both `frontend/` and `backend/`.
4. Run `npx prisma migrate dev` (backend) once `DATABASE_URL` points at a running PostgreSQL instance.
5. Update `.pipeline/surface.json` and `.colossus-acceptance.json` (`expect_text`) as real routes/components/testids are added, so downstream test generation stays accurate.
6. Run `docker-compose up` for local full-stack verification once the Dockerfile/entrypoint are finalized per the plan.

## Template source
- `template-enterprise` from the scaffold template library.
