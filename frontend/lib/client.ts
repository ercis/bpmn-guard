// Demo-mode replacement for the Supabase browser client.
// The existing UI code calls `createClient()` and uses the .auth surface; we return
// a stub that always reports the demo user as authenticated.
import { createDemoClient } from './demo'

export function createClient() {
  return createDemoClient()
}
