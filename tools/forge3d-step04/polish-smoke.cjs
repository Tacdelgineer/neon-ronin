// One short real-input smoke; skip fighting the first wave to sample its normal transition.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/lib/game/engine.js*', async route => {
      const response = await route.fetch();
      const original = await response.text();
      assert.match(original, /this\.mount\s*=\s*mount/);
      await route.fulfill({ response, body: original.replace(/this\.mount\s*=\s*mount/, 'window.__polishEngine=this;this.mount=mount') });
    });
    await page.goto(process.env.GAME_URL || 'http://localhost:3000');
    await page.waitForFunction(() => window.__polishEngine?.playerModel && window.__polishEngine.enemyTemplates.size === 2, { timeout: 60000 });
    const capture = () => page.evaluate(() => {
      const g = window.__polishEngine, v = g.playerModel;
      return { state: v.userData.playerAnimation.state, chest: v.getObjectByName('chest').quaternion.toArray(),
        tilt: v.rotation.toArray(), katana: v.userData.katana.visible, sheath: v.userData.sheath.visible,
        zoom: g.zoom, yaw: g.yaw, arena: g.arenaIndex, wave: g.sim.wave };
    });
    const idle = await capture();
    await page.waitForTimeout(300);
    assert.notDeepEqual(idle.chest, (await capture()).chest, 'idle moves');
    await page.keyboard.press('Enter');
    await page.mouse.move(720, 350);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(250);
    assert.equal((await capture()).state, 'run');
    await page.keyboard.up('KeyW');
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(80);
    const attack = await capture();
    assert.equal(attack.state, 'attack'); assert.equal(attack.katana, true); assert.equal(attack.sheath, false);
    const sword = await page.evaluate(() => {
      const s = window.__polishEngine.playerModel.getObjectByName('hero-energy-katana');
      return { socket: s.parent.parent.name, blade: s.material[1].emissive.toArray(), intensity: s.material[1].emissiveIntensity, groups: s.geometry.groups.length };
    });
    assert.equal(sword.socket, 'weapon_hand_r'); assert.equal(sword.groups, 2);
    assert(sword.blade[0] > sword.blade[1] * 5 && sword.intensity > 3, 'red emissive blade');
    await page.screenshot({ path: path.resolve('work/forge3d-step04/polish-attack.png') });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(650);
    assert.equal((await capture()).katana, false);
    await page.keyboard.press('Space');
    await page.waitForTimeout(70);
    const dodge = await capture(); assert.equal(dodge.state, 'dodge');
    assert(Math.abs(dodge.tilt[0]) + Math.abs(dodge.tilt[2]) > .1, 'dodge leans');
    await page.mouse.wheel(0, -180); await page.waitForTimeout(350);
    const close = (await capture()).zoom; assert(close < 22, 'wheel zooms in');
    await page.mouse.wheel(0, 180); await page.waitForTimeout(350);
    assert((await capture()).zoom > close, 'wheel zooms out');
    const yaw = (await capture()).yaw;
    await page.keyboard.down('KeyE'); await page.waitForTimeout(250); await page.keyboard.up('KeyE');
    assert((await capture()).yaw > yaw + .1, 'E orbits');
    await page.keyboard.down('KeyQ'); await page.waitForTimeout(250); await page.keyboard.up('KeyQ');
    assert(Math.abs((await capture()).yaw - yaw) < .08, 'Q orbits back');
    await page.waitForFunction(() => window.__polishEngine.sim.wave === 1);
    await page.evaluate(() => {
      const s = window.__polishEngine.sim;
      for (const e of s.enemies) s.hitEnemy(e, e.hp, 0, true);
    });
    await page.waitForFunction(() => window.__polishEngine.sim.transitioning);
    assert.equal((await capture()).arena, 0, 'transition starts in outgoing arena');
    await page.waitForFunction(() => window.__polishEngine.sim.wave === 2, { timeout: 10000 });
    const next = await page.evaluate(() => {
      const g = window.__polishEngine;
      return { arena: g.arenaIndex, name: g.world.name, pillars: g.sim.obstacles.length, enemies: g.sim.enemies.length, transition: g.sim.snapshot().transition };
    });
    assert.equal(next.arena, 1); assert.equal(next.name, 'The Ember Gates');
    assert.equal(next.pillars, 2); assert.equal(next.enemies, 4); assert.equal(next.transition, 0);
    await page.screenshot({ path: path.resolve('work/forge3d-step04/polish-arena2.png') });
    assert.deepEqual(errors, [], 'no console/runtime errors');
    console.log(JSON.stringify({ sword: 'pass', heroMotion: 'pass', camera: 'pass', arenaProgression: 'pass', consoleErrors: errors, next }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
