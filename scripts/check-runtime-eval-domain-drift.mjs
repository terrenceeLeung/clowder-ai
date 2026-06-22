#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const DEFAULT_PATH = 'docs/harness-feedback/eval-domains';
const DEFAULT_SOURCE_REF = 'origin/main';

function parseArgs(argv) {
  const args = {
    runtimeDir: process.cwd(),
    sourceRef: DEFAULT_SOURCE_REF,
    checkedPath: DEFAULT_PATH,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--':
        break;
      case '--runtime-dir':
        i += 1;
        args.runtimeDir = requireValue(argv, i, arg);
        break;
      case '--source-ref':
        i += 1;
        args.sourceRef = requireValue(argv, i, arg);
        break;
      case '--path':
        i += 1;
        args.checkedPath = requireValue(argv, i, arg);
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function git(runtimeDir, args, options = {}) {
  return execFileSync('git', ['-C', runtimeDir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.allowFailure ? 'pipe' : 'pipe'],
  }).trim();
}

function gitMaybe(runtimeDir, args) {
  try {
    return git(runtimeDir, args);
  } catch {
    return null;
  }
}

function sourceYamlFiles(runtimeDir, ref, checkedPath) {
  const output = gitMaybe(runtimeDir, ['ls-tree', '-r', '--name-only', ref, '--', checkedPath]);
  if (!output) return [];
  const prefix = `${checkedPath.replace(/\/+$/, '')}/`;
  return output
    .split('\n')
    .filter(Boolean)
    .filter((path) => path.startsWith(prefix))
    .filter((path) => path.endsWith('.yaml') || path.endsWith('.yml'))
    .filter((path) => !path.slice(prefix.length).includes('/'))
    .sort();
}

function runtimeYamlFiles(runtimeDir, checkedPath) {
  const dir = join(runtimeDir, checkedPath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => `${checkedPath.replace(/\/+$/, '')}/${name}`)
    .sort();
}

function sourceFileContent(runtimeDir, ref, path) {
  return gitMaybe(runtimeDir, ['show', `${ref}:${path}`]);
}

function runtimeFileContent(runtimeDir, path) {
  try {
    return readFileSync(join(runtimeDir, path), 'utf8').trim();
  } catch {
    return null;
  }
}

function dirtyFiles(runtimeDir, checkedPath) {
  const output = gitMaybe(runtimeDir, ['status', '--porcelain', '--', checkedPath]);
  if (!output) return [];
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.replace(/^(?:..|.)\s+/, '').trim())
    .map((path) => relative(runtimeDir, resolve(runtimeDir, path)))
    .sort();
}

function compareEvalDomainYaml({ runtimeDir, sourceRef, checkedPath }) {
  const resolvedRuntimeDir = resolve(runtimeDir);
  if (!existsSync(resolvedRuntimeDir)) {
    throw new Error(`runtime dir does not exist: ${resolvedRuntimeDir}`);
  }

  const runtimeFiles = runtimeYamlFiles(resolvedRuntimeDir, checkedPath);
  const sourceFiles = sourceYamlFiles(resolvedRuntimeDir, sourceRef, checkedPath);
  const files = [...new Set([...runtimeFiles, ...sourceFiles])].sort();

  const missingInRuntime = sourceFiles.filter((path) => !runtimeFiles.includes(path));
  const missingInSource = runtimeFiles.filter((path) => !sourceFiles.includes(path));
  const differingFiles = files.filter((path) => {
    if (missingInRuntime.includes(path) || missingInSource.includes(path)) return false;
    return runtimeFileContent(resolvedRuntimeDir, path) !== sourceFileContent(resolvedRuntimeDir, sourceRef, path);
  });
  const driftedFiles = [...missingInRuntime, ...missingInSource, ...differingFiles].sort();

  const aheadBehind = gitMaybe(resolvedRuntimeDir, ['rev-list', '--left-right', '--count', `HEAD...${sourceRef}`]);
  const [ahead, behind] = aheadBehind
    ? aheadBehind.split(/\s+/).map((value) => Number.parseInt(value, 10))
    : [null, null];

  return {
    status: driftedFiles.length > 0 ? 'drift' : 'ok',
    runtimeDir: resolvedRuntimeDir,
    sourceRef,
    checkedPath,
    ahead,
    behind,
    dirtyFiles: dirtyFiles(resolvedRuntimeDir, checkedPath),
    driftedFiles,
    missingInRuntime,
    missingInSource,
    differingFiles,
  };
}

function printHuman(result) {
  if (result.status === 'ok') {
    console.log(
      `OK: runtime eval-domain yaml matches ${result.sourceRef} (${result.checkedPath}); behind=${result.behind ?? 'unknown'}`,
    );
    printDirtyFiles(result);
    return;
  }

  console.error(
    `DRIFT: runtime eval-domain yaml differs from ${result.sourceRef} (${result.checkedPath}); behind=${
      result.behind ?? 'unknown'
    }`,
  );
  for (const path of result.driftedFiles) {
    console.error(`- ${path}`);
  }
  printDirtyFiles(result);
}

function printDirtyFiles(result) {
  if (result.dirtyFiles.length === 0) return;
  console.error('Dirty eval-domain yaml files in runtime worktree:');
  for (const path of result.dirtyFiles) {
    console.error(`- ${path}`);
  }
}

function printUsage() {
  console.log(`Usage: node scripts/check-runtime-eval-domain-drift.mjs [options]

Options:
  --runtime-dir <path>  Git worktree to inspect (default: cwd)
  --source-ref <ref>    Source ref to compare against (default: origin/main)
  --path <path>         Registry directory (default: ${DEFAULT_PATH})
  --json                Emit JSON

This guard is read-only. It does not fetch, sync, merge, or restart runtime.`);
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printUsage();
      return 0;
    }
    const result = compareEvalDomainYaml(args);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }
    return result.status === 'ok' ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`check-runtime-eval-domain-drift: ${message}`);
    return 2;
  }
}

process.exitCode = main();
