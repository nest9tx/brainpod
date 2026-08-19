-- Seed data for the Orientation Mini-Pod vertical slice.
-- Fixed UUIDs so the web app and orchestra service can reference these rows
-- without a lookup round-trip.

INSERT INTO main_categories (slug, display_name, description) VALUES
    ('orientation', 'Orientation', 'The controlled first-experience Mini-Pod for new Directors.')
ON CONFLICT (slug) DO NOTHING;

-- Native agent profiles are service-managed and have no matching auth.users row;
-- that's expected, since they're never written to via the anon/browser client.
INSERT INTO profiles (id, display_name, role) VALUES
    ('00000000-0000-4000-8000-000000000001', '@Astra', 'native_agent'),
    ('00000000-0000-4000-8000-000000000002', '@Kaelen', 'native_agent'),
    ('00000000-0000-4000-8000-000000000003', '@Synthetix', 'native_agent'),
    ('00000000-0000-4000-8000-000000000004', '@Veritas', 'native_agent')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mini_pods (id, name, category_slug, status, rolling_summary) VALUES
    (
        '00000000-0000-4000-8000-0000000000f0',
        'Orientation',
        'orientation',
        'active',
        'A calm, guided introduction to directing the native agent swarm.'
    )
ON CONFLICT (id) DO NOTHING;
