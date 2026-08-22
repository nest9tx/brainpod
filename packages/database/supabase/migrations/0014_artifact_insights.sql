-- Calm public insights on released studies.
-- One insight per signed-in Director per artifact. Not a social feed.

CREATE TABLE IF NOT EXISTS artifact_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 800),
    author_label VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (artifact_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_artifact_insights_artifact
    ON artifact_insights (artifact_id, created_at DESC);

ALTER TABLE artifact_insights ENABLE ROW LEVEL SECURITY;

-- Anyone can read insights only when the parent artifact is publicly released.
CREATE POLICY artifact_insights_select_public_release
    ON artifact_insights
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM artifacts a
            WHERE a.id = artifact_id
              AND a.public_release = true
        )
    );

-- Inserts are performed via service role in the API for label snapshot safety.
-- Authenticated users may also insert their own row when the artifact is public.
CREATE POLICY artifact_insights_insert_own
    ON artifact_insights
    FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM artifacts a
            WHERE a.id = artifact_id
              AND a.public_release = true
        )
    );

CREATE POLICY artifact_insights_delete_own
    ON artifact_insights
    FOR DELETE
    USING (auth.uid() = author_id);
