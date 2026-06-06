// A single dedicated test user, self-provisioned in global setup and reused
// across feature tests via storageState. It's a +clerk_test throwaway in the
// dev instance, so the password isn't sensitive.
export const TEST_USER = {
  email: "e2e+clerk_test@example.com",
  password: "Clerk-E2E-Test-Password-1!",
  handle: "e2etester",
  displayName: "E2E Tester",
}

export const STORAGE_STATE = "playwright/.clerk/user.json"
