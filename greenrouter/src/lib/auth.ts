import 'server-only';
import { betterAuth } from 'better-auth';
import { postgresPool } from './db';

function configureAuth() {
  const database = postgresPool();
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL } = process.env;
  if (!database || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !BETTER_AUTH_URL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32) return null;
  return betterAuth({
    database,
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
    account: { encryptOAuthTokens: true },
    socialProviders: { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } },
  });
}

let auth: ReturnType<typeof configureAuth> | undefined;
export function getAuth() {
  if (auth === undefined) auth = configureAuth();
  return auth;
}
