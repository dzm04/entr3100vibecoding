import Link from 'next/link';
import { getAuth } from '../../lib/auth';
import GoogleButton from './google-button';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="compact">
    <Link href="/">↗ GreenRouter</Link><h1>Start learning</h1>
    <p>Sign in with Google to save your study chats and reopen them on another device.</p>
    {error && <p role="alert">Sign-in did not complete. Try again or continue as a guest.</p>}
    {getAuth() ? <GoogleButton /> : <p>Google sign-in is awaiting configuration.</p>}
    <p><Link href="/study">Continue as guest →</Link></p>
  </main>;
}
