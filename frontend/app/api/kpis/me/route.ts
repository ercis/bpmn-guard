import { NextResponse } from 'next/server';
import { KPIResponseSchema } from '@/types/schemas';
import { createClient } from '@/lib/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Call backend API /me endpoint with JWT token
    const response = await fetch(`${BACKEND_URL}/api/v1/kpis/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch personal KPIs' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    // Validate the response data using Zod schema
    const parseResult = KPIResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: parseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data);
  } catch (error) {
    console.error('Error fetching personal KPIs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
