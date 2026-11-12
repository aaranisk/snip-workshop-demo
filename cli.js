#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');

const DEFAULT_API = 'http://localhost:3000';
const TIMEOUT_MS = 10_000;

function usage() {
  return [
    'Usage:',
    '  snip add <url>    Create a short link',
    '  snip ls           List links and hit counts',
    '  snip open <code>  Open the original URL in your browser',
    '  snip help         Show this help',
  ].join('\n');
}

function apiBase() {
  const value = (process.env.SNIP_API || DEFAULT_API).replace(/\/+$/, '');
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('SNIP_API must be an absolute HTTP(S) URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SNIP_API must be an absolute HTTP(S) URL.');
  }

  return `${value}/`;
}

function apiUrl(path) {
  return new URL(path.replace(/^\/+/, ''), apiBase());
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(apiUrl(path), {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'The API request timed out.'
      : `Cannot reach the Snip API: ${error.message}`;
    throw new Error(message);
  }

  return response;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('The API returned an invalid JSON response.');
  }
}

async function apiError(response) {
  const body = await response.text();
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.error === 'string' && parsed.error) {
        return parsed.error;
      }
    } catch {
      // Fall through to the status-based message for non-JSON errors.
    }
  }
  return `API request failed (${response.status} ${response.statusText}).`;
}

function validateUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Provide a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }
}

async function add(url) {
  if (!url) {
    throw new Error('Usage: snip add <url>');
  }
  validateUrl(url);

  const response = await request('api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new Error(await apiError(response));
  }

  const link = await responseJson(response);
  if (!link || typeof link.shortUrl !== 'string' || !link.shortUrl) {
    throw new Error('The API response is missing shortUrl.');
  }
  process.stdout.write(`${link.shortUrl}\n`);
}

async function list() {
  const response = await request('api/links');
  if (!response.ok) {
    throw new Error(await apiError(response));
  }

  const links = await responseJson(response);
  if (!Array.isArray(links)) {
    throw new Error('The API response is not a link list.');
  }
  if (links.length === 0) {
    process.stdout.write('No links yet.\n');
    return;
  }

  const codeWidth = Math.max(4, ...links.map((link) => String(link.code ?? '').length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits ?? '').length));
  process.stdout.write(`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL\n`);
  for (const link of links) {
    process.stdout.write(
      `${String(link.code ?? '').padEnd(codeWidth)}  ${String(link.hits ?? '').padStart(hitsWidth)}  ${String(link.url ?? '')}\n`,
    );
  }
}

function browserCommand(target) {
  switch (process.platform) {
    case 'darwin':
      return ['open', [target]];
    case 'win32':
      return ['cmd.exe', ['/d', '/s', '/c', 'start', '""', `"${target}"`]];
    default:
      return ['xdg-open', [target]];
  }
}

function openBrowser(target) {
  const parsed = new URL(target);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('The API returned a redirect to an unsupported URL.');
  }

  const [command, args] = browserCommand(parsed.href);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', (error) => {
      reject(new Error(`Could not launch the browser: ${error.message}`));
    });
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function open(code) {
  if (!code) {
    throw new Error('Usage: snip open <code>');
  }

  const response = await request(encodeURIComponent(code), { redirect: 'manual' });
  if (response.status === 404) {
    throw new Error(`Unknown short code: ${code}`);
  }
  if (response.status !== 302) {
    throw new Error(await apiError(response));
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new Error('The API redirect did not include a Location header.');
  }
  let target;
  try {
    target = new URL(location, apiUrl('')).href;
  } catch {
    throw new Error('The API returned an invalid redirect URL.');
  }
  await openBrowser(target);
}

async function main(args) {
  const [command, ...rest] = args;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  switch (command) {
    case 'add':
      if (rest.length !== 1) {
        throw new Error('Usage: snip add <url>');
      }
      await add(rest[0]);
      return;
    case 'ls':
      if (rest.length !== 0) {
        throw new Error('Usage: snip ls');
      }
      await list();
      return;
    case 'open':
      if (rest.length !== 1) {
        throw new Error('Usage: snip open <code>');
      }
      await open(rest[0]);
      return;
    default:
      throw new Error(`Unknown command: ${command}\n${usage()}`);
  }
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
