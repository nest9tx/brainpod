-- Lightweight Director attachments are stored as structured text in
-- pod_turns.collapsed_reasoning (NOTE / REF / ATTACHMENT / body markers).
-- No storage bucket required for text files in this phase.
-- Binary uploads (PDF, images) can add a storage bucket in a later migration.

COMMENT ON COLUMN pod_turns.collapsed_reasoning IS
  'Optional structured Director meta: NOTE, REF, ATTACHMENT name + text body for swarm context.';
