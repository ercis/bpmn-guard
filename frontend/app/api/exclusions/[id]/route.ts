import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { IssueExclusionDeleteResponseSchema } from '@/types/schemas';
import { createClient } from '@/lib/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * DELETE /api/exclusions/[id]
 * Delete a single exclusion (restore the issue)
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    const response = await fetch(`${BACKEND_URL}/api/v1/evaluation/exclusions/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to delete exclusion' },
        { status: response.status }
      );
    }

    const rawData = await response.json();

    const parseResult = IssueExclusionDeleteResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid response format from backend', details: parseResult.error.issues },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data);

  } catch (error) {
    console.error('Error deleting exclusion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
