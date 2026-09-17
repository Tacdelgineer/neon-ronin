import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';

// Visual-only playback: simulation positions, timers, and hit detection remain authoritative.
export function createPlayerAnimation(root, clips = []) {
  const mixer = new AnimationMixer(root);
  const actions = new Map();
  for (const name of ['idle', 'run', 'attack', 'dodge']) {
    const clip = clips.find(candidate => candidate.name === name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    const oneShot = name === 'attack' || name === 'dodge';
    action.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = oneShot;
    action.paused = oneShot;
    action.setEffectiveWeight(0).play();
    actions.set(name, action);
  }
  let state = null, previousPlayer = null, previousTime = null;
  const clamp = value => Math.max(0, Math.min(1, value));
  const controller = {
    get state() { return state; },
    get clipNames() { return [...actions.keys()]; },
    update(sim, dt) {
      if (sim.mode === 'paused' || !actions.size) return;
      const player = sim.player;
      const restarted = player !== previousPlayer || (previousTime !== null && sim.time < previousTime);
      if (restarted) {
        for (const action of actions.values()) {
          action.time = 0;
          action.setEffectiveWeight(0);
        }
        state = null;
      }
      // Simulation time freezes during hit-stop. Ready/victory idle uses render time.
      const elapsed = sim.mode === 'playing' && !restarted
        ? Math.max(0, sim.time - previousTime) : Math.max(0, dt);
      previousPlayer = player;
      previousTime = sim.time;
      let next = sim.mode !== 'playing' ? 'idle'
        : player.dodge > 0 ? 'dodge'
        : player.attack ? 'attack'
        : player.move > 0 ? 'run' : 'idle';
      if (!actions.has(next)) next = actions.has('idle') ? 'idle' : actions.keys().next().value;
      const first = state === null;
      state = next;
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
