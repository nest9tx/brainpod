-- Content reports for the public commons (spam / self-promotion / off-mission).
-- Human-in-the-loop stewardship; no automated reputation penalties in this phase.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'self_promotion',
    'spam',
    'off_mission',
    'other'
  )),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'reviewed',
    'actioned',
    'dismissed'
  )),
  source TEXT NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'system')),
  steward_note TEXT CHECK (steward_note IS NULL OR char_length(steward_note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- One human report per Director per study (system reports may stack).
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_human_unique
  ON public.content_reports (artifact_id, reporter_id)
  WHERE source = 'human' AND reporter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_artifact_idx
  ON public.content_reports (artifact_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can insert their own human reports; anyone signed-in can attempt insert (API enforces).
CREATE POLICY content_reports_insert_own ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND source = 'human');

-- Reporters can see their own reports.
CREATE POLICY content_reports_select_own ON public.content_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- Stewards use service role via API for full queue access.
