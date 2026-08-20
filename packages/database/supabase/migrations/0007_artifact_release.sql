-- Publication belongs to an individual study/artifact, not the entire pod.
ALTER TABLE artifacts
    ADD COLUMN public_release BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN public_summary TEXT;

CREATE INDEX idx_artifacts_public_release ON artifacts (pod_id, public_release)
    WHERE public_release = TRUE;

DROP POLICY IF EXISTS artifacts_visible_with_pod ON artifacts;

CREATE POLICY artifacts_member_or_released_read ON artifacts
    FOR SELECT USING (
        public_release = TRUE
        OR EXISTS (
            SELECT 1 FROM private_pod_permissions p
            WHERE p.pod_id = artifacts.pod_id
              AND p.profile_id = auth.uid()
        )
    );
