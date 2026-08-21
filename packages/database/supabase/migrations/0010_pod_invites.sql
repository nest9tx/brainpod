-- Pod invitations: allow Directors to invite collaborators by email
-- before or after the invitee has a Brainpod account.

CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE pod_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID REFERENCES mini_pods(id) ON DELETE CASCADE NOT NULL,
    invited_email TEXT NOT NULL,
    invited_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    can_direct BOOLEAN NOT NULL DEFAULT TRUE,
    status invite_status NOT NULL DEFAULT 'pending',
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    CONSTRAINT unique_pending_pod_email UNIQUE (pod_id, invited_email)
);

CREATE INDEX idx_pod_invites_email ON pod_invites (lower(invited_email));
CREATE INDEX idx_pod_invites_token ON pod_invites (token);
CREATE INDEX idx_pod_invites_inviter ON pod_invites (invited_by, created_at);

ALTER TABLE pod_invites ENABLE ROW LEVEL SECURITY;

-- Invitees and inviters can read their own invite rows; writes go through service role APIs.
CREATE POLICY pod_invites_self_read ON pod_invites
    FOR SELECT USING (
        invited_by = auth.uid()
        OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
