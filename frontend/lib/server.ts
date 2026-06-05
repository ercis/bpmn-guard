// Demo-mode replacement for the Supabase server (SSR) client. Same shape as the
// browser shim; cookies are unused because there's no real session to persist.
import { createDemoClient } from './demo'

export async function createClient() {
  return createDemoClient()
}
