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
import { ALLOWED_IMAGE_TYPES, presignUpload, verifyUpload } from "./storage"

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

// Step 1 of an image post: hand the browser a presigned URL to upload directly
// to R2 (bytes never pass through the Worker).
export const requestUploadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((data: { contentType: string }) => {
    if (!ALLOWED_IMAGE_TYPES.has(data.contentType)) {
      throw new Error("Images must be JPEG, PNG, WebP, or GIF.")
    }
    return { contentType: data.contentType }
  })
  .handler(async ({ data }) => {
    const { isAuthenticated } = await auth()
    if (!isAuthenticated) throw new Error("You must be signed in.")
    return presignUpload(data.contentType)
  })

// Step 2: create the post, verifying any uploaded object exists and is valid.
export const createPostFn = createServerFn({ method: "POST" })
  .inputValidator((data: { content: string; mediaKey?: string }) => {
    const content = data.content.trim()
    const mediaKey = data.mediaKey?.trim() || undefined
    if (!content && !mediaKey) {
      throw new Error("Write something or attach an image.")
    }
    if (content.length > 500) {
      throw new Error("Posts must be 500 characters or fewer.")
    }
    return { content, mediaKey }
  })
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth()
    if (!isAuthenticated) throw new Error("You must be signed in.")

    const d = db()
    const profile = await getProfile(d, userId)
    if (!profile) throw new Error("Create your profile first.")

    let mediaType: string | undefined
    if (data.mediaKey) {
      mediaType = (await verifyUpload(data.mediaKey)).contentType
    }

    return createPost(d, {
      authorId: userId,
      content: data.content,
      mediaKey: data.mediaKey,
      mediaType,
    })
  })
