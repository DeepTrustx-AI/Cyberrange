import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Compile the real API module with Vite's public environment expression replaced
// by an empty API base, so Node exercises production behavior without a browser.
const source = (await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8'))
  .replaceAll('import.meta.env.VITE_API_URL', "''");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { authFetch } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function respond(t, body, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(body, { status });
  t.after(() => { globalThis.fetch = original; });
}

for (const [status, body] of [
  [522, '<html>Connection timed out</html>'],
  [522, 'error code: 522'],
  [502, 'Bad gateway'],
  [503, JSON.stringify({ detail: 'Database unavailable' })],
]) {
  test(`HTTP ${status} outage never becomes a password error (${body.slice(0, 12)})`, async (t) => {
    respond(t, body, status);
    await assert.rejects(authFetch('/api/v1/auth/student-login'), /Sign-in is temporarily unavailable/);
  });
}

for (const path of ['/api/v1/auth/student-login', '/api/v1/auth/google']) {
  test(`${path} reports a network failure with recovery guidance`, async (t) => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    t.after(() => { globalThis.fetch = original; });
    await assert.rejects(authFetch(path), /Check your connection and try again/);
  });
}

for (const body of ['<!doctype html><html>SPA fallback</html>', 'null', '[]', 'true', '']) {
  test(`unexpected successful response is rejected: ${body || 'empty'}`, async (t) => {
    respond(t, body);
    await assert.rejects(authFetch('/api/v1/auth/student-login'), /Unable to complete sign-in/);
  });
}

test('backend credential rejection keeps its generic message', async (t) => {
  respond(t, JSON.stringify({ message: 'Invalid email or password' }), 401);
  await assert.rejects(authFetch('/api/v1/auth/student-login'), /^Error: Invalid email or password$/);
});

test('a bare JSON 401 uses the credential fallback', async (t) => {
  respond(t, '{}', 401);
  await assert.rejects(authFetch('/api/v1/auth/student-login'), /^Error: Invalid Email or Password$/);
});

for (const [status, message] of [
  [403, 'Please use the Institution sign-in page.'],
  [429, 'Account is temporarily locked. Please try again in 15 minutes.'],
]) {
  test(`HTTP ${status} preserves backend recovery guidance`, async (t) => {
    respond(t, JSON.stringify({ detail: message }), status);
    await assert.rejects(authFetch('/api/v1/auth/admin-login'), { message });
  });
}

test('validation detail objects are rendered as text', async (t) => {
  respond(t, JSON.stringify({ detail: [{ msg: 'Field required' }] }), 422);
  await assert.rejects(authFetch('/api/v1/auth/student-login'), { message: 'Field required' });
});

test('OTP-required success is returned without treating it as a failed login', async (t) => {
  const payload = { status: 'otp_required', message: 'Check your email.' };
  respond(t, JSON.stringify(payload));
  assert.deepEqual(await authFetch('/api/v1/auth/admin-login'), payload);
});

for (const payload of [
  {},
  { success: true },
  { success: true, token: '', user: { id: 1 } },
  { success: true, token: { invalid: true }, user: { id: 1 } },
  { success: true, token: 'unit-test-placeholder', user: null },
  { success: true, token: 'unit-test-placeholder', user: [] },
]) {
  test(`malformed session never establishes login or blames credentials: ${JSON.stringify(payload)}`, async (t) => {
    respond(t, JSON.stringify(payload));
    await assert.rejects(authFetch('/api/v1/auth/student-login'), /Unable to complete sign-in/);
  });
}

test('a JSON business rejection preserves its message even with HTTP 200', async (t) => {
  respond(t, JSON.stringify({ success: false, message: 'Invalid email or password' }));
  await assert.rejects(authFetch('/api/v1/auth/student-login'), { message: 'Invalid email or password' });
});

test('successful login preserves session data and native fetch options', async (t) => {
  const original = globalThis.fetch;
  const payload = { success: true, token: 'unit-test-placeholder', role: 'student', user: { id: 1 } };
  const options = { method: 'POST', credentials: 'same-origin', body: '{"test":true}' };
  globalThis.fetch = async (path, request) => {
    assert.equal(path, '/api/v1/auth/student-login');
    assert.deepEqual(request, options);
    return Response.json(payload);
  };
  t.after(() => { globalThis.fetch = original; });
  assert.deepEqual(await authFetch('/api/v1/auth/student-login', options), payload);
});

test('Google authentication retains the shared credentials setting', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/v1/auth/google');
    assert.equal(options.credentials, 'include');
    return Response.json({ success: true, token: 'unit-test-placeholder', user: { id: 1 } });
  };
  t.after(() => { globalThis.fetch = original; });
  await authFetch('/api/v1/auth/google');
});
