// Single source of truth for which content types may be served inline from the
// media route. Anything not in this set is forced to download as an opaque
// binary so a stored object can never execute in the app's origin.
export const SERVE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

// Build the response headers for a media object. The stored content type is
// untrusted: only allowlisted image types are echoed back; everything else is
// served as a download (attachment) as octet-stream. `nosniff` stops the
// browser from re-sniffing an image into something executable.
export function mediaResponseHeaders(
  storedContentType: string | undefined,
  etag: string
): Record<string, string> {
  const isImage =
    storedContentType !== undefined && SERVE_IMAGE_TYPES.has(storedContentType)
  const headers: Record<string, string> = {
    "Content-Type": isImage ? storedContentType : "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
  }
  if (!isImage) {
    headers["Content-Disposition"] = "attachment"
  }
  return headers
}
