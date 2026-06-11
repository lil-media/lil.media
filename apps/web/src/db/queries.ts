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

export class HandleTakenError extends Error {
  constructor() {
    super("That handle is taken. Try another.")
    this.name = "HandleTakenError"
  }
}

function isHandleUniqueViolation(err: unknown): boolean {
  // D1 wraps the SQLite error in err.cause; the top-level message is the query text.
  // Check both to be safe. The SQLite error is: "UNIQUE constraint failed: profiles.handle"
  const message = err instanceof Error ? err.message : String(err)
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : String((err as { cause?: unknown } | null)?.cause ?? "")
  const text = `${message} ${cause}`
  return /UNIQUE constraint failed: profiles\.handle/i.test(text)
}

export async function upsertProfile(
  db: Db,
  input: { userId: string; handle: string; displayName: string; bio?: string }
) {
  try {
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
  } catch (err) {
    if (isHandleUniqueViolation(err)) throw new HandleTakenError()
    throw err
  }
}

export async function createPost(
  db: Db,
  input: {
    authorId: string
    content: string
    mediaKey?: string
    mediaType?: string
  }
) {
  const [post] = await db.insert(posts).values(input).returning()
  return post
}

export async function listRecentPosts(db: Db, limit = 50) {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      mediaKey: posts.mediaKey,
      mediaType: posts.mediaType,
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
