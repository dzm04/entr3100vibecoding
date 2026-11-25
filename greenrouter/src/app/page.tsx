import Link from 'next/link';
import './landing.css';

const examples = [
  {
    question: 'What is recursion?',
    model: 'Lightweight model',
    reason: 'A short definition and one example are enough.',
  },
  {
    question: 'Help debug my recursive function.',
    model: 'More capable model',
    reason: 'Tracing calls and edge cases may need more reasoning.',
  },
];

const steps = [
  ['Describe your task', 'Tell GreenRouter what you’re working on.'],
  ['See why a model fits', 'Get a recommendation based on the task.'],
  ['Choose your model', 'Use the suggestion or switch models.'],
];

function Brand() {
  return <span className="landing-brand"><span aria-hidden="true">↗</span> GreenRouter</span>;
}

export default function Landing() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Brand />
        <Link href="/login" className="landing-sign-in">Sign in</Link>
      </nav>

      <div className="landing-hero">
        <div className="landing-intro">
          <h1>Find the right AI<br /><em>for your task.</em></h1>
          <p>GreenRouter matches your study task to a suitable model and explains why, so you can use fewer resources as you learn.</p>
          <Link href="/login" className="landing-cta">Start learning <span aria-hidden="true">→</span></Link>
        </div>

        <section className="landing-preview" aria-labelledby="routing-preview">
          <div className="landing-preview-top">
            <h2 id="routing-preview">Model recommendation</h2>
            <span>Example</span>
          </div>
          {examples.map(({ question, model, reason }) => (
            <div className="landing-example" key={question}>
              <h3>{question}</h3>
              <div className="landing-model">
                <strong>{model}</strong>
                <p>{reason}</p>
              </div>
            </div>
          ))}
          <p>You decide which model to run.</p>
        </section>
      </div>

      <section className="landing-steps" aria-labelledby="landing-steps-title">
        <h2 id="landing-steps-title">How it works</h2>
        <ol>
          {steps.map(([title, description]) => (
            <li key={title}><h3>{title}</h3><p>{description}</p></li>
          ))}
        </ol>
      </section>

      <section className="landing-research" aria-labelledby="landing-research-title">
        <h2 id="landing-research-title">What students told us</h2>
        <p>In our survey of 51 university students, about 61% rarely or never considered AI’s environmental impact while using it.</p>
      </section>

      <footer className="landing-footer"><Brand /></footer>
    </main>
  );
}
