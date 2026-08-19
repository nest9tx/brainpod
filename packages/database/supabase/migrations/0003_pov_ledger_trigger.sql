-- Keep profiles.current_pov as a live sum of the append-only ledger, so the app
-- never has to (and never should) write current_pov directly.
CREATE OR REPLACE FUNCTION apply_pov_ledger_delta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET current_pov = current_pov + NEW.delta WHERE id = NEW.profile_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER pov_ledger_apply_delta
    AFTER INSERT ON pov_ledger
    FOR EACH ROW EXECUTE FUNCTION apply_pov_ledger_delta();
