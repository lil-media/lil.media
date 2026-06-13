# Per-PR preview deployments

Every pull request from a branch in this repo gets its own ephemeral, isolated
preview of `apps/web`, deployed to Cloudflare Workers and torn down when the PR
closes. Status shows up as a single self-updating comment on the PR.

- **Deploy:** [`.github/workflows/pr-preview-deploy.yml`](../.github/workflows/pr-preview-deploy.yml)
- **Teardown:** [`.github/workflows/pr-preview-teardown.yml`](../.github/workflows/pr-preview-teardown.yml)
- **Status comment:** [`.github/actions/preview-comment`](../.github/actions/preview-comment/action.yml)
- **Config patcher:** [`scripts/preview/patch-wrangler-config.mjs`](../scripts/preview/patch-wrangler-config.mjs)

## What each PR gets

| Resource    | Value                                                                         | Lifecycle                                                        |
| ----------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Worker      | `lil-media-web-pr-<N>` at `https://lil-media-web-pr-<N>.adam-730.workers.dev` | created on open, redeployed on push, deleted on close            |
| D1 database | `lil-media-pr-<N>`                                                            | **isolated** — created on open, migrated fresh, deleted on close |
| R2 bucket   | `lil-media-uploads-preview`                                                   | **shared** with staging and all other PRs                        |
| Clerk       | DEV keys (same as staging)                                                    | n/a                                                              |

### Why D1 is isolated but R2 is shared

The cross-PR confusion you actually hit comes from the **database**: a migration
in one PR changing the schema another PR's Worker expects, or test rows from PR A
showing up in PR B's feed. Giving each PR its own D1 eliminates both.

R2 doesn't need isolating. Object keys are random UUIDs
([`storage.ts`](../apps/web/src/server/storage.ts)), so uploads never collide,
and the feed only renders images a **D1 row** references — since D1 is isolated,
PR A's uploads can't appear in PR B's feed even though the bytes share one
bucket. Sharing the bucket also avoids the expensive half of the churn (R2
buckets must be emptied object-by-object before they can be deleted, and each
needs its own CORS policy). A lifecycle rule bounds orphaned objects instead.

## One-time setup

These are done once by a maintainer, not per PR.

### 1. Secrets and variables on the `preview` environment

The deploy reuses the existing `preview` GitHub Environment. It must contain:

| Name                         | Kind     | Notes                                           |
| ---------------------------- | -------- | ----------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`       | secret   | scopes below                                    |
| `CLOUDFLARE_ACCOUNT_ID`      | secret   | already present                                 |
| `CLERK_SECRET_KEY`           | secret   | already present (used by E2E)                   |
| `R2_ACCESS_KEY_ID`           | secret   | **add this** — R2 S3 key for presigning uploads |
| `R2_SECRET_ACCESS_KEY`       | secret   | **add this** — R2 S3 secret                     |
| `VITE_CLERK_PUBLISHABLE_KEY` | variable | already present (public `pk_test_…`)            |

A fresh Worker starts with **no** secrets, so the deploy pushes
`CLERK_SECRET_KEY`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` onto each PR
Worker. All three are **required** — they back Clerk server auth and R2
presigning, and a preview missing any of them would 500 on auth or uploads. If
one is absent the deploy **fails loudly** (pointing you here) rather than
shipping a broken-but-green preview; add the secret and the next push retries.

### 2. Cloudflare API token scopes

The `CLOUDFLARE_API_TOKEN` needs these **account-level** permissions:

- **Workers Scripts: Edit** — deploy and delete PR Workers
- **D1: Edit** — create, migrate, and delete PR databases
- **Account Settings: Read** — resolve the account

(The one-time R2 commands below also need **Workers R2 Storage: Edit**, but the
per-PR workflows never touch R2, so the token used in CI doesn't need it.)

### 3. Shared preview bucket: CORS + lifecycle

Run once, from `apps/web`, with credentials that have R2 edit access. CORS lets
every PR Worker origin upload directly to R2; the lifecycle rule auto-expires
orphaned objects so the shared bucket doesn't grow without bound.

```bash
# Allow uploads from any origin (staging + every dynamic PR worker origin).
wrangler r2 bucket cors set lil-media-uploads-preview --file r2-cors.json --force

# Auto-delete preview objects after 14 days (tune as you like).
wrangler r2 bucket lifecycle add lil-media-uploads-preview \
  --name expire-preview --prefix "" --expire-days 14
```

> R2 matches CORS `AllowedOrigins` **exactly** — there's no subdomain-wildcard
> support, only a bare `"*"`. Because per-PR workers live at dynamic origins
> (`https://lil-media-web-pr-<N>.adam-730.workers.dev`) that can't be enumerated
> ahead of time, [`r2-cors.json`](../apps/web/r2-cors.json) uses `"*"`. That's
> safe for this bucket: CORS only decides which browser origins may issue the
> request — the **presigned URL** (10-minute expiry, signed with the R2 key) is
> what actually authorizes the upload, and `verifyUpload` re-checks size/type
> server-side. To verify the policy took effect:
>
> ```bash
> curl -sI -X OPTIONS \
>   "https://<account>.r2.cloudflarestorage.com/lil-media-uploads-preview/probe" \
>   -H "Origin: https://lil-media-web-pr-42.adam-730.workers.dev" \
>   -H "Access-Control-Request-Method: PUT" \
>   -H "Access-Control-Request-Headers: content-type"
> # expect an Access-Control-Allow-Origin header in the response
> ```

## How a deploy flows

1. Derive `lil-media-web-pr-<N>` / `lil-media-pr-<N>` from the integer PR number.
2. Post the "⏳ deploying" status comment.
3. Create-or-reuse the PR's D1 database and capture its `database_id`.
4. Patch the runner's copy of `wrangler.jsonc` so the `preview` env points at the
   PR Worker name + isolated D1 (R2 stays the shared preview bucket).
5. Apply migrations to the PR database (the whole job runs with
   `CLOUDFLARE_ENV=preview`, so wrangler resolves the patched `preview` env).
6. Build, then `wrangler deploy`.
7. Push the runtime secrets onto the new Worker.
8. Update the comment to "✅ ready" with the URL.

Teardown (on PR close, merged or not) deletes the Worker and the D1 database via
the Cloudflare API ([`scripts/preview/destroy-preview.sh`](../scripts/preview/destroy-preview.sh))
and updates the comment to "🧹 torn down".

## Hardening notes

- **No `pull_request_target`.** Both workflows use `pull_request`, and the deploy
  job is gated to **same-repo branches** (`head.repo.full_name == repository`).
  Untrusted fork code therefore never runs with deploy secrets; fork PRs get no
  preview.
- **Least-privilege `GITHUB_TOKEN`.** Top-level `permissions: {}`; each job is
  granted only `contents: read` + `pull-requests: write`.
- **Pinned actions.** Every action is pinned to a full commit SHA; Dependabot
  ([`.github/dependabot.yml`](../.github/dependabot.yml)) keeps them current.
- **No script injection.** PR-controlled strings (title, branch, body) are never
  interpolated into a shell or `github-script`; resource names come only from the
  integer PR number, and the comment body is passed via env.
- **Production is unreachable.** Every Wrangler/API mutation is scoped to the PR
  Worker / PR database by name, so `lil-media-web` and `lil-media` can't be hit.
- **Idempotent teardown.** A 404 from the delete API is treated as success, so
  re-runs and already-cleaned PRs are safe.
- **No orphans on a mid-deploy close.** If a PR is closed while its deploy is
  in flight (which cancels the run), an `if: always()` reconcile step re-checks
  the PR state and tears down anything it just created, so a teardown that ran
  first can't be undone by the finishing deploy.
- **Fail loud, not green.** All three runtime secrets are mandatory; a missing
  one fails the deploy with a pointer to fix it rather than publishing a preview
  whose auth or uploads silently error.

## Manual cleanup (rare)

If a teardown ever fails (the comment will say `⚠️ check manually`), list and
remove leftovers by hand:

```bash
# Workers whose name starts with the PR prefix:
wrangler deployments list            # or check the dashboard
wrangler delete --name lil-media-web-pr-<N>

# Databases:
wrangler d1 list
wrangler d1 delete lil-media-pr-<N> --skip-confirmation
```
