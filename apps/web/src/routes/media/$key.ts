import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"

// Serves uploaded images from R2. Keys are opaque (uuid.ext), and objects are
// immutable, so they can be cached aggressively.
export const Route = createFileRoute("/media/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const object = await env.MEDIA.get(params.key)
        if (!object) {
          return new Response("Not found", { status: 404 })
        }
        return new Response(object.body, {
          headers: {
            "Content-Type":
              object.httpMetadata?.contentType ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: object.httpEtag,
          },
        })
      },
    },
  },
})
