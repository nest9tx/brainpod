-- A pod may remain private as a collaboration container while individual artifacts
-- are public. Permit only the pod metadata needed by a released artifact card.
DROP POLICY IF EXISTS mini_pods_public_read ON mini_pods;

CREATE POLICY mini_pods_public_read ON mini_pods
    FOR SELECT USING (
        status <> 'private_isolated'
        OR EXISTS (
            SELECT 1 FROM private_pod_permissions p
            WHERE p.pod_id = mini_pods.id
              AND p.profile_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM artifacts a
            WHERE a.pod_id = mini_pods.id
              AND a.public_release = TRUE
        )
    );

-- Earlier releases used the question as a placeholder summary; clear that duplicate
-- so owners can provide a real public description before releasing again.
UPDATE artifacts
SET public_release = FALSE, public_summary = NULL
WHERE public_summary IS NOT NULL
    AND question IS NOT NULL
    AND btrim(public_summary) = btrim(question);
