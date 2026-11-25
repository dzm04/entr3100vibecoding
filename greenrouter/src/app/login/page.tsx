import Link from 'next/link';

export default function Login() {
  return <main className="compact"><Link href="/">↗ GreenRouter</Link><h1>Start learning</h1><p>Open the study workspace to compare models and run your task.</p><Link href="/study" className="action">Continue as guest →</Link><p>Google account sign-in is coming soon.</p></main>;
}
