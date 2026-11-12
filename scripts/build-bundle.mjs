import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = join(repoRoot, 'bundle');
const frontendDir = join(repoRoot, 'frontend');
const outputDir = join(frontendDir, 'dist', 'snip-frontend', 'browser');
const shouldPush = process.argv.includes('--push');

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function writeIfChanged(path, content) {
  let existing;
  try {
    existing = readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (existing !== content) {
    writeFileSync(path, content);
  }
}

function hasStagedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd });
  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }
  throw new Error(`git diff --cached failed with exit code ${result.status}`);
}

const branch = spawnSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' });
if (branch.error) {
  throw branch.error;
}
if (branch.status !== 0) {
  throw new Error(`Unable to inspect the current branch (exit code ${branch.status}).`);
}
if (branch.stdout.trim() !== 'main') {
  throw new Error(`Run this script from the main branch (currently ${branch.stdout.trim() || 'detached'}).`);
}

run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);
run('npm', ['install'], frontendDir);
run('npx', ['ng', 'build'], frontendDir);

const indexPath = join(outputDir, 'index.html');
if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
  throw new Error(`Angular build output is missing: ${indexPath}`);
}

rmSync(join(bundleDir, 'public'), { recursive: true, force: true });
mkdirSync(join(bundleDir, 'public'), { recursive: true });
cpSync(outputDir, join(bundleDir, 'public'), { recursive: true });
copyFileSync(join(repoRoot, 'backend', 'server.js'), join(bundleDir, 'server.js'));
copyFileSync(join(repoRoot, 'cli', 'cli.js'), join(bundleDir, 'cli.js'));

writeIfChanged(
  join(bundleDir, '.env'),
  'PUBLIC_DIR=./public\n',
);
writeIfChanged(
  join(bundleDir, 'package.json'),
  `${JSON.stringify({ name: 'snip-bundle', private: true, scripts: { start: 'bun server.js' } }, null, 2)}\n`,
);
writeIfChanged(
  join(bundleDir, 'Dockerfile'),
  'FROM oven/bun:1-alpine\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD ["bun", "server.js"]\n',
);
writeIfChanged(
  join(bundleDir, '.dockerignore'),
  '.git\n.gitignore\nnode_modules\n*.log\n',
);
writeIfChanged(
  join(bundleDir, 'railway.json'),
  `${JSON.stringify({
    $schema: 'https://railway.app/railway.schema.json',
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
    deploy: { healthcheckPath: '/api/links', healthcheckTimeout: 100 },
  }, null, 2)}\n`,
);

run('git', ['add', '-A'], bundleDir);
const bundleChanged = hasStagedChanges(bundleDir);
if (bundleChanged) {
  run('git', ['commit', '-m', 'Build generated Snip bundle', '-m', 'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>'], bundleDir);
} else {
  console.log('bundle unchanged');
}

run('git', ['add', 'backend', 'frontend', 'cli', 'bundle']);
const mainChanged = hasStagedChanges(repoRoot);
if (mainChanged) {
  run('git', ['commit', '-m', 'Update generated bundle and source pointers', '-m', 'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>']);
} else if (!bundleChanged) {
  console.log('main pointers unchanged');
}

if (shouldPush) {
  run('git', ['push', 'origin', 'HEAD:bundle'], bundleDir);
  run('git', ['push', 'origin', 'main']);
}
