import { expect, test } from "@playwright/test"

// Runs with the dedicated user's persisted session (storageState), so it starts
// signed in with a profile and goes straight to the feature under test.
test("an authenticated user can post and see it in the feed", async ({
  page,
}) => {
  const content = `feature post ${Date.now()}`

  await page.goto("/")
  await page.waitForFunction("window.Clerk?.loaded === true")
  await expect(page.getByPlaceholder("What's happening?")).toBeVisible()

  await page.getByPlaceholder("What's happening?").fill(content)
  await page.getByRole("button", { name: "Post" }).click()

  await expect(page.getByText(content)).toBeVisible()
  await expect(page.getByText(`@${"e2etester"}`).first()).toBeVisible()
})
