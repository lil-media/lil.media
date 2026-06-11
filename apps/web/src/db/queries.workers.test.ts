import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"

import { createDb } from "./index"
import {
  HandleTakenError,
  createPost,
  listRecentPosts,
  upsertProfile,
  upsertUser,
} from "./queries"

describe("post queries (D1)", () => {
  const db = createDb(env.lil_media)

  it("creates a user + profile + post and lists it in the feed", async () => {
    await upsertUser(db, { id: "user_1", email: "adam@example.com" })
    await upsertProfile(db, {
      userId: "user_1",
      handle: "adam",
      displayName: "Adam",
    })

    const post = await createPost(db, {
      authorId: "user_1",
      content: "hello world",
    })
    expect(post.content).toBe("hello world")

    const feed = await listRecentPosts(db)
    expect(feed).toHaveLength(1)
    expect(feed[0]).toMatchObject({
      content: "hello world",
      authorHandle: "adam",
      authorName: "Adam",
    })
  })

  it("stores and returns media metadata on a post", async () => {
    await upsertUser(db, { id: "user_m", email: "m@example.com" })
    await upsertProfile(db, {
      userId: "user_m",
      handle: "mediauser",
      displayName: "Media",
    })
    const post = await createPost(db, {
      authorId: "user_m",
      content: "",
      mediaKey: "abc123.jpg",
      mediaType: "image/jpeg",
    })
    expect(post.mediaKey).toBe("abc123.jpg")

    const feed = await listRecentPosts(db)
    const found = feed.find((p) => p.id === post.id)
    expect(found).toMatchObject({
      mediaKey: "abc123.jpg",
      mediaType: "image/jpeg",
    })
  })

  it("cannot create a post for an author with no user/profile row", async () => {
    await expect(
      createPost(db, { authorId: "ghost_user", content: "hi" })
    ).rejects.toThrow()
  })

  it("rejects a handle already taken by another user", async () => {
    await upsertUser(db, { id: "user_taken_a", email: "a@example.com" })
    await upsertProfile(db, {
      userId: "user_taken_a",
      handle: "popular",
      displayName: "A",
    })

    await upsertUser(db, { id: "user_taken_b", email: "b@example.com" })
    await expect(
      upsertProfile(db, {
        userId: "user_taken_b",
        handle: "popular",
        displayName: "B",
      })
    ).rejects.toBeInstanceOf(HandleTakenError)
  })

  it("upsertProfile updates an existing profile rather than duplicating", async () => {
    await upsertUser(db, { id: "user_2", email: "b@example.com" })
    await upsertProfile(db, {
      userId: "user_2",
      handle: "b",
      displayName: "B",
    })
    const updated = await upsertProfile(db, {
      userId: "user_2",
      handle: "bee",
      displayName: "Bee",
    })
    expect(updated.handle).toBe("bee")
  })
})
