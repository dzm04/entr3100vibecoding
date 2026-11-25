'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import { studyModels } from '../../lib/study-models';
import './study.css';

const authClient = createAuthClient();

const goals = { concept: 'Explain a concept', writing: 'Improve my writing' };
type Goal = keyof typeof goals;
type Difficulty = 'basic' | 'advanced';
type Model = { id: string; display_name: string; score: number | null; sample_count?: number };
type Recommendation = {
  recommendation_id?: string;
  question?: string;
  model?: Model | null;
  candidates?: Model[];
  reason?: string;
  threshold?: number;
  source?: 'ai' | 'benchmark';
  routerUnavailable?: boolean;
};
type Answer = { model: string; text: string };
type Turn = {
  id: string;
  prompt: string;
  goal: Goal;
  recommendation?: Recommendation;
  answers: Answer[];
  error?: string;
  sample?: boolean;
};
type Chat = { id: string; turns: Turn[] };

const qwen = { ...studyModels.qwen, score: null };
const gemini = { ...studyModels.gemini, score: null };
const example: Turn = {
  id: 'example',
  prompt: 'Explain recursion with one worked example.',
  goal: 'concept',
  sample: true,
  recommendation: {
    model: qwen,
    candidates: [qwen, gemini],
    reason: 'This task asks for a short definition and one worked example. A lightweight model is a candidate because the answer only needs to trace a few steps.',
  },
  answers: [{
    model: qwen.display_name,
    text: 'Recursion solves a problem by calling the same function on a smaller input. A base case tells it when to stop.\n\nFor example, factorial(3) calls factorial(2), which calls factorial(1). The base case returns 1, so the calls unwind as 2 × 1 = 2 and then 3 × 2 = 6.',
  }],
};

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The request failed. Try again.');
  return result;
}

export default function Study({ signedIn }: { signedIn: boolean }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [goal, setGoal] = useState<Goal>('concept');
  const [pending, setPending] = useState<{ turn: string; label: string } | null>(null);
  const [details, setDetails] = useState<Turn | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const conversation = chats.find((chat) => chat.id === active);
  const turns = conversation?.turns ?? [];
  const latest = turns.at(-1);

  useEffect(() => {
    if (latest) transcriptEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [latest, pending]);

  const saved = useRef(new Map<string, Chat>());
  const saving = useRef(Promise.resolve());
  const [historyReady, setHistoryReady] = useState(!signedIn);
  const [historyError, setHistoryError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    fetch('/api/chats', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { chats: history }: { chats: Chat[] } = await response.json();
      saved.current = new Map(history.map((chat) => [chat.id, chat]));
      setChats(history);
      setHistoryReady(true);
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryError('Could not load saved chats. Refresh to try again.');
    });
    return () => controller.abort();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !historyReady || pending) return;
    for (const chat of chats) {
      if (chat.id === 'example' || saved.current.get(chat.id) === chat) continue;
      saved.current.set(chat.id, chat);
      saving.current = saving.current.then(async () => {
        const response = await fetch('/api/chats', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chat),
        });
        if (!response.ok) throw new Error();
      }).catch(() => {
        if (saved.current.get(chat.id) === chat) saved.current.delete(chat.id);
        setHistoryError('A chat could not be saved.');
      });
    }
  }, [chats, historyReady, pending, retry, signedIn]);

  async function signOut() {
    try {
      await saving.current;
      const result = await authClient.signOut();
      if (result.error) throw result.error;
      window.location.assign('/');
    } catch {
      setHistoryError('Could not sign out. Please try again.');
    }
  }

  function updateTurn(chatId: string, id: string, update: (turn: Turn) => Turn) {
    setChats((current) => current.map((chat) => chat.id === chatId
      ? { ...chat, turns: chat.turns.map((turn) => turn.id === id ? update(turn) : turn) }
      : chat));
  }

  async function withRequest(chatId: string, turn: Turn, label: string, request: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending({ turn: turn.id, label });
    updateTurn(chatId, turn.id, (current) => ({ ...current, error: undefined }));
    try {
      await request();
    } catch (error) {
      updateTurn(chatId, turn.id, (current) => ({
        ...current, error: error instanceof Error ? error.message : 'The request failed. Try again.',
      }));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function run(chatId: string, turn: Turn, model: Model, recommendationId: string) {
    setPending({ turn: turn.id, label: `Waiting for ${model.display_name}…` });
    const result = await post<{ answer: string }>('/api/run', {
      prompt: turn.prompt, model: model.id, recommendationId,
    });
    updateTurn(chatId, turn.id, (current) => ({
      ...current, answers: [...current.answers, { model: model.display_name, text: result.answer }],
    }));
  }

  function recommend(chatId: string, turn: Turn, difficulty?: Difficulty) {
    return withRequest(chatId, turn, 'Finding a model…', async () => {
      const recommendation = await post<Recommendation>('/api/recommend', { activity: turn.goal, difficulty, prompt: turn.prompt });
      updateTurn(chatId, turn.id, (current) => ({ ...current, recommendation }));
      if (recommendation.model && recommendation.recommendation_id) {
        await run(chatId, turn, recommendation.model, recommendation.recommendation_id);
      }
    });
  }

  function send() {
    if (busy.current || !historyReady || !prompt.trim()) return;
    const chatId = conversation?.id ?? crypto.randomUUID();
    const turn: Turn = { id: crypto.randomUUID(), prompt: prompt.trim(), goal, answers: [] };
    setChats((current) => conversation
      ? current.map((chat) => chat.id === chatId ? { ...chat, turns: [...chat.turns, turn] } : chat)
      : [{ id: chatId, turns: [turn] }, ...current]);
    setActive(chatId);
    setPrompt('');
    void recommend(chatId, turn);
  }

  function selectChat(id: string | null) {
    setActive(id);
    setPrompt('');
    setGoal(chats.find((chat) => chat.id === id)?.turns.at(-1)?.goal ?? 'concept');
  }

  function showExample() {
    setChats((current) => current.some((chat) => chat.id === 'example')
      ? current : [{ id: 'example', turns: [example] }, ...current]);
    selectChat('example');
  }

  function showDetails(turn: Turn) {
    setDetails(turn);
    dialog.current?.showModal();
  }

  return <div className="study-shell">
    <aside className="study-sidebar">
      <Link className="study-brand" href="/"><span aria-hidden="true">↗</span> GreenRouter</Link>
      <button className="study-secondary" type="button" onClick={() => selectChat(null)} disabled={!!pending}>+ New chat</button>
      <button className="study-secondary" type="button" onClick={showExample} disabled={!!pending}>Offline demo</button>
      <p className="study-label">{signedIn ? 'Saved chats' : 'Chats this session'}</p>
      {chats.map((chat) => <button key={chat.id} className="study-chat-link" type="button"
        aria-current={active === chat.id ? 'true' : undefined} onClick={() => selectChat(chat.id)} disabled={!!pending}>
        {chat.id === 'example' ? 'Offline demo · Recursion' : chat.turns[0].prompt}
      </button>)}
    </aside>

    <main className="study-main">
      <div className="study-top"><Link href="/">GreenRouter</Link>{signedIn ? <button type="button" className="study-secondary" disabled={!!pending} onClick={() => void signOut()}>Sign out</button> : <Link href="/login">Sign in</Link>}</div>
      <div className={turns.length ? 'study-thread' : 'study-thread study-welcome'}>
        {turns.length === 0 && <div className="study-intro">
          <h1>What are you studying?</h1>
          <p>Choose a study goal and ask a question. GreenRouter will look for a model that fits.</p>
          <button type="button" className="study-secondary" onClick={showExample}>Open offline demo</button>
        </div>}
        {turns.map((turn) => {
          const rec = turn.recommendation;
          const recommendationId = rec?.recommendation_id;
          return <section className="study-turn" key={turn.id} aria-label={goals[turn.goal]}>
            <div className="study-message"><span className="study-label">{goals[turn.goal]}</span><p>{turn.prompt}</p></div>
            {rec?.question && <div className="study-card">
              <h2>One detail about your task</h2>
              {rec.routerUnavailable && <p>Automatic routing is unavailable. Answer this question to continue, or open the offline demo.</p>}
              <p>{rec.question}</p>
              <div className="study-actions">
                <button type="button" className="study-secondary" disabled={!!pending} onClick={() => void recommend(active!, turn, 'basic')}>No</button>
                <button type="button" className="study-secondary" disabled={!!pending} onClick={() => void recommend(active!, turn, 'advanced')}>Yes</button>
              </div>
            </div>}
            {rec?.candidates && <div className="study-card study-recommendation">
              <span className="study-label">{turn.sample ? 'Model recommendation · Example' : 'Model recommendation'}</span>
              <h2>{rec.model?.display_name ?? 'Choose a model'}</h2>
              <p>{rec.reason}</p>
              {rec.source === 'ai' && <p className="study-label">AI routing judgment</p>}
              <div className="study-actions">
                <button type="button" onClick={() => showDetails(turn)}>{rec.model ? 'Why this model?' : 'View model evidence'}</button>
              </div>
              {!turn.sample && recommendationId && rec.candidates.length > 0 && <details open={rec.model ? undefined : true}>
                <summary>{rec.model ? 'Compare or run another model' : 'Available models'}</summary>
                <ul className="study-models">{rec.candidates.map((model) => <li key={model.id}>
                  <span>{model.display_name}</span>
                  <button type="button" className="study-secondary" disabled={!!pending} onClick={() => void withRequest(active!, turn, 'Starting model…', () => run(active!, turn, model, recommendationId))}>
                    Run model<span className="study-sr-only"> {model.display_name}</span>
                  </button>
                </li>)}</ul>
              </details>}
            </div>}
            {pending?.turn === turn.id && <p role="status">{pending.label}</p>}
            {turn.error && <div className="study-error" role="alert">
              <p>{turn.error}</p>
              <button type="button" className="study-secondary" disabled={!!pending} onClick={showExample}>Open offline demo</button>
              {!recommendationId && <button type="button" className="study-secondary" disabled={!!pending} onClick={() => void recommend(active!, turn)}>Retry recommendation</button>}
            </div>}
            {turn.answers.map((answer, index) => <article className="study-answer" key={index}>
              <h2>{turn.sample ? 'Offline example for' : 'Answer from'} {answer.model}</h2><p className="answer">{answer.text}</p>
            </article>)}
            {turn.answers.length > 0 && <div className="study-card study-water">
              <span className="study-label">On-site cooling water</span>
              <h2>Live estimate unavailable</h2>
              <p>A request estimate requires IT energy and cooling data for the serving facility.</p>
              {turn.sample && <details><summary>Illustrative calculation · 0.10–0.20 mL</summary>
                <p>Assumed IT energy of 0.20 Wh × assumed cooling water intensity of 0.5–1.0 L/kWh. This scenario excludes water used to generate electricity.</p>
                <a href="https://arxiv.org/html/2304.03271">Water estimation methodology</a>
              </details>}
            </div>}
          </section>;
        })}
        <div ref={transcriptEnd} />
      </div>

      <form className="study-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        {historyError && <p role="alert">{historyError} {historyReady && <button type="button" onClick={() => { setHistoryError(''); setRetry(retry + 1); }}>Retry saving</button>}</p>}
        <label htmlFor="study-task" className="study-sr-only">Study question</label>
        <textarea id="study-task" rows={2} maxLength={8000} required placeholder="Ask a study question…" value={prompt}
          onChange={(event) => setPrompt(event.target.value)} />
        <div className="study-actions study-composer-controls">
          <label htmlFor="study-goal" className="study-sr-only">Study goal</label>
          <div className="study-goal-control"><select id="study-goal" value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>
            {Object.entries(goals).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>
          <button type="submit" disabled={!!pending || !historyReady || !prompt.trim()}>Send ↑</button>
        </div>
      </form>
    </main>

    <dialog className="study-dialog" ref={dialog} aria-labelledby="study-dialog-title" onClose={() => setDetails(null)}>
      {details && <><span className="study-label">{details.sample ? 'Routing example' : 'Model evidence'} · {goals[details.goal]}</span>
        <h2 id="study-dialog-title">{details.recommendation?.model ? `Why ${details.recommendation.model.display_name}?` : 'Why manual selection?'}</h2>
        <p>{details.recommendation?.reason}</p>
        {details.recommendation?.source === 'ai' && <p>A separate routing model judged the task. The chosen model generates the study answer.</p>}
        <p>{details.recommendation?.model?.id === studyModels.qwen.id
          ? 'Qwen3.5-9B is an open-weight model with 9 billion parameters.'
          : details.recommendation?.model?.id === studyModels.gemini.id
            ? 'Gemini 3.1 Flash Lite is a Google model designed for low latency.' : null}</p>
        {details.recommendation?.source !== 'ai' && details.recommendation?.threshold !== undefined && <p>Quality threshold · {details.recommendation.threshold}/100</p>}
        <ul className="study-models">{details.recommendation?.candidates?.map((model) => <li key={model.id}>
          <strong>{model.display_name}</strong><span>{model.score === null ? 'Benchmark pending' : `${model.score}/100${model.sample_count ? ` · ${model.sample_count} tasks` : ''}`}</span>
        </li>)}</ul>
        <form method="dialog"><button type="submit" autoFocus>Back to chat</button></form>
      </>}
    </dialog>
  </div>;
}
