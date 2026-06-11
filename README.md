# lil.media

A small social app: sign in, claim a handle, and post short text (≤500 chars)
with an optional image to a shared, reverse-chronological feed.

## Stack

- **TanStack Start** (React 19) deployed on **Cloudflare Workers**
- **Clerk** for authentication
- **Drizzle ORM** over **Cloudflare D1** (SQLite)
- **Cloudflare R2** for images, via presigned direct-to-R2 uploads
- **Tailwind CSS v4**; shared UI in `packages/ui` (`@workspace/ui`)

Monorepo managed with **pnpm workspaces** + **Turbo**. Requires Node ≥ 20 and
pnpm 10.

## Layout

- `apps/web` — the application (routes, server functions, data + storage layers)
- `packages/ui` — shared component library (`@workspace/ui`)

## Local development

1. Install: `pnpm install`
2. Create `apps/web/.dev.vars` from `apps/web/.dev.vars.example` and fill in:
   - `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (Clerk)
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (R2 S3 credentials)
     (`R2_ACCOUNT_ID` and `R2_BUCKET` are non-secret and live in `wrangler.jsonc`.)
3. Apply local D1 migrations: `pnpm --filter web db:migrate:local`
4. Run the dev server: `pnpm dev` (web app on http://localhost:3000)

## Common commands

Run from the repo root (Turbo fans out to the workspaces):

- `pnpm dev` — start the dev server
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit` (run `pnpm --filter web cf-typegen` first to
  generate Cloudflare binding types)
- `pnpm test` — component tests (happy-dom) + D1 integration tests (workerd pool)
- `pnpm build` — production build

Playwright E2E (needs Clerk dev keys in `.dev.vars`):
`pnpm --filter web test:e2e`.

## Data model

- `users` — Clerk identity (`id`, `email`)
- `profiles` — 1:1 with a user; unique `handle`, `displayName`, optional `bio`
- `posts` — `authorId`, `content`, optional image (`mediaKey` + `mediaType`)

Schema lives in `apps/web/src/db/schema.ts`; migrations in `apps/web/drizzle`.
Generate a migration after a schema change with `pnpm --filter web db:generate`.

## Deployment

Cloudflare Workers (see `.github/workflows/ci.yml`):

- Every PR runs lint, typecheck, test, and build.
- Push to `main` → deploys the **preview** Worker `lil-media-web-preview`
  (Clerk dev keys).
- **Production** (`lil-media-web`, Clerk prod keys) deploys via a manual
  `workflow_dispatch` from the Actions tab.
- E2E in CI is opt-in via the Actions variable `RUN_E2E=true`.

## License

[MIT](./LICENSE) © Adam Snodgrass
