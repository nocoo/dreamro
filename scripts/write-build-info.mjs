import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = 'local';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Local builds can precede the first commit. */ }
writeFileSync('dist/build-info.json', JSON.stringify({ name: 'dreamro', version, commit }, null, 2) + '\n');
