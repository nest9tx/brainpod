-- Denormalized so we can check "has this exact question already been verified?"
-- without joining back through pod_turns/turn_sequence arithmetic.
ALTER TABLE artifacts ADD COLUMN question TEXT;

CREATE INDEX idx_artifacts_question_verified ON artifacts (pod_id, is_verified) WHERE question IS NOT NULL;
