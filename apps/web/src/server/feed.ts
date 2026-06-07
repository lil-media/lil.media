import { auth, clerkClient } from "@clerk/tanstack-react-start/server"
import { createServerFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"

import { createDb } from "@/db"
import {
  createPost,
  getProfile,
  listRecentPosts,
  upsertProfile,
  upsertUser,
} from "@/db/queries"

function db() {
  return createDb(env.lil_media)
}

export const getFeedFn = createServerFn().handler(async () => {
  return listRecentPosts(db())
})

export const getViewerFn = createServerFn().handler(async () => {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { signedIn: false as const, profile: null }
  }
  const profile = await getProfile(db(), userId)
  return { signedIn: true as const, profile: profile ?? null }
})

export const saveProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: { handle: string; displayName: string }) => {
    const handle = data.handle.trim().toLowerCase()
    const displayName = data.displayName.trim()
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      throw new Error(
        "Handle must be 3–20 characters: a–z, 0–9, or underscore."
      )
    }
    if (displayName.length < 1 || displayName.length > 50) {
      throw new Error("Display name must be 1–50 characters.")
    }
    return { handle, displayName }
  })
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth()
    if (!isAuthenticated) throw new Error("You must be signed in.")

    const user = await clerkClient().users.getUser(userId)
    const email = user.primaryEmailAddress?.emailAddress ?? ""

    const d = db()
    await upsertUser(d, { id: userId, email })
    return upsertProfile(d, {
      userId,
      handle: data.handle,
      displayName: data.displayName,
    })
  })

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

export const createPostFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected form data.")
    }
    const content = (data.get("content")?.toString() ?? "").trim()
    const file = data.get("image")
    const image = file instanceof File && file.size > 0 ? file : null

    if (!content && !image) {
      throw new Error("Write something or attach an image.")
    }
    if (content.length > 500) {
      throw new Error("Posts must be 500 characters or fewer.")
    }
    if (image) {
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        throw new Error("Images must be JPEG, PNG, WebP, or GIF.")
      }
      if (image.size > MAX_IMAGE_BYTES) {
        throw new Error("Images must be 8MB or smaller.")
      }
    }
    return { content, image }
  })
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth()
    if (!isAuthenticated) throw new Error("You must be signed in.")

    let mediaKey: string | undefined
    let mediaType: string | undefined
    if (data.image) {
      const ext = data.image.type.split("/")[1] ?? "bin"
      mediaKey = `${crypto.randomUUID()}.${ext}`
      mediaType = data.image.type
      await env.MEDIA.put(mediaKey, await data.image.arrayBuffer(), {
        httpMetadata: { contentType: data.image.type },
      })
    }

    return createPost(db(), {
      authorId: userId,
      content: data.content,
      mediaKey,
      mediaType,
    })
  })
