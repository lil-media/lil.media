import { clerkSetup } from "@clerk/testing/playwright"
import { test as setup } from "@playwright/test"

// Fetches a Clerk Testing Token so test sign-ups bypass bot protection.
setup("global setup", async () => {
  await clerkSetup()
})
