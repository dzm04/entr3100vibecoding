import { headers } from 'next/headers';
import { getAuth } from '../../lib/auth';
import ChatWorkspace from './chat';

export const dynamic = 'force-dynamic';

export default async function StudyPage() {
  const auth = getAuth();
  const session = auth ? await auth.api.getSession({ headers: await headers() }) : null;
  return <ChatWorkspace signedIn={Boolean(session)} />;
}
