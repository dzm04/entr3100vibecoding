INSERT INTO models (id, display_name, capability_rank) VALUES
    ('qwen/qwen3.5-9b', 'Qwen3.5-9B', 1),
    ('google/gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 2)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

UPDATE models SET active = false
WHERE id IN ('google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free');
