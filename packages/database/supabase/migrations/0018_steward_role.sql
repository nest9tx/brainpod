-- Steward role for human review of public commons reports.
-- Not a paid tier; access is gated in app code via role or STEWARD_USER_IDS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'steward'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'steward';
  END IF;
END
$$;

-- Steward gets a high individual quota (same band as institutional) so review work is not blocked.
CREATE OR REPLACE FUNCTION daily_prompt_limit_for_role(p_role user_role)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'sustaining_member' THEN 50
    WHEN 'institutional_partner' THEN 100
    WHEN 'steward' THEN 100
    ELSE 5
  END;
$$;
