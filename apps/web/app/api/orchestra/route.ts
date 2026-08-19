import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AGENT_PROFILE_ID_BY_NAME, ORIENTATION_POD_ID } from '@/lib/constants';

type SwarmTurn = { agent: string; summary_conclusion: string };

// Auth + quota gate, then proxy from the browser to the orchestra (FastAPI/LangGraph)
// swarm service, persisting both the Director's turn and each agent's turn to pod_turns.
export async function POST(request: NextRequest) {
  const { director_prompt: directorPrompt } = await request.json();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // SECURITY DEFINER function enforces the 5/day free-tier ceiling atomically.
  const { error: quotaError } = await supabase.rpc('increment_daily_usage');
  if (quotaError) {
    return NextResponse.json({ error: 'daily_prompt_limit_exceeded' }, { status: 429 });
  }

  const { count } = await supabase
    .from('pod_turns')
    .select('id', { count: 'exact', head: true })
    .eq('pod_id', ORIENTATION_POD_ID);
  const nextSequence = (count ?? 0) + 1;

  // Director's own turn: RLS requires sender_id = auth.uid(), so the user's session
  // client (not the admin client) performs this insert.
  const { error: directorTurnError } = await supabase.from('pod_turns').insert({
    pod_id: ORIENTATION_POD_ID,
    sender_id: user.id,
    summary_conclusion: directorPrompt,
    turn_sequence: nextSequence,
  });
  if (directorTurnError) {
    return NextResponse.json(
      { error: 'turn_insert_failed', detail: directorTurnError.message },
      { status: 500 }
    );
  }

  const orchestraUrl = process.env.ORCHESTRA_SERVICE_URL ?? 'http://localhost:8000';
  const response = await fetch(`${orchestraUrl}/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ director_prompt: directorPrompt }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: 'orchestra_unavailable', detail }, { status: 502 });
  }

  const { turns } = (await response.json()) as { turns: SwarmTurn[] };

  // Agent turns: sender_id is a native-agent profile, not the human, so RLS would
  // reject a user-session insert here — this is exactly what the admin client is for.
  const admin = createAdminClient();
  const { error: agentTurnsError } = await admin.from('pod_turns').insert(
    turns.map((turn, i) => ({
      pod_id: ORIENTATION_POD_ID,
      sender_id: AGENT_PROFILE_ID_BY_NAME[turn.agent],
      summary_conclusion: turn.summary_conclusion,
      turn_sequence: nextSequence + i + 1,
    }))
  );
  if (agentTurnsError) {
    return NextResponse.json(
      { error: 'agent_turn_insert_failed', detail: agentTurnsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ turns });
}
