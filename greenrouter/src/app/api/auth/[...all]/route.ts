import { getAuth } from '../../../../lib/auth';

export const runtime = 'nodejs';

function handle(request: Request) {
  const auth = getAuth();
  return auth ? auth.handler(request) : Response.json({ error: 'Google sign-in is not configured.' }, { status: 503 });
}

export { handle as GET, handle as POST };
