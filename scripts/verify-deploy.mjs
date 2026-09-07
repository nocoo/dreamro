import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const event = process.env.GITHUB_EVENT_NAME;

if (event === 'workflow_run') {
  const run = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).workflow_run;
  assert.equal(run.head_repository.full_name, process.env.GITHUB_REPOSITORY, 'CI must belong to this repository');
  assert.equal(run.head_branch, 'main', 'Only main is deployed automatically');
  assert.ok(['push', 'workflow_dispatch'].includes(run.event), 'PR runs cannot deploy');
  assert.equal(run.conclusion, 'success', 'CI must pass before deployment');
  assert.equal(commit, run.head_sha, 'Checkout must match the commit verified by CI');
  assert.equal(commit, git('rev-parse', 'origin/main'), 'A newer main commit exists; skipping this stale deployment');
} else {
  assert.ok(['push', 'workflow_dispatch'].includes(event), 'Unsupported release event');
  const tag = process.env.RELEASE_TAG ?? '';
  assert.match(tag, /^v\d+\.\d+\.\d+$/, 'Use a release tag such as v1.0.0');
  assert.equal(tag.slice(1), version, 'Tag must match package.json version');
  assert.equal(git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`), commit, 'Checkout must match the release tag');
  git('merge-base', '--is-ancestor', commit, 'origin/main');
}

if (!process.argv.includes('--source-only')) {
  const info = JSON.parse(readFileSync('dist/build-info.json', 'utf8'));
  assert.equal(info.name, 'dreamro');
  assert.equal(info.commit, commit, 'Build artifact must belong to this commit');
  assert.equal(info.version, version, 'Build artifact must match the release version');
}
console.log(`Verified DreamRO v${version} at ${commit}`);
