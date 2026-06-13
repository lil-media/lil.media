import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"

import { presignUpload, verifyAndPromote } from "./storage"

describe("presignUpload", () => {
  it("issues a pending/ key with a 600s expiry", async () => {
    const { key, uploadUrl } = await presignUpload("image/png")
    expect(key).toMatch(/^pending\/[0-9a-f-]{36}\.png$/)
    const url = new URL(uploadUrl)
    // NOTE: aws4fetch with signQuery:true only signs `host`; content-type is NOT
    // bound in the signature even though we pass it to sign(). R2 does not enforce
    // a content-type match on presigned PUTs — the serve route (media/$key.ts) is
    // the backstop. See PR notes for the content-type signing limitation.
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600")
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host")
  })
})

describe("verifyAndPromote", () => {
  async function putPending(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ) {
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } })
  }

  it("promotes a valid upload to its permanent key and removes the pending one", async () => {
    const pending = "pending/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png"
    await putPending(pending, new Uint8Array([1, 2, 3]), "image/png")

    const result = await verifyAndPromote(env.MEDIA, pending)
    expect(result).toEqual({
      key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png",
      contentType: "image/png",
    })
    expect(await env.MEDIA.get(result.key)).not.toBeNull()
    expect(await env.MEDIA.get(pending)).toBeNull()
  })

  it("rejects + deletes an oversized upload", async () => {
    const pending = "pending/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png"
    await putPending(pending, new Uint8Array([1, 2, 3, 4, 5]), "image/png")
    await expect(
      verifyAndPromote(env.MEDIA, pending, 2) // maxBytes=2 < 5
    ).rejects.toThrow("8MB or smaller")
    expect(await env.MEDIA.get(pending)).toBeNull()
  })

  it("rejects + deletes a disallowed content type", async () => {
    const pending = "pending/cccccccc-cccc-cccc-cccc-cccccccccccc.html"
    await putPending(pending, new Uint8Array([1]), "text/html")
    await expect(verifyAndPromote(env.MEDIA, pending)).rejects.toThrow(
      "JPEG, PNG, WebP, or GIF"
    )
    expect(await env.MEDIA.get(pending)).toBeNull()
  })

  it("rejects a missing upload", async () => {
    await expect(
      verifyAndPromote(
        env.MEDIA,
        "pending/dddddddd-dddd-dddd-dddd-dddddddddddd.png"
      )
    ).rejects.toThrow("Upload not found")
  })
})
