-- Tier-aware daily Director prompt limits.
-- free_public: 5 · sustaining_member: 50 · institutional_partner: 100
-- Collaboration remains invite-to-pod; institutional is a higher individual quota only for now.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS membership_status TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION daily_prompt_limit_for_role(p_role user_role)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'sustaining_member' THEN 50
    WHEN 'institutional_partner' THEN 100
    ELSE 5
  END;
$$;

CREATE OR REPLACE FUNCTION increment_daily_usage(p_daily_limit INT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
    v_role user_role;
    v_limit INT;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
    IF v_role IS NULL THEN
        v_role := 'free_public';
    END IF;

    v_limit := COALESCE(p_daily_limit, daily_prompt_limit_for_role(v_role));

    INSERT INTO daily_usage_logs (profile_id, usage_date, prompt_count)
    VALUES (auth.uid(), CURRENT_DATE, 1)
    ON CONFLICT (profile_id, usage_date)
    DO UPDATE SET prompt_count = daily_usage_logs.prompt_count + 1
    RETURNING prompt_count INTO v_count;

    IF v_count > v_limit THEN
        RAISE EXCEPTION 'daily_prompt_limit_exceeded';
    END IF;

    RETURN v_count;
END;
$$;
