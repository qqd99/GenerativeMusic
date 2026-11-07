import type {Clock,Config,TrackPlan} from './composer.js';
import type {Tune,Style} from './types.js';
import {composeTrack,seeded,styles,validateConfig} from './composer.js';

export type SchedulerClock=Clock;
export const systemClock:SchedulerClock={
 now:()=>Date.now(),
 setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),
 clearTimeout:id=>globalThis.clearTimeout(id as ReturnType<typeof setTimeout>)
};
export type RotationSchedulerOptions={
 catalog:Tune[]; config?:Partial<Config>; clock?:SchedulerClock;
 onTrack:(plan:TrackPlan)=>void; onStatus?:(message:string)=>void;
};
export class RotationScheduler {
 readonly config:Config;
 private readonly clock:SchedulerClock;
 private timer:unknown;
 private running=false;
 private token=0;
 private seed:number;
 private history:string[]=[];
 private active?:TrackPlan;
 private skipTuneId?:string;
 constructor(private options:RotationSchedulerOptions){
  this.config=validateConfig(options.config);
  this.clock=options.clock??systemClock;
  this.seed=this.config.seed;
 }
 get isRunning(){return this.running;}
 get recentTrackIds(){return [...this.history];}
 get currentTrack(){return this.active;}
 start(){if(this.running)return;this.running=true;this.nextTrack();}
 stop(){
  this.running=false;this.token++;
  if(this.timer!==undefined)this.clock.clearTimeout(this.timer);
  this.timer=undefined;this.active=undefined;this.skipTuneId=undefined;
 }
 transition(plan:TrackPlan){
  if(!this.running)throw new Error('Start the music before requesting a mood transition');
  this.playAndSchedule(plan);
 }
 dedication(plan:TrackPlan){
  if(this.timer!==undefined)this.clock.clearTimeout(this.timer);
  this.running=true;this.token++;this.skipTuneId=plan.tune.id;this.history.push(plan.id);if(this.history.length>this.config.noRepeatWindow)this.history.shift();this.playAndSchedule(plan,()=>this.nextTrack());
 }
 private hour(){
  const date=new Date(this.clock.now());
  try{return Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:this.config.timezone}).format(date));}
  catch{return date.getHours();}
 }
 private nextTrack(){
  if(!this.running)return;
  const h=this.hour(),q=this.config.quietHours;
  const quiet=q.start>q.end?(h>=q.start||h<q.end):(h>=q.start&&h<q.end);
  const allowed:Style[]=quiet?['ballad','musicbox','ambient']:styles;
  const candidates=this.options.catalog.flatMap(t=>allowed.flatMap(style=>
   [0,2,5,7,9].map(offset=>({t,style,key:(t.key+offset)%12,id:t.id+'.'+style+'.'+((t.key+offset)%12)}))
  )).filter(x=>!this.history.includes(x.id)&&x.t.id!==this.skipTuneId);
  if(!candidates.length){
   this.options.onStatus?.('No-repeat window exhausted; waiting for the next selection window.');
   const token=++this.token;
   this.timer=this.clock.setTimeout(()=>{if(this.running&&token===this.token)this.nextTrack();},15000);
   return;
  }
  this.skipTuneId=undefined;
  const random=seeded(this.seed++),choice=candidates[Math.floor(random()*candidates.length)];
  this.history.push(choice.id);
  if(this.history.length>this.config.noRepeatWindow)this.history.shift();
  const plan=composeTrack(choice.t,choice.style,choice.key,this.seed++,this.config);
  this.playAndSchedule(plan,()=>this.nextTrack());
 }
 private playAndSchedule(plan:TrackPlan,done:()=>void){
  if(!this.running)return;
  this.active=plan;
  if(this.timer!==undefined)this.clock.clearTimeout(this.timer);
  const token=++this.token;
  this.options.onTrack(plan);
  const wait=Math.max(1000,(plan.duration-this.config.crossfadeSec)*1000);
  this.timer=this.clock.setTimeout(()=>{if(this.running&&token===this.token)done();},wait);
 }
}
