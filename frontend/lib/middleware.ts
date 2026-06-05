// Demo mode: every request is "authenticated" as the demo user, so the middleware
// is a no-op pass-through. Kept around so the existing `updateSession` callers don't
// need to be deleted.
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(_request: NextRequest) {
  return NextResponse.next()
}
