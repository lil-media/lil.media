export type ProfileInput = { handle: string; displayName: string }
export type PostInput = { content: string; mediaKey?: string }

export function validateProfileInput(data: {
  handle: string
  displayName: string
}): ProfileInput {
  const handle = data.handle.trim().toLowerCase()
  const displayName = data.displayName.trim()
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new Error("Handle must be 3–20 characters: a–z, 0–9, or underscore.")
  }
  if (displayName.length < 1 || displayName.length > 50) {
    throw new Error("Display name must be 1–50 characters.")
  }
  return { handle, displayName }
}

export function validatePostInput(data: {
  content: string
  mediaKey?: string
}): PostInput {
  const content = data.content.trim()
  const mediaKey = data.mediaKey?.trim() || undefined
  if (!content && !mediaKey) {
    throw new Error("Write something or attach an image.")
  }
  if (content.length > 500) {
    throw new Error("Posts must be 500 characters or fewer.")
  }
  return { content, mediaKey }
}
