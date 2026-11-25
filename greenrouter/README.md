# GreenRoute database

Run the development API with Node.js 22 or newer:

```sh
npm ci
npm run db:migrate
npm run dev -- --port 3017
```

Development uses PGlite, an embedded PostgreSQL engine. Data persists in
`.data/postgres`. Stop the dev server before running migrations or opening
that database from another process. The migration command records migration
001 and can be rerun. The model ranks are provisional and benchmark and
water data start empty.

To use a dedicated PostgreSQL 16+ database instead, set DATABASE_URL in
the server environment or local .env.local before running the migration.
Production requires DATABASE_URL. Keep that URL server-side.

Test the development endpoint:

```sh
curl -X POST http://127.0.0.1:3017/api/recommend \
  -H 'Content-Type: application/json' \
  -d '{"activity":"concept","difficulty":"basic"}'
```

Leave out difficulty to get the follow-up question. With a difficulty,
the API writes a recommendation and links the benchmark evidence it used.
The initial response is manual_selection until both active models have
benchmark scores for that activity and difficulty. The water field
reports unavailable because serving-provider data has yet to be connected.

The recommendation endpoint sets a session cookie. Before adding public run and feedback endpoints, use a signed session token or server-side session validation for ownership checks. Save the recommendation and its benchmark links in a single transaction. For missing evidence, leave recommended_model_id null and store the reason for manual selection. Insert benchmark versions as new rows so existing recommendations keep their evidence.

Before calling OpenRouter, insert the run with its client-generated UUID. Only the request that successfully inserts the row may call OpenRouter. On conflict, check session ownership and return the current status. A retry uses a fresh UUID. Let the API check that a model is allowed and that answer ratings attach to successful runs.

A feedback row with recommendation_id rates recommendation clarity. A row with run_id rates answer usefulness. Each target supports one rating, editable through an upsert. The database stores no student prompts or generated answers.
