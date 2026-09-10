export class TempleAudio {
  constructor(){this.ctx=null;this.muted=false;this.musicClock=0;this.beat=0;this.nodes=[];}
  start(){
    if(this.ctx){this.ctx.resume();return;}
    const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
    this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.46;
    const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-20;compressor.ratio.value=5;this.master.connect(compressor);compressor.connect(this.ctx.destination);
    this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    for(const f of [55,82.41,110.15]){const osc=this.ctx.createOscillator(),g=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();osc.type='sine';osc.frequency.value=f;g.gain.value=.016;filter.type='lowpass';filter.frequency.value=300;osc.connect(filter);filter.connect(g);g.connect(this.master);osc.start();this.nodes.push(osc);}
    const wind=this.ctx.createBufferSource(),wg=this.ctx.createGain(),wf=this.ctx.createBiquadFilter();wind.buffer=this.noiseBuffer;wind.loop=true;wg.gain.value=.027;wf.type='lowpass';wf.frequency.value=260;wind.connect(wf);wf.connect(wg);wg.connect(this.master);wind.start();this.nodes.push(wind);
  }
  mute(v){this.muted=v;if(this.ctx)this.master.gain.setTargetAtTime(v?0:.46,this.ctx.currentTime,.05);}
  tone(f,d=.2,g=.15,type='sine',end=f,delay=0){if(!this.ctx)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+d);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(Math.max(.001,g),t+.006);v.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+d+.03);}
  noise(d=.2,g=.2,f=2000,end=300){if(!this.ctx)return;const t=this.ctx.currentTime,s=this.ctx.createBufferSource(),v=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();s.buffer=this.noiseBuffer;filter.type='bandpass';filter.Q.value=.6;filter.frequency.setValueAtTime(f,t);filter.frequency.exponentialRampToValueAtTime(end,t+d);v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(filter);filter.connect(v);v.connect(this.master);s.start(t);s.stop(t+d);}
  play(event){if(!this.ctx)return;switch(event.type){
    case'swing':this.noise(event.heavy?.35:.18,event.heavy?.3:.13,900,4500);this.tone(event.heavy?100:280,.18,.1,'triangle',60);break;
    case'impact':this.noise(.15,.25,4500,700);this.tone(160,.16,.2,'triangle',42);this.tone(1300,.1,.07,'sine',400);break;
    case'destroy':this.noise(.52,.35,2000,80);this.tone(75,.45,.25,'sawtooth',25);this.tone(680,.2,.09,'sine',110);break;
    case'warning':this.tone(440,.2,.07,'sine',660);this.tone(660,.2,.08,'sine',880,.28);this.tone(880,.32,.1,'sine',1080,.58);break;
    case'shot':this.tone(720,.3,.13,'sawtooth',120);this.noise(.16,.15,3600,300);break;
    case'dodge':this.noise(.28,.15,1000,5000);this.tone(180,.2,.06,'sine',800);break;
    case'damage':this.noise(.3,.28,450,70);this.tone(70,.35,.3,'triangle',28);break;
    case'wave':this.tone(82.4,1.7,.2,'sine',81);this.noise(.7,.06,170,60);break;
    case'clear':this.tone(440,.8,.09);this.tone(660,1,.06,'sine',660,.15);break;
    case'deflect':this.tone(1700,.3,.1,'sine',550);break;
    case'victory':[220,329.63,440,659.25,880].forEach((n,i)=>this.tone(n,2.4,.12,'sine',n,i*.23));break;
    case'defeat':[164.81,146.83,110,55].forEach((n,i)=>this.tone(n,1.3,.15,'triangle',n*.97,i*.32));break;
  }}
  update(dt,active,wave){if(!this.ctx||!active)return;this.musicClock-=dt;if(this.musicClock<=0){this.musicClock=.48;this.beat++;const notes=[110,110,130.81,98,110,164.81,146.83,98];if(this.beat%2===0)this.tone(notes[(this.beat/2)%8],.55,.045,'triangle',notes[(this.beat/2)%8]*.99);if(this.beat%4===0){this.tone(75,.28,.12,'sine',35);this.noise(.12,.04,160,90);}if(wave>1&&this.beat%2===1)this.noise(.07,.023,4000,2000);if(this.beat%16===0)this.tone(440,.9,.026,'sine',439);}}
  dispose(){for(const n of this.nodes)n.stop();this.ctx?.close();}
}
