import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

const origin = process.env.DEPLOY_URL || 'https://dreamro.hexly.ai';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const get = async path => {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10_000), headers: { 'Cache-Control': 'no-cache' } });
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  return response;
};

for (let attempt = 1; attempt <= 24; attempt++) {
  try {
    const info = await (await get(`/build-info.json?commit=${commit}`)).json();
    assert.equal(info.name, 'dreamro'); assert.equal(info.version, version); assert.equal(info.commit, commit);
    const html = await (await get('/')).text();
    assert.match(html, /仙境之梦/);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
    assert.ok(assets.some(path => path.endsWith('.js')), 'The page must include the game bundle');
    for (const path of assets) {
      const response = await get(path);
      assert.match(response.headers.get('content-type') || '', path.endsWith('.js') ? /javascript/ : /text\/css/);
    }
    assert.match((await get('/art/dawnlight.webp')).headers.get('content-type') || '', /image\/webp/);
    assert.match(await (await get('/journey/valley')).text(), /仙境之梦/);
    console.log(`Live: ${origin} · v${version} · ${commit}`);
    process.exit(0);
  } catch (error) {
    console.error(`Verification attempt ${attempt}/24: ${error.message}`);
    if (attempt === 24) process.exit(1);
    await setTimeout(5000);
  }
}
