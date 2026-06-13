import { AwsClient } from "aws4fetch"
import { env } from "cloudflare:workers"

import { SERVE_IMAGE_TYPES } from "./media"

// One allowlist for both uploading and serving (see ./media).
export const ALLOWED_IMAGE_TYPES = SERVE_IMAGE_TYPES
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export const PENDING_PREFIX = "pending/"

// The permanent key an attached upload is promoted to (drops the staging prefix).
export function promotedKey(pendingKey: string): string {
  return pendingKey.startsWith(PENDING_PREFIX)
    ? pendingKey.slice(PENDING_PREFIX.length)
    : pendingKey
}

function s3Client() {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  })
}

// Presign a direct-to-R2 PUT so the browser uploads the bytes straight to R2,
// never through the Worker. The key is staged under pending/ so an R2 lifecycle
// rule can auto-expire orphaned uploads.
export async function presignUpload(contentType: string) {
  const ext = contentType.split("/")[1] ?? "bin"
  const key = `${PENDING_PREFIX}${crypto.randomUUID()}.${ext}`
  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`
  )
  url.searchParams.set("X-Amz-Expires", "600")
  // Sign the content type so the uploaded object must match what was requested.
  const signed = await s3Client().sign(
    new Request(url, {
      method: "PUT",
      headers: { "content-type": contentType },
    }),
    { aws: { signQuery: true } }
  )
  return { key, uploadUrl: signed.url }
}

// Validate a freshly uploaded object and promote it from the pending/ staging
// prefix to its permanent key. Deletes the pending object either way. The bucket
// is passed in so this is testable against the workers-pool R2 binding.
export async function verifyAndPromote(
  bucket: R2Bucket,
  pendingKey: string,
  maxBytes: number = MAX_IMAGE_BYTES
): Promise<{ key: string; contentType: string }> {
  const object = await bucket.get(pendingKey)
  if (!object) throw new Error("Upload not found. Please try again.")

  const contentType = object.httpMetadata?.contentType
  if (object.size > maxBytes) {
    await bucket.delete(pendingKey)
    throw new Error("Images must be 8MB or smaller.")
  }
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    await bucket.delete(pendingKey)
    throw new Error("Images must be JPEG, PNG, WebP, or GIF.")
  }

  const key = promotedKey(pendingKey)
  await bucket.put(key, object.body, { httpMetadata: { contentType } })
  await bucket.delete(pendingKey)
  return { key, contentType }
}
