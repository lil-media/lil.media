import { applyD1Migrations, env } from "cloudflare:test"

// Apply Drizzle-generated migrations to the test D1 database before each
// isolated-storage test run. TEST_MIGRATIONS is injected by
// vitest.workers.config.ts.
await applyD1Migrations(env.lil_media, env.TEST_MIGRATIONS)
