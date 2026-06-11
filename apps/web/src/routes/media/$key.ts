import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"

import { mediaResponseHeaders } from "@/server/media"

// Serves uploaded images from R2. The stored content type is untrusted, so the
// response is restricted to allowlisted image types (see mediaResponseHeaders);
// anything else downloads as an opaque attachment.
export const Route = createFileRoute("/media/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const object = await env.MEDIA.get(params.key)
        if (!object) {
          return new Response("Not found", { status: 404 })
        }
        return new Response(object.body, {
          headers: mediaResponseHeaders(
            object.httpMetadata?.contentType,
            object.httpEtag
          ),
        })
      },
    },
  },
})
