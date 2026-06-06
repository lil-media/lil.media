import { clerk } from "@clerk/testing/playwright"
import { expect, test as setup } from "@playwright/test"

import { STORAGE_STATE, TEST_USER } from "./test-user"

// Sign the dedicated user in programmatically (no UI), make sure their app
// profile exists in the (local) test D1, then persist the session so feature
// tests start authenticated and ready to post.
setup("authenticate", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction("window.Clerk?.loaded === true")

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: TEST_USER.email,
      password: TEST_USER.password,
    },
  })

  await page.goto("/")
  // Wait for hydration before interacting, else a click can trigger a native
  // form submit (reload) instead of the server function.
  await page.waitForFunction("window.Clerk?.loaded === true")
  const composer = page.getByPlaceholder("What's happening?")
  const handle = page.getByPlaceholder("handle (e.g. adam)")

  // Wait for the app to settle into either state, then create the profile if
  // this user doesn't have one yet (first run against a fresh test D1).
  await expect(composer.or(handle)).toBeVisible({ timeout: 15_000 })
  if (await handle.isVisible()) {
    await handle.fill(TEST_USER.handle)
    await page.getByPlaceholder("Display name").fill(TEST_USER.displayName)
    await page.getByRole("button", { name: "Create profile" }).click()
    await expect(composer).toBeVisible({ timeout: 15_000 })
  }

  await page.context().storageState({ path: STORAGE_STATE })
})
