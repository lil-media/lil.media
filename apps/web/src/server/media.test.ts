import { describe, expect, it } from "vitest"

import { mediaResponseHeaders } from "./media"

describe("mediaResponseHeaders", () => {
  it("echoes an allowlisted image content type inline", () => {
    const h = mediaResponseHeaders("image/png", '"etag"')
    expect(h["Content-Type"]).toBe("image/png")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["Content-Disposition"]).toBeUndefined()
    expect(h["ETag"]).toBe('"etag"')
  })

  it("forces a download for a non-image (XSS payload) content type", () => {
    const h = mediaResponseHeaders("text/html", '"etag"')
    expect(h["Content-Type"]).toBe("application/octet-stream")
    expect(h["Content-Disposition"]).toBe("attachment")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
  })

  it("forces a download when the content type is missing", () => {
    const h = mediaResponseHeaders(undefined, '"etag"')
    expect(h["Content-Type"]).toBe("application/octet-stream")
    expect(h["Content-Disposition"]).toBe("attachment")
  })

  it("never serves SVG inline (script-capable image type)", () => {
    const h = mediaResponseHeaders("image/svg+xml", '"etag"')
    expect(h["Content-Type"]).toBe("application/octet-stream")
    expect(h["Content-Disposition"]).toBe("attachment")
  })
})
