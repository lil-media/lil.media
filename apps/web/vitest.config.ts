import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Dedicated test config — intentionally omits the Cloudflare/TanStack Start
// plugins so component tests run in a plain happy-dom environment. Server/data
// tests that need the workerd runtime will live in a separate vitest project
// using @cloudflare/vitest-pool-workers.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
  },
})
