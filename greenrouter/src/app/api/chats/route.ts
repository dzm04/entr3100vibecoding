import { getAuth } from '../../../lib/auth';
import { query } from '../../../lib/db';

const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const privateHeaders = { 'Cache-Control': 'private, no-store' };

async function session(request: Request) {
  return (await getAuth()?.api.getSession({ headers: request.headers })) ?? null;
}

export async function GET(request: Request) {
  const user = (await session(request))?.user;
  if (!user) return Response.json({ error: 'Sign in to access saved chats.' }, { status: 401, headers: privateHeaders });
  const chats = await query('SELECT id::text, turns FROM study_chats WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 100', [user.id]);
  return Response.json({ chats }, { headers: privateHeaders });
}

export async function PUT(request: Request) {
  const user = (await session(request))?.user;
  if (!user) return Response.json({ error: 'Sign in to save chats.' }, { status: 401 });
  if (request.headers.get('origin') !== process.env.BETTER_AUTH_URL?.replace(/\/$/, '')) return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 500_000) return Response.json({ error: 'This chat is too long to save.' }, { status: 413 });
  let chat;
  try { chat = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (typeof chat?.id !== 'string' || !uuid.test(chat.id) || !Array.isArray(chat.turns)) return new Response(null, { status: 400 });
  await query(
    `INSERT INTO study_chats (owner_id, id, turns) VALUES ($1, $2, $3)
     ON CONFLICT (owner_id, id) DO UPDATE SET turns = EXCLUDED.turns, updated_at = now()`,
    [user.id, chat.id, JSON.stringify(chat.turns)],
  );
  return new Response(null, { status: 204 });
}
