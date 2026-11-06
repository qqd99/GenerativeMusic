export type Style = 'swing' | 'ballad' | 'musicbox' | 'bellchoir';
export type Instrument = 'piano' | 'celesta' | 'bell' | 'bass' | 'strings' | 'sleigh';
export type NoteEvent = { at: number; duration: number; midi: number; instrument: Instrument; gain: number; pan: number };
export type Tune = { id: string; title: string; key: number; meter: 3 | 4; melody: readonly (readonly [number,number,number])[][] };
export type TrackPlan = { id: string; tune: Tune; style: Style; key: number; seed: number; bpm: number; duration: number; events: NoteEvent[] };
export type Clock = { now():number; setTimeout(fn:()=>void,ms:number):unknown; clearTimeout(id:unknown):void };
export type Config = { timezone:string; seed:number; lookAheadSec:number; tickMs:number; crossfadeSec:number; maxVoices:number; noRepeatWindow:number; quietHours:{start:number;end:number}; levels:{melody:number;bass:number;strings:number;bells:number;sleigh:number} };
export const defaultConfig: Config = {timezone:'Asia/Ho_Chi_Minh',seed:24122026,lookAheadSec:1.25,tickMs:100,crossfadeSec:4,maxVoices:48,noRepeatWindow:40,quietHours:{start:22,end:6},levels:{melody:.17,bass:.08,strings:.025,bells:.08,sleigh:.035}};
export const tunes: Tune[] = [
{id:'jingle-bells',title:'Jingle Bells',key:0,meter:4,melody:[
[[0,64,1],[1,64,1],[2,64,2]],[[0,64,1],[1,64,1],[2,64,2]],[[0,64,1],[1,67,1],[2,60,1.5],[3.5,62,.5]],[[0,64,4]],
[[0,65,1],[1,65,1],[2,65,1.5],[3.5,65,.5]],[[0,65,1],[1,64,1],[2,64,1],[3,64,.5],[3.5,64,.5]],[[0,64,1],[1,62,1],[2,62,1],[3,64,1]],[[0,62,2],[2,67,2]],
[[0,64,1],[1,64,1],[2,64,2]],[[0,64,1],[1,64,1],[2,64,2]],[[0,64,1],[1,67,1],[2,60,1.5],[3.5,62,.5]],[[0,64,4]],
[[0,65,1],[1,65,1],[2,65,1.5],[3.5,65,.5]],[[0,65,1],[1,64,1],[2,64,1],[3,64,.5],[3.5,64,.5]],[[0,67,1],[1,67,1],[2,65,1],[3,62,1]],[[0,60,4]]]},
{id:'silent-night',title:'Silent Night',key:10,meter:3,melody:[
[[0,65,1.5],[1.5,67,.5],[2,65,1]],[[0,62,2],[2,65,1]],[[0,67,1.5],[1.5,69,.5],[2,67,1]],[[0,65,2],[2,62,1]],
[[0,72,1.5],[1.5,72,.5],[2,69,1]],[[0,70,2],[2,65,1]],[[0,67,1.5],[1.5,67,.5],[2,70,1]],[[0,69,1.5],[1.5,67,.5],[2,65,1]],
[[0,67,1.5],[1.5,65,.5],[2,62,1]],[[0,67,1.5],[1.5,65,.5],[2,62,1]],[[0,72,1.5],[1.5,75,.5],[2,72,1]],[[0,70,2],[2,65,1]]]}
];
const styles:Style[]=['swing','ballad','musicbox','bellchoir'], offsets=[0,2,5,7,9];
export function virtualTrackIds(){return tunes.flatMap(t=>styles.flatMap(s=>offsets.map(k=>t.id+'.'+s+'.'+((t.key+k)%12))));}
export function seeded(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function composeTrack(tune:Tune,style:Style,key:number,seed:number,cfg:Config=defaultConfig):TrackPlan{
 const random=seeded(seed),range=style==='swing'?[112,140]:style==='ballad'?[66,76]:style==='musicbox'?[72,84]:[100,124],bpm=Math.round(range[0]+random()*(range[1]-range[0])),beat=60/bpm,events:NoteEvent[]=[],bars=96,transpose=key-tune.key;
 const add=(at:number,duration:number,midi:number,instrument:Instrument,gain:number,pan=0)=>events.push({at:Math.max(0,at+(random()-.5)*.006),duration,midi,instrument,gain,pan});
 for(let bar=0;bar<bars;bar++){const lift=bar>=80?2:0,root=48+tune.key+[0,5,7,0,0,9,2,7][bar%8]+transpose+lift;
 add(bar*tune.meter*beat,2.6*beat,root-12,'bass',cfg.levels.bass,-.08);
 for(const [i,p] of [[4,-.2],[7,.12],[11,.22]] as const)add(bar*tune.meter*beat,tune.meter*.9*beat,root+i+12,'strings',cfg.levels.strings,p);
 for(const [b,n,len] of tune.melody[bar%tune.melody.length]){const swing=style==='swing'&&b%1===.5?.16:0,at=(bar*tune.meter+b+swing)*beat,pitch=n+transpose+lift;
 add(at,len*beat,pitch,style==='musicbox'?'celesta':'piano',cfg.levels.melody,.02);
 if((bar%4===0&&b===0)||(style==='bellchoir'&&b%2===0)||(bar%4===3&&len>=1))add(at+.012,Math.min(.7,len)*beat,pitch+12,'bell',cfg.levels.bells,.25);
 }
 const hits=style==='ballad'?[1,2]:style==='musicbox'?[]:[0,.5,1,1.5,2,2.5,3,3.5];
 for(const b of hits)if(b<tune.meter)add((bar*tune.meter+b)*beat,.16,90,'sleigh',cfg.levels.sleigh*(b%1?.55:1),random()*1.5-.75);
 if(bar%4===3)add((bar*tune.meter+tune.meter-.5)*beat,2*beat,root+24,'bell',cfg.levels.bells*1.1,0);
 }
 events.sort((a,b)=>a.at-b.at);return{id:tune.id+'.'+style+'.'+key,tune,style,key,seed,bpm,duration:bars*tune.meter*beat,events};
}
export type MusicOptions={context:BaseAudioContext;output:AudioNode;config?:Partial<Config>;clock?:Clock;onTrack?:(p:{id:string;title:string;style:Style})=>void;onStatus?:(message:string)=>void};
type Voice={nodes:AudioNode[];stop:(at:number)=>void};
const defaultClock:Clock={now:()=>Date.now(),setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimeout:id=>globalThis.clearTimeout(id as ReturnType<typeof setTimeout>)};
export class GenerativeMusic{
 private cfg:Config;private clock:Clock;private bus:GainNode;private timer:unknown;private rotation:unknown;private running=false;private dedicated=false;private token=0;private cursor=0;private plan?:TrackPlan;private history:string[]=[];private voices=new Set<Voice>();private currentGain?:GainNode;private trackStartAt=0;private randomSeed:number;
 constructor(private opts:MusicOptions){this.cfg={...defaultConfig,...opts.config,levels:{...defaultConfig.levels,...opts.config?.levels},quietHours:{...defaultConfig.quietHours,...opts.config?.quietHours}};this.clock=opts.clock??defaultClock;this.bus=opts.context.createGain();this.bus.connect(opts.output);this.randomSeed=this.cfg.seed;}
 start(){if(this.running)return;this.running=true;this.dedicated=false;this.token++;this.nextTrack();}
 stop(){this.running=false;this.dedicated=false;this.token++;if(this.timer!==undefined)this.clock.clearTimeout(this.timer);if(this.rotation!==undefined)this.clock.clearTimeout(this.rotation);this.timer=this.rotation=undefined;const now=this.opts.context.currentTime;for(const v of this.voices)v.stop(now);this.voices.clear();this.plan=undefined;if(this.currentGain){const old=this.currentGain;old.gain.cancelScheduledValues(now);old.gain.setValueAtTime(old.gain.value,now);old.gain.linearRampToValueAtTime(.0001,now+.12);this.clock.setTimeout(()=>old.disconnect(),160);}this.currentGain=undefined;}
 dedication(){if(this.rotation!==undefined)this.clock.clearTimeout(this.rotation);this.token++;this.running=true;this.dedicated=true;this.play(composeTrack(tunes[1],'musicbox',10,this.cfg.seed+this.history.length,this.cfg),()=>{this.dedicated=false;this.nextTrack();});}
 private hour(){try{return Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:this.cfg.timezone}).format(new Date(this.clock.now())));}catch{return new Date(this.clock.now()).getHours();}}
 private nextTrack(){if(!this.running)return;const quiet=this.hour()>=this.cfg.quietHours.start||this.hour()<this.cfg.quietHours.end,allowed=quiet?(['ballad','musicbox'] as Style[]):styles,pool=tunes.flatMap(t=>allowed.flatMap(s=>offsets.map(k=>({t,s,key:(t.key+k)%12,id:t.id+'.'+s+'.'+((t.key+k)%12)})))).filter(x=>!this.history.includes(x.id));
 if(!pool.length){this.opts.onStatus?.('No-repeat window exhausted: current quiet-hour repertoire has only 20 eligible virtual tracks.');this.rotation=this.clock.setTimeout(()=>this.nextTrack(),15000);return;}
 const r=seeded(this.randomSeed++),x=pool[Math.floor(r()*pool.length)];this.history.push(x.id);if(this.history.length>this.cfg.noRepeatWindow)this.history.shift();this.play(composeTrack(x.t,x.s,x.key,this.randomSeed++,this.cfg),()=>this.nextTrack());}
 private play(plan:TrackPlan,done:()=>void){if(!this.running)return;const ctx=this.opts.context,now=ctx.currentTime,fade=this.cfg.crossfadeSec,old=this.currentGain,gain=ctx.createGain();gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(1,now+fade);gain.connect(this.bus);if(old){old.gain.cancelScheduledValues(now);old.gain.setValueAtTime(old.gain.value,now);old.gain.linearRampToValueAtTime(.0001,now+fade);this.clock.setTimeout(()=>old.disconnect(),(fade+.12)*1000);}this.currentGain=gain;this.plan=plan;this.cursor=0;this.trackStartAt=now+.12;this.opts.onTrack?.({id:plan.id,title:plan.tune.title,style:plan.style});this.pump();this.tick();const token=this.token;this.rotation=this.clock.setTimeout(()=>{if(this.running&&token===this.token)done();},Math.max(1000,(plan.duration-fade)*1000));}
 private tick(){if(!this.running)return;this.pump();this.timer=this.clock.setTimeout(()=>this.tick(),this.cfg.tickMs);}
 private pump(){const plan=this.plan;if(!plan)return;const ctx=this.opts.context,now=ctx.currentTime,horizon=now+this.cfg.lookAheadSec;while(this.cursor<plan.events.length){const e=plan.events[this.cursor],when=this.trackStartAt+e.at;if(when>horizon)break;this.cursor++;if(when<now-.03)continue;this.voice(e,Math.max(now+.005,when));}}
 private voice(e:NoteEvent,when:number){const ctx=this.opts.context;if(this.voices.size>=this.cfg.maxVoices){const first=this.voices.values().next().value as Voice|undefined;first?.stop(when);}const f=440*Math.pow(2,(e.midi-69)/12),gain=ctx.createGain(),pan=ctx.createStereoPanner(),osc:OscillatorNode[]=[];const parts=e.instrument==='bell'?[1,.25,.1]:e.instrument==='strings'?[1,.3,.08]:e.instrument==='bass'?[1,.18,.05]:[1,.18,.05];for(let i=0;i<parts.length;i++){const o=ctx.createOscillator(),g=ctx.createGain();o.type=e.instrument==='strings'?'sawtooth':'sine';o.frequency.value=f*(i===0?1:i===1?2.01:3.98);g.gain.value=parts[i];o.connect(g);g.connect(gain);o.start(when);o.stop(when+e.duration+.08);osc.push(o);}
 const attack=e.instrument==='strings'?.25:.01,release=Math.min(.8,e.duration*.25);gain.gain.setValueAtTime(.0001,when);gain.gain.linearRampToValueAtTime(e.gain,when+attack);gain.gain.setValueAtTime(e.gain,Math.max(when+attack,when+e.duration-release));gain.gain.linearRampToValueAtTime(.0001,when+e.duration);pan.pan.value=e.pan;gain.connect(pan);pan.connect(this.currentGain??this.bus);const voice:Voice={nodes:[...osc,gain,pan],stop:(at)=>{try{gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value),at);gain.gain.linearRampToValueAtTime(.0001,at+.12);for(const o of osc)o.stop(at+.13);}catch{}}};this.voices.add(voice);osc[0].onended=()=>{for(const n of voice.nodes)try{n.disconnect()}catch{}this.voices.delete(voice);};}
 dispose(){this.stop();this.bus.disconnect();}
}
