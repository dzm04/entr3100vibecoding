BEGIN;

CREATE TABLE models (
    id text PRIMARY KEY,
    display_name text NOT NULL,
    capability_rank smallint NOT NULL CHECK (capability_rank > 0),
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE benchmarks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_id text NOT NULL REFERENCES models(id),
    activity text NOT NULL CHECK (activity IN ('concept', 'writing')),
    difficulty text NOT NULL CHECK (difficulty IN ('basic', 'advanced')),
    score numeric NOT NULL CHECK (score BETWEEN 0 AND 100),
    sample_count integer NOT NULL CHECK (sample_count > 0),
    rubric_version text NOT NULL,
    evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX benchmarks_lookup
    ON benchmarks (activity, difficulty, model_id, evaluated_at DESC, id DESC);

CREATE TABLE water_estimates (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_id text NOT NULL REFERENCES models(id),
    provider text NOT NULL,
    lower_ml numeric NOT NULL CHECK (lower_ml >= 0),
    upper_ml numeric NOT NULL CHECK (upper_ml >= lower_ml),
    measurement_scope text NOT NULL,
    request_profile text NOT NULL,
    source_url text NOT NULL,
    measured_on date NOT NULL
);

CREATE TABLE recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    activity text NOT NULL CHECK (activity IN ('concept', 'writing')),
    difficulty text NOT NULL CHECK (difficulty IN ('basic', 'advanced')),
    recommended_model_id text REFERENCES models(id),
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_benchmarks (
    recommendation_id uuid REFERENCES recommendations(id) ON DELETE CASCADE,
    benchmark_id bigint REFERENCES benchmarks(id),
    PRIMARY KEY (recommendation_id, benchmark_id)
);

CREATE TABLE runs (
    id uuid PRIMARY KEY,
    recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    requested_model_id text NOT NULL REFERENCES models(id),
    served_model_id text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'rate_limited', 'failed')),
    duration_ms integer CHECK (duration_ms >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (status <> 'succeeded' OR served_model_id IS NOT NULL)
);

CREATE INDEX runs_by_recommendation ON runs (recommendation_id);

CREATE TABLE feedback (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recommendation_id uuid REFERENCES recommendations(id) ON DELETE CASCADE,
    run_id uuid REFERENCES runs(id) ON DELETE CASCADE,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((recommendation_id IS NULL) <> (run_id IS NULL)),
    UNIQUE (recommendation_id),
    UNIQUE (run_id)
);

COMMIT;
