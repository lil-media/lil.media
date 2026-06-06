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

export const createPostFn = createServerFn({ method: "POST" })
  .inputValidator((data: { content: string }) => {
    const content = data.content.trim()
    if (content.length < 1 || content.length > 500) {
      throw new Error("Posts must be 1–500 characters.")
    }
    return { content }
  })
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth()
    if (!isAuthenticated) throw new Error("You must be signed in.")
    return createPost(db(), { authorId: userId, content: data.content })
  })
