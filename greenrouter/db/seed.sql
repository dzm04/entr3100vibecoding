INSERT INTO models (id, display_name, capability_rank) VALUES
    ('google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B A4B (free)', 1),
    ('google/gemma-4-31b-it:free', 'Gemma 4 31B (free)', 2)
, ('qwen/qwen3.5-9b', 'Qwen3.5-9B (paid)', 1)
, ('google/gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite (paid)', 2)
ON CONFLICT (id) DO NOTHING;
