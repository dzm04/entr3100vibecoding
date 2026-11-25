'use client';

import { useState } from 'react';
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient();

export default function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signIn() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/study', errorCallbackURL: '/login?error=google' });
      if (result.error) throw result.error;
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return <><button type="button" disabled={pending} onClick={signIn}>{pending ? 'Opening Google…' : 'Continue with Google'}</button>
    {error && <p role="alert">Google sign-in could not start. Please try again.</p>}</>;
}
