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
import { validatePostInput, validateProfileInput } from "./validation"

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
  .inputValidator((data: { handle: string; displayName: string }) =>
    validateProfileInput(data)
  )
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
  .inputValidator((data: { content: string; mediaKey?: string }) =>
    validatePostInput(data)
  )
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
