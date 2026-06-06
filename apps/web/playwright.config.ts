import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { defineConfig, devices } from "@playwright/test"

import { STORAGE_STATE } from "./e2e/test-user"

// Locally, load Clerk keys from .dev.vars (gitignored) so the test runner can
// mint a testing token. In CI these come from the job environment instead.
// @clerk/testing's clerkSetup() reads CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY.
function loadDevVars() {
  const file = path.resolve(".dev.vars")
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!match) continue
      const [, key, raw] = match
      process.env[key] ??= raw.replace(/^["']|["']$/g, "")
    }
  }
  process.env.CLERK_PUBLISHABLE_KEY ??= process.env.VITE_CLERK_PUBLISHABLE_KEY
}
loadDevVars()

const PORT = 4321

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "auth",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["setup"],
    },
    // Feature tests reuse the dedicated user's persisted session.
    {
      name: "authed",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /signup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["auth"],
    },
    // The sign-up UI smoke runs unauthenticated (fresh user, no storageState).
    {
      name: "signup",
      testMatch: /signup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `pnpm exec vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
})
