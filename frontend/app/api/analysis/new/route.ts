import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { StartAnalysisResponseSchema, AnalysisRequestSchema } from '@/types/schemas';
import { createClient } from '@/lib/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Parse JSON body to get model_id
    const body = await request.json();

    // Validate request body
    const requestParseResult = AnalysisRequestSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: requestParseResult.error.issues },
        { status: 400 }
      );
    }

    const { model_id } = requestParseResult.data;

    // Call backend analysis/new endpoint to start background evaluation
    const response = await fetch(`${BACKEND_URL}/api/v1/analyses/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model_id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to start analysis' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    // Validate the response data using Zod schema
    const responseParseResult = StartAnalysisResponseSchema.safeParse(rawData);

    if (!responseParseResult.success) {
      console.error('Validation error:', responseParseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: responseParseResult.error.issues },
        { status: 500 }
      );
    }

    // Return the analysis_id with 202 Accepted status
    return NextResponse.json(responseParseResult.data, { status: 202 });

  } catch (error) {
    console.error('Error starting analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
