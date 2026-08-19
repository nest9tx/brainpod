-- Brainpod initial schema + Row Level Security
-- Assumes profiles.id == auth.uid() (one profile row per Supabase auth user; agents/BYOA
-- rows are created by service-role and have no matching auth user, which is fine since
-- they're never written to via the anon/browser client).

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('free_public', 'sustaining_member', 'institutional_partner', 'native_agent', 'byoa_agent');
CREATE TYPE pod_status AS ENUM ('active', 'hibernating', 'deep_sleep', 'private_isolated');
CREATE TYPE artifact_type AS ENUM ('code_script', 'structured_analysis', 'research_synthesis');
CREATE TYPE contribution_type AS ENUM ('artifact_verified', 'strategic_direction', 'constructive_critique', 'equitable_participation');
CREATE TYPE outreach_status AS ENUM ('pending_review', 'approved_dispatched', 'rejected_discarded');

-- 2. DYNAMIC CATEGORIES TABLE (Replaces static enum for future-proof scaling)
CREATE TABLE main_categories (
    slug VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES TABLE (With explicit research consent tracking)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'free_public',
    current_pov INT NOT NULL DEFAULT 0,
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    research_consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
    research_consent_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DAILY USAGE QUOTA TRACKER (Protects against compute runaway)
CREATE TABLE daily_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    prompt_count INT NOT NULL DEFAULT 0,
    CONSTRAINT unique_profile_date_quota UNIQUE (profile_id, usage_date)
);

-- 5. MINI PODS TABLE (Links directly to dynamic categories)
CREATE TABLE mini_pods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category_slug VARCHAR(50) REFERENCES main_categories(slug) NOT NULL,
    status pod_status NOT NULL DEFAULT 'active',
    rolling_summary TEXT NOT NULL DEFAULT 'Initial context baseline setting up...',
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRIVATE POD ACCESS CONTROL (Explicit access control list for isolated rooms)
CREATE TABLE private_pod_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES mini_pods(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    can_direct BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_pod_profile_access UNIQUE (pod_id, profile_id)
);

-- 7. CALMED TIMELINE INTERACTION LOGS
CREATE TABLE pod_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES mini_pods(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) NOT NULL,
    summary_conclusion TEXT NOT NULL,
    collapsed_reasoning TEXT,
    turn_sequence INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. VERIFIED ARTIFACTS TABLE
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES mini_pods(id) ON DELETE CASCADE NOT NULL,
    turn_id UUID REFERENCES pod_turns(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES profiles(id) NOT NULL,
    type artifact_type NOT NULL,
    content TEXT NOT NULL,
    veritas_score INT CHECK (veritas_score BETWEEN 0 AND 100),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SOULBOUND PROOF-OF-VALUE LEDGER (Immutable Registry)
CREATE TABLE pov_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    pod_id UUID REFERENCES mini_pods(id) ON DELETE SET NULL,
    artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    delta INT NOT NULL,
    reason_category contribution_type NOT NULL,
    action_reference_log TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. GROWTH PIPELINE (Human-in-the-Loop Content Gate)
CREATE TABLE outreach_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_url TEXT NOT NULL UNIQUE,
    target_platform VARCHAR(50) NOT NULL,
    target_context_match TEXT NOT NULL,
    proposed_message_body TEXT NOT NULL,
    generated_artifact TEXT,
    status outreach_status NOT NULL DEFAULT 'pending_review',
    rejection_reason_tag VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- 11. HIGH-PERFORMANCE SEARCH INDICES
CREATE INDEX idx_profiles_pov ON profiles(current_pov DESC);
CREATE INDEX idx_daily_usage_lookup ON daily_usage_logs(profile_id, usage_date);
CREATE INDEX idx_mini_pods_lookup ON mini_pods(category_slug, status);
CREATE INDEX idx_pod_permissions ON private_pod_permissions(profile_id);
CREATE INDEX idx_pod_turns_sequence ON pod_turns(pod_id, turn_sequence);
CREATE INDEX idx_artifacts_verification ON artifacts(pod_id, is_verified);
CREATE INDEX idx_pov_ledger_profile ON pov_ledger(profile_id);
CREATE INDEX idx_outreach_status ON outreach_pipeline(status);

-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- Default posture: deny-all, then open narrow, explicit windows.
-- =====================================================================

ALTER TABLE main_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_pod_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pov_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_pipeline ENABLE ROW LEVEL SECURITY;

-- Categories: public reference data, readable by everyone, writable only by service role.
CREATE POLICY main_categories_public_read ON main_categories
    FOR SELECT USING (true);

-- Profiles: reputation is public by design (PoV ledger is public), but you can only
-- change your own row, and never your own role or current_pov (those are server-managed).
CREATE POLICY profiles_public_read ON profiles
    FOR SELECT USING (true);

CREATE POLICY profiles_self_update ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())
        AND current_pov = (SELECT current_pov FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY profiles_self_insert ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Daily usage: a human may read only their own quota row; increments happen through
-- the increment_daily_usage() function below, never a direct client write.
CREATE POLICY daily_usage_self_read ON daily_usage_logs
    FOR SELECT USING (auth.uid() = profile_id);

-- Mini pods: public pods are visible to everyone; private/isolated pods are visible
-- only to profiles granted access via private_pod_permissions.
CREATE POLICY mini_pods_public_read ON mini_pods
    FOR SELECT USING (
        status <> 'private_isolated'
        OR EXISTS (
            SELECT 1 FROM private_pod_permissions p
            WHERE p.pod_id = mini_pods.id AND p.profile_id = auth.uid()
        )
    );

CREATE POLICY mini_pods_creator_insert ON mini_pods
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Private pod permissions: visible only to the grantee (and implicitly to the service
-- role, which bypasses RLS entirely). No client-side grant/revoke.
CREATE POLICY private_pod_permissions_self_read ON private_pod_permissions
    FOR SELECT USING (auth.uid() = profile_id);

-- Pod turns / artifacts inherit the visibility of their parent pod.
CREATE POLICY pod_turns_visible_with_pod ON pod_turns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM mini_pods mp
            WHERE mp.id = pod_turns.pod_id
              AND (
                mp.status <> 'private_isolated'
                OR EXISTS (
                    SELECT 1 FROM private_pod_permissions p
                    WHERE p.pod_id = mp.id AND p.profile_id = auth.uid()
                )
              )
        )
    );

CREATE POLICY pod_turns_director_insert ON pod_turns
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM mini_pods mp
            WHERE mp.id = pod_turns.pod_id
              AND (
                mp.status <> 'private_isolated'
                OR EXISTS (
                    SELECT 1 FROM private_pod_permissions p
                    WHERE p.pod_id = mp.id AND p.profile_id = auth.uid() AND p.can_direct
                )
              )
        )
    );

CREATE POLICY artifacts_visible_with_pod ON artifacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM mini_pods mp
            WHERE mp.id = artifacts.pod_id
              AND (
                mp.status <> 'private_isolated'
                OR EXISTS (
                    SELECT 1 FROM private_pod_permissions p
                    WHERE p.pod_id = mp.id AND p.profile_id = auth.uid()
                )
              )
        )
    );

-- PoV ledger: public, immutable. Readable by everyone; no INSERT/UPDATE/DELETE policy
-- exists for anon/authenticated roles, so only the service role can write to it.
CREATE POLICY pov_ledger_public_read ON pov_ledger
    FOR SELECT USING (true);

-- Outreach pipeline is internal-only (Human Approval Gate); no anon/authenticated
-- policies at all means it is only reachable via the service role from a trusted admin UI.

-- Belt-and-suspenders: even service-role callers can't mutate history after the fact.
CREATE OR REPLACE FUNCTION reject_pov_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'pov_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pov_ledger_no_update
    BEFORE UPDATE ON pov_ledger
    FOR EACH ROW EXECUTE FUNCTION reject_pov_ledger_mutation();

CREATE TRIGGER pov_ledger_no_delete
    BEFORE DELETE ON pov_ledger
    FOR EACH ROW EXECUTE FUNCTION reject_pov_ledger_mutation();

-- Atomic, tier-aware free-prompt counter. SECURITY DEFINER so an authenticated user
-- can bump their own counter without a direct table-write policy (and can't backdate
-- someone else's, since profile_id is pinned to auth.uid()).
CREATE OR REPLACE FUNCTION increment_daily_usage(p_daily_limit INT DEFAULT 5)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    INSERT INTO daily_usage_logs (profile_id, usage_date, prompt_count)
    VALUES (auth.uid(), CURRENT_DATE, 1)
    ON CONFLICT (profile_id, usage_date)
    DO UPDATE SET prompt_count = daily_usage_logs.prompt_count + 1
    RETURNING prompt_count INTO v_count;

    IF v_count > p_daily_limit THEN
        RAISE EXCEPTION 'daily_prompt_limit_exceeded';
    END IF;

    RETURN v_count;
END;
$$;
