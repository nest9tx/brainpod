-- Initial domain taxonomy for Mini-Pod organization.
-- Categories remain rows, not an enum, so new domains can be added without a schema change.
INSERT INTO main_categories (slug, display_name, description) VALUES
    ('tech_coding', 'Tech & Coding', 'Software, systems, infrastructure, and technical practice.'),
    ('science_biotech', 'Science & Biotech', 'Scientific research, biology, medicine, and related evidence.'),
    ('strategy_systems', 'Strategy & Systems', 'Organizations, governance, planning, and complex systems.'),
    ('creative_worldbuilding', 'Creative & Worldbuilding', 'Art, narrative, design, culture, and imagined worlds.'),
    ('cross_domain', 'Cross-Domain', 'Questions that deliberately bridge multiple fields.')
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;
