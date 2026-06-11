import { AwsClient } from "aws4fetch"
import { env } from "cloudflare:workers"

import { SERVE_IMAGE_TYPES } from "./media"

// One allowlist for both uploading and serving (see ./media).
export const ALLOWED_IMAGE_TYPES = SERVE_IMAGE_TYPES
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function s3Client() {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  })
}

// Presign a direct-to-R2 PUT so the browser uploads the bytes straight to R2,
// never through the Worker.
export async function presignUpload(contentType: string) {
  const ext = contentType.split("/")[1] ?? "bin"
  const key = `${crypto.randomUUID()}.${ext}`
  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`
  )
  url.searchParams.set("X-Amz-Expires", "600")
  const signed = await s3Client().sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  })
  return { key, uploadUrl: signed.url }
}

// Confirm a direct upload actually landed and is within limits before linking
// it to a post; delete it otherwise.
export async function verifyUpload(key: string) {
  const object = await env.MEDIA.head(key)
  if (!object) throw new Error("Upload not found. Please try again.")
  if (object.size > MAX_IMAGE_BYTES) {
    await env.MEDIA.delete(key)
    throw new Error("Images must be 8MB or smaller.")
  }
  const contentType = object.httpMetadata?.contentType
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    await env.MEDIA.delete(key)
    throw new Error("Images must be JPEG, PNG, WebP, or GIF.")
  }
  return { contentType }
}
