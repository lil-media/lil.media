import { describe, expect, it } from "vitest"

import { validatePostInput, validateProfileInput } from "./validation"

describe("validateProfileInput", () => {
  it("trims and lowercases a valid handle and trims the display name", () => {
    expect(
      validateProfileInput({ handle: "  Adam  ", displayName: "  Adam S  " })
    ).toEqual({ handle: "adam", displayName: "Adam S" })
  })

  it("rejects a handle shorter than 3 chars", () => {
    expect(() =>
      validateProfileInput({ handle: "ab", displayName: "A" })
    ).toThrow("Handle must be 3–20 characters: a–z, 0–9, or underscore.")
  })

  it("rejects a handle with disallowed characters", () => {
    expect(() =>
      validateProfileInput({ handle: "bad-handle!", displayName: "A" })
    ).toThrow(/Handle must be/)
  })

  it("rejects an empty display name", () => {
    expect(() =>
      validateProfileInput({ handle: "adam", displayName: "   " })
    ).toThrow("Display name must be 1–50 characters.")
  })

  it("rejects a display name longer than 50 chars", () => {
    expect(() =>
      validateProfileInput({ handle: "adam", displayName: "x".repeat(51) })
    ).toThrow(/Display name must be/)
  })
})

describe("validatePostInput", () => {
  it("accepts text content and trims it", () => {
    expect(validatePostInput({ content: "  hi  " })).toEqual({
      content: "hi",
      mediaKey: undefined,
    })
  })

  it("accepts an image-only post (no text) with a media key", () => {
    expect(validatePostInput({ content: "   ", mediaKey: "abc.png" })).toEqual({
      content: "",
      mediaKey: "abc.png",
    })
  })

  it("rejects an empty post with no media", () => {
    expect(() => validatePostInput({ content: "   " })).toThrow(
      "Write something or attach an image."
    )
  })

  it("rejects content longer than 500 chars", () => {
    expect(() => validatePostInput({ content: "x".repeat(501) })).toThrow(
      "Posts must be 500 characters or fewer."
    )
  })
})
