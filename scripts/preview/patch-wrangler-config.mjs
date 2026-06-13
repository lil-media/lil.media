#!/usr/bin/env node
// Rewrites apps/web/wrangler.jsonc's `preview` environment in place so a single
// PR can be deployed as an isolated, ephemeral Worker.
//
// Per-PR previews reuse the existing `preview` Wrangler environment (shared R2
// bucket, preview vars) but swap in:
//   - a PR-scoped Worker name  -> lil-media-web-pr-<N>
//   - a PR-scoped, ISOLATED D1 -> lil-media-pr-<N> (its own database_id)
//
// The @cloudflare/vite-plugin bakes binding config into the build output from
// the env named by CLOUDFLARE_ENV, so we patch the file on the CI runner BEFORE
// `CLOUDFLARE_ENV=preview pnpm build`. R2 is intentionally left shared — object
// keys are random UUIDs and the feed is driven by the (isolated) D1, so there's
// nothing to collide.
//
// This runs only against the runner's throwaway checkout; the change is never
// committed. Values come from the environment so untrusted PR strings never
// reach a shell:
//   PR_WORKER_NAME  e.g. lil-media-web-pr-42
//   PR_DB_NAME      e.g. lil-media-pr-42
//   PR_DB_ID        the D1 database_id (uuid) created for this PR
//   WRANGLER_CONFIG optional path override (default: apps/web/wrangler.jsonc)

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const configPath = resolve(
  repoRoot,
  process.env.WRANGLER_CONFIG ?? "apps/web/wrangler.jsonc"
)

// Strip // line and /* */ block comments while respecting string literals and
// escapes, so a JSONC file parses as JSON. (wrangler.jsonc uses only line
// comments today, but this stays correct if that changes.)
function stripJsonComments(text) {
  let out = ""
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inString) {
      out += c
      if (c === "\\") {
        // Copy the escaped char verbatim so an escaped quote can't end the string.
        out += text[i + 1] ?? ""
        i++
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++
      out += "\n"
      continue
    }
    if (c === "/" && next === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++
      i++ // land on the '/' of '*/'; loop's i++ steps past it
      continue
    }
    out += c
  }
  return out
}

function fail(msg) {
  console.error(`patch-wrangler-config: ${msg}`)
  process.exit(1)
}

const workerName = process.env.PR_WORKER_NAME
const dbName = process.env.PR_DB_NAME
const dbId = process.env.PR_DB_ID

// Defensively validate: these are derived from a PR number, so anything else
// signals a wiring bug, not a valid input.
if (!/^lil-media-web-pr-\d+$/.test(workerName ?? ""))
  fail(
    `PR_WORKER_NAME is not a valid PR worker name: ${JSON.stringify(workerName)}`
  )
if (!/^lil-media-pr-\d+$/.test(dbName ?? ""))
  fail(`PR_DB_NAME is not a valid PR database name: ${JSON.stringify(dbName)}`)
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    dbId ?? ""
  )
)
  fail(`PR_DB_ID is not a valid D1 database id (uuid): ${JSON.stringify(dbId)}`)

let config
try {
  config = JSON.parse(stripJsonComments(readFileSync(configPath, "utf8")))
} catch (err) {
  fail(`could not parse ${configPath}: ${err.message}`)
}

const preview = config?.env?.preview
if (!preview) fail("config has no env.preview block to patch")
const d1 = preview.d1_databases?.[0]
if (!d1) fail("env.preview has no d1_databases[0] to patch")

preview.name = workerName
d1.database_name = dbName
d1.database_id = dbId

writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")

console.log(
  `patched ${configPath}: env.preview.name=${workerName}, ` +
    `d1[0]={name:${dbName}, id:${dbId}}`
)
