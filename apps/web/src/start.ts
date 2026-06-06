import { clerkMiddleware } from "@clerk/tanstack-react-start/server"
import { createStart } from "@tanstack/react-start"

// clerkMiddleware() reads CLERK_SECRET_KEY / VITE_CLERK_PUBLISHABLE_KEY from
// the environment. On Cloudflare Workers these are exposed via process.env
// thanks to nodejs_compat (secret key) and baked in at build time for the
// publishable key (VITE_ prefix).
export const startInstance = createStart(() => {
  return {
    requestMiddleware: [clerkMiddleware()],
  }
})
