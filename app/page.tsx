'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Volume2, VolumeX, Maximize, Pause, Play, RotateCcw, Swords, MoveUpRight, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
type Snapshot = { mode: string; hp: number; wave: number; enemies: number; kills: number; time: number; combo: number; dodge: number; heavy: number; banner: string; sub: string; score: number };
const initial: Snapshot = { mode: 'loading', hp: 100, wave: 0, enemies: 0, kills: 0, time: 0, combo: 0, dodge: 0, heavy: 0, banner: '', sub: '', score: 0 };
const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<any>(null);
  const [state, setState] = useState(initial);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    import('@/lib/game/engine.js').then(({ NeonRonin }) => {
      if (disposed || !mount.current) return;
      game.current = new NeonRonin(mount.current, setState);
    }).catch((e) => { console.error(e); setError('The temple could not be rendered. Please use a browser with WebGL enabled.'); });
    return () => { disposed = true; game.current?.dispose(); game.current = null; };
  }, []);
  const start = () => game.current?.start();
  const toggleMute = () => { const next = !muted; setMuted(next); game.current?.setMuted(next); };
  const active = state.mode === 'playing';
  const end = state.mode === 'victory' || state.mode === 'defeat';
  return <main className={`game-shell mode-${state.mode}`}>
    <div ref={mount} className="world" aria-label="Neon Ronin 3D combat arena"/><div className="vignette"/><div className="grain"/>
    <header className="topbar"><div className="brand"><span className="crescent"/><span>NEON <b>RONIN</b></span><span className="brand-divider"/><small>THE SILENT SHRINE</small></div><div className="toolbar"><Button variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? 'Unmute audio' : 'Mute audio'} title="Audio">{muted ? <VolumeX/> : <Volume2/>}</Button><Button variant="ghost" size="icon" onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }} aria-label="Toggle fullscreen"><Maximize/></Button>{(active || state.mode === 'paused') && <Button variant="ghost" size="icon" onClick={() => game.current?.togglePause()} aria-label={active ? 'Pause game' : 'Resume game'} title="Pause · Esc">{active ? <Pause/> : <Play/>}</Button>}</div></header>
    {(state.mode === 'ready' || state.mode === 'loading') && <section className="intro"><div className="eyebrow"><span/> A TECHNO-TEMPLE COMBAT EXPERIENCE</div><h1>NEON<br/><em>RONIN</em><span className="title-mark">月</span></h1><p className="tagline">Silence cuts a brighter path.</p><div className="intro-rule"/><p className="intro-copy">A forgotten shrine. Three enemy waves.<br/>One blade between you and the silence.</p><Button className="enter-button" onClick={start} disabled={state.mode === 'loading' || !!error}>{error ? 'RENDERING UNAVAILABLE' : state.mode === 'loading' ? 'AWAKENING THE SHRINE…' : 'ENTER THE SHRINE'}<ArrowUpRight size={20}/></Button>{error && <p className="error-copy">{error}</p>}<div className="entry-meta"><span className="live-dot"/> SINGLE PLAYER <span>·</span> 3–5 MINUTES <span>·</span> HEADPHONES RECOMMENDED</div></section>}
    {(active || state.mode === 'paused') && <><div className="encounter"><span className="eyebrow">SHRINE PURIFICATION</span><div className="wave-label">WAVE <b>{String(state.wave).padStart(2, '0')}</b><span>/ 03</span></div><div className="wave-track">{[1,2,3].map(n=><i key={n} className={state.wave >= n ? 'filled' : ''}/>)}</div><p>{state.enemies > 0 ? `${state.enemies} ${state.enemies === 1 ? 'HOSTILE' : 'HOSTILES'} REMAINING` : 'THE SHRINE STIRS'}</p></div><div className="run-time"><span>ELAPSED</span>{formatTime(state.time)}</div>{state.banner && <div className="wave-banner" key={state.banner}><span className="eyebrow">{state.sub}</span><h2>{state.banner}</h2><div/></div>}<div className="combat-hud"><div className="vitality"><div className="health-heading"><span className="health-emblem">月</span><div><span>RONIN</span><small>VITALITY</small></div><b>{Math.ceil(state.hp)}<small>/ 100</small></b></div><div className="health-track"><i style={{width:`${state.hp}%`}}/></div><div className="health-foot"><span>{state.hp <= 25 ? 'CRITICAL · KEEP MOVING' : 'SILENCE CUTS A BRIGHTER PATH'}</span><span>{state.kills} / 26</span></div></div><div className="abilities"><div className={`ability ${state.heavy > 0 ? 'cooling' : ''}`} style={{'--cooldown': `${state.heavy / 1.35 * 100}%`} as React.CSSProperties}><Swords/><kbd>RMB</kbd><span>HEAVY</span></div><div className={`ability ${state.dodge > 0 ? 'cooling' : ''}`} style={{'--cooldown': `${state.dodge / .9 * 100}%`} as React.CSSProperties}><MoveUpRight/><kbd>SPACE</kbd><span>DODGE</span></div></div></div>{state.combo > 1 && <div className="chain"><b>{state.combo}<small>×</small></b><span>BLADE CHAIN</span></div>}</>}
    {state.mode === 'paused' && <section className="center-overlay"><span className="eyebrow">TAKE A BREATH</span><h2>Stillness.</h2><p>The shrine can wait.</p><Button className="enter-button" onClick={() => game.current?.togglePause()}>RESUME<Play size={18}/></Button><Button variant="ghost" className="secondary-button" onClick={start}><RotateCcw size={15}/> Restart encounter</Button></section>}
    {end && <section className="center-overlay end-overlay"><span className={`end-symbol ${state.mode}`}>月</span><span className="eyebrow">{state.mode === 'victory' ? 'ALL THREE WAVES CLEARED' : 'THE SHRINE CLAIMS ANOTHER'}</span><h2>{state.mode === 'victory' ? 'Silence restored.' : 'Rise again.'}</h2><p>{state.mode === 'victory' ? 'The blade rests. The temple remembers.' : 'Read the warning. Find the opening.'}</p><div className="result-stats"><div><span>TIME</span><b>{formatTime(state.time)}</b></div><div><span>HOSTILES CUT</span><b>{state.kills}<small> / 26</small></b></div><div><span>BEST CHAIN</span><b>{state.score}<small> ×</small></b></div></div><Button className="enter-button" onClick={start}>RETURN TO THE SHRINE<RotateCcw size={18}/></Button><small className="restart-key">OR PRESS ENTER</small></section>}
    <footer className="controls-bar"><div><kbd>W A S D</kbd><span>Move</span></div><div><MousePointer2 size={15}/><span>Aim · edge to orbit</span></div><div><kbd>LMB</kbd><span>3-hit combo</span></div><div><kbd>RMB</kbd><span>Heavy</span></div><div><kbd>SPACE</kbd><span>Dodge</span></div><span className="footer-note">{active ? 'CYAN EVADES · RED WARNS' : 'ANCIENT STONE. FUTURE STEEL.'}</span></footer><div className="small-screen-note">Best played on a desktop with a mouse and keyboard.</div>
  </main>;
}
