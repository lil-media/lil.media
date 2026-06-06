import { defineConfig } from "drizzle-kit"

// Migrations are generated here and applied to D1 via
// `wrangler d1 migrations apply` (see package.json db:* scripts), so no
// HTTP driver/credentials are needed for generation.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
})
