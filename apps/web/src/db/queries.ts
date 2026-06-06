import { desc, eq } from "drizzle-orm"

import type { Db } from "./index"
import { posts, profiles, users } from "./schema"

export async function upsertUser(db: Db, user: { id: string; email: string }) {
  await db
    .insert(users)
    .values(user)
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } })
}

export async function getProfile(db: Db, userId: string) {
  return db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
}

export async function upsertProfile(
  db: Db,
  input: { userId: string; handle: string; displayName: string; bio?: string }
) {
  const [profile] = await db
    .insert(profiles)
    .values(input)
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        handle: input.handle,
        displayName: input.displayName,
        bio: input.bio,
      },
    })
    .returning()
  return profile
}

export async function createPost(
  db: Db,
  input: { authorId: string; content: string }
) {
  const [post] = await db.insert(posts).values(input).returning()
  return post
}

export async function listRecentPosts(db: Db, limit = 50) {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorHandle: profiles.handle,
      authorName: profiles.displayName,
    })
    .from(posts)
    .leftJoin(profiles, eq(profiles.userId, posts.authorId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}
