import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchBackendWithWakeupRetry,
  resolveBackendApiUrl,
  resolveBackendWsUrl,
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
