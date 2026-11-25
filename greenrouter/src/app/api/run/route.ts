import { NextRequest, NextResponse } from 'next/server';
import { studyModelIds } from '../../../lib/study-models';
import { readTokenUsage } from '../../../lib/token-usage';
import { query } from '../../../lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const model = body?.model;
  const id = body?.recommendationId;
  const session = request.cookies.get('greenroute_session')?.value;
  const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (!prompt || prompt.length > 8000 || typeof model !== 'string' || !studyModelIds.includes(model) ||
      typeof id !== 'string' || !uuid.test(id) || !session || !uuid.test(session)) {
    return NextResponse.json({ error: 'Enter a task and complete the model comparison first.' }, { status: 400 });
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: 'Live answers are unavailable. You can still open the offline demo.' }, { status: 503 });

  try {
    const allowed = await query(
      'SELECT 1 FROM recommendations, models WHERE recommendations.id = $1 AND session_id = $2 AND models.id = $3 AND active',
      [id, session, model],
    );
    if (!allowed.length) return NextResponse.json({ error: 'Generate a new recommendation and try again.' }, { status: 403 });
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048, reasoning: { effort: 'none' }, provider: { require_parameters: true } }),
      signal: AbortSignal.timeout(45000),
    });
    if (response.status === 429) {
      return NextResponse.json({ error: 'The selected model is rate limited. Try the other model or retry later.' }, { status: 429 });
    }
    if (!response.ok) return NextResponse.json({ error: `OpenRouter returned HTTP ${response.status}.` }, { status: 502 });
    const result = await response.json();
    const answer = result?.choices?.[0]?.message?.content;
    if (result?.model !== model || typeof answer !== 'string' || !answer.trim()) {
      return NextResponse.json({ error: 'OpenRouter did not return a usable answer from the selected model.' }, { status: 502 });
    }
    return NextResponse.json({ answer, usage: readTokenUsage(result.usage) });
  } catch {
    return NextResponse.json({ error: 'The request could not be completed. Try again.' }, { status: 503 });
  }
}
