import { test, expect, type Page } from '@playwright/test';

async function enterRuins(page: Page, job = 'swordsman') {
  await page.goto('/');
  await page.locator(`[data-job="${job}"]`).click();
  await page.locator('#hero-name').fill('遗迹旅人');
  await page.locator('.begin-button').click();
  await expect(page.locator('#app')).toHaveClass('playing');
  await page.locator('[data-action="dismiss-tip"]').click();
  await page.evaluate(async () => {
    const { statsFor } = await import('/src/game/state.ts');
    const g = window.__dreamro.game;
    g.changeMap(2, true);
    g.hero.level = 7; g.hero.claimed = [true, true, false];
    g.stats = statsFor(g.hero); g.hero.hp = g.stats.hp; g.hero.sp = g.stats.sp;
    // Isolate the queen encounter from unrelated roaming monsters.
    for (const e of g.enemies) if (!e.boss) { e.hp = 0; e.respawn = 999; }
  });
}

for (const job of ['swordsman', 'archer']) {
  test(`${job}: queen loses health beyond her leash, returns home, and can be defeated`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await enterRuins(page, job);
    await page.evaluate(() => {
      const g = window.__dreamro.game; const b = g.enemies.find((e: any) => e.boss);
      // Reproduce a player kiting the queen just past the old 18-unit leash.
      b.position.set(b.spawn.x, g.world.walkHeight(b.spawn.x, 2.5), 2.5);
      g.player.group.position.set(b.spawn.x, g.world.walkHeight(b.spawn.x, 5.4), 5.4);
      g.updateCamera(.1, true);
    });
    await page.waitForTimeout(100);
    const point = await page.evaluate(() => {
      const g = window.__dreamro.game;
      return g.project(g.enemies.find((e: any) => e.boss).position.clone().add({ x: 0, y: 1.6, z: 0 }));
    });
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.__dreamro.game.target?.boss)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__dreamro.game.target.hp)).toBeLessThan(720);
    await expect(page.locator('#target-level')).toHaveText('返回领地');
    await expect(page.locator('#target-health-text')).not.toHaveText('720 / 720');
    const health: number[] = [];
    for (let n = 0; n < 8; n++) {
      await page.waitForTimeout(150);
      health.push(await page.evaluate(() => window.__dreamro.game.target.hp));
    }
    expect(health[0]).toBeLessThan(720);
    for (let i = 1; i < health.length; i++) expect(health[i]).toBeLessThanOrEqual(health[i - 1]);
    await expect.poll(() => page.evaluate(() => window.__dreamro.game.target.returning), { timeout: 12_000 }).toBe(false);
    // Continue using actual controls: basic attacks, skills, and potions.
    for (let n = 0; n < 35; n++) {
      if (await page.evaluate(() => window.__dreamro.game.hero.bossDefeated)) break;
      const status = await page.evaluate(() => {
        const g = window.__dreamro.game;
        return { cds: g.cooldowns, hp: g.hero.hp / g.stats.hp, sp: g.hero.sp / g.stats.sp, dead: g.dead };
      });
      expect(status.dead).toBe(false);
      for (let i = 0; i < 4; i++) if (status.cds[i] <= 0) await page.keyboard.press(String(i + 1));
      if (status.hp < .65) await page.keyboard.press('q');
      if (status.sp < .4) await page.keyboard.press('e');
      await page.waitForTimeout(500);
    }
    expect(await page.evaluate(() => window.__dreamro.game.hero.bossDefeated)).toBe(true);
    expect(await page.evaluate(() => window.__dreamro.game.target.hp)).toBe(0);
    expect(await page.evaluate(() => window.__dreamro.game.hero.kills[2])).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('retreat heals only once at home after disengaging; poison still damages a retreating queen', async ({ page }) => {
  await enterRuins(page, 'thief');
  const result = await page.evaluate(() => {
    const g = window.__dreamro.game; g.setPaused(true);
    const b = g.enemies.find((e: any) => e.boss);
    const advance = (seconds: number) => {
      for (let n = 0; n < seconds * 60; n++) { g.time += 1 / 60; g.tickEnemy(b, 1 / 60); }
    };
    b.hp = 300; b.aggro = true;
    b.position.set(b.spawn.x, g.world.walkHeight(b.spawn.x, 2.5), 2.5);
    g.player.group.position.set(0, g.world.walkHeight(0, 25), 25);
    advance(.1);
    const duringRetreat = { hp: b.hp, returning: b.returning };
    advance(6);
    const atHome = { hp: b.hp, returning: b.returning, distance: Math.hypot(b.position.x - b.spawn.x, b.position.z - b.spawn.y) };
    advance(6);
    const idleHp = b.hp;

    b.hp = b.maxHp; b.aggro = false;
    b.position.set(b.spawn.x, g.world.walkHeight(b.spawn.x, 2.5), 2.5);
    g.player.group.position.set(b.spawn.x, g.world.walkHeight(b.spawn.x, 5.4), 5.4);
    g.target = b; g.setPaused(false);
    const cast = g.cast(1); // Thief's poison applies real initial and periodic damage.
    g.setPaused(true);
    const poisonedHp = b.hp;
    advance(.1);
    const poisonedRetreat = b.returning;
    const poisonHealth = [];
    for (let n = 0; n < 7; n++) { advance(1); poisonHealth.push(b.hp); }
    return { duringRetreat, atHome, idleHp, cast, poisonedHp, poisonedRetreat, poisonHealth, finalReturning: b.returning };
  });
  expect(result.duringRetreat).toEqual({ hp: 300, returning: true });
  expect(result.atHome.returning).toBe(false);
  expect(result.atHome.distance).toBeLessThan(.25);
  expect(result.atHome.hp).toBeGreaterThan(300);
  expect(result.idleHp).toBe(result.atHome.hp);
  expect(result.cast).toBe(true);
  expect(result.poisonedRetreat).toBe(true);
  let previous = result.poisonedHp;
  for (const hp of result.poisonHealth) { expect(hp).toBeLessThanOrEqual(previous); previous = hp; }
  expect(previous).toBeLessThan(result.poisonedHp);
  expect(result.finalReturning).toBe(false);
});

test('arena floor clears the terrain and path; characters and magic stand above the floor', async ({ page }) => {
  await enterRuins(page);
  const result = await page.evaluate(() => {
    const g = window.__dreamro.game; g.setPaused(true);
    const b = g.enemies.find((e: any) => e.boss);
    const samples = [];
    g.world.root.updateMatrixWorld(true);
    for (const [dx, dz] of [[0, 0], [2, 2], [-3, 2], [0, -4], [4, -2]]) {
      const x = b.spawn.x + dx, z = b.spawn.y + dz;
      const ray = g.raycaster;
      ray.set(b.position.clone().set(x, 5, z), b.position.clone().set(0, -1, 0));
      const hits = ray.intersectObjects(g.world.root.children.filter((object: any) => object.name === 'batched-scenery'));
      const platform = hits.find((hit: any) => hit.object.material?.color?.getHexString() === 'd7ceb5');
      if (!platform) throw new Error('Arena platform is missing below the sample point');
      const ground = ray.intersectObject(g.world.ground)[0];
      const road = hits.find((hit: any) => hit.object.material?.vertexColors && !hit.object.isInstancedMesh && hit.object !== g.world.ground);
      samples.push({ floor: platform.point.y, ground: ground.point.y, road: road?.point.y, feet: g.world.walkHeight(x, z) });
    }
    g.player.group.position.set(b.spawn.x, g.world.walkHeight(b.spawn.x, -7), -7);
    g.updateCamera(.1, true);
    const seal = g.world.magicalCircles.find((m: any) => m.parent === g.world.root);
    return { samples, bossFeet: b.position.y, sealHeight: seal.position.y, sealDepthTest: seal.material.depthTest };
  });
  for (const sample of result.samples) {
    expect(sample.floor - sample.ground).toBeGreaterThan(.1);
    if (sample.road !== undefined) expect(sample.floor - sample.road).toBeGreaterThan(.1);
    expect(sample.feet).toBeCloseTo(sample.floor, 4);
    expect(result.sealHeight).toBeGreaterThan(sample.floor + .02);
  }
  expect(result.bossFeet).toBeCloseTo(result.samples[0].floor, 4);
  expect(result.sealDepthTest).toBe(true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'output/screenshots/boss-arena-fixed.png' });
  // Inspect the arena at several camera angles and both render quality settings.
  for (const [yaw, quality] of [[-.7, 'high'], [1.3, 'high'], [.4, 'balanced']] as const) {
    await page.evaluate(({ yaw, quality }) => {
      const g = window.__dreamro.game; g.cameraYaw = yaw; g.applyQuality(quality); g.updateCamera(.1, true);
    }, { yaw, quality });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `output/screenshots/boss-arena-${quality}-${yaw}.png` });
  }
});
