import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { expect, test } from "@playwright/test"

// Full happy path: sign up (Clerk test email + bypass code) -> create profile
// -> post -> see it in the feed. Exercises Clerk auth + the D1 read/write path
// end to end against the real running app.
test("sign up, create a profile, post, and see it in the feed", async ({
  page,
}) => {
  await setupClerkTestingToken({ page })

  const unique = Date.now()
  const email = `e2e_${unique}+clerk_test@example.com`
  const username = `e2e${unique}`
  const handle = `e2e${unique}`.slice(0, 20)
  const content = `automated e2e post ${unique}`

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "lil.media" })).toBeVisible()

  // Wait for Clerk to finish loading before clicking, otherwise the click
  // lands before the button is wired up and the modal never opens.
  await page.waitForFunction("window.Clerk?.loaded === true")

  // Open the Clerk modal and switch to sign-up.
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("link", { name: "Sign up" }).click()

  await page.getByRole("textbox", { name: "Username" }).fill(username)
  await page.getByRole("textbox", { name: "Email address" }).fill(email)
  await page.getByRole("textbox", { name: "Password" }).fill("L1lMediaE2E!Test")
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  // Clerk test emails accept the fixed verification code 424242.
  await page
    .getByRole("textbox", { name: "Enter verification code" })
    .fill("424242")

  // Signed in with no profile yet -> profile form.
  await page.getByPlaceholder("handle (e.g. adam)").fill(handle)
  await page.getByPlaceholder("Display name").fill("E2E Tester")
  await page.getByRole("button", { name: "Create profile" }).click()

  // Profile created -> composer appears -> post.
  await page.getByPlaceholder("What's happening?").fill(content)
  await page.getByRole("button", { name: "Post" }).click()

  // The post shows in the feed, attributed to the new profile.
  await expect(page.getByText(content)).toBeVisible()
  await expect(page.getByText(`@${handle}`)).toBeVisible()
})
