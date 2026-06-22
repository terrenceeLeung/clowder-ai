import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const SCRIPT = resolve(ROOT, 'scripts/check-runtime-eval-domain-drift.mjs');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeEvalMemoryYaml(root, frequency) {
  const dir = join(root, 'docs/harness-feedback/eval-domains');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'eval-memory.yaml'),
    [
      'domainId: eval:memory',
      'displayName: Memory eval',
      'systemThreadId: thread_eval_memory',
      'evalCat:',
      '  catId: opus-47',
      '  handle: "@opus47"',
      '  model: claude-opus-4-7',
      `frequency: ${frequency}`,
      'sourceAdapter: f200-f188-memory-eval',
      'threadPolicy:',
      '  role: working-home',
      '  stateSot: registry',
      '  allowedContent:',
      '    - longitudinal-analysis',
      'handoffTargetResolver:',
      '  featureId: F200',
      '  ownerCatId: opus-47',
      '  threadLookup: feature-thread',
      'sla:',
      '  acknowledgeHours: 48',
      '  reevalWithinHours: 168',
      'legacyScheduledTaskIds: []',
      '',
    ].join('\n'),
  );
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'cat-cafe-runtime-drift-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test Cat']);
  writeEvalMemoryYaml(root, 'daily');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'initial daily']);
  git(root, ['checkout', '-b', 'runtime/main-sync']);
  git(root, ['checkout', 'main']);
  writeEvalMemoryYaml(root, 'weekly');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'main weekly']);
  git(root, ['checkout', 'runtime/main-sync']);
  return root;
}

describe('check-runtime-eval-domain-drift', () => {
  it('exits non-zero and reports drift when runtime eval-domain yaml differs from source ref', () => {
    const repo = makeRepo();

    const result = spawnSync(process.execPath, [SCRIPT, '--runtime-dir', repo, '--source-ref', 'main', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'drift');
    assert.equal(payload.sourceRef, 'main');
    assert.deepEqual(payload.driftedFiles, ['docs/harness-feedback/eval-domains/eval-memory.yaml']);
  });

  it('passes when runtime eval-domain yaml matches source ref', () => {
    const repo = makeRepo();
    git(repo, ['merge', '--ff-only', 'main']);

    const result = spawnSync(process.execPath, [SCRIPT, '--runtime-dir', repo, '--source-ref', 'main', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'ok');
    assert.deepEqual(payload.driftedFiles, []);
  });

  it('compares the runtime working tree content because the daemon reads files, not git HEAD', () => {
    const repo = makeRepo();
    writeEvalMemoryYaml(repo, 'weekly');

    const result = spawnSync(process.execPath, [SCRIPT, '--runtime-dir', repo, '--source-ref', 'main', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'ok');
    assert.deepEqual(payload.driftedFiles, []);
    assert.deepEqual(payload.dirtyFiles, ['docs/harness-feedback/eval-domains/eval-memory.yaml']);
  });

  it('accepts a pnpm-style -- argument separator before flags', () => {
    const repo = makeRepo();

    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--runtime-dir', repo, '--source-ref', 'main', '--', '--json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 1, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.status, 'drift');
    assert.deepEqual(payload.driftedFiles, ['docs/harness-feedback/eval-domains/eval-memory.yaml']);
  });
});
