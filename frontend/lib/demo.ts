// Single fixed identity used by the demo-mode auth shims.
// Must match DEMO_USER_ID / DEMO_USER_EMAIL on the backend.

// Matches the subset of the Supabase User shape the UI reads. `any` on the metadata
// bags mirrors @supabase/supabase-js, where these are intentionally open-ended.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Metadata = Record<string, any>

export type DemoUser = {
  id: string
  email: string
  user_metadata: Metadata
  app_metadata: Metadata
  aud: string
  role: string
  created_at: string
  // Optional Supabase-User-shaped fields some pages read (account page).
  phone?: string
  last_sign_in_at?: string
  is_anonymous?: boolean
  identities?: Array<{
    provider: string
    id: string
    identity_data?: Metadata
    created_at?: string
    last_sign_in_at?: string
  }>
}

export const DEMO_USER: DemoUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@example.com',
  user_metadata: { full_name: 'Demo User' },
  app_metadata: { provider: 'demo' },
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '1970-01-01T00:00:00.000Z',
  phone: '',
  last_sign_in_at: undefined,
  is_anonymous: false,
  identities: [{ provider: 'demo', id: '00000000-0000-0000-0000-000000000001' }],
}

// The backend ignores this token in DEMO_MODE; it just needs to be a non-empty string so
// the existing `Authorization: Bearer …` plumbing in the API proxy routes keeps working.
export const DEMO_TOKEN = 'demo-mode-token'

export const DEMO_SESSION = {
  access_token: DEMO_TOKEN,
  refresh_token: DEMO_TOKEN,
  token_type: 'bearer',
  expires_in: 60 * 60 * 24 * 365 * 10,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10,
  user: DEMO_USER,
} as const

// Shape of the object the existing callers expect from createClient(). We only stub the
// auth surface they actually use: getSession, getUser, signInWithPassword, signUp,
// signOut, onAuthStateChange.
export type DemoClient = ReturnType<typeof createDemoClient>

export function createDemoClient() {
  const auth = {
    getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
    getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
    signInWithPassword: async (_credentials?: { email?: string; password?: string }) => ({
      data: { session: DEMO_SESSION, user: DEMO_USER },
      error: null,
    }),
    signUp: async (_credentials?: {
      email?: string
      password?: string
      options?: Record<string, unknown>
    }) => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (
      _cb: (event: string, session: typeof DEMO_SESSION) => void,
    ) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  }
  return { auth }
}
