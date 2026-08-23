-- Stewardship is independent of membership tier.
-- role remains free_public | sustaining_member | institutional_partner | ...
-- is_steward is a boolean capability flag for commons review.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_steward BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_steward
  ON public.profiles (is_steward)
  WHERE is_steward = true;
