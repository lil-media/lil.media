import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"

import { createDb } from "./index"
import {
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
