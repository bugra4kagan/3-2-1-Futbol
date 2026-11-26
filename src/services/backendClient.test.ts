import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchBackendWithWakeupRetry,
  fetchWithVerifiedFirebaseAuth,
  resolveBackendApiUrl,
  resolveBackendWsUrl,
  resolveVerifiedFirebaseIdToken,
} from './backendClient';

test('resolveBackendApiUrl and resolveBackendWsUrl build clean Render HTTPS/WSS URLs', () => {
  assert.equal(
    resolveBackendApiUrl('/api/leaderboard', 'https://futbol-321.onrender.com/'),
    'https://futbol-321.onrender.com/api/leaderboard'
  );
  assert.equal(resolveBackendApiUrl('healthz', ''), '/healthz');

  assert.equal(
    resolveBackendWsUrl('/ws', 'https://futbol-321.onrender.com/'),
    'wss://futbol-321.onrender.com/ws'
  );
  assert.equal(
    resolveBackendWsUrl('/ws', 'http://localhost:3000'),
    'ws://localhost:3000/ws'
  );
});

test('fetchBackendWithWakeupRetry retries Render 503 sleep and transient network errors before succeeding', async () => {
  let calls = 0;
  const wakeups: number[] = [];

  const res = await fetchBackendWithWakeupRetry(
    '/healthz',
    { method: 'GET' },
    {
      baseUrl: 'https://futbol-321.onrender.com',
      retries: 2,
      retryDelayMs: 50,
      timeoutMs: 2000,
      onWakeup: (attempt) => wakeups.push(attempt),
      fetchImpl: (async () => {
        calls += 1;
        if (calls === 1) {
          return new Response('Service waking up', { status: 503 });
        }
        if (calls === 2) {
          throw new TypeError('Failed to fetch');
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch,
    }
  );

  assert.equal(res.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(wakeups, [1, 2]);
});

test('fetchBackendWithWakeupRetry surfaces clean error when Render remains unreachable after retries', async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      fetchBackendWithWakeupRetry(
        '/api/accounts/register',
        { method: 'POST' },
        {
          baseUrl: 'https://futbol-321.onrender.com',
          retries: 1,
          retryDelayMs: 50,
          timeoutMs: 2000,
          fetchImpl: (async () => {
            calls += 1;
            throw new TypeError('Network unreachable');
          }) as typeof fetch,
        }
      ),
    /Network unreachable/
  );

  assert.equal(calls, 2);
});

test('resolveVerifiedFirebaseIdToken waits authStateReady and blocks anonymous tokens', async () => {
  let stateReadyCalled = false;
  let anonTokenRequested = false;

  const anonToken = await resolveVerifiedFirebaseIdToken({
    authStateReady: async () => {
      stateReadyCalled = true;
    },
    currentUser: {
      isAnonymous: true,
      getIdToken: async () => {
        anonTokenRequested = true;
        return 'anon-jwt-should-not-leak';
      },
    },
  });
  assert.equal(stateReadyCalled, true);
  assert.equal(anonTokenRequested, false);
  assert.equal(anonToken, null);

  const googleToken = await resolveVerifiedFirebaseIdToken(
    {
      authStateReady: async () => {},
      currentUser: {
        isAnonymous: false,
        getIdToken: async (force?: boolean) => (force ? 'fresh-jwt' : 'cached-jwt'),
      },
    },
    false
  );
  assert.equal(googleToken, 'cached-jwt');
});

test('fetchWithVerifiedFirebaseAuth skips token for anonymous and refreshes once on 401 for verified sessions', async () => {
  const sentHeaders: Array<Record<string, string>> = [];
  const resAnon = await fetchWithVerifiedFirebaseAuth({
    path: '/api/accounts/register',
    baseHeaders: { 'Content-Type': 'application/json' },
    body: { accountId: 'acc_anon_1' },
    auth: {
      authStateReady: async () => {},
      currentUser: {
        isAnonymous: true,
        getIdToken: async () => 'anon-jwt',
      },
    },
    retryOptions: {
      baseUrl: 'https://futbol-321.onrender.com',
      retries: 0,
      fetchImpl: (async (_url, init) => {
        sentHeaders.push((init?.headers as Record<string, string>) || {});
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    },
  });
  assert.equal(resAnon.status, 200);
  assert.equal(sentHeaders[0]['X-Firebase-Id-Token'], undefined);

  // Verified user whose cached token triggers 401 -> forces exactly ONE getIdToken(true) refresh
  const refreshCalls: boolean[] = [];
  const authTokensPerReq: Array<string | undefined> = [];
  let reqCount = 0;
  const resVerified = await fetchWithVerifiedFirebaseAuth({
    path: '/api/accounts/register',
    baseHeaders: { 'Content-Type': 'application/json' },
    body: { accountId: 'acc_google_1' },
    auth: {
      authStateReady: async () => {},
      currentUser: {
        isAnonymous: false,
        getIdToken: async (force = false) => {
          refreshCalls.push(force);
          return force ? 'fresh-google-jwt' : 'stale-google-jwt';
        },
      },
    },
    retryOptions: {
      baseUrl: 'https://futbol-321.onrender.com',
      retries: 0,
      fetchImpl: (async (_url, init) => {
        reqCount += 1;
        const h = (init?.headers as Record<string, string>) || {};
        authTokensPerReq.push(h['X-Firebase-Id-Token']);
        return reqCount === 1
          ? new Response(JSON.stringify({ ok: false }), { status: 401 })
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    },
  });
  assert.equal(resVerified.status, 200);
  assert.deepEqual(refreshCalls, [false, true]);
  assert.deepEqual(authTokensPerReq, ['stale-google-jwt', 'fresh-google-jwt']);

  // Still 401 after refresh -> stops cleanly without infinite retry loop
  let persistent401Calls = 0;
  const resStill401 = await fetchWithVerifiedFirebaseAuth({
    path: '/api/accounts/register',
    baseHeaders: { 'Content-Type': 'application/json' },
    body: { accountId: 'acc_google_2' },
    auth: {
      authStateReady: async () => {},
      currentUser: {
        isAnonymous: false,
        getIdToken: async (force = false) => (force ? 'refreshed-bad' : 'stale-bad'),
      },
    },
    retryOptions: {
      baseUrl: 'https://futbol-321.onrender.com',
      retries: 0,
      fetchImpl: (async () => {
        persistent401Calls += 1;
        return new Response(JSON.stringify({ ok: false }), { status: 401 });
      }) as typeof fetch,
    },
  });
  assert.equal(resStill401.status, 401);
  assert.equal(persistent401Calls, 2);
});
