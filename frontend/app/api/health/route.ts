import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout for health checks
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Log the error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Health check failed: ${errorMessage}`);

    // Determine the type of failure for more informative status
    let status: 'unreachable' | 'timeout' | 'error' = 'unreachable';
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        status = 'timeout';
      } else if (error.name === 'SyntaxError') {
        // JSON parsing error - backend responded but with invalid JSON
        status = 'error';
      }
    }

    return NextResponse.json(
      {
        status,
        database: 'unknown',
        llm_api: 'unknown',
        bpmn_validation: 'unknown',
      },
      { status: 503 }
    );
  }
}
