#!/usr/bin/env bash
# Idempotently destroy a per-PR preview's Cloudflare resources: the Worker
# (lil-media-web-pr-<N>) and its isolated D1 database (lil-media-pr-<N>).
#
# Used by both the teardown workflow (PR closed) and the deploy workflow's
# end-of-run reconcile step (PR closed mid-deploy). Goes straight to the
# Cloudflare REST API so there's no confirmation prompt to satisfy and a 404
# ("already gone") counts as success.
#
# Required env:
#   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, PR_WORKER_NAME, PR_DB_NAME
# Optional:
#   GITHUB_OUTPUT  — if set, worker_status / db_status are written for later steps
#
# Always exits 0 (teardown should still report + comment); non-404 failures are
# surfaced as ::warning:: and reflected in the *_status values.
set -uo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?}" "${CLOUDFLARE_API_TOKEN:?}"
: "${PR_WORKER_NAME:?}" "${PR_DB_NAME:?}"

api_base="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"

# http METHOD PATH OUTFILE -> prints HTTP status code
http() {
  curl -sS -o "$3" -w '%{http_code}' -X "$1" "${api_base}$2" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json"
}

worker_status="🗑️ removed"
db_status="🗑️ removed"

echo "::group::Delete Worker ${PR_WORKER_NAME}"
code="$(http DELETE "/workers/scripts/${PR_WORKER_NAME}?force=true" /tmp/worker.json || echo 000)"
echo "HTTP ${code}"; cat /tmp/worker.json 2>/dev/null || true; echo
case "$code" in
  2*) ;;
  404) worker_status="already gone" ;;
  *) worker_status="⚠️ check manually"
     echo "::warning::Worker ${PR_WORKER_NAME} delete returned HTTP ${code}" ;;
esac
echo "::endgroup::"

echo "::group::Delete D1 ${PR_DB_NAME}"
code="$(http GET "/d1/database?name=${PR_DB_NAME}" /tmp/d1list.json || echo 000)"
uuid="$(jq -r --arg n "$PR_DB_NAME" '.result[]? | select(.name==$n) | .uuid' /tmp/d1list.json 2>/dev/null | head -n1)"
if [ "$code" != "200" ]; then
  db_status="⚠️ check manually"
  echo "::warning::D1 lookup for ${PR_DB_NAME} returned HTTP ${code}"
elif [ -z "$uuid" ]; then
  db_status="already gone"
  echo "No database named ${PR_DB_NAME}."
else
  dcode="$(http DELETE "/d1/database/${uuid}" /tmp/d1del.json || echo 000)"
  echo "HTTP ${dcode}"; cat /tmp/d1del.json 2>/dev/null || true; echo
  case "$dcode" in
    2*) ;;
    404) db_status="already gone" ;;
    *) db_status="⚠️ check manually"
       echo "::warning::D1 ${PR_DB_NAME} delete returned HTTP ${dcode}" ;;
  esac
fi
echo "::endgroup::"

echo "Worker: ${worker_status} | Database: ${db_status}"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "worker_status=${worker_status}"
    echo "db_status=${db_status}"
  } >> "$GITHUB_OUTPUT"
fi
