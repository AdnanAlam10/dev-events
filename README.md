# DevEvent

DevEvent is a developer-event discovery and free-registration portfolio application. It includes search, location/date/topic/state filters, paginated event discovery, rich event detail pages, calendar export, private attendee registration and cancellation, organizer CRUD, moderation, freshness enforcement, and organizer summaries.

Every bundled listing and demo workflow is explicitly labeled **DEMO**. DevEvent does not ingest live third-party events, sell tickets, or represent that any demo listing will occur.

## Local setup

Requires Node.js 24.x and npm:

```bash
npm ci
# Create .env.local with the variables described below
npm run dev
```

Open <http://localhost:3000>. Without `MONGODB_URI`, the app intentionally runs in ephemeral demo mode: state survives requests in one warm process but is not durable across restarts or serverless instances.

Available scripts:

- `npm run dev` — start development mode
- `npm run build` — create the production build
- `npm start` — serve a production build
- `npm run test:domain` — run focused authorization, capacity, cancellation, moderation, privacy, and freshness contracts

## Demo access

Open `/organizer`, select **Organizer** or **Moderator admin**, and enter the configured `DEMO_LOGIN_CODE`. The public portfolio deployment uses `DevEventDemo!2026`; this is intentionally a public demo code, not a production credential. Sessions are signed, HTTP-only, same-site cookies. Organizer mutations enforce ownership server-side and moderator actions enforce the admin role.

New or organizer-edited events return to `pending` moderation. Approved future listings remain public for 90 days after organizer verification; stale future listings are hidden until reverification. Past approved listings remain archived, while cancelled approved listings remain visible with the cancellation reason.

## Persistence and transactional registration

The bundled dataset lives in `database/seed.ts` and is inserted idempotently through the Mongoose data layer when Atlas is configured. `database/service.ts` selects:

- **MongoDB Atlas mode** when `MONGODB_URI` exists: durable events, registrations, privacy choices, capacity counts, and reminder/cancellation outbox records.
- **Ephemeral demo mode** otherwise: the same domain behavior in a process-local repository, clearly disclosed in the interface.

Atlas must be a transaction-capable replica set (Atlas clusters satisfy this). Mongoose creates the declared indexes, including unique event slugs, public discovery indexes, and the partial unique `{ eventSlug, email }` index for one active registration per attendee/event. Run the application against the target database once with an index-authorized database user, or call `syncIndexes()` in controlled provisioning, then verify these indexes in Atlas before accepting registrations.

Atlas registration uses a transaction with an atomic `$expr: { $lt: [\"$registeredCount\", \"$capacity\"] }` reservation. Registration creation and reminder-outbox creation commit in the same transaction. Self-cancellation validates a hashed cancellation token, releases the capacity slot, and cancels any pending reminder in a transaction. Event cancellation queues attendee cancellation notices without exposing attendee email addresses to organizer analytics.

## Reminder email

Reminder and cancellation messages use a durable outbox and the Resend HTTP API. `/api/reminders/process` is protected by `CRON_SECRET`; `vercel.json` schedules it daily. A message is marked `sent` only after Resend returns success, and an idempotency key prevents duplicate sends during retries.

Required production environment:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<transaction-capable-cluster>/<database>
SESSION_SECRET=<at-least-32-random-bytes>
DEMO_LOGIN_CODE=<public-demo-access-code>
CRON_SECRET=<random-vercel-cron-secret>
RESEND_API_KEY=re_...
REMINDER_FROM_EMAIL=DevEvent Demo <events@verified-domain.example>
```

`REMINDER_FROM_EMAIL` must use a sender/domain verified in the same Resend account. Store all values in the deployment provider, never in Git. If Atlas or Resend values are absent, the interface does not claim durable persistence or email delivery.

Optional client analytics:

```dotenv
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

## API surface

- `GET /api/events` — public filters and pagination
- `POST /api/events` and `PATCH|DELETE /api/events/:slug` — authenticated organizer/admin CRUD, moderation, and cancellation
- `POST|DELETE /api/events/:slug/registrations` — free registration and token-protected self-cancellation
- `GET /api/events/:slug/calendar` — RFC 5545 calendar export with a local display alarm
- `GET /api/organizer/analytics` — owner-scoped or admin summaries without attendee emails
- `GET /api/reminders/process` — protected outbox delivery worker

## Release checks

```bash
npm ci
npm run test:domain
npm run build
npm start
```

Smoke the catalog search, event detail, organizer create/update/delete, attendee registration/self-cancellation, and `.ics` export against the built artifact. On Vercel, confirm the production deployment is Ready and repeat the primary path against the canonical URL.

## Project structure

- `app/` — catalog, detail, organizer, and API routes
- `components/` — discovery cards, registration, organizer console, navigation, and visual effects
- `database/` — Mongoose models, explicit demo seed, durable adapter, ephemeral demo repository, and reminder worker
- `lib/` — signed sessions, API error handling, and Mongo connection cache
- `tests/domain.test.ts` — focused changed-contract tests
- `public/` — event artwork and icons
