import { NextRequest, NextResponse } from 'next/server';

// Thin proxy from the browser to the orchestra (FastAPI/LangGraph) swarm service.
// Keeps ORCHESTRA_SERVICE_URL server-side only and gives us one seam to add
// auth/rate-limiting before requests reach the swarm.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const orchestraUrl = process.env.ORCHESTRA_SERVICE_URL ?? 'http://localhost:8000';

  const response = await fetch(`${orchestraUrl}/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: 'orchestra_unavailable', detail },
      { status: 502 }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
