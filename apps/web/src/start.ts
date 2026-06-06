import { clerkMiddleware } from "@clerk/tanstack-react-start/server"
import { createCsrfMiddleware, createStart } from "@tanstack/react-start"

// Protect server-function RPC endpoints from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
})

// clerkMiddleware() reads CLERK_SECRET_KEY / VITE_CLERK_PUBLISHABLE_KEY from
// the environment. On Cloudflare Workers these are exposed via process.env
// thanks to nodejs_compat (secret key) and baked in at build time for the
// publishable key (VITE_ prefix).
export const startInstance = createStart(() => {
  return {
    requestMiddleware: [csrfMiddleware, clerkMiddleware()],
  }
})
