import { test, expect, type Page } from '@playwright/test';

declare global { interface Window { __dreamro: any } }

async function start(page: Page, job = 'archer', name = '夏日旅人') {
  await page.goto('/');
  await page.locator(`[data-job="${job}"]`).click();
  await page.locator('#hero-name').fill(name);
  await page.locator('.begin-button').click();
  await expect(page.locator('#app')).toHaveClass('playing');
  await expect.poll(() => page.evaluate(() => Boolean(window.__dreamro.game))).toBe(true);
  await page.waitForTimeout(250);
}

async function walkByMap(page: Page, x: number, z: number) {
  await page.keyboard.press('m');
  await expect(page.locator('#large-map')).toBeVisible();
  const bounds = await page.locator('#large-map').boundingBox();
  await page.mouse.click(bounds!.x + (x + 35) / 70 * bounds!.width, bounds!.y + (z + 35) / 70 * bounds!.height);
  await expect(page.locator('#modal')).not.toBeVisible();
}

async function speakToGuide(page: Page) {
  const p = await page.evaluate(() => { const n = window.__dreamro.game.world.npcPosition; return { x: n.x + 1.4, z: n.z + .55 }; });
  await walkByMap(page, p.x, p.z);
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.player.group.position.distanceTo(window.__dreamro.game.world.npcPosition)), { timeout: 22_000 }).toBeLessThan(3.2);
  await page.keyboard.press('f');
  await expect(page.locator('.dialogue-modal')).toBeVisible();
}

async function travelNorth(page: Page, targetMap: number) {
  const portal = await page.evaluate(() => { const p = window.__dreamro.game.world.portals.find((p: any) => p.north); return { x: p.x, z: p.z }; });
  await walkByMap(page, portal.x, portal.z);
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.hero.mapId), { timeout: 28_000 }).toBe(targetMap);
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.transitioning)).toBe(false);
}

async function attackNext(page: Page) {
  const nearest = await page.evaluate(() => {
    const g = window.__dreamro.game; const enemy = g.closestEnemy();
    return enemy ? { x: enemy.position.x, z: enemy.position.z, distance: enemy.position.distanceTo(g.player.group.position) } : null;
  });
  expect(nearest).not.toBeNull();
  // Wandering monsters may leave the 18-unit Space targeting radius between fights.
  if (nearest!.distance > 16) {
    await walkByMap(page, nearest!.x, nearest!.z);
    await expect.poll(() => page.evaluate(() => {
      const g = window.__dreamro.game; return g.closestEnemy()?.position.distanceTo(g.player.group.position) ?? Infinity;
    }), { timeout: 20_000 }).toBeLessThan(16);
  }
  await page.keyboard.press('Space');
}

test('all 20 professions have a working animated preview, and names are validated', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('.begin-button').click();
  await expect(page.locator('#name-error')).toContainText('先写下你的名字');
  await page.locator('#hero-name').fill('<script>');
  await page.locator('.begin-button').click();
  await expect(page.locator('#name-error')).toContainText('1–12');
  const basics = ['swordsman', 'mage', 'archer', 'acolyte', 'merchant', 'thief', 'novice'];
  const advanced = ['knight', 'crusader', 'wizard', 'sage', 'hunter', 'bard', 'dancer', 'priest', 'monk', 'blacksmith', 'alchemist', 'assassin', 'rogue'];
  for (const id of basics) {
    await page.locator(`[data-job="${id}"]`).click();
    await expect(page.locator(`[data-job="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => window.__dreamro.app.preview.character.job.id)).toBe(id);
    await expect(page.locator('.mini-skill')).toHaveCount(4);
  }
  await page.locator('[data-action="advanced-jobs"]').click();
  await expect(page.locator('[data-job]')).toHaveCount(13);
  for (const id of advanced) {
    await page.locator(`[data-job="${id}"]`).click();
    await expect.poll(() => page.evaluate(() => window.__dreamro.app.preview.character.job.id)).toBe(id);
    await expect(page.locator('.mini-skill')).toHaveCount(4);
  }
  await page.locator('[data-job="dancer"]').click();
  await page.locator('[data-action="body-1"]').click();
  await page.locator('[data-action="hair-3"]').click();
  await page.locator('[data-action="hairstyle"]').click();
  const rotation = await page.evaluate(() => window.__dreamro.app.preview.yaw);
  await page.locator('[data-action="rotate-right"]').click();
  expect(await page.evaluate(() => window.__dreamro.app.preview.yaw)).toBeGreaterThan(rotation);
  const initial = await page.evaluate(() => window.__dreamro.app.preview.character.body.position.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__dreamro.app.preview.character.body.position.y)).not.toBe(initial);
  await page.locator('#hero-name').fill('月光邮差');
  await page.screenshot({ path: 'output/screenshots/creation-dancer.png' });
  expect(errors).toEqual([]);
});

test('a complete adventure: combat, rewards, bridges, three maps, the queen, and persistence', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await start(page);
  const origin = await page.evaluate(() => window.__dreamro.game.player.group.position.toArray());
  await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
  expect(await page.evaluate(() => window.__dreamro.game.player.group.position.toArray())).not.toEqual(origin);
  await page.screenshot({ path: 'output/screenshots/valley-final.png' });

  for (let count = 1; count <= 5; count++) {
    await attackNext(page);
    await expect.poll(() => page.evaluate(() => window.__dreamro.game.hero.kills[0]), { timeout: 12_000 }).toBeGreaterThanOrEqual(count);
  }
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.hero.level)).toBeGreaterThan(1);
  await speakToGuide(page);
  await expect(page.locator('[data-action="claim-quest"]')).toBeVisible();
  await page.locator('[data-action="claim-quest"]').click();
  expect(await page.evaluate(() => window.__dreamro.game.hero.claimed[0])).toBe(true);
  await expect(page.locator('[data-action="claim-quest"]')).toHaveCount(0);
  const potions = await page.evaluate(() => window.__dreamro.game.hero.redPotions);
  await page.locator('[data-action="buy-red"]').click();
  expect(await page.evaluate(() => window.__dreamro.game.hero.redPotions)).toBe(potions + 1);
  await page.locator('.dialogue-bottom [data-action="close-modal"]').click();

  await page.keyboard.press('i');
  const attack = await page.evaluate(() => window.__dreamro.game.stats.attack);
  await page.locator('[data-action="upgrade"]').click();
  expect(await page.evaluate(() => window.__dreamro.game.stats.attack)).toBe(attack + 4);
  await page.keyboard.press('Escape');
  await travelNorth(page, 1);
  await page.screenshot({ path: 'output/screenshots/forest-final.png' });
  for (let count = 1; count <= 5; count++) {
    await attackNext(page);
    await page.keyboard.press('1');
    await expect.poll(() => page.evaluate(() => window.__dreamro.game.hero.kills[1]), { timeout: 14_000 }).toBeGreaterThanOrEqual(count);
  }
  await speakToGuide(page);
  await page.locator('[data-action="claim-quest"]').click();
  expect(await page.evaluate(() => window.__dreamro.game.hero.claimed[1])).toBe(true);
  await page.locator('.dialogue-bottom [data-action="close-modal"]').click();
  await travelNorth(page, 2);
  await walkByMap(page, -3.2, -9.5);
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.player.group.position.z), { timeout: 20_000 }).toBeLessThan(-8);
  await page.screenshot({ path: 'output/screenshots/sanctuary-final.png' });
  const boss = await page.evaluate(() => { const g = window.__dreamro.game; const b = g.enemies.find((e: any) => e.boss); return g.project(b.position.clone().add({ x: 0, y: 1.7, z: 0 })); });
  await page.mouse.click(boss.x, boss.y);
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.target?.boss)).toBe(true);
  for (let n = 0; n < 35; n++) {
    if (await page.evaluate(() => window.__dreamro.game.hero.bossDefeated)) break;
    const snapshot = await page.evaluate(() => { const g = window.__dreamro.game; return { cds: g.cooldowns, hp: g.hero.hp / g.stats.hp, sp: g.hero.sp / g.stats.sp, dead: g.dead }; });
    expect(snapshot.dead).toBe(false);
    for (let i = 0; i < 4; i++) if (snapshot.cds[i] <= 0) await page.keyboard.press(String(i + 1));
    if (snapshot.hp < .65) await page.keyboard.press('q');
    if (snapshot.sp < .4) await page.keyboard.press('e');
    await page.waitForTimeout(800);
  }
  expect(await page.evaluate(() => window.__dreamro.game.hero.bossDefeated)).toBe(true);
  await speakToGuide(page);
  await page.locator('[data-action="claim-quest"]').click();
  await expect(page.locator('.victory-modal')).toBeVisible();
  await page.screenshot({ path: 'output/screenshots/journey-complete.png' });
  expect(await page.evaluate(() => window.__dreamro.game.hero.claimed)).toEqual([true, true, true]);
  await page.locator('[data-action="keep-playing"]').click();
  const save = await page.evaluate(() => { const g = window.__dreamro.game; g.save(); return structuredClone(g.hero); });
  await page.reload();
  await page.locator('[data-action="characters"]').click();
  await page.getByRole('button', { name: /夏日旅人/ }).click();
  await expect(page.locator('#app')).toHaveClass('playing');
  expect(await page.evaluate(() => window.__dreamro.game.hero.claimed)).toEqual([true, true, true]);
  expect(await page.evaluate(() => window.__dreamro.game.hero.mapId)).toBe(2);
  expect(await page.evaluate(() => window.__dreamro.game.hero.level)).toBe(save.level);
  expect(await page.evaluate(() => window.__dreamro.game.familiar.permanent)).toBe(true);
  expect(errors).toEqual([]);
});

test('spell effects, potion costs, cooldowns, pause, chest persistence, and respawn', async ({ page }) => {
  await start(page, 'mage', '星光邮差');
  await page.locator('[data-action="dismiss-tip"]').click();
  await expect(page.locator('#scene canvas')).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.cooldowns[0])).toBeGreaterThan(0);
  const resource = await page.evaluate(() => { const g = window.__dreamro.game; const before = g.hero.sp; const result = g.cast(0); return { before, after: g.hero.sp, result }; });
  expect(resource.result).toBe(false); expect(resource.after).toBe(resource.before);
  await page.keyboard.press('4');
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.zones.length)).toBeGreaterThan(0);
  await page.screenshot({ path: 'output/screenshots/magic-combat.png' });
  await page.keyboard.press('i');
  const progress = await page.evaluate(() => window.__dreamro.game.hero.playtime);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__dreamro.game.hero.playtime)).toBe(progress);
  const firstFocus = await page.evaluate(() => document.activeElement?.outerHTML);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).not.toBe(firstFocus);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__dreamro.game.paused)).toBe(false);
  await page.evaluate(() => { const g = window.__dreamro.game; g.hero.hp = 20; g.hero.sp = 10; });
  const counts = await page.evaluate(() => ({ red: window.__dreamro.game.hero.redPotions, blue: window.__dreamro.game.hero.bluePotions }));
  await page.keyboard.press('q'); await page.keyboard.press('e');
  expect(await page.evaluate(() => window.__dreamro.game.hero.redPotions)).toBe(counts.red - 1);
  expect(await page.evaluate(() => window.__dreamro.game.hero.bluePotions)).toBe(counts.blue - 1);
  // Reproduce a delayed spell finishing its target while a ground-click route is in progress.
  await page.evaluate(() => {
    const g = window.__dreamro.game; g.autoAttack = false; g.zones = [];
    const target = g.enemies[0]; target.hp = 1; target.poison = 0; target.aggro = false; target.death = 0;
    target.model.group.visible = true; target.position.copy(g.player.group.position); target.position.x += 3;
    g.target = target; g.cooldowns[3] = 0; g.hero.sp = g.stats.sp;
    if (!g.cast(3)) throw new Error('Could not prepare the delayed-spell navigation scenario');
    g.zones[0].tick = .7;
  });
  await walkByMap(page, -14.5, 12.5);
  await expect.poll(() => page.evaluate(() => window.__dreamro.game.interaction), { timeout: 20_000 }).toBe('chest');
  expect(await page.evaluate(() => window.__dreamro.game.target.hp)).toBe(0);
  const before = await page.evaluate(() => ({ cards: window.__dreamro.game.hero.cards, hp: window.__dreamro.game.stats.hp }));
  await page.keyboard.press('f');
  expect(await page.evaluate(() => window.__dreamro.game.hero.cards)).toBe(before.cards + 1);
  expect(await page.evaluate(() => window.__dreamro.game.stats.hp)).toBe(before.hp + 12);
  expect(await page.evaluate(() => window.__dreamro.game.hero.openedChests)).toContain('0-0');
  await page.keyboard.press('f');
  expect(await page.evaluate(() => window.__dreamro.game.hero.cards)).toBe(before.cards + 1);
  await page.evaluate(() => { const g = window.__dreamro.game; g.invulnerable = 0; g.hurt(99999); });
  await expect(page.locator('.ending-modal')).toContainText('歇一会儿');
  await page.locator('[data-action="respawn"]').click();
  expect(await page.evaluate(() => window.__dreamro.game.dead)).toBe(false);
  expect(await page.evaluate(() => window.__dreamro.game.hero.hp)).toBe(await page.evaluate(() => window.__dreamro.game.stats.hp));
  expect(await page.evaluate(() => window.__dreamro.game.hero.openedChests)).toContain('0-0');
  await page.reload();
  await page.locator('[data-action="characters"]').click();
  await page.getByRole('button', { name: /星光邮差/ }).click();
  expect(await page.evaluate(() => window.__dreamro.game.world.chests.find((c: any) => c.id === '0-0').opened)).toBe(true);
});

test('touch layout works, with no horizontal overflow and a working joystick', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'output/screenshots/creation-mobile.png', fullPage: true });
  await page.locator('#hero-name').fill('薄荷与风'); await page.locator('.begin-button').click();
  await expect(page.locator('#app')).toHaveClass('playing');
  await page.waitForTimeout(500);
  await expect(page.locator('#joystick')).toBeVisible();
  await expect(page.locator('.mobile-attack')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const pos = await page.evaluate(() => window.__dreamro.game.player.group.position.toArray());
  const joystick = await page.locator('#joystick').boundingBox();
  await page.mouse.move(joystick!.x + 44, joystick!.y + 44); await page.mouse.down();
  await page.mouse.move(joystick!.x + 67, joystick!.y + 15); await page.waitForTimeout(500); await page.mouse.up();
  expect(await page.evaluate(() => window.__dreamro.game.player.group.position.toArray())).not.toEqual(pos);
  await page.screenshot({ path: 'output/screenshots/valley-mobile.png' });
  await page.locator('[data-action="bag"]').click();
  await expect(page.locator('.inventory-modal')).toBeVisible();
  const modal = await page.locator('#modal').boundingBox(); expect(modal!.x).toBeGreaterThanOrEqual(0); expect(modal!.x + modal!.width).toBeLessThanOrEqual(390);
  await page.locator('.modal-close').click();
  expect(await page.evaluate(() => window.__dreamro.game.paused)).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});

test('corrupted storage and untrusted character names are handled without executing markup', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('dreamro.adventurers.v1', '{broken-json'));
  await page.reload(); await expect(page.locator('[data-job]')).toHaveCount(7);
  await page.locator('#hero-name').fill('正常名字'); await page.locator('.begin-button').click();
  await expect(page.locator('#app')).toHaveClass('playing');
  await page.evaluate(() => { const key = 'dreamro.adventurers.v1'; const saves = JSON.parse(localStorage.getItem(key)!); saves[0].name = '<img src=x>'; saves[0].id = 'saved" onclick="window.__unsafeName = true'; saves[0].hp = null; saves[0].level = -20; localStorage.setItem(key, JSON.stringify(saves)); });
  // Navigate to a fresh document without the old game's unload save replacing this deliberate fixture.
  const second = await page.context().newPage(); await second.goto('/');
  await second.locator('[data-action="characters"]').click();
  await expect(second.locator('.saved-character img')).toHaveCount(0);
  await expect(second.locator('.saved-character strong')).toContainText('<img src=x>');
  await expect(second.locator('.saved-character')).not.toHaveAttribute('onclick');
  await second.locator('.saved-character').click();
  expect(await second.evaluate(() => window.__dreamro.game.hero.level)).toBe(1);
  expect(await second.evaluate(() => Number.isFinite(window.__dreamro.game.hero.hp))).toBe(true);
});

test('all 80 profession skills affect combat, including healing, poison, fields, and companions', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const jobs = await page.evaluate(() => window.__dreamro.jobs.map((j: any) => ({ id: j.id, name: j.name, advanced: j.advanced })));
  const kinds = new Set<string>();
  for (const job of jobs) {
    await page.locator(`[data-action="${job.advanced ? 'advanced-jobs' : 'base-jobs'}"]`).click();
    await page.locator(`[data-job="${job.id}"]`).click();
    await page.locator('#hero-name').fill(`${job.name}旅人`);
    await page.locator('.begin-button').click();
    await expect(page.locator('#app')).toHaveClass('playing');
    for (let i = 0; i < 4; i++) {
      // Keep the target alive and remove incidental damage so each skill's behavior is observable.
      const kind = await page.evaluate(() => {
        const g = window.__dreamro.game;
        g.path = []; g.autoAttack = false; g.zones = []; g.effects.clear(); g.guard = 0;
        g.player.group.position.set(.75, g.world.walkHeight(.75, 22), 22);
        g.hero.hp = 20; g.hero.sp = g.stats.sp; g.invulnerable = 100; g.lastDamage = g.time;
        g.enemies.forEach((e: any) => { e.hp = e.maxHp = 10000; e.aggro = false; e.poison = 0; e.rooted = 0; e.attackTimer = 999; e.wanderTimer = 999; e.wander.set(0, 0); });
        g.target = g.enemies[0]; g.target.position.copy(g.player.group.position); g.target.position.z -= 3.5;
        return g.job.skills;
      }).then(skills => skills[i].kind);
      kinds.add(kind);
      await page.locator(`[data-action="skill-${i}"]`).click();
      await expect.poll(() => page.evaluate(index => window.__dreamro.game.cooldowns[index], i), { message: `${job.name}: skill ${i + 1} starts its cooldown` }).toBeGreaterThan(0);
      if (kind === 'heal' || kind === 'drain' || kind === 'song') {
        await expect.poll(() => page.evaluate(() => window.__dreamro.game.hero.hp)).toBeGreaterThan(20);
      }
      if (kind === 'guard') {
        expect(await page.evaluate(() => window.__dreamro.game.guard)).toBeGreaterThan(0);
      } else if (kind !== 'heal') {
        await expect.poll(() => page.evaluate(() => window.__dreamro.game.target.hp), { message: `${job.name}: ${kind} damages the target` }).toBeLessThan(10000);
      }
      if (kind === 'poison') {
        expect(await page.evaluate(() => window.__dreamro.game.target.poison)).toBeGreaterThan(0);
        const hp = await page.evaluate(() => window.__dreamro.game.target.hp);
        await expect.poll(() => page.evaluate(() => window.__dreamro.game.target.hp)).toBeLessThan(hp);
      }
      if (kind === 'trap') expect(await page.evaluate(() => window.__dreamro.game.target.rooted)).toBeGreaterThan(0);
      if (kind === 'summon') {
        expect(await page.evaluate(() => Boolean(window.__dreamro.game.familiar))).toBe(true);
        if (job.id === 'hunter') expect(await page.evaluate(() => window.__dreamro.game.familiar.wings.length)).toBe(2);
      }
    }
    await page.keyboard.press('Escape');
    await page.locator('[data-action="return-creation"]').click();
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dreamro.adventurers.v1')!).length)).toBe(20);
  expect(kinds.size).toBe(11);
  expect(errors).toEqual([]);
});
