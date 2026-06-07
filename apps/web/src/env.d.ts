// R2 S3 API credentials for presigning upload URLs. Set as Worker secrets
// (wrangler secret put ...) per environment and in .dev.vars / CI locally.
// Declared here because they aren't in wrangler.jsonc, so `wrangler types`
// won't generate them.
declare global {
  namespace Cloudflare {
    interface Env {
      R2_ACCESS_KEY_ID: string
      R2_SECRET_ACCESS_KEY: string
    }
  }
}

export {}
