import type {Clock,Config,TrackPlan,NoteEvent} from './composer.js';
import {composeTrack,defaultConfig,validateConfig} from './composer.js';
import {RotationScheduler,systemClock} from './scheduler.js';
import {tunes} from './catalog.js';
import type {Instrument,Style,Tune} from './types.js';

type Voice={nodes:AudioNode[];sources:AudioScheduledSourceNode[];startedAt:number;stop:(at:number)=>void};
export type MusicOptions={
 context:BaseAudioContext;output:AudioNode;config?:Partial<Config>;clock?:Clock;
 onTrack?:(p:{id:string;title:string;style:Style;key:number;bpm:number})=>void;
 onStatus?:(message:string)=>void;
};
export {tunes,defaultConfig,composeTrack,validateConfig};
export type {Config,TrackPlan,Clock,Style,Tune};

export class GenerativeMusic {
 readonly config:Config;
 private readonly clock:Clock;
 private readonly bus:GainNode;
 private readonly scheduler:RotationScheduler;
 private tickTimer:unknown;
 private running=false;
 private plan?:TrackPlan;
 private cursor=0;
 private trackStartAt=0;
 private voices=new Set<Voice>();
 private currentGain?:GainNode;
 private retiredGains=new Set<GainNode>();
 private cleanupTimers=new Set<unknown>();
 private noiseBuffer?:AudioBuffer;
 private dedicationCount=0;

 constructor(private readonly options:MusicOptions){
  this.config=validateConfig(options.config);
  this.clock=options.clock??systemClock;
  this.bus=options.context.createGain();
  this.bus.connect(options.output);
  this.scheduler=new RotationScheduler({
   catalog:tunes,config:this.config,clock:this.clock,
   onTrack:p=>this.playPlan(p),onStatus:m=>options.onStatus?.(m)
  });
 }
 start(){if(this.running)return;this.running=true;this.scheduler.start();}
 stop(){
  this.running=false;this.scheduler.stop();
  if(this.tickTimer!==undefined)this.clock.clearTimeout(this.tickTimer);
  this.tickTimer=undefined;this.plan=undefined;this.cursor=0;
  const now=this.options.context.currentTime;
  for(const voice of this.voices)voice.stop(now);
  this.voices.clear();
  for(const timer of this.cleanupTimers)this.clock.clearTimeout(timer);
  this.cleanupTimers.clear();
  for(const gain of this.retiredGains){try{gain.disconnect();}catch{}}
  this.retiredGains.clear();
  if(this.currentGain){const g=this.currentGain;this.currentGain=undefined;this.fadeAndRetire(g,now,.12);}
 }
 dedication(){
  const tune=tunes.find(t=>t.id==='silent-night')??tunes[0];
  const plan=composeTrack(tune,'musicbox',tune.key,this.config.seed+this.dedicationCount++,this.config);
  this.audition(plan);
 }
 audition(plan:TrackPlan){this.running=true;this.scheduler.dedication(plan);}
 private playPlan(plan:TrackPlan){
  if(!this.running)return;
  const ctx=this.options.context,now=ctx.currentTime,fade=this.config.crossfadeSec;
  if(this.tickTimer!==undefined)this.clock.clearTimeout(this.tickTimer);
  this.tickTimer=undefined;
  const nextGain=ctx.createGain(),old=this.currentGain;
  nextGain.gain.setValueAtTime(.0001,now);
  nextGain.gain.linearRampToValueAtTime(1,now+Math.max(.05,fade));
  nextGain.connect(this.bus);
  this.currentGain=nextGain;
  if(old)this.fadeAndRetire(old,now,Math.max(.05,fade));
  this.plan=plan;this.cursor=0;this.trackStartAt=now+.12;
  this.options.onTrack?.({id:plan.id,title:plan.tune.title,style:plan.style,key:plan.key,bpm:plan.bpm});
  this.pump();this.tick();
 }
 private fadeAndRetire(gain:GainNode,at:number,seconds:number){
  try{
   gain.gain.cancelScheduledValues(at);
   gain.gain.setValueAtTime(Math.max(.0001,gain.gain.value),at);
   gain.gain.linearRampToValueAtTime(.0001,at+seconds);
  }catch{}
  this.retiredGains.add(gain);
  const timer=this.clock.setTimeout(()=>{
   this.cleanupTimers.delete(timer);this.retiredGains.delete(gain);
   try{gain.disconnect();}catch{}
  },Math.ceil((seconds+.08)*1000));
  this.cleanupTimers.add(timer);
 }
 private tick(){
  if(!this.running)return;
  this.pump();
  this.tickTimer=this.clock.setTimeout(()=>this.tick(),this.config.tickMs);
 }
 private pump(){
  const plan=this.plan;if(!plan||!this.running)return;
  const ctx=this.options.context,now=ctx.currentTime,horizon=now+this.config.lookAheadSec;
  while(this.cursor<plan.events.length){
   const event=plan.events[this.cursor],when=this.trackStartAt+event.at;
   if(when>horizon)break;
   this.cursor++;
   if(when<now-.03)continue;
   this.createVoice(event,Math.max(now+.005,when));
  }
 }
 private getNoiseBuffer(seed:number){
  if(this.noiseBuffer)return this.noiseBuffer;
  const ctx=this.options.context,length=Math.max(1,Math.ceil(ctx.sampleRate*.2));
  const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
  let x=seed>>>0;
  for(let i=0;i<length;i++){x=(Math.imul(x,1664525)+1013904223)>>>0;data[i]=x/2147483648-1;}
  this.noiseBuffer=buffer;return buffer;
 }
 private createVoice(event:NoteEvent,when:number){
  const ctx=this.options.context;
  if(this.voices.size>=this.config.maxVoices){
   const oldest=[...this.voices].sort((a,b)=>a.startedAt-b.startedAt)[0];
   if(oldest){oldest.stop(when);this.voices.delete(oldest);}
  }
  const frequency=440*Math.pow(2,(event.midi-69)/12);
  const envelope=ctx.createGain(),pan=ctx.createStereoPanner();
  const nodes:AudioNode[]=[envelope,pan],sources:AudioScheduledSourceNode[]=[];
  const partials=event.instrument==='bell'?[1,.25,.1]:event.instrument==='strings'?[1,.3,.08]:event.instrument==='bass'?[1,.18,.05]:[1,.18,.05];
  partials.forEach((level,index)=>{
   const osc=ctx.createOscillator(),partialGain=ctx.createGain();
   osc.type=event.instrument==='strings'?'sawtooth':'sine';
   osc.frequency.value=frequency*(index===0?1:index===1?2.01:3.98);
   partialGain.gain.value=level;osc.connect(partialGain);partialGain.connect(envelope);
   osc.start(when);osc.stop(when+event.duration+.08);
   sources.push(osc);nodes.push(osc,partialGain);
  });
  if(event.instrument==='sleigh'){
   const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
   noise.buffer=this.getNoiseBuffer(event.noiseSeed);
   filter.type='highpass';filter.frequency.value=2600;filter.Q.value=.7;
   noise.connect(filter);filter.connect(envelope);noise.start(when);noise.stop(when+.13);
   sources.push(noise);nodes.push(noise,filter);
  }
  const attack=event.instrument==='strings'?.25:.012,release=Math.min(.8,event.duration*.25);
  envelope.gain.setValueAtTime(.0001,when);
  envelope.gain.linearRampToValueAtTime(event.gain,when+attack);
  envelope.gain.setValueAtTime(event.gain,Math.max(when+attack,when+event.duration-release));
  envelope.gain.linearRampToValueAtTime(.0001,when+event.duration);
  pan.pan.value=event.pan;envelope.connect(pan);pan.connect(this.currentGain??this.bus);
  let stopped=false;
  const voice:Voice={
   nodes,sources,startedAt:when,
   stop:(at:number)=>{
    if(stopped)return;stopped=true;
    const stopAt=Math.max(at,ctx.currentTime);
    try{
     envelope.gain.cancelScheduledValues(stopAt);
     envelope.gain.setValueAtTime(Math.max(.0001,envelope.gain.value),stopAt);
     envelope.gain.linearRampToValueAtTime(.0001,stopAt+.035);
    }catch{}
    for(const source of sources)try{source.stop(stopAt+.04);}catch{}
   }
  };
  this.voices.add(voice);
  sources[0].addEventListener('ended',()=>{
   this.voices.delete(voice);
   for(const node of nodes)try{node.disconnect();}catch{}
  },{once:true});
 }
 dispose(){this.stop();try{this.bus.disconnect();}catch{}}
}
