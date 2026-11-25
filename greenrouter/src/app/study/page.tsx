'use client';

import { useState } from 'react';

type Model = { id: string; display_name: string; score: number | null };
type Reply = {
  recommendation_id?: string;
  question?: string;
  reason?: string;
  model?: Model | null;
  candidates?: Model[];
  error?: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState<{ model: string; text: string } | null>(null);
  const [runError, setRunError] = useState('');
  const [activity, setActivity] = useState('concept');
  const [reply, setReply] = useState<Reply | null>(null);
  const [pending, setPending] = useState(false);

  async function run(model: Model) {
    setPending(true);
    setRunError('');
    setAnswer(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: model.id, recommendationId: reply?.recommendation_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The model request failed.');
      setAnswer({ model: model.display_name, text: result.answer });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'The model request failed.');
    } finally {
      setPending(false);
    }
  }

  async function recommend(difficulty?: string) {
    setPending(true);
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, difficulty }),
      });
      setReply(await response.json());
    } catch {
      setReply({ error: 'Could not reach the recommendation service. Try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <header>
        <h1>GreenRoute</h1>
        <p>Find out how much model capability your study task needs.</p>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); void recommend(); }}>
        <label htmlFor="task">What do you want help with?</label>
        <textarea id="task" required maxLength={8000} disabled={pending}
          placeholder="Explain recursion with a worked example."
          value={prompt} onChange={(event) => {
            setPrompt(event.target.value);
            setReply(null);
            setAnswer(null);
            setRunError('');
          }} />
        <label htmlFor="activity">What kind of task are you working on?</label>
        <select id="activity" value={activity} disabled={pending} onChange={(event) => {
          setActivity(event.target.value);
          setReply(null);
          setAnswer(null);
          setRunError('');
        }}>
          <option value="concept">Explain a concept</option>
          <option value="writing">Improve academic writing</option>
        </select>
        <button disabled={pending}>{pending ? 'Checking…' : 'Find a model'}</button>
      </form>
      <div aria-live="polite">
        {reply?.error && <p role="alert">{reply.error}</p>}
        {reply?.question && <section>
          <h2>{reply.question}</h2>
          <button disabled={pending} onClick={() => recommend('basic')}>No</button>
          <button disabled={pending} onClick={() => recommend('advanced')}>Yes</button>
        </section>}
        {reply?.candidates && <section>
          <h2>{reply.model?.display_name ?? 'Model comparison'}</h2>
          <p>{reply.reason}</p>
          <ul>{reply.candidates.map((model) => (
            <li key={model.id}>{model.display_name} · {model.score === null ? 'Benchmark pending' : `${model.score}/100`}
              <button type="button" disabled={pending || !prompt.trim()} onClick={() => run(model)}>Try {model.display_name}</button>
            </li>
          ))}</ul>
          <p>Cooling water per request · Estimate unavailable</p>
          {pending && <p role="status">Working…</p>}
          {runError && <p role="alert">{runError}</p>}
          {answer && <article>
            <h2>Answer from {answer.model}</h2>
            <p className="answer">{answer.text}</p>
          </article>}
        </section>}
      </div>
    </main>
  );
}
