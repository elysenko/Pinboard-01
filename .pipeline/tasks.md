# Pipeline Task Decomposition

## Summary
PinBoard is a sticky-note wall: a NestJS + Prisma/Postgres backend exposing REST CRUD for a single `Pin` entity (`id`, `title` ≤120 chars, `body` ≤2000 chars defaulting to `""`, `createdAt`, `updatedAt`), paired with an Angular 17 standalone-component SPA that renders the pins newest-first in a CSS grid, with query-param-addressable create/edit/delete dialogs, a deep-linkable pin detail route, and a not-found state. The existing scaffold (NestJS 11 + Prisma 7 + Angular 17, `backend/` + `frontend/`) is reused. Per the pipeline auth model the app is `full_auth`: a `User`/`UserRole` model, login/signup/logout flows, and a protected `/admin` section (including `/admin/settings` for the provisioned `postgresql` and `minio` services) are layered on top of the spec's feature set, while the public pin wall stays readable without a login prompt so the spec's smoke markers still pass.

## Surface contract

**Backend REST routes** (global prefix `/api`, global `ValidationPipe` with `whitelist`/`forbidNonWhitelisted`/`transform`)
- `GET    /api/pins` — all pins ordered `createdAt DESC, id DESC` (public)
- `GET    /api/pins/:id` — single pin, 404 when missing (public)
- `POST   /api/pins` — 201, body `CreatePinDto` (public per spec acceptance)
- `PATCH  /api/pins/:id` — 200, body `UpdatePinDto`, 404 when missing
- `DELETE /api/pins/:id` — 204, 404 when missing
- `GET    /api/health` → `{ status: 'ok' }`
- `GET    /api/health/deep` → `{ status: 'ok', db: 'up' }` or 503
- `POST   /api/auth/signup` — first user becomes `ADMIN`, subsequent users `USER`
- `POST   /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET    /api/admin/settings` — admin-only; service keys with masked values + configured status
- `PATCH  /api/admin/settings` — admin-only; upsert key/value pairs

**Frontend routes**
- `''` → redirect to `wall`
- `/wall` → `WallComponent`, `data: { flow: 'wall' }`; reads `?modal=new|edit|delete` and `?pinId=<id>`
- `/pins/:id` → `PinDetailComponent`, `data: { flow: 'pin-detail' }`
- `/login` → `LoginComponent`
- `/signup` → `SignupComponent`
- `/admin/settings` → `AdminSettingsComponent` (admin role only)
- `'**'` → `NotFoundComponent`, `data: { flow: 'not-found' }`

**Entities**
- `Pin { id String @id @default(uuid()), title String @db.VarChar(120), body String @default("") @db.VarChar(2000), createdAt DateTime @default(now()), updatedAt DateTime @updatedAt, @@index([createdAt]) }`
- `User { id, email @unique, name?, passwordHash, role UserRole @default(USER), createdAt, updatedAt }`
- `enum UserRole { ADMIN USER }`
- `SystemSetting { key String @id, value String, updatedAt DateTime @updatedAt }`

**Smoke markers**
- `curl -s localhost:3000 | grep PinBoard` (literal `PinBoard` in the app shell `<h1>` and `<title>`)
- The wall shows all three seeded pins with bodies, newest-first: "Q3 Roadmap Draft", "Migration Checklist", "Rooftop Garden Plan".

## db_agent tasks
- [ ] Add the `Pin` model to `backend/prisma/schema.prisma` exactly as specified: `id String @id @default(uuid())`, `title String @db.VarChar(120)`, `body String @default("") @db.VarChar(2000)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `@@index([createdAt])`.
- [ ] Rename the scaffold's `Role` enum to `UserRole { ADMIN USER }` and update `User.role` to `UserRole @default(USER)`; add a `passwordHash String` field to `User` and update any scaffold references to `Role`.
- [ ] Add the `SystemSetting` model (`key String @id`, `value String`, `updatedAt DateTime @updatedAt`) for admin-configurable `postgresql` and `minio` credentials.
- [ ] Generate the initial migration into `backend/prisma/migrations/` covering `Pin`, `User`/`UserRole`, and `SystemSetting`; run `prisma generate`.
- [ ] Rewrite `backend/prisma/seed.ts` to idempotently `upsert` exactly three pins with fixed UUIDs and explicit staggered `createdAt` (oldest → newest: "Rooftop Garden Plan", "Migration Checklist", "Q3 Roadmap Draft"), each with a one-sentence `body`.
- [ ] Extend the seed to upsert a single admin `User` (fixed UUID, hashed password, `role: ADMIN`) so admin login works without a signup step.
- [ ] Keep the compiled seed entrypoint in sync (`backend/prisma/seed/seed.js` + the `prisma.seed` hook in `backend/package.json`) so the container entrypoint can seed without `ts-node`.

## backend_agent tasks
- [ ] Create `backend/src/pins/dto/create-pin.dto.ts`: `title` with `@Transform(({value}) => typeof value === 'string' ? value.trim() : value)`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(120)`; `body` with `@IsOptional()`, `@IsString()`, `@MaxLength(2000)`, default `''`. Create `update-pin.dto.ts` as `PartialType(CreatePinDto)`.
- [ ] Create `backend/src/pins/pins.service.ts` with `findAll()` (`orderBy: [{createdAt:'desc'},{id:'desc'}]`), `findOne(id)` (throw `NotFoundException` on null), `create(dto)`, `update(id, dto)` and `remove(id)` (catch Prisma `P2025` → `NotFoundException`).
- [ ] Create `backend/src/pins/pins.controller.ts` (`@Controller('pins')`) with `GET /`, `GET /:id`, `POST /` (`@HttpCode(201)`), `PATCH /:id`, `DELETE /:id` (`@HttpCode(204)`), plus `pins.module.ts` wiring `PrismaModule`.
- [ ] Update `backend/src/main.ts`: `app.setGlobalPrefix('api')`, `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`, `app.enableCors()` when `NODE_ENV !== 'production'`, `app.listen(process.env.PORT ?? 3000, '0.0.0.0')`.
- [ ] Update `backend/src/app.module.ts` to register `ConfigModule`, `PrismaModule`, `PinsModule`, `HealthModule`, `AuthModule`, `AdminModule`, and `ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', '..', 'public'), exclude: ['/api*'], serveStaticOptions: { fallthrough: true } })` so SPA deep links fall back to `index.html`.
- [ ] Extend `backend/src/health/health.controller.ts`: `GET /api/health` → `{status:'ok'}`; `GET /api/health/deep` → `PrismaService.$queryRaw\`SELECT 1\`` → `{status:'ok', db:'up'}` or 503.
- [ ] Create `backend/src/auth/` (module, service, controller): `POST /api/auth/signup` (first user gets `ADMIN`, subsequent get `USER`; bcrypt hash), `POST /api/auth/login` (JWT via `@nestjs/jwt`), `POST /api/auth/logout`, `GET /api/auth/me`.
- [ ] Create `backend/src/auth/jwt-auth.guard.ts` and `backend/src/auth/roles.guard.ts` + `@Roles()` decorator; apply the admin guard to every `/api/admin/*` controller. Leave `/api/pins` and `/api/health` unguarded per the spec's public-wall acceptance criteria.
- [ ] Create `backend/src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — read `process.env[key]` first; if absent or equal to `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, read the matching `SystemSetting` row; return `null` when neither is set. Export `ServiceUnconfiguredError` mapping to a 503.
- [ ] Create `backend/src/admin/settings.controller.ts` + module: `GET /api/admin/settings` listing the `postgresql` and `minio` credential keys with masked values and a `configured` boolean, and `PATCH /api/admin/settings` upserting key/value pairs into `SystemSetting` — both admin-role-guarded.
- [ ] Reconcile `backend/package.json` dependencies with the spec's pinned versions (`@nestjs/*`, `express@^4`, `@prisma/client`/`prisma`, `class-validator`, `class-transformer`) and remove the unused tRPC scaffold (`src/trpc/`, `src/users/users.router.ts`, `frontend/src/app/trpc-client.types.ts`) so the REST surface is the only API.
- [ ] Create/update the deployment files: root `Dockerfile` (Angular build → Nest build → slim runtime copying `frontend/dist/pinboard/browser` to `./public`), `docker-entrypoint.sh` (`prisma migrate deploy` → compiled seed → `node dist/src/main.js`), `.dockerignore`, `.env.example` (`DATABASE_URL`, `PORT`, `NODE_ENV`, minio keys), and `docker-compose.yml` (`postgres:16-alpine` with healthcheck + named volume, app service).
- [ ] Replace the `README.md` stub: PinBoard name, `docker compose up` quickstart, two-terminal local dev with `proxy.conf.json`, env-var table, and the endpoint table from the surface contract.

## ui_agent tasks
- [ ] Update `frontend/src/index.html` (`<title>PinBoard</title>`) and `frontend/src/app/app.component.ts|.html|.css`: shell header rendering the literal text `PinBoard` in an `<h1>` plus `<router-outlet>` and a nav that shows the admin link only for `ADMIN` users.
- [ ] Rewrite `frontend/src/app/app.routes.ts` with `''` → `wall`, `wall`, `pins/:id`, `login`, `signup`, `admin/settings`, and `**` → not-found, each carrying its `data: { flow: ... }`; ensure `app.config.ts` uses `provideRouter(routes, withComponentInputBinding())` and `provideHttpClient()`.
- [ ] Create `frontend/src/app/features/wall/wall.component.ts|.html|.css` — CSS-grid sticky-note cards showing `title` and `body` newest-first, a "New pin" button linking to `?modal=new`, per-card Edit (`?modal=edit&pinId=`) / Delete (`?modal=delete&pinId=`) actions, a title link to `/pins/:id`, plus loading, empty and error states.
- [ ] Create `frontend/src/app/features/wall/pin-form-dialog.component.ts|.html` — reactive form with `title` (`required`, `maxLength(120)`) and `body` (`maxLength(2000)`), live character counters, inline messages mirroring server validation, submit disabled while invalid, create + edit modes, and navigation back to `/wall` with query params cleared on success/cancel.
- [ ] Create `frontend/src/app/features/wall/confirm-delete-dialog.component.ts|.html` — confirm/cancel for `?modal=delete&pinId=`, returning to `/wall` afterwards.
- [ ] Create `frontend/src/app/features/pin-detail/pin-detail.component.ts|.html` — fetch by route `:id`, render title/body/timestamps, and render a "Pin not found" state with a link back to the wall on a 404.
- [ ] Create `frontend/src/app/features/not-found/not-found.component.ts|.html` for the `**` route.
- [ ] Create `frontend/src/app/features/auth/login.component.ts|.html` and `signup.component.ts|.html` — email/password reactive forms with inline error display, redirecting to `/wall` on success.
- [ ] Create `frontend/src/app/features/admin/admin-settings.component.ts|.html` at `/admin/settings` — one section per provisioned service (`postgresql`, `minio`) with a configured/unconfigured badge and a per-service credential form; show a prominent banner "The following need credentials to activate: …" listing any service reported unconfigured by `GET /api/admin/settings`. No third-party integrations are declared, so no integration fields.
- [ ] Add shared styling in `frontend/src/styles.css` (grid, sticky-note card, dialog backdrop, badge, banner) and remove the scaffold `home/home.component.ts` once `wall` replaces it.

## service_agent tasks
- [ ] Create `frontend/src/app/core/pin.model.ts` — `Pin` interface plus `CreatePinDto` and `UpdatePinDto` types matching the backend DTOs.
- [ ] Create `frontend/src/app/core/pins.service.ts` — injectable with a `signal<Pin[]>` store and `load()`, `get(id)`, `create(dto)`, `update(id, dto)`, `remove(id)` against `/api/pins`; mutations re-sort locally newest-first so a created pin appears at the top immediately, then refresh from the server.
- [ ] Add typed error surfacing to `pins.service.ts`: map 400 responses to per-field messages for the form dialog and 404s to the detail component's not-found state.
- [ ] Create `frontend/src/app/core/auth.service.ts` — signal-backed current-user store with `login()`, `signup()`, `logout()`, `me()` against `/api/auth/*`, plus an `isAdmin` computed signal for nav/guard use.
- [ ] Create `frontend/src/app/core/auth.interceptor.ts` (attach the token, redirect to `/login` on 401) and an `adminGuard` `CanActivateFn` protecting `/admin/settings`; register both in `app.config.ts`.
- [ ] Create `frontend/src/app/core/settings.service.ts` — `list()` and `save(entries)` against `/api/admin/settings`, returning masked values and `configured` flags for the admin settings page.
- [ ] Verify `frontend/proxy.conf.json` proxies `/api` to `http://localhost:3000` for local dev.

## tester tasks
- [ ] `backend/src/pins/pins.service.spec.ts` — unit tests: `findAll()` orders by `createdAt DESC` then `id DESC`; `findOne()` and `remove()` on a missing id throw `NotFoundException` (Prisma `P2025` mapped).
- [ ] `backend/test/pins.e2e-spec.ts` (supertest) — `GET /api/pins` returns the 3 seeded titles newest-first; `POST` with `{title:''}` → 400 with no row created; `POST` with a 121-char title → 400; a valid `POST` → 201 and appears first in the next `GET`.
- [ ] `backend/test/pins.e2e-spec.ts` (continued) — `PATCH /api/pins/:id` changes the stored text; `DELETE /api/pins/:id` → 204 and a follow-up `GET /api/pins/:id` → 404; whitespace-only titles are rejected as empty.
- [ ] `backend/test/health.e2e-spec.ts` — `GET /api/health` → 200 `{status:'ok'}`; `GET /api/health/deep` → 200 with the DB up (and document the 503 path with the DB stopped).
- [ ] `backend/test/auth.e2e-spec.ts` — first signup receives `ADMIN`, a second signup receives `USER`; login returns a token; `GET /api/admin/settings` is 401/403 without an admin token and 200 with one.
- [ ] `frontend/src/app/app.component.spec.ts` — asserts the shell renders the string `PinBoard`.
- [ ] `frontend/src/app/features/wall/wall.component.spec.ts` — with a stubbed `PinsService`, asserts the wall renders the three seeded titles with bodies in newest-first order, plus the empty and error states.
- [ ] Routing checks — hard-reload `/wall?modal=new`, `/wall?modal=edit&pinId=<seed-id>`, and `/pins/<seed-id>` each restore their state; `/pins/<deleted-id>` renders not-found.
- [ ] Build + marker verification — `ng build` succeeds, `nest build` succeeds, and after `docker compose up` `curl -s localhost:3000 | grep PinBoard` matches and the wall shows all three seeded pins.

## Open questions
- **Auth conflict.** The spec explicitly states "No auth layer at all" (no login/signup routes, no guards, no user table), but the pipeline auth model for this run is `full_auth` (roles: admin, user). These tasks apply the pipeline model — `User`/`UserRole`, signup/login/logout, protected `/admin` — while deliberately leaving `GET/POST/PATCH/DELETE /api/pins` public so the spec's acceptance markers ("wall renders with no authentication prompt", public-CRUD e2e tests) still pass. Confirm whether pin mutations should instead require a logged-in user, which would require rewriting the e2e suite.
- **Object storage (`minio`) is provisioned but unused.** The spec describes no file/image upload for pins. Its credentials are only surfaced in `/admin/settings`; confirm whether pin attachments are intended.
- **API style mismatch with the scaffold.** The scaffold ships a tRPC router (`src/trpc/`, `users.router.ts`, `frontend/src/app/trpc-client.types.ts`) and Nest 11 / Prisma 7, while the spec specifies plain REST controllers and Nest 10 / Prisma 5. These tasks keep REST per the spec and remove the tRPC layer; confirm the version pins to use (the risk section calls for `@nestjs/*@^10` + `express@^4` to keep `ServeStaticModule` `exclude: ['/api*']` working).
- **Docker topology.** The scaffold has separate `backend/Dockerfile` and `frontend/Dockerfile` (nginx), while the spec calls for one root multi-stage image serving the SPA from Nest's `./public`. These tasks follow the spec; confirm the Colossus build target path.
- **Integrations.** `<spec_integrations>` arrived as a placeholder entry (`(none` / `NONE_API_KEY`) matching the spec's "Integrations: (none)". No integration client modules are generated. Confirm there are genuinely no third-party APIs.
- **Seed vs. public delete.** Any visitor can delete the seeded pins, breaking acceptance markers on a live instance. Re-seeding restores them; confirm no rate limiting or soft-delete is expected.
