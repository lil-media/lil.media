import { createClerkClient } from "@clerk/backend"
import { clerkSetup } from "@clerk/testing/playwright"
import { test as setup } from "@playwright/test"

import { TEST_USER } from "./test-user"

// Fetch a Clerk Testing Token (bypasses bot protection) and ensure the
// dedicated test user exists, so auth.setup can sign in programmatically.
setup("global setup", async () => {
  await clerkSetup()

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required to provision the e2e user")
  }

  const clerk = createClerkClient({ secretKey })
  const existing = await clerk.users.getUserList({
    emailAddress: [TEST_USER.email],
  })
  if (existing.totalCount === 0) {
    try {
      await clerk.users.createUser({
        emailAddress: [TEST_USER.email],
        username: TEST_USER.handle,
        password: TEST_USER.password,
        skipPasswordChecks: true,
      })
    } catch (err) {
      // Surface Clerk's field-level validation messages instead of a bare 422.
      const errors = (err as { errors?: unknown }).errors
      throw new Error(
        `Failed to create e2e user: ${JSON.stringify(errors ?? err)}`
      )
    }
  }
})
