# DevEvent

DevEvent is a Next.js site for discovering developer-focused events. The home page presents the featured event catalog, and each event has a detail page at `/events/<slug>`.

## Requirements

- Node.js 24.x (the supported version is declared in `package.json`)
- npm (the repository includes a lockfile)

## Local setup

Install the locked dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

Available scripts:

- `npm run dev` — start Next.js in development mode
- `npm run build` — create the optimized production build
- `npm start` — serve the production build (run `npm run build` first)
- `npm run lint` — run the repository ESLint configuration

## Data and environment variables

The currently released catalog is deliberately file-backed: featured events are defined in [`lib/constants.ts`](./lib/constants.ts). There is no seed script or remote event API, so the site can be built and deployed without a database. Update that file to change the featured catalog; event detail pages are generated from the same records.

The repository also contains reusable Mongoose models in `database/` and a cached connector in `lib/mongodb.ts` for a future data-backed workflow. Those modules are not imported by the current page routes. If server-side code starts using them, provide:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
```

Do not commit a real connection string. Use the corresponding secret in the deployment provider instead.

PostHog error and product analytics are optional. Set the public project key to enable the client instrumentation:

```dotenv
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

When the key is absent, analytics is disabled and the application still runs normally. The PostHog proxy routes in `next.config.ts` are used only when analytics is enabled.

## Production

Build and run the same artifact locally before releasing:

```bash
npm ci
npm run build
npm start
```

The app is a standard Next.js App Router deployment. On Vercel, import this repository, keep the detected framework as **Next.js**, use `npm run build` as the build command, and set `NEXT_PUBLIC_POSTHOG_KEY` only if PostHog is required. No MongoDB configuration is needed for the current catalog-only routes; add `MONGODB_URI` only when database-backed routes are introduced.

For another Node-compatible host, run `npm ci`, `npm run build`, and `npm start`, and expose the host's `PORT` (Next.js defaults to `3000`). Keep environment values in the host's secret/configuration store rather than in Git.

## Project structure

- `app/` — layouts, home page, and event detail routes
- `components/` — shared navigation, event cards, and visual effects
- `lib/constants.ts` — released featured-event data
- `database/` — Mongoose models and exports for future server-side data access
- `public/` — event artwork and icons
