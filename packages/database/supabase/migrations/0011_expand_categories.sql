-- Expand domain taxonomy for multi-field collaboration.
-- Categories are rows (not enums) so this is additive only.

INSERT INTO main_categories (slug, display_name, description) VALUES
    ('medicine_health', 'Medicine & Health', 'Clinical reasoning, public health, biomedical research, and care systems.'),
    ('law_policy', 'Law & Policy', 'Legal analysis, regulation, rights, governance, and institutional design.'),
    ('ai_alignment', 'AI & Alignment', 'Machine intelligence, human–AI collaboration, evaluation, and safety research.'),
    ('education_learning', 'Education & Learning', 'Pedagogy, curriculum, assessment, and collective knowledge building.'),
    ('climate_earth', 'Climate & Earth Systems', 'Climate science, ecology, energy transition, and planetary systems.')
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Soft-refine existing biotech category wording so Medicine stands as its own hub.
UPDATE main_categories
SET description = 'Scientific research, biology, laboratory practice, and related evidence.'
WHERE slug = 'science_biotech';
