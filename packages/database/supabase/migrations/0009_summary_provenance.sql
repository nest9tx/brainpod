-- A human-written release note is not an agent verification result.
-- Keep provenance explicit so future generated summaries can use a separate authority path.
ALTER TABLE artifacts
    ADD COLUMN public_summary_source VARCHAR(30) NOT NULL DEFAULT 'owner_authored';

ALTER TABLE artifacts
    ADD CONSTRAINT artifacts_public_summary_source_check
    CHECK (public_summary_source IN ('owner_authored', 'system_generated'));

-- Existing releases were entered by pod owners through the workspace UI.
UPDATE artifacts
SET public_summary_source = 'owner_authored'
WHERE public_summary IS NOT NULL;
