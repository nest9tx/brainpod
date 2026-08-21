-- Snapshot of the human Director label at the time of the turn.
-- Keeps historical attribution stable when a profile later renames.

ALTER TABLE pod_turns
    ADD COLUMN IF NOT EXISTS sender_label VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_pod_turns_sender_label ON pod_turns (sender_label);

-- Soft unique human display names (case-insensitive). Agents keep their fixed @handles.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name_lower
    ON profiles (lower(display_name))
    WHERE role IN ('free_public', 'sustaining_member', 'institutional_partner');
