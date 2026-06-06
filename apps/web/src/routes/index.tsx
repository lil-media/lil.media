import { SignInButton, UserButton } from "@clerk/tanstack-react-start"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

import {
  createPostFn,
  getFeedFn,
  getViewerFn,
  saveProfileFn,
} from "@/server/feed"

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const [feed, viewer] = await Promise.all([getFeedFn(), getViewerFn()])
    return { feed, viewer }
  },
})

function Home() {
  const { feed, viewer } = Route.useLoaderData()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">lil.media</h1>
        {viewer.signedIn ? (
          <UserButton />
        ) : (
          <SignInButton mode="modal">
            <Button size="sm">Sign in</Button>
          </SignInButton>
        )}
      </header>

      {viewer.signedIn ? (
        viewer.profile ? (
          <Composer />
        ) : (
          <ProfileForm />
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in to create your profile and start posting.
        </p>
      )}

      <Feed posts={feed} />
    </main>
  )
}

const fieldClass =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

function ProfileForm() {
  const router = useRouter()
  const [handle, setHandle] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await saveProfileFn({ data: { handle, displayName } })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Create your profile</h2>
      <input
        className={fieldClass}
        placeholder="handle (e.g. adam)"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
      />
      <input
        className={fieldClass}
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Create profile"}
        </Button>
      </div>
    </form>
  )
}

function Composer() {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await createPostFn({ data: { content } })
      setContent("")
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <textarea
        className={fieldClass}
        placeholder="What's happening?"
        rows={3}
        maxLength={500}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={pending || content.trim().length === 0}
        >
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
    </form>
  )
}

function Feed({ posts }: { posts: Awaited<ReturnType<typeof getFeedFn>> }) {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No posts yet. Be the first.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {posts.map((post) => (
        <li key={post.id} className="rounded-lg border border-border p-3">
          <div className="flex items-baseline gap-2">
            <span className="font-medium">{post.authorName ?? "Someone"}</span>
            <span className="text-xs text-muted-foreground">
              @{post.authorHandle ?? "unknown"}
            </span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{post.content}</p>
        </li>
      ))}
    </ul>
  )
}
