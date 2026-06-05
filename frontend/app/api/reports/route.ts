import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { EvaluationReportsResponseSchema } from '@/types/schemas';
import { createClient } from '@/lib/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Read pagination and sorting params from the request URL
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('page_size') || '15';
    const view = searchParams.get('view');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortDirection = searchParams.get('sort_direction') || 'desc';

    // Resolve "me" view into uploaded_by UUID
    const backendParams = new URLSearchParams({ page, page_size: pageSize, sort_by: sortBy, sort_direction: sortDirection });
    if (view === 'me') {
      backendParams.set('uploaded_by', session.user.id);
    }

    // Call backend API with JWT token
    const response = await fetch(`${BACKEND_URL}/api/v1/evaluation/reports?${backendParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch reports' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    // Validate the response data using Zod schema
    const parseResult = EvaluationReportsResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: parseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
