import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { expect, test } from "@playwright/test"

// Smoke test for our Clerk sign-up *integration*: the modal opens, the sign-up
// form submits, and the flow advances to email verification. We deliberately
// stop here — driving Clerk's OTP UI + post-redirect is flaky and tests Clerk's
// surface, not ours. The authenticated experience (profile, posting) is covered
// by feed.spec via the persisted session.
test("the sign-up UI opens and advances to verification", async ({ page }) => {
  await setupClerkTestingToken({ page })

  const unique = Date.now()

  await page.goto("/")
  await page.waitForFunction("window.Clerk?.loaded === true")

  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("link", { name: "Sign up" }).click()

  await page.getByRole("textbox", { name: "Username" }).fill(`signup${unique}`)
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill(`signup_${unique}+clerk_test@example.com`)
  await page.getByRole("textbox", { name: "Password" }).fill("L1lMediaE2E!Test")
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(
    page.getByRole("heading", { name: "Verify your email" })
  ).toBeVisible({ timeout: 15_000 })
})
