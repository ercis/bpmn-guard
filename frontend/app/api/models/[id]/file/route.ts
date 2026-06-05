import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BPMNModelSchema } from '@/types/schemas';
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

    const response = await fetch(`${BACKEND_URL}/api/v1/models/${id}/file`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to download model file' },
        { status: response.status },
      );
    }

    // Stream the file bytes through to the client unchanged.
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'application/xml',
        'Content-Disposition': response.headers.get('Content-Disposition') ?? `attachment; filename="${id}.bpmn"`,
      },
    });
  } catch (error) {
    console.error('Error downloading model file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = session.access_token;

    // Parse multipart form data
    const formData = await request.formData();

    // Forward the form data to backend with authentication
    const response = await fetch(`${BACKEND_URL}/api/v1/models/${id}/file`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to replace model file' },
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

    return NextResponse.json(parseResult.data, { status: 200 });
  } catch (error) {
    console.error('Error replacing model file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
