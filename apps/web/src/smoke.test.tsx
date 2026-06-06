import { render, screen } from "@testing-library/react"
import { Button } from "@workspace/ui/components/button"
import { describe, expect, it } from "vitest"

// Smoke test: proves the web app's test harness renders React and can import
// from the @workspace/ui package across the monorepo boundary.
describe("web test harness", () => {
  it("renders workspace ui components", () => {
    render(<Button>Post</Button>)
    expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument()
  })
})
