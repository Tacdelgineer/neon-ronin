import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';

// Visual-only playback: simulation positions, timers, and hit detection remain authoritative.
export function createPlayerAnimation(root, clips = [], kind = 'player') {
  const mixer = new AnimationMixer(root);
  const actions = new Map();
  for (const name of kind === 'player' ? ['idle', 'run', 'attack', 'dodge'] : ['idle', 'run', 'attack', 'hit', 'death']) {
    const clip = clips.find(candidate => candidate.name === name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    const oneShot = name === 'attack' || name === 'dodge' || name === 'hit' || name === 'death';
    action.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = oneShot;
    action.paused = oneShot;
    action.setEffectiveWeight(0).play();
    actions.set(name, action);
  }
  let state = null, previousPlayer = null, previousTime = null;
  let previousEnemyState = null, recoil = 0, stunDuration = .2;
  const clamp = value => Math.max(0, Math.min(1, value));
  const controller = {
    get state() { return state; },
    get clipNames() { return [...actions.keys()]; },
    update(sim, dt, entity = sim.player) {
      if (sim.mode === 'paused' || !actions.size) return;
      const player = entity;
      const restarted = player !== previousPlayer || (previousTime !== null && sim.time < previousTime);
      if (restarted) {
        for (const action of actions.values()) {
          action.time = 0;
          action.setEffectiveWeight(0);
        }
        state = null;
        previousEnemyState = null; recoil = 0;
      }
      // Simulation time freezes during hit-stop. Ready/victory idle uses render time.
      const elapsed = sim.mode === 'playing' && !restarted
        ? Math.max(0, sim.time - previousTime) : Math.max(0, dt);
      previousPlayer = player;
      previousTime = sim.time;
      // Match the reused in-place stride to existing travel speeds without changing locomotion.
      const run = actions.get('run');
      if (run) run.setEffectiveTimeScale(kind === 'player' ? 2.59
        : player.type === 'ranged' ? .66 : sim.wave === 3 ? 2.24 : 1.93);
      let next = sim.mode !== 'playing' ? 'idle'
        : player.dodge > 0 ? 'dodge'
        : player.attack ? 'attack'
        : player.move > 0 ? 'run' : 'idle';
      if (kind === 'enemy') {
        if (previousEnemyState === 'charge' && player.state === 'recover') recoil = .22;
        else recoil = Math.max(0, recoil - elapsed);
        next = player.state === 'dead' ? 'death'
          : player.stun > 0 ? 'hit'
          : ['windup', 'slash', 'charge'].includes(player.state) || recoil > 0 ? 'attack'
          : player.move > 0 ? 'run' : 'idle';
        if (next === 'hit' && (state !== 'hit' || player.flash > .1)) stunDuration = Math.max(.01, player.stun);
        previousEnemyState = player.state;
      }
      if (!actions.has(next)) next = actions.has('idle') ? 'idle' : actions.keys().next().value;
      const first = state === null;
      const changed = state !== next;
      state = next;
      if (kind === 'enemy' && changed && next === 'death') {
        const death = actions.get('death'); death.reset().play(); death.paused = false;
      }
      const blend = first ? 1 : 1 - Math.exp(-elapsed * (next === 'attack' || next === 'dodge' ? 55 : 22));
      for (const [name, action] of actions) {
        const target = name === next ? 1 : 0;
        action.setEffectiveWeight(action.getEffectiveWeight() + (target - action.getEffectiveWeight()) * blend);
      }
      const attack = actions.get('attack');
      if (attack && player.attack) {
        const { t, duration, heavy } = player.attack;
        const hit = heavy ? .27 : .085;
        // The authored strike lands at 30% of the clip; align it with every combo/heavy hit.
        const phase = t <= hit ? .3 * t / hit : .3 + .7 * (t - hit) / (duration - hit);
        attack.time = clamp(phase) * attack.getClip().duration;
      }
      if (kind === 'enemy' && attack) {
        const phase = player.state === 'windup' ? .3 * clamp(1 - player.timer / (sim.wave === 3 ? .55 : .72))
          : player.state === 'slash' ? .3 + .4 * clamp(1 - player.timer / .19)
          : player.state === 'charge' ? .3 * clamp(1 - player.timer / 1.35)
          : recoil > 0 ? .3 + .7 * (1 - recoil / .22) : 1;
        attack.time = phase * attack.getClip().duration;
        const hit = actions.get('hit');
        if (hit && player.stun > 0) hit.time = clamp(1 - player.stun / stunDuration) * hit.getClip().duration;
      }
      const dodge = actions.get('dodge');
      if (dodge && player.dodge > 0) {
        dodge.time = clamp(1 - player.dodge / .29) * dodge.getClip().duration;
      }
      mixer.update(elapsed);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      actions.clear();
    },
  };
  return controller;
}

export function createEnemyAnimation(root, clips = []) {
  return createPlayerAnimation(root, clips, 'enemy');
}
