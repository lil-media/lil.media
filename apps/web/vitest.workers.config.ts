import path from "node:path"

import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

// Integration tests that run inside the real workerd runtime with a live D1
// binding. Migrations are read from ./drizzle and applied per-test via the
// setup file. Component tests live in vitest.config.ts (happy-dom).
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "drizzle")
  )

  return {
    test: {
      include: ["src/**/*.workers.test.ts"],
      setupFiles: ["./src/test/apply-migrations.ts"],
    },
    plugins: [
      // Configure miniflare directly (rather than loading wrangler.jsonc) so
      // the pool doesn't try to bundle the app's TanStack server entry — these
      // tests only exercise the D1 binding.
      cloudflareTest({
        miniflare: {
          compatibilityDate: "2026-06-03",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { lil_media: "lil-media-test" },
          r2Buckets: { MEDIA: "lil-media-test-uploads" },
          bindings: {
            TEST_MIGRATIONS: migrations,
            R2_ACCESS_KEY_ID: "test-access-key-id",
            R2_SECRET_ACCESS_KEY: "test-secret-access-key",
            R2_ACCOUNT_ID: "test-account",
            R2_BUCKET: "lil-media-test-uploads",
          },
        },
      }),
    ],
  }
})
