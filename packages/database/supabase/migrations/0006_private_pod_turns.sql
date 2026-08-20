-- Public category hubs expose pod summaries, not raw conversation transcripts.
-- Keep turn access limited to explicit pod members even when a pod is released.
DROP POLICY IF EXISTS pod_turns_visible_with_pod ON pod_turns;

CREATE POLICY pod_turns_member_read ON pod_turns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM private_pod_permissions p
            WHERE p.pod_id = pod_turns.pod_id
              AND p.profile_id = auth.uid()
        )
    );
