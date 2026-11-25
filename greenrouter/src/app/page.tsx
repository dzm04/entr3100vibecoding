import Link from 'next/link';

export default function Landing() {
  return <main className="landing">
    <nav><strong>↗ GreenRouter</strong><Link href="/login">Sign in</Link></nav>
    <div className="hero"><div><h1>Find the right AI<br/><em>for your task.</em></h1>
    <p>Match your study question to a suitable model. See why it fits, then choose what to run.</p>
    <Link className="action" href="/login">Start learning →</Link></div>
    <section className="preview"><small>MODEL ROUTING · EXAMPLE</small><h2>What is recursion?</h2><b>Lightweight model</b><p>A definition and a short example can be enough.</p><hr/><h2>Help debug my recursive function.</h2><b>More capable model</b><p>Tracing calls and edge cases can require deeper reasoning.</p></section></div>
    <footer><b>Why GreenRouter?</b><p>In our survey of 51 university students, about 61% rarely or never considered AI’s environmental impact while using it.</p></footer>
  </main>;
}
