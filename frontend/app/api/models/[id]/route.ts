import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BPMNModelSchema, BPMNModelDeleteResponseSchema, BPMNModelUpdateSchema } from '@/types/schemas';
import { createClient } from '@/lib/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Call backend API with JWT token
    const response = await fetch(`${BACKEND_URL}/api/v1/models/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch model' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    // Validate the response data using Zod schema
    const parseResult = BPMNModelSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: parseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data);
  } catch (error) {
    console.error('Error fetching model:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Get request body
    const body = await request.json();

    // Validate request body
    const requestParseResult = BPMNModelUpdateSchema.safeParse(body);
    if (!requestParseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: requestParseResult.error.issues },
        { status: 400 }
      );
    }

    // Call backend API with JWT token
    const response = await fetch(`${BACKEND_URL}/api/v1/models/${id}`, {
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
        { error: errorData.detail || 'Failed to update model' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    // Validate the response data using Zod schema
    const responseParseResult = BPMNModelSchema.safeParse(rawData);

    if (!responseParseResult.success) {
      console.error('Validation error:', responseParseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: responseParseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(responseParseResult.data);
  } catch (error) {
    console.error('Error updating model:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Call backend API with JWT token
    const response = await fetch(`${BACKEND_URL}/api/v1/models/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to delete model' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    // Validate the response data using Zod schema
    const parseResult = BPMNModelDeleteResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: parseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data);
  } catch (error) {
    console.error('Error deleting model:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
