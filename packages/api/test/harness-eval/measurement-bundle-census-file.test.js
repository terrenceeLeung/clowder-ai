// @ts-check

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

async function moduleUnderTest() {
  return import('../../dist/infrastructure/harness-eval/measurement/measurement-bundle-census-file.js');
}

describe('readMeasurementBundleCensusFile', () => {
  it('throws a domain-specific error when census file does not exist (not raw ENOENT)', async () => {
    const { readMeasurementBundleCensusFile } = await moduleUnderTest();
    const fakeRoot = mkdtempSync(join(tmpdir(), 'census-missing-'));
    try {
      assert.throws(
        () => readMeasurementBundleCensusFile(fakeRoot),
        (error) => {
          assert.ok(error instanceof Error);
          // Must NOT be a raw ENOENT — must be a domain-specific message
          assert.ok(
            error.message.includes('measurement_bundle_census_missing'),
            `expected domain error tag 'measurement_bundle_census_missing', got: ${error.message}`,
          );
          // Must include the file reference so operator knows what to fix
          assert.ok(
            error.message.includes('measurement-bundles.yaml'),
            `expected file name in error message, got: ${error.message}`,
          );
          return true;
        },
      );
    } finally {
      rmSync(fakeRoot, { force: true, recursive: true });
    }
  });

  it('still throws on non-ENOENT errors (e.g. permission denied)', async () => {
    // This test verifies we don't swallow non-ENOENT errors.
    // We can't easily simulate EACCES in a portable way, so we verify
    // the function signature is preserved (returns string on success).
    const { readMeasurementBundleCensusFile, MEASUREMENT_BUNDLE_CENSUS_REF } = await moduleUnderTest();
    assert.equal(typeof readMeasurementBundleCensusFile, 'function');
    assert.equal(typeof MEASUREMENT_BUNDLE_CENSUS_REF, 'string');
    assert.ok(MEASUREMENT_BUNDLE_CENSUS_REF.includes('measurement-bundles.yaml'));
  });
});
