import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  IssueExclusionListResponseSchema,
  IssueExclusionSchema,
  IssueExclusionCreateSchema,
  BulkExclusionRequestSchema,
  BulkExclusionResponseSchema,
} from '@/types/schemas';
import { createClient } from '@/lib/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/reports/[id]/exclusions
 * List all exclusions for a report
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    const response = await fetch(`${BACKEND_URL}/api/v1/evaluation/reports/${id}/exclusions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch exclusions' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    const parseResult = IssueExclusionListResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: parseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data);

  } catch (error) {
    console.error('Error fetching exclusions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/[id]/exclusions
 * Create a single exclusion
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    const body = await request.json();

    // Validate request body
    const requestParseResult = IssueExclusionCreateSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: requestParseResult.error.issues },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/evaluation/reports/${id}/exclusions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create exclusion' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    const responseParseResult = IssueExclusionSchema.safeParse(rawData);

    if (!responseParseResult.success) {
      console.error('Validation error:', responseParseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: responseParseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(responseParseResult.data, { status: 201 });

  } catch (error) {
    console.error('Error creating exclusion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/[id]/exclusions
 * Bulk update exclusions (create multiple + delete multiple in one request)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    const body = await request.json();

    // Validate request body
    const requestParseResult = BulkExclusionRequestSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: requestParseResult.error.issues },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/evaluation/reports/${id}/exclusions`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to update exclusions' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    const responseParseResult = BulkExclusionResponseSchema.safeParse(rawData);

    if (!responseParseResult.success) {
      console.error('Validation error:', responseParseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: responseParseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(responseParseResult.data);

  } catch (error) {
    console.error('Error updating exclusions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
