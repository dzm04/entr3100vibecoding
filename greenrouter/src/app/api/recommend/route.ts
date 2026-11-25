import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { studyModelIds, studyModels } from '../../../lib/study-models';
import { routeStudyTask, routingModel } from '../../../lib/ai-router';
import { query } from '../../../lib/db';

export const runtime = 'nodejs';

type Candidate = {
  id: string;
  display_name: string;
  benchmark_id: string | null;
  score: number | null;
  sample_count: number | null;
  rubric_version: string | null;
};

const threshold = 80;
const activities = {
  concept: 'Does the task require comparing sources or implementations?',
  writing: 'Does the task require restructuring arguments or comparing sources?',
};

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }
  const activity = body?.activity;
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length > 8000) return NextResponse.json({ error: 'Keep your task under 8,000 characters.' }, { status: 400 });
  if (activity !== 'concept' && activity !== 'writing') {
    return NextResponse.json({ error: 'Choose concept or writing.' }, { status: 400 });
  }
  const routing = body?.difficulty === undefined && prompt ? await routeStudyTask(prompt, activity) : null;
  const difficulty = routing?.difficulty ?? body?.difficulty;
  if (difficulty === undefined) {
    return NextResponse.json({
      status: 'needs_clarification',
      question: activities[activity],
      routerUnavailable: Boolean(prompt),
      choices: [{ label: 'No', difficulty: 'basic' }, { label: 'Yes', difficulty: 'advanced' }],
    });
  }
  if (difficulty !== 'basic' && difficulty !== 'advanced') {
    return NextResponse.json({ error: 'Choose basic or advanced.' }, { status: 400 });
  }

  try {
    const rows = await query<Candidate>(`
      SELECT m.id, m.display_name, b.id::text AS benchmark_id, b.score::float8 AS score,
             b.sample_count, b.rubric_version
      FROM models m
      LEFT JOIN LATERAL (
        SELECT id, score, sample_count, rubric_version FROM benchmarks
        WHERE model_id = m.id AND activity = $1 AND difficulty = $2
        ORDER BY evaluated_at DESC, id DESC LIMIT 1
      ) b ON true
      WHERE m.active AND m.id = ANY($3::text[])
      ORDER BY m.capability_rank, m.id
    `, [activity, difficulty, studyModelIds]);

    const names = new Map(Object.values(studyModels).map(({ id, display_name }) => [id, display_name]));
    const candidates = rows.map((model) => ({ ...model, display_name: names.get(model.id) ?? model.display_name }));

    const missing = candidates.some((model) => model.score === null);
    const selected = routing
      ? candidates.find((model) => model.id === routing.id)
      : missing ? undefined : candidates.find((model) => model.score! >= threshold);
    const reason = selected
      ? routing?.reason ?? `${selected.display_name} is the lowest-ranked by required capability among the qualifying models. It scored ${selected.score}/100 on ${selected.sample_count} benchmark tasks for this category and level.`
      : !candidates.length ? 'No models are active.'
      : missing ? 'Benchmark evidence is missing. Choose an available model manually.'
      : 'No model reached the quality threshold. Choose an available model manually.';

    const prior = request.cookies.get('greenroute_session')?.value;
    const session = prior && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(prior) ? prior : randomUUID();
    const id = randomUUID();
    await query(`
      WITH recommendation AS (
        INSERT INTO recommendations (id, session_id, activity, difficulty, recommended_model_id, reason)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      )
      INSERT INTO recommendation_benchmarks (recommendation_id, benchmark_id)
      SELECT recommendation.id, evidence.id
      FROM recommendation CROSS JOIN unnest($7::bigint[]) AS evidence(id)
    `, [id, session, activity, difficulty, selected?.id ?? null, reason, candidates.flatMap((m) => m.benchmark_id ? [m.benchmark_id] : [])]);

    const response = NextResponse.json({
      status: selected ? 'recommended' : 'manual_selection',
      recommendation_id: id,
      model: selected ?? null,
      reason,
      source: routing && selected ? 'ai' : 'benchmark',
      routingUsage: routing ? { model: routingModel, counts: routing.usage } : null,
      candidates,
      threshold,
      water: { status: 'unavailable_for_serving_provider' },
    }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('greenroute_session', session, {
      httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (error) {
    console.error('Recommendation database error', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The recommendation database is unavailable.' }, { status: 503 });
  }
}
