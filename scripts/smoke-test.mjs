import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = resolve(repoRoot, 'bundle');
const baseUrl = process.env.SNIP_SMOKE_URL || 'http://localhost:3000';
const server = spawn('bun', ['server.js'], {
  cwd: bundleDir,
  env: { ...process.env, PORT: new URL(baseUrl).port || '3000' },
  stdio: 'ignore',
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Bundle server exited with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/links`);
      ready = response.ok;
      if (ready) break;
    } catch {
      // The server may need a moment to bind its port.
    }
    await delay(500);
  }
  assert(ready, 'Bundle API did not become ready.');

  const createdResponse = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/smoke-test' }),
  });
  assert(createdResponse.status === 201, `Expected POST 201, got ${createdResponse.status}.`);
  const created = await createdResponse.json();
  assert(typeof created.code === 'string' && created.code.length === 6, 'Response has no six-character code.');
  assert(created.hits === 0, 'New link should start with zero hits.');

  const listResponse = await fetch(`${baseUrl}/api/links`);
  assert(listResponse.ok, `List API returned ${listResponse.status}.`);
  const links = await listResponse.json();
  assert(links.some((link) => link.code === created.code), 'Created link is missing from list.');

  const redirectResponse = await fetch(`${baseUrl}/${created.code}`, { redirect: 'manual' });
  assert(redirectResponse.status === 302, `Expected redirect 302, got ${redirectResponse.status}.`);
  assert(redirectResponse.headers.get('location') === created.url, 'Redirect target does not match the original URL.');

  const htmlResponse = await fetch(`${baseUrl}/`);
  assert(htmlResponse.ok, `Frontend returned ${htmlResponse.status}.`);
  assert((htmlResponse.headers.get('content-type') || '').includes('text/html'), 'Frontend root is not HTML.');

  const cli = spawnSync(process.execPath, ['cli.js', 'ls'], {
    cwd: bundleDir,
    encoding: 'utf8',
    env: { ...process.env, SNIP_API: baseUrl },
  });
  assert(!cli.error, cli.error?.message || 'CLI failed to start.');
  assert(cli.status === 0, `CLI exited with code ${cli.status}: ${cli.stderr}`);
  assert(cli.stdout.includes(created.code), 'CLI did not show the created link.');

  const afterRedirect = await (await fetch(`${baseUrl}/api/links`)).json();
  const updated = afterRedirect.find((link) => link.code === created.code);
  assert(updated?.hits === 1, 'Redirect did not increment the hit count.');
  console.log('Bundle smoke test passed: API, redirect, hit count, frontend, and CLI.');
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => server.once('exit', resolveExit)),
    delay(5000),
  ]);
  if (server.exitCode === null) {
    server.kill('SIGKILL');
  }
}
