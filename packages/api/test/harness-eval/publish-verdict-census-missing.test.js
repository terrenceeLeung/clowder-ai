// @ts-check

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { handlePublishVerdict } from '../../dist/infrastructure/harness-eval/publish-verdict/publish-verdict.js';
import { setupHarnessFeedback } from './eval-manual-trigger-fixtures.js';
import { buildPacket } from './publish-verdict-fixtures.js';

function seedLiveEvidence(liveRoot, snapName, attrName) {
  mkdirSync(resolve(liveRoot, 'snapshots'), { recursive: true });
  mkdirSync(resolve(liveRoot, 'attributions'), { recursive: true });
  if (snapName) writeFileSync(resolve(liveRoot, 'snapshots', snapName), 'fake snap\n');
  if (attrName) writeFileSync(resolve(liveRoot, 'attributions', attrName), 'fake attr\n');
}

/**
 * Create an isolated worktree WITHOUT the measurement census file.
 * Simulates the pre-PR#198 state where measurement-bundles.yaml was
 * never committed to origin/main.
 */
function makeIsolatedWorktreeWithoutCensus() {
  const root = mkdtempSync(`${tmpdir()}/phase-h-no-census-`);
  mkdirSync(resolve(root, 'docs/harness-feedback/verdicts'), { recursive: true });
  mkdirSync(resolve(root, 'docs/harness-feedback/bundles'), { recursive: true });
  return root;
}

describe('handlePublishVerdict — census prerequisite', () => {
  /** @type {string} */
  let root;

  before(() => {
    root = setupHarnessFeedback();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns 503 census_unavailable when measurement-bundles.yaml is missing (not 500 generator_failed)', async () => {
    seedLiveEvidence(root, 'x.yaml', 'y.yaml');

    const mockGitPublisher = {
      async publishOnIsolatedWorktree(/** @type {any} */ opts) {
        await opts.stage(makeIsolatedWorktreeWithoutCensus());
        return { commitSha: 'unreachable', prUrl: 'unreachable' };
      },
    };

    const result = await handlePublishVerdict(
      {
        harnessFeedbackRoot: root,
        gitPublisher: mockGitPublisher,
        generator: async () => {
          throw new Error('generator should not be reached');
        },
      },
      {
        packet: buildPacket({ id: 'census-missing-test', domainId: 'eval:a2a' }),
        domain: 'eval:a2a',
        catId: 'codex',
        sourceRefs: { snapshotName: 'x.yaml', attributionName: 'y.yaml' },
      },
    );

    assert.ok('error' in result, 'expected an error response');
    assert.equal(result.status, 503, `expected 503 census_unavailable, got ${result.status} ${result.error}`);
    assert.equal(result.error, 'census_unavailable');
    assert.match(result.detail, /measurement_bundle_census_missing/);
    assert.match(result.detail, /measurement-bundles\.yaml/);
  });
});
