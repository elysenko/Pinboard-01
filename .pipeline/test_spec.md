# Test Specification

> **WARNING — `surface.json` is stale and was NOT used as the endpoint source of truth.**
> `.pipeline/surface.json` still contains the untouched scaffold surface (`GET /health`,
> `GET /trpc/users.findAll`, `GET /trpc/users.findById`, components `app-root`/`app-home`).
> None of those routes exist in the PinBoard spec, and `tasks.md` explicitly instructs the
> backend agent to **delete** the tRPC layer (`src/trpc/`, `src/users/users.router.ts`,
> `frontend/src/app/trpc-client.types.ts`). The API surface below is therefore derived from
> `<spec>` Steps 6–8 and the "Surface contract" section of `.pipeline/tasks.md`.
> The three stale routes are still covered — as **negative/regression** cases asserting they
> are gone (see `## API tests → Removed scaffold surface`).
>
> **Second warning — auth conflict.** The spec states "No auth layer at all"; `tasks.md`
> layers a `full_auth` model (User/UserRole, login/signup, guarded `/admin`) on top. Sections
> marked **[CONDITIONAL: full_auth]** are required only if the auth layer is actually built.
> If it is not built, those cases are skipped, but `API-PUB-01` (pins routes reachable with no
> credentials) is **mandatory either way** — it is a spec acceptance marker.
>
> **Fixture notation.** Seeded pins use fixed UUIDs (spec Step 3). Tests must read them from
> the seed module rather than hardcoding; this document refers to them as
> `<seed:rooftop>` (oldest), `<seed:migration>`, `<seed:q3>` (newest). Expected newest-first
> display order is therefore: **Q3 Roadmap Draft, Migration Checklist, Rooftop Garden Plan**.

## Coverage summary
- Total cases: 110
- API endpoints covered: 14 / 3 in surface.json (all 3 stale entries covered as removal-regression cases; the 14 are the real spec surface — 8 spec-mandated, 6 conditional-auth)
- User journeys covered: 11

## API tests

### `GET /api/pins`
- **Happy path**: `GET /api/pins` on a freshly seeded DB → `200`, JSON array of exactly 3 objects; `titles == ["Q3 Roadmap Draft","Migration Checklist","Rooftop Garden Plan"]` in that order; each `body` is a non-empty one-sentence string. (API-PINS-01)
- **Happy path**: every element has exactly the keys `id, title, body, createdAt, updatedAt` — no extra keys, no `passwordHash`-style leakage; `id` is a v4-shaped UUID string; `createdAt`/`updatedAt` are ISO-8601 strings parseable by `Date`. (API-PINS-02)
- **Idempotency / edge cases**: `POST` a pin titled `"Newest Pin"`, then `GET /api/pins` → `200`, length 4, `body[0].title === "Newest Pin"` (proves `createdAt DESC`). (API-PINS-03)
- **Idempotency / edge cases**: insert two rows directly with an **identical** `createdAt`; `GET` → the row with the lexicographically greater `id` sorts first (proves the `id DESC` tiebreaker is deterministic, not incidental). (API-PINS-04)
- **Idempotency / edge cases**: with all rows deleted → `200` and `[]` (not `404`, not `null`). (API-PINS-05)
- **Auth failures**: n/a — endpoint is public by spec.

### `GET /api/pins/:id`
- **Happy path**: `GET /api/pins/<seed:q3>` → `200`, `{ id: "<seed:q3>", title: "Q3 Roadmap Draft", body: <seeded sentence>, createdAt, updatedAt }`. (API-PIN-01)
- **Validation failures**: `GET /api/pins/00000000-0000-4000-8000-000000000000` (well-formed, absent) → `404` with body `{ statusCode: 404, message: <string>, error: "Not Found" }`. (API-PIN-02)
- **Validation failures**: `GET /api/pins/not-a-uuid` → `404` (**must not be `500`** — a raw Prisma error escaping as 500 is a failure; `id` is a plain `String` column so a lookup miss is the correct outcome). (API-PIN-03)
- **Idempotency / edge cases**: `DELETE /api/pins/<seed:rooftop>` then `GET /api/pins/<seed:rooftop>` → `404` (this is the delete-then-fetch scenario the detail view surfaces). (API-PIN-04)

### `POST /api/pins`
- **Happy path**: `{"title":"Sprint Retro","body":"Notes from the retro."}` → `201`; response has a server-generated `id` not supplied by the client, `title === "Sprint Retro"`, `body === "Notes from the retro."`, `createdAt === updatedAt` on first write. (API-POST-01)
- **Happy path**: `{"title":"No body pin"}` (body omitted) → `201` and `body === ""` (empty string, **not** `null` / `undefined` / missing key). (API-POST-02)
- **Happy path**: `{"title":"   Trim me   "}` → `201` and stored `title === "Trim me"`; confirm via a follow-up `GET /api/pins/:id`. (API-POST-03)
- **Happy path (boundary)**: `title` of exactly 120 chars → `201`; `body` of exactly 2000 chars → `201`. Both persist at full length (proves `@db.VarChar` limits match the DTO limits and do not truncate). (API-POST-04)
- **Validation failures**: `{"title":""}` → `400`; and a subsequent `GET /api/pins` returns the **same count as before the request** (no orphan row). (API-POST-05)
- **Validation failures**: `{"title":"     "}` (whitespace only) → `400` — trim runs before `@IsNotEmpty`. (API-POST-06)
- **Validation failures**: `{}` / `{"body":"orphan body"}` (title missing) → `400`, message names the `title` field. (API-POST-07)
- **Validation failures**: `title` of exactly 121 chars → `400`, message mentions the 120 limit (must be a 400, **not** a 500 from a Postgres `varchar(120)` overflow). (API-POST-08)
- **Validation failures**: `body` of exactly 2001 chars → `400`, message mentions the 2000 limit; no 500. (API-POST-09)
- **Validation failures**: `{"title":12345}` (non-string) → `400`. (API-POST-10)
- **Validation failures**: `{"title":"ok","color":"red"}` → `400` (`forbidNonWhitelisted`), message names `color`. (API-POST-11)
- **Validation failures**: `{"title":"ok","id":"client-chosen","createdAt":"1999-01-01T00:00:00Z"}` → `400`; a client must not be able to set `id`/`createdAt`/`updatedAt`. (API-POST-12)

### `PATCH /api/pins/:id`
- **Happy path**: `PATCH /api/pins/<seed:migration>` with `{"title":"Migration Checklist v2"}` → `200`; response `title === "Migration Checklist v2"`, `body` **unchanged** from the seed value, `id` unchanged. (API-PATCH-01)
- **Happy path**: `{"body":"Rewritten body."}` → `200`; `title` unchanged. Change is durable — a fresh `GET /api/pins/:id` returns the new text. (API-PATCH-02)
- **Happy path**: after any successful PATCH, `updatedAt > createdAt` and `updatedAt` is strictly greater than the pre-PATCH `updatedAt`. (API-PATCH-03)
- **Happy path**: `{}` (empty patch) → `200` with the record unmodified (`PartialType` makes every field optional). (API-PATCH-04)
- **Happy path**: `{"title":"  Padded  "}` → stored `title === "Padded"` (trim transform applies to PATCH too). (API-PATCH-05)
- **Validation failures**: `{"title":""}` → `400`, record unchanged. (API-PATCH-06)
- **Validation failures**: `title` 121 chars → `400`; `body` 2001 chars → `400`. (API-PATCH-07)
- **Validation failures**: `{"nope":1}` → `400` (`forbidNonWhitelisted`). (API-PATCH-08)
- **Idempotency / edge cases**: `PATCH /api/pins/<absent-uuid>` → `404` (Prisma `P2025` mapped to `NotFoundException`, **not** a 500). (API-PATCH-09)

### `DELETE /api/pins/:id`
- **Happy path**: `DELETE /api/pins/<seed:rooftop>` → `204` with an **empty response body**; the subsequent `GET /api/pins` has length 2 and no longer contains `"Rooftop Garden Plan"`. (API-DEL-01)
- **Idempotency / edge cases**: repeating the same `DELETE` → `404` (delete is not silently idempotent; `P2025` maps to 404). (API-DEL-02)
- **Idempotency / edge cases**: `DELETE /api/pins/<never-existed-uuid>` → `404`, and `DELETE /api/pins/not-a-uuid` → `404` (never `500`). (API-DEL-03)

### `GET /api/health`
- **Happy path**: → `200`, body exactly `{ "status": "ok" }`. (API-HLTH-01)
- **Auth failures**: reachable with no credentials and no cookie, in both `NODE_ENV=development` and `production`. (API-HLTH-02)

### `GET /api/health/deep`
- **Happy path**: with Postgres reachable → `200`, body `{ "status": "ok", "db": "up" }`; assert `PrismaService.$queryRaw` was actually invoked (spy) so the endpoint is not a hardcoded literal. (API-HLTH-03)
- **Idempotency / edge cases**: with `$queryRaw` stubbed to reject (unit/integration) **and** with the Postgres container stopped (documented manual/compose check) → `503`, body does not claim `db: "up"`. (API-HLTH-04)

### `GET /` (static SPA served by `ServeStaticModule`)
- **Happy path**: `GET /` → `200`, `content-type: text/html`, body contains the literal string `PinBoard` (the smoke marker, present in both `<title>` and the shell `<h1>`). (API-SPA-01)
- **Happy path**: hard `GET /pins/<seed:q3>` and `GET /wall?modal=new` (Accept: text/html, no client router) → `200` and the same `index.html` shell, **not** `404` — proves SPA deep-link fallback. (API-SPA-02)
- **Validation failures**: `GET /api/does-not-exist` → `404` **as JSON**, and the body must **not** be `index.html` — proves `exclude: ['/api*']` works and the Express 4 / path-to-regexp risk in the spec did not regress. (API-SPA-03)

### Removed scaffold surface (regression — covers the three stale `surface.json` entries)
- **Validation failures**: `GET /trpc/users.findAll` → `404` (tRPC layer deleted per `tasks.md`). (API-GONE-01)
- **Validation failures**: `GET /trpc/users.findById` → `404`. (API-GONE-02)
- **Validation failures**: `GET /health` (unprefixed, the stale `surface.json` path) → `404`; the canonical path is `/api/health`. If the implementation instead keeps `/health` unprefixed via `setGlobalPrefix` exclusions, this case flips to expecting `200` — but `surface.json` must then be regenerated to match. (API-GONE-03)

### Public-access guarantee (mandatory regardless of auth model)
- **Auth failures**: with **no** `Authorization` header and no cookie jar, all five pin routes behave exactly as specified above — `GET /api/pins` `200`, `GET /api/pins/:id` `200`, `POST` `201`, `PATCH` `200`, `DELETE` `204`. No `401`/`403`, and no redirect to `/login`. This is the spec's "no authentication prompt" acceptance marker. (API-PUB-01)

### `POST /api/auth/signup` **[CONDITIONAL: full_auth]**
- **Happy path**: on an empty `User` table, `{"email":"admin@pinboard.test","password":"Passw0rd!","name":"Admin"}` → `201` with `role === "ADMIN"`. (API-AUTH-01)
- **Happy path**: a second signup `{"email":"user@pinboard.test",...}` → `201` with `role === "USER"`. (API-AUTH-02)
- **Validation failures**: signing up an already-registered email → `409` (or `400`), and no second row is created. (API-AUTH-03)
- **Validation failures**: `{"email":"not-an-email","password":"x"}` → `400` naming both fields. (API-AUTH-04)
- **Idempotency / edge cases**: no signup or login response, and no `/api/auth/me` response, ever contains `passwordHash` or a plaintext password. (API-AUTH-05)

### `POST /api/auth/login` **[CONDITIONAL: full_auth]**
- **Happy path**: correct credentials → `200` with a non-empty JWT and the user object. (API-AUTH-06)
- **Auth failures**: correct email + wrong password → `401`; the error message does not reveal whether the email exists. (API-AUTH-07)
- **Auth failures**: unknown email → `401`, same generic message as above. (API-AUTH-08)

### `GET /api/auth/me` **[CONDITIONAL: full_auth]**
- **Happy path**: with a valid token → `200`, the signed-in user's `id`/`email`/`role`. (API-AUTH-09)
- **Auth failures**: no token → `401`; malformed/expired token → `401`. (API-AUTH-10)

### `POST /api/auth/logout` **[CONDITIONAL: full_auth]**
- **Happy path**: with a valid token → `200`/`204`; the documented post-logout contract holds (either the token is rejected on the next `/api/auth/me`, or — for stateless JWT — the response instructs the client to clear it and the frontend test `J10-04` proves the client does). (API-AUTH-11)

### `GET /api/admin/settings` **[CONDITIONAL: full_auth]**
- **Happy path**: with an ADMIN token → `200`, an entry for each provisioned service key (`postgresql`, `minio`), each with `{ key, value: <masked>, configured: boolean }`. (API-ADM-01)
- **Auth failures**: no token → `401`. (API-ADM-02)
- **Auth failures**: a `USER`-role token → `403`. (API-ADM-03)
- **Idempotency / edge cases**: values are masked (e.g. `••••last4`) — the raw secret written via PATCH is never echoed back in any response. (API-ADM-04)

### `PATCH /api/admin/settings` **[CONDITIONAL: full_auth]**
- **Happy path**: ADMIN sets a `minio` credential → `200`; the following `GET /api/admin/settings` reports `configured: true` for that key while still masking the value. Re-sending the same PATCH is idempotent (upsert, no duplicate row). (API-ADM-05)
- **Auth failures**: `USER` token → `403`; no token → `401`; neither call mutates `SystemSetting`. (API-ADM-06)
- **Validation failures**: an unrecognised key or a non-string value → `400`; no partial write. (API-ADM-07)

## UI / journey tests

### Journey: View the wall (seeded pins, newest-first)
- **Steps**: navigate to `/` → expect a redirect to `/wall`.
- **Expected outcomes**: URL is `/wall`; the shell `<h1>` renders the literal `PinBoard` and `document.title` is `PinBoard`; the grid renders exactly 3 cards; card titles in DOM order are `Q3 Roadmap Draft`, `Migration Checklist`, `Rooftop Garden Plan`; each card also renders its non-empty body text. (J1-01)
- **Expected outcomes**: no login form, no "sign in" prompt, and no redirect to `/login` is rendered at any point on this journey — the wall is readable anonymously. (J1-02)
- **Expected outcomes**: each card exposes a title link to `/pins/:id`, an Edit control linking to `/wall?modal=edit&pinId=<id>`, and a Delete control linking to `/wall?modal=delete&pinId=<id>`; a "New pin" control links to `/wall?modal=new`. (J1-03)
- **Negative path**: with `PinsService.load()` stubbed to reject with a 500, the wall renders a visible error state (not a blank grid, not an unhandled console error) and offers a retry affordance. (J1-04)

### Journey: Create a pin
- **Steps**: from `/wall`, click "New pin" → URL becomes `/wall?modal=new` and the form dialog appears **while the wall list stays mounted behind it**; type `Sprint Retro` into title and `Notes from the retro.` into body; click Submit.
- **Expected outcomes**: `POST /api/pins` is issued with `{title:"Sprint Retro", body:"Notes from the retro."}`; on `201` the dialog closes, the URL returns to `/wall` with **query params cleared**, and the new card appears **first** in the grid (local re-sort, before the server refresh lands). (J2-01)
- **Expected outcomes**: the title field shows a live character counter (`0/120`, updating as you type) and the body counter reads `n/2000`. (J2-02)
- **Expected outcomes**: with title empty the Submit button is `disabled`; typing one character enables it; clearing it disables it again and shows an inline "required" message. (J2-03)
- **Negative path**: paste 121 characters into title → inline max-length message, Submit stays disabled, no network request is made. (J2-04)
- **Negative path**: with the API stubbed to return `400` with a `title` field error, the dialog stays open, the typed input is preserved, and the server message is rendered inline against the title field. (J2-05)

### Journey: Edit a pin
- **Steps**: from `/wall`, click Edit on the `Migration Checklist` card → URL `/wall?modal=edit&pinId=<seed:migration>`; the form is **pre-populated** with that pin's current title and body; change the title to `Migration Checklist v2`; Submit.
- **Expected outcomes**: `PATCH /api/pins/<seed:migration>` is issued with only the changed fields; on `200` the dialog closes, URL returns to `/wall`, and the card text updates in place without a full page reload. (J3-01)
- **Expected outcomes**: clicking Cancel (or the backdrop) navigates back to `/wall` with params cleared and issues **no** PATCH; the card is unchanged. (J3-02)
- **Negative path**: `?modal=edit&pinId=<absent-uuid>` renders a not-found / unavailable state inside the dialog rather than an empty form or a crash. (J3-03)
- **Negative path**: server returns `404` on submit (pin deleted in another tab) → an error is surfaced and the wall refreshes to the true server state. (J3-04)

### Journey: Delete a pin
- **Steps**: from `/wall`, click Delete on the `Rooftop Garden Plan` card → URL `/wall?modal=delete&pinId=<seed:rooftop>`; a confirmation dialog names the pin being deleted; click Confirm.
- **Expected outcomes**: `DELETE /api/pins/<seed:rooftop>` is issued; on `204` the dialog closes, URL returns to `/wall`, the grid drops to 2 cards, and `Rooftop Garden Plan` is absent from the DOM. (J4-01)
- **Expected outcomes**: clicking Cancel navigates back to `/wall` and issues **no** DELETE; all 3 cards remain. (J4-02)
- **Negative path**: server returns `404` → an error state is surfaced and the wall re-syncs from the server. (J4-03)
- **Negative path**: deleting the last remaining pin leaves the wall in its empty state (see J8-02), not a broken grid. (J4-04)

### Journey: Deep-linked pin detail
- **Steps**: hard-load (full browser navigation, not in-app routing) `/pins/<seed:q3>`.
- **Expected outcomes**: `200` HTML shell, then `GET /api/pins/<seed:q3>`; the page renders the title `Q3 Roadmap Draft`, its body, and its timestamps; a link back to the wall is present and navigates to `/wall`. (J5-01)
- **Expected outcomes**: the shell `<h1>PinBoard</h1>` is still present on this route (marker holds on deep links). (J5-02)
- **Negative path**: `/pins/<deleted-or-absent-uuid>` → the API returns `404` and the component renders a "Pin not found" state with a working link back to `/wall` — **not** a blank page, a spinner that never resolves, or the global `**` not-found component. (J5-03)

### Journey: Unknown route (not-found)
- **Steps**: hard-load `/definitely-not-a-route`.
- **Expected outcomes**: the `**` route renders `NotFoundComponent` (`data.flow === 'not-found'`), the HTTP status of the shell fetch is `200` (SPA fallback), and a link back to `/wall` works. (J6-01)
- **Expected outcomes**: no `GET /api/...` request is fired for the bogus path. (J6-02)
- **Negative path**: `/wall/extra/segments` also lands on not-found rather than a partially-rendered wall. (J6-03)

### Journey: Query-param modal deep-links survive a hard reload
- **Steps**: hard-load `/wall?modal=new`.
- **Expected outcomes**: the wall grid renders its 3 cards **and** the create dialog is open on top of it, in create mode with empty fields. (J7-01)
- **Steps/outcomes**: hard-load `/wall?modal=edit&pinId=<seed:migration>` → wall renders and the dialog opens pre-populated with that pin. (J7-02)
- **Steps/outcomes**: hard-load `/wall?modal=delete&pinId=<seed:q3>` → wall renders and the confirm dialog names `Q3 Roadmap Draft`. (J7-03)
- **Negative path**: `/wall?modal=bogus` and `/wall?modal=edit` (missing `pinId`) render the plain wall with no dialog and no console error. (J7-04)

### Journey: Wall loading / empty / error states
- **Steps**: stub `PinsService` in each of the three states and render `WallComponent`.
- **Expected outcomes (loading)**: a loading indicator renders while the request is in flight and disappears on resolve. (J8-01)
- **Expected outcomes (empty)**: with `[]` from the API, an empty state is rendered that still offers the "New pin" action. (J8-02)
- **Negative path (error)**: with a rejected request, an error message renders and the three seeded titles are absent. (J8-03)

### Journey: Smoke marker / shell
- **Steps**: render `AppComponent` in a component test with the router stubbed.
- **Expected outcomes**: the rendered text contains the literal string `PinBoard`; `frontend/src/index.html` contains `<title>PinBoard</title>`. (J9-01)
- **Expected outcomes**: after `docker compose up`, `curl -s localhost:3000 | grep PinBoard` exits `0`, and the live wall shows all three seeded titles **with** their bodies. The scaffold reject-signatures from `.colossus-acceptance.json` must be absent from the served page: `home-title">Users<`, `Loading...`, `Failed to load users.`. The `data-testid="app-ready"` marker must still be present on the shell. (J9-02)

### Journey: Login / signup **[CONDITIONAL: full_auth]**
- **Steps**: navigate to `/signup`, submit email + password → redirected to `/wall`, nav reflects the signed-in user.
- **Expected outcomes**: `/login` with valid credentials redirects to `/wall`; the admin nav link is visible **only** when `isAdmin` is true. (J10-01)
- **Negative path**: invalid credentials render an inline error on the login form and stay on `/login`. (J10-02)
- **Negative path**: form validation (bad email, short password) blocks submit with inline messages and no network call. (J10-03)
- **Expected outcomes**: after logout, `/wall` is **still reachable and fully rendered anonymously** (this is the key spec/tasks reconciliation check), while `/admin/settings` is no longer reachable. (J10-04)

### Journey: Admin settings **[CONDITIONAL: full_auth]**
- **Steps**: signed in as ADMIN, navigate to `/admin/settings`.
- **Expected outcomes**: one section per provisioned service (`postgresql`, `minio`), each with a configured/unconfigured badge sourced from `GET /api/admin/settings`. (J11-01)
- **Expected outcomes**: when any service reports `configured: false`, a prominent banner reads "The following need credentials to activate: …" and lists exactly those services; when all are configured the banner is absent. (J11-02)
- **Expected outcomes**: saving a credential issues `PATCH /api/admin/settings` and the badge flips to configured without a full reload; the saved secret is never rendered back in plaintext. (J11-03)
- **Negative path**: an anonymous or `USER`-role visitor navigating to `/admin/settings` is redirected (to `/login` or `/wall`) by the `adminGuard` and never sees settings content; a `401` from any API call triggers the interceptor's redirect to `/login`. (J11-04)

## Data integrity tests
- After a successful `POST /api/pins`, exactly one new `Pin` row exists; its `id` is a UUID the client did not supply, `createdAt === updatedAt`, and `body` is `""` (never `NULL`) when body was omitted. (DI-01)
- After **any** rejected (`400`) `POST` or `PATCH`, the `Pin` row count and every field of every existing row are byte-identical to the pre-request state — validation must reject before the DB write. (DI-02)
- `title` is stored trimmed: no row in `Pin` ever has a `title` with leading/trailing whitespace or a zero-length `title`, after any sequence of POST/PATCH operations. (DI-03)
- `title` length ≤ 120 and `body` length ≤ 2000 hold for every row; a 121/2001-char attempt produces a `400` and no row — the DB `VarChar` constraint is never the thing that rejects it (which would surface as a 500). (DI-04)
- After `PATCH`, `updatedAt` is strictly greater than the previous `updatedAt`, and `createdAt` and `id` are unchanged. (DI-05)
- After `DELETE`, the row is absent from `Pin` (hard delete, no soft-delete tombstone) and is absent from `GET /api/pins`; no other row was affected. (DI-06)
- Seeding is idempotent: running the seed twice in a row leaves exactly 3 pins with the same 3 fixed UUIDs, the same staggered `createdAt` values (rooftop < migration < q3), and unchanged bodies. Running the seed after a pin was deleted restores exactly that pin. (DI-07)
- `prisma migrate deploy` applied to an empty database, followed by the seed, yields a schema containing the `Pin` model with the `@@index([createdAt])` index present; the entrypoint sequence (migrate → seed → start) completes with a zero exit code. **[CONDITIONAL: full_auth]** the same run creates the `User`/`UserRole` and `SystemSetting` structures, and no `User` row ever stores a plaintext password. (DI-08)

## Out of scope
- **Authentication on pin routes.** The spec mandates public CRUD; `tasks.md` flags this as an open question. No test asserts that pin mutations require a session — only `API-PUB-01` asserting they do **not**. If the open question is resolved toward guarded mutations, this spec must be regenerated.
- **Rate limiting / abuse protection on the public destructive API.** The spec's own risk section says none is in scope; a visitor deleting seeded pins is expected behaviour, remediated by re-seeding (DI-07).
- **MinIO / object storage behaviour.** The spec declares no file or image upload for pins. `minio` is tested only as a credential row in `/admin/settings` (API-ADM-01, J11-01), never as a working storage integration.
- **Third-party integrations.** The spec's Integrations section is `(none)`; no client, webhook, or API-key test exists.
- **Pagination, search, filtering, sorting controls, and tags on the wall.** The spec defines a single unpaginated `createdAt DESC` list; no such UI or query parameters are specified.
- **Concurrency / optimistic locking.** The spec defines no `If-Match`/version field, so last-write-wins on a concurrent PATCH is untested beyond the J3-04 stale-delete case.
- **Accessibility, responsive breakpoints, and visual regression.** The spec specifies "plain CSS grid" with no a11y or breakpoint acceptance criteria; only DOM presence and text content are asserted.
- **Browser matrix.** The spec names no target browsers; journey tests run on the single default harness browser.
- **Multi-replica migration races.** The spec's risk section explicitly holds the deployment at one replica, so concurrent `migrate deploy` is not exercised.
- **Colossus image-path / deploy-target correctness.** Flagged as an open question in both the spec's risks and `tasks.md`; the pipeline's build step, not this test suite, will surface a wrong `Dockerfile` location.
